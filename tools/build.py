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
CJK = re.compile(r'[㐀-鿿豈-﫿\U00020000-\U0003ffff]')
VARIANTS = {'爲': '為', '羣': '群', '疎': '疏'}  # frequency-list forms -> standard forms

def is_heading(line):
    s = line.strip()
    return s == s.upper() and not CJK.search(s) and not s.startswith('+')

ENTRY = re.compile(r'^(\+?)\s*([^\s,(（]+)\s*(?:[(（]([^)）]+)[)）])?\s*,\s*(.+?)\s*$')
TRAIL = re.compile(r'\s+(#\d+|—|-)\s*$')

def parse_entry(line):
    line = TRAIL.sub('', line.rstrip())
    m = ENTRY.match(line)
    if not m:
        return None
    plus, key, simp, gloss = m.groups()
    crib, _, more = gloss.partition(';')
    return {'key': key, 'simp': (simp or '').strip() or None,
            'crib': crib.strip(), 'more': more.strip() or None,
            'assigned': plus == '+'}

def load_lexicon(path):
    lex = {}
    for line in open(path, encoding='utf-8'):
        if not line.strip() or not CJK.match(line.lstrip('+ ')[:1] or ' '):
            continue
        e = parse_entry(line)
        if e:
            lex[e['key']] = {k: e[k] for k in ('simp', 'crib', 'more')}
    return lex

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
        if s in ('POEM', 'LESSON'):
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
            'week': int(it.get('week', 0) or 0),
            'release': it.get('release'),
            'poet': split_names(it.get('poet')),
            'title': split_names(it.get('title')),
            'lines': it['lines'],
            'keys': [e['key'] for e in it['entries']],
            'assigned': assigned,
            'overrides': overrides,
            'translations': it['translations'],
        })
    items.sort(key=lambda x: (x['week'], x['type'] != 'lesson', x['id']))

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

    sdir = os.path.join(ROOT, 'strokes')
    os.makedirs(sdir, exist_ok=True)
    for ch in sorted(stroke_chars):
        src = os.path.join(a.strokes, ch + '.json')
        if os.path.exists(src):
            shutil.copy(src, os.path.join(sdir, ch + '.json'))
        else:
            problems.append(f'no stroke data for {ch}')

    missing_glyphs = build_fonts(a.font, font_chars, os.path.join(ROOT, 'fonts'))
    missing_glyphs = [c for c in missing_glyphs if CJK.match(c)]
    if missing_glyphs:
        problems.append('TW-Kai lacks glyphs (fallback font used): ' + ''.join(missing_glyphs))

    content = {'lexicon': out_lex, 'items': items}
    blob = json.dumps(content, ensure_ascii=False, sort_keys=True)
    content['version'] = hashlib.sha1(blob.encode()).hexdigest()[:10]
    os.makedirs(os.path.join(ROOT, 'data'), exist_ok=True)
    with open(os.path.join(ROOT, 'data', 'content.json'), 'w', encoding='utf-8') as f:
        json.dump(content, f, ensure_ascii=False, indent=1)

    print(f"{len(items)} item(s), {len(lex)} lexicon entries, {len(stroke_chars)} stroke files, "
          f"version {content['version']}")
    for p in problems:
        print('NOTE:', p)

if __name__ == '__main__':
    main()
