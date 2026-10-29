#!/usr/bin/env python3
"""Build the study app's data from the plain-text sources.

Reads  source/lexicon.txt, source/items/*.txt, source/tang_char_freq.txt
Writes data/content.json, strokes/<char>.json, fonts/kai-*.woff2, fonts/kai.css

Usage:
  python3 tools/build.py --strokes <hanzi-writer-data dir> --font <tw-kai package dir>
"""
import argparse, json, os, re, shutil, sys, glob, hashlib
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CJK = re.compile('[\u2e80-\u2fdf\u3400-\u9fff\uf900-\ufaff\U00020000-\U0003ffff]')
VARIANTS = {'爲': '為', '羣': '群', '疎': '疏'}  # frequency-list forms -> standard forms

def is_heading(line):
    s = line.strip()
    return s == s.upper() and not CJK.search(s) and not s.startswith('+')

ENTRY = re.compile(r'^(\+?)\s*([^\s,(（]+)\s*(?:[(（]([^)）]+)[)）])?\s*([^,(（]*?)\s*,\s*(.+?)\s*$')
TRAIL = re.compile(r'\s+(#\d+|—|-)\s*$')

def parse_entry(line):
    line = TRAIL.sub('', line.rstrip())
    m = ENTRY.match(line)
    if not m:
        return None
    plus, key, simp, py, gloss = m.groups()
    key, *forms = [k for k in key.split('/') if k]   # 手/扌: 扌 is the form used as a component
    crib, _, more = gloss.partition(';')
    return {'key': key, 'forms': forms or None, 'simp': (simp or '').strip() or None, 'py': (py or '').strip() or None,
            'crib': crib.strip(), 'more': more.strip() or None,
            'assigned': plus == '+'}

def load_lexicon(path):
    lex = {}
    for line in open(path, encoding='utf-8'):
        if not line.strip() or not CJK.match(line.lstrip('+ ')[:1] or ' '):
            continue
        e = parse_entry(line)
        if e:
            lex[e['key']] = {k: e[k] for k in ('simp', 'py', 'crib', 'more', 'forms')}
    return lex

TOP_N = 300   # length of the Top 300 page; raise to 500 to show the whole frequency list

def load_top(path, n):
    out = []
    for m in re.finditer(r'(\d+)\.\s+(\S)\s+\(([\d,]+)\)', open(path, encoding='utf-8').read()):
        if int(m.group(1)) <= n:
            out.append({'rank': int(m.group(1)), 'ch': VARIANTS.get(m.group(2), m.group(2)),
                        'count': int(m.group(3).replace(',', ''))})
    return out

def load_ranks(path):
    ranks = {}
    for m in re.finditer(r'(\d+)\.\s+(\S)\s+\(', open(path, encoding='utf-8').read()):
        ch = VARIANTS.get(m.group(2), m.group(2))
        ranks.setdefault(ch, int(m.group(1)))
    return ranks

def tokenize(text):
    """Turn '床前[明月]光，' into tokens; brackets mark compounds."""
    toks, i = [], 0
    while i < len(text):
        c = text[i]
        if c == '[':
            j = text.index(']', i)
            chars = [ch for ch in text[i + 1:j] if CJK.match(ch)]
            toks.append({'k': ''.join(chars), 'chars': chars})
            i = j + 1
        elif CJK.match(c):
            toks.append({'k': c, 'chars': [c]})
            i += 1
        elif c.strip():
            toks.append({'p': c})
            i += 1
        else:
            i += 1
    return toks

def parse_item(path):
    item = {'translations': [], 'lines': [], 'entries': [], 'source': os.path.basename(path)}
    section, tr = None, None
    for raw in open(path, encoding='utf-8'):
        line = raw.rstrip('\n')
        s = line.strip()
        if s in ('POEM', 'LESSON', 'RADICALS'):
            item['type'] = s.lower(); section = 'head'; continue
        if s in ('LEXICON', 'COMPOUNDS', 'TRANSLATIONS', 'CHARACTERS'):
            section = s.lower(); continue
        if section == 'translations':
            if s.startswith('=='):
                parts = [p.strip() for p in s[2:].split('|')]
                tr = {'translator': parts[0], 'title': parts[1] if len(parts) > 1 else '',
                      'date': parts[2] if len(parts) > 2 else '', 'note': None, 'lines': []}
                item['translations'].append(tr)
            elif tr is not None:
                if s.lower().startswith('note:') and not tr['lines']:
                    tr['note'] = s[5:].strip()
                else:
                    tr['lines'].append(line.rstrip())
            continue
        if not s:
            continue
        if section == 'head':
            m = re.match(r'^(\w+):\s*(.*)$', s)
            if m and not CJK.match(s[0]):
                item[m.group(1).lower()] = m.group(2).strip()
            elif CJK.search(s):
                item['lines'].append(tokenize(s))
        elif section in ('lexicon', 'compounds', 'characters'):
            e = parse_entry(s)
            if e:
                item['entries'].append(e)
    for tr in item['translations']:
        while tr['lines'] and not tr['lines'][-1].strip():
            tr['lines'].pop()
        tr['text'] = '\n'.join(tr.pop('lines'))
    return item

def split_names(field):
    """'李白 Li Bai' -> ('李白', 'Li Bai'); '靜夜思 / Quiet Night Thoughts' likewise."""
    if not field:
        return {'zh': '', 'en': ''}
    if '/' in field:
        a, b = [x.strip() for x in field.split('/', 1)]
        return {'zh': a, 'en': b} if CJK.search(a) else {'zh': b, 'en': a}
    zh = ''.join(t for t in re.findall(r'[㐀-鿿]+', field))
    en = CJK.sub('', field).strip()
    return {'zh': zh, 'en': en}

# Component forms missing from the stroke data, taken from a character that contains them.
DERIVED = {'\u2eca': ('\u8def', range(7))}   # the foot component, from 路

def derive_component(host_path, strokes, out_path):
    """Cut a component's strokes out of a host character and enlarge them to fill the box."""
    d = json.load(open(host_path, encoding='utf-8'))
    paths = [d['strokes'][i] for i in strokes]
    meds = [d['medians'][i] for i in strokes]
    num = r'-?\d+(?:\.\d+)?'
    nums = [float(x) for p in paths for x in re.findall(num, p)]
    xs, ys = nums[0::2], nums[1::2]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    k = 860 / max(x1 - x0, y1 - y0)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    def tx(x): return round(512 + (x - cx) * k)
    def ty(y): return round(388 + (y - cy) * k)      # 388 = centre of the glyph box, whose y runs from 900 to -124
    def move(path):
        out, n = [], 0
        for tok in re.split('(' + num + ')', path):
            if re.fullmatch(num, tok):
                out.append(str(tx(float(tok)) if n % 2 == 0 else ty(float(tok)))); n += 1
            else:
                out.append(tok)
        return ''.join(out)
    json.dump({'strokes': [move(p) for p in paths],
               'medians': [[[tx(x), ty(y)] for x, y in m] for m in meds]},
              open(out_path, 'w', encoding='utf-8'), ensure_ascii=False)

# Stroke data drawn in a variant form, rebuilt in the standard form the course uses.
def standard_wei(src_path, out_path, dot_dx=-120, dot_dy=5, top=815):
    """The data draws 為 as 爲 (爫 on top, 12 strokes). Rebuild the standard 9-stroke 為: a dot, then the
    lower strokes of 爲 (丿, 𠃍, 一, 𠃌, 灬) stretched upward to fill the space the 爫 occupied."""
    d = json.load(open(src_path, encoding='utf-8'))
    num = r'-?\d+(?:\.\d+)?'
    def pts(p):
        v = [float(x) for x in re.findall(num, p)]
        return list(zip(v[0::2], v[1::2]))
    def move(path, f):
        out, pair = [], []
        for t in re.split('(' + num + ')', path):
            if re.fullmatch(num, t):
                pair.append(float(t))
                if len(pair) == 2:
                    x, y = f(*pair); out.append(f'{round(x)} {round(y)}'); pair = []
            else:
                out.append(t)
        return ''.join(out)
    lower = range(4, 12)
    ys = [y for i in lower for _, y in pts(d['strokes'][i])]
    ytop, ybot = max(ys), min(ys)
    k = (top - ybot) / (ytop - ybot)
    def fl(x, y): return x, ybot + (y - ybot) * k
    dp = pts(d['strokes'][1]); cx = sum(p[0] for p in dp) / len(dp); cy = sum(p[1] for p in dp) / len(dp)
    sx, sy = fl(*d['medians'][4][0])                       # where the 丿 now begins
    def fd(x, y): return x - cx + sx + dot_dx, y - cy + sy + dot_dy
    strokes = [move(d['strokes'][1], fd)] + [move(d['strokes'][i], fl) for i in lower]
    medians = [[[round(v) for v in fd(*m)] for m in d['medians'][1]]] + \
              [[[round(v) for v in fl(*m)] for m in d['medians'][i]] for i in lower]
    json.dump({'strokes': strokes, 'medians': medians}, open(out_path, 'w', encoding='utf-8'), ensure_ascii=False)

REBUILT = {'\u70ba': standard_wei}   # 為

def font_ranges(css_path):
    css = open(css_path, encoding='utf-8').read()
    out = []
    for block in re.findall(r'@font-face\s*{(.*?)}', css, re.S):
        src = re.search(r'url\("?\.?/?([^")]+)"?\)', block).group(1)
        cps = set()
        for part in re.search(r'unicode-range:\s*([^;]+);', block).group(1).split(','):
            part = part.strip()[2:]
            if '-' in part:
                a, b = part.split('-'); cps.update(range(int(a, 16), int(b, 16) + 1))
            else:
                cps.add(int(part, 16))
        out.append((src, cps))
    return out

def build_fonts(font_dir, chars, out_dir):
    from fontTools import subset
    from fontTools.ttLib import TTFont
    os.makedirs(out_dir, exist_ok=True)
    for f in glob.glob(os.path.join(out_dir, 'kai-*.woff2')):
        os.remove(f)
    wanted = {ord(c) for c in chars}
    groups = defaultdict(set)
    for src, cps in font_ranges(os.path.join(font_dir, 'tw-kai.css')):
        hit = wanted & cps
        if hit:
            groups[src] |= hit
            wanted -= hit
    rules = []
    for n, (src, cps) in enumerate(sorted(groups.items())):
        font = TTFont(os.path.join(font_dir, src))
        opts = subset.Options(); opts.flavor = 'woff2'; opts.layout_features = []
        sub = subset.Subsetter(opts); sub.populate(unicodes=cps); sub.subset(font)
        h = hashlib.sha1(''.join(sorted(map(chr, cps))).encode()).hexdigest()[:8]
        name = f'kai-{h}.woff2'
        font.flavor = 'woff2'; font.save(os.path.join(out_dir, name))
        rng = ','.join(f'U+{c:X}' for c in sorted(cps))
        rules.append('@font-face{font-family:"TW-Kai";font-display:swap;'
                     f'src:url("{name}") format("woff2");unicode-range:{rng};}}')
    shutil.copy(os.path.join(font_dir, 'LICENSE-OFL.txt'), os.path.join(out_dir, 'LICENSE-OFL.txt'))
    open(os.path.join(out_dir, 'kai.css'), 'w', encoding='utf-8').write('\n'.join(rules) + '\n')
    return sorted(chr(c) for c in wanted)  # characters the font lacks

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--strokes', required=True, help='hanzi-writer-data package directory')
    ap.add_argument('--font', required=True, help='TW-Kai web font package directory')
    a = ap.parse_args()

    lex = load_lexicon(os.path.join(ROOT, 'source', 'lexicon.txt'))
    ranks = load_ranks(os.path.join(ROOT, 'source', 'tang_char_freq.txt'))
    problems = []
    items = []
    for path in sorted(glob.glob(os.path.join(ROOT, 'source', 'items', '*.txt'))):
        it = parse_item(path)
        overrides, assigned = {}, []
        for e in it['entries']:
            if e['assigned']:
                assigned.append(e['key'])
            master = lex.get(e['key'])
            if master is None:
                problems.append(f"{it['source']}: {e['key']} is not in the master lexicon")
            elif e['crib'] != master['crib']:
                overrides[e['key']] = e['crib']
                if e['crib'] not in (master['more'] or ''):
                    problems.append(f"{it['source']}: override for {e['key']} ('{e['crib']}') "
                                    f"is not among its additional glosses")
        for ch in (split_names(it.get('title'))['zh'] if it.get('type') == 'poem' else ''):
            if CJK.match(ch) and ch not in lex:
                problems.append(f"{it['source']}: title character {ch} has no entry (it won't be clickable)")
        for line in it['lines']:
            for t in line:
                if 'k' in t and t['k'] not in lex:
                    problems.append(f"{it['source']}: {t['k']} appears in the text but has no entry")
                for ch in t.get('chars', []):
                    if ch not in lex:
                        problems.append(f"{it['source']}: character {ch} has no entry")
        items.append({
            'id': it.get('id') or os.path.splitext(it['source'])[0],
            'type': it.get('type', 'poem'),
            'week': int(it['week']) if str(it.get('week', '')).strip().isdigit() else None,  # None = not yet scheduled
            'release': it.get('release'),
            'poet': split_names(it.get('poet')),
            'title': split_names(it.get('title')),
            'lines': it['lines'],
            'keys': [e['key'] for e in it['entries']],
            'assigned': assigned,
            'overrides': overrides,
            'translations': it['translations'],
        })
    items.sort(key=lambda x: (x['week'] is None, x['week'] or 0, x['type'] != 'lesson', x['id']))

    # Pinyin: from the lexicon line; a missing reading is filled in (most common reading) and reported
    try:
        from pypinyin import pinyin as _py, Style as _St
    except ImportError:
        _py = None
    for k, v in lex.items():
        if not v.get('py') and _py:
            v['py'] = ''.join(p[0] for p in _py(k, style=_St.TONE))
            problems.append(f'no pinyin given for {k}; using {v["py"]}')

    # Lexicon with ranks and computed "see also" links
    out_lex = {}
    for k, v in lex.items():
        e = dict(v)
        if len(k) == 1 and k in ranks:
            e['rank'] = ranks[k]
        if len(k) == 1:
            e['compounds'] = sorted(c for c in lex if len(c) > 1 and k in c)
        out_lex[k] = e

    # Characters needing stroke data and font glyphs
    stroke_chars = set()
    for k, v in lex.items():
        stroke_chars.update(ch for ch in k if CJK.match(ch))
        for f in v.get('forms') or []:
            stroke_chars.update(ch for ch in f if CJK.match(ch))
        if v['simp']:
            stroke_chars.update(ch for ch in v['simp'] if CJK.match(ch))
    font_chars = set(stroke_chars)
    for it in items:
        for f in (it['poet']['zh'], it['title']['zh']):
            font_chars.update(ch for ch in f if CJK.match(ch))
        for line in it['lines']:
            for t in line:
                font_chars.update(t.get('chars', [])); font_chars.update(t.get('p', ''))
    font_chars.update('，。、；：？！「」『』（）')
    font_chars.update('唐詩識字常用字部首')  # the app's own headings
    top = load_top(os.path.join(ROOT, 'source', 'tang_char_freq.txt'), TOP_N)
    font_chars.update(t['ch'] for t in top)

    sdir = os.path.join(ROOT, 'strokes')
    os.makedirs(sdir, exist_ok=True)
    for ch in sorted(stroke_chars):
        src = os.path.join(a.strokes, ch + '.json')
        if ch in REBUILT and os.path.exists(src):
            REBUILT[ch](src, os.path.join(sdir, ch + '.json'))
        elif os.path.exists(src):
            shutil.copy(src, os.path.join(sdir, ch + '.json'))
        elif ch in DERIVED:
            host, strokes = DERIVED[ch]
            derive_component(os.path.join(a.strokes, host + '.json'), strokes, os.path.join(sdir, ch + '.json'))
            problems.append(f'stroke data for {ch} derived from the first {len(strokes)} strokes of {host}')
        else:
            problems.append(f'no stroke data for {ch}')

    missing_glyphs = build_fonts(a.font, font_chars, os.path.join(ROOT, 'fonts'))
    missing_glyphs = [c for c in missing_glyphs if CJK.match(c)]
    if missing_glyphs:
        problems.append('TW-Kai lacks glyphs (fallback font used): ' + ''.join(missing_glyphs))

    content = {'lexicon': out_lex, 'items': items, 'top': top}
    blob = json.dumps(content, ensure_ascii=False, sort_keys=True)
    content['version'] = hashlib.sha1(blob.encode()).hexdigest()[:10]
    os.makedirs(os.path.join(ROOT, 'data'), exist_ok=True)
    with open(os.path.join(ROOT, 'data', 'content.json'), 'w', encoding='utf-8') as f:
        json.dump(content, f, ensure_ascii=False, indent=1)

    # Stamp the page's script and stylesheet links so browsers fetch new versions at once.
    ipath = os.path.join(ROOT, 'index.html')
    page = open(ipath, encoding='utf-8').read()
    for name in ('app.js', 'style.css', 'fonts/kai.css'):
        h = hashlib.sha1(open(os.path.join(ROOT, name), 'rb').read()).hexdigest()[:8]
        page = re.sub(r'(["\'])' + re.escape(name) + r'(\?v=[0-9a-f]+)?\1', r'\g<1>' + name + '?v=' + h + r'\1', page)
    open(ipath, 'w', encoding='utf-8').write(page)

    print(f"{len(items)} item(s), {len(lex)} lexicon entries, {len(stroke_chars)} stroke files, "
          f"version {content['version']}")
    for p in problems:
        print('NOTE:', p)

if __name__ == '__main__':
    main()
