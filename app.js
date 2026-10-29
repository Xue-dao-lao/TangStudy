/* Tang Study: character-by-character reading and writing practice. */
(function () {
  'use strict';

  var C = null;            // content.json
  var view = document.getElementById('view');
  var INK = '#22262A', ZHU = '#B8321F', OUTLINE = '#E6DDD3';

  // ---------- storage (fails quietly in private windows) ----------
  function load(key, fallback) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  // ---------- helpers ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function rich(s) { return esc(s).replace(/\*([^*]+)\*/g, '<i>$1</i>'); }
  function el(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }
  function today() { return new Date().toISOString().slice(0, 10); }
  function released(it) { return !it.release || it.release <= today(); }
  function items() { return C.items.filter(released); }
  function scheduled() { return items().filter(function (i) { return i.week != null; }); }
  function itemById(id) { return items().filter(function (i) { return i.id === id; })[0]; }
  function titleZh(it) { return it.type === 'lesson' ? it.keys.join('，') : it.type === 'radicals' ? '部首' : it.title.zh; }
  function radicals() { return C.items.filter(function (i) { return i.type === 'radicals'; })[0]; }
  function forms(k) { var e = C.lexicon[k] || {}; return [k].concat(e.forms || []); }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  function assignedBefore(week) {
    var s = {};
    scheduled().forEach(function (it) { if (week == null || it.week < week) it.assigned.forEach(function (k) { s[k] = 1; }); });
    return s;
  }

  // ---------- 米字格 guide for writing boxes ----------
  function guideSVG(size) {
    var h = size / 2, d = 'stroke="#E3B9AE" stroke-width="1" stroke-dasharray="4 4"';
    return '<svg class="guide" width="' + size + '" height="' + size + '" aria-hidden="true">' +
      '<line x1="0" y1="' + h + '" x2="' + size + '" y2="' + h + '" ' + d + '/>' +
      '<line x1="' + h + '" y1="0" x2="' + h + '" y2="' + size + '" ' + d + '/>' +
      '<line x1="0" y1="0" x2="' + size + '" y2="' + size + '" ' + d + '/>' +
      '<line x1="' + size + '" y1="0" x2="0" y2="' + size + '" ' + d + '/></svg>';
  }
  function loader(ch, onLoad, onError) {
    fetch('strokes/' + encodeURIComponent(ch) + '.json')
      .then(function (r) { if (!r.ok) throw new Error('missing'); return r.json(); })
      .then(onLoad).catch(onError || function () {});
  }
  function makeWriter(box, ch, opts) {
    box.innerHTML = guideSVG(200) + '<div class="hw"></div>';
    var o = { width: 200, height: 200, padding: 14, strokeColor: INK, outlineColor: OUTLINE,
      drawingColor: ZHU, highlightColor: ZHU, drawingWidth: 6, charDataLoader: loader,
      strokeAnimationSpeed: 1, delayBetweenStrokes: 220 };
    for (var k in opts) o[k] = opts[k];
    return HanziWriter.create(box.querySelector('.hw'), ch, o);
  }

  // ---------- navigation ----------
  function setNav(name) {
    document.querySelectorAll('nav a').forEach(function (a) {
      if (a.getAttribute('data-nav') === name) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }
  function route() {
    document.body.classList.remove('sheet-mode');
    var h = location.hash.replace(/^#\/?/, '');
    var parts = h.split('/');
    window.scrollTo(0, 0);
    if (parts[0] === 'poem' || parts[0] === 'lesson') return renderItem(decodeURIComponent(parts[1] || ''));
    if (parts[0] === 'index') return renderIndex();
    if (parts[0] === 'radicals') return renderRadicals();
    if (parts[0] === 'sheet') return renderSheet(parts.slice(1).map(decodeURIComponent));
    if (parts[0].indexOf('cards') === 0) return renderCards();
    renderHome();
  }

  // ---------- syllabus ----------
  function itemRow(it, showChars) {
    var chars = it.assigned.join(' ');
    var right = showChars && chars ? '<div class="item-chars" lang="zh-Hant">' + esc(chars) + '<small>characters to learn</small></div>'
      : !showChars ? '<div class="item-week">' + (it.week != null ? 'Week ' + it.week : 'Not yet assigned') + '</div>' : '<div></div>';
    var en = it.type === 'lesson' ? 'Character lesson' : esc(it.title.en);
    var poet = it.type === 'lesson' ? '' : '<div class="item-poet"><span lang="zh-Hant" class="zh">' + esc(it.poet.zh) + '</span> ' + esc(it.poet.en) + '</div>';
    return '<a class="item-row" href="#/' + it.type + '/' + encodeURIComponent(it.id) + '"><div>' +
      '<div class="item-zh" lang="zh-Hant">' + esc(titleZh(it)) + '</div>' +
      '<div class="item-en">' + en + '</div>' + poet + '</div>' + right + '</a>';
  }
  function renderHome() {
    setNav('home');
    var weeks = {};
    scheduled().forEach(function (it) { (weeks[it.week] = weeks[it.week] || []).push(it); });
    var keys = Object.keys(weeks).map(Number).sort(function (a, b) { return b - a; });
    if (!keys.length) { view.innerHTML = '<p class="empty">Nothing has been assigned yet.</p>'; return; }
    view.innerHTML = keys.map(function (w) {
      return '<section class="week"><div class="week-head"><h2>Week ' + w + '</h2>' +
        '<a class="sans muted" href="#/cards?w=' + w + '">Practice this week’s characters</a>' +
        '<a class="sans muted" href="#/sheet/week/' + w + '" target="_blank">Print a writing sheet</a></div>' +
        weeks[w].map(function (it) { return itemRow(it, true); }).join('') + '</section>';
    }).join('');
  }

  function renderIndex() {
    setNav('index');
    var poems = items().filter(function (i) { return i.type === 'poem'; });
    var lessons = items().filter(function (i) { return i.type === 'lesson'; });
    function plain(x) { return x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
    poems.sort(function (a, b) { return plain(a.poet.en).localeCompare(plain(b.poet.en)) || plain(a.title.en).localeCompare(plain(b.title.en)); });
    var lastLetter = '';
    view.innerHTML =
      '<section class="index-section"><h2>Poems</h2><p class="sans muted">By poet, alphabetically.</p>' + (poems.length ? poems.map(function (i) {
        var L = plain(i.poet.en).charAt(0).toUpperCase(), head = L !== lastLetter ? '<div class="letter">' + esc(L) + '</div>' : '';
        lastLetter = L; return head + itemRow(i, false); }).join('') : '<p class="empty">No poems yet.</p>') + '</section>' +
      '<section class="index-section"><h2>Character lessons</h2>' + (lessons.length ? lessons.map(function (i) { return itemRow(i, false); }).join('') : '<p class="empty">No character lessons yet.</p>') + '</section>';
  }

  // ---------- poem or lesson page ----------
  function renderItem(id) {
    setNav('');
    var it = itemById(id);
    if (!it) { view.innerHTML = '<p class="empty">That poem isn’t available. <a href="#/">Return to the syllabus</a>.</p>'; return; }
    var now = {}; if (it.week != null) it.assigned.forEach(function (k) { now[k] = 1; });
    var past = assignedBefore(it.week);
    var lines = [];
    if (it.type === 'lesson') lines = [it.keys.map(function (k) { return { k: k, chars: k.split('') }; })];
    else it.lines.forEach(function (line) {          // one verse (句) per row, broken after each punctuation mark
      var row = [];
      line.forEach(function (t) { row.push(t); if (t.p) { lines.push(row); row = []; } });
      if (row.length) lines.push(row);
      if (lines.length) lines[lines.length - 1].end = true;
    });

    function cellMark(ch, unitKey) {
      if (now[ch] || now[unitKey]) return ' now';
      if (past[ch] || past[unitKey]) return ' past';
      return '';
    }
    var grid = lines.map(function (line) {
      return '<div class="line' + (line.end ? ' line-end' : '') + '">' + line.map(function (t) {
        if (t.p) return '';   // punctuation marks only where a verse ends; it gets no cell
        var crib = it.overrides[t.k] || (C.lexicon[t.k] ? C.lexicon[t.k].crib : '');
        return '<div class="unit' + (t.chars.length > 1 ? ' compound' : '') + '" data-k="' + esc(t.k) + '"><div class="cells">' +
          t.chars.map(function (ch) {
            return '<button class="cell' + cellMark(ch, t.k) + '" lang="zh-Hant" data-k="' + esc(t.k) + '" data-ch="' + esc(ch) +
              '" aria-pressed="false" aria-label="' + esc(ch) + '">' + esc(ch) + '</button>';
          }).join('') + '</div><div class="crib">' + rich(crib) + '</div></div>';
      }).join('') + '</div>';
    }).join('');

    var heading = it.type === 'lesson'
      ? '<div class="poem-title"><span class="zh" lang="zh-Hant">' + esc(titleZh(it)) + '</span><span class="en">Character lesson' + (it.week != null ? ', week ' + it.week : '') + '</span></div>'
      : '<div class="poem-title"><span class="zh title-zh" lang="zh-Hant">' + Array.from(it.title.zh).map(function (ch) {
          return C.lexicon[ch] ? '<button class="title-char" data-k="' + esc(ch) + '">' + esc(ch) + '</button>' : esc(ch);
        }).join('') + '</span><span class="en">' + esc(it.title.en) + '</span>' +
        '<div class="poet"><span class="zh" lang="zh-Hant">' + esc(it.poet.zh) + '</span> ' + esc(it.poet.en) + '</div></div>';

    var legend = '<div class="legend">' + (Object.keys(now).length ? '<span class="l-now">characters to learn this week</span>' : '') +
      (Object.keys(past).length ? '<span class="l-past">' + (it.week == null ? 'learned so far' : 'learned in earlier weeks') + '</span>' : '') + '</div>';

    var tr = it.translations.length ? '<section class="translations"><h3>Translations</h3><div class="tr-list">' +
      it.translations.map(function (t, i) {
        return '<button data-tr="' + i + '" aria-pressed="false">' + esc(t.translator) + ' <span class="yr">(' + esc(t.date) + ')</span></button>';
      }).join('') + '</div><div class="tr-body"><p class="muted">Choose a translator to read their version.</p></div></section>' : '';

    view.innerHTML = '<div class="poem-layout"><div class="poem-main">' + heading +
      '<div class="toolbar btn-row"><button class="btn" id="crib-toggle" aria-pressed="' + (it.type === 'lesson') + '">Show cribs</button>' +
      (it.week != null ? '<a class="btn" href="#/cards?w=' + it.week + '">Practice week ' + it.week + '</a>' : '') + '</div>' +
      '<div class="grid' + (it.type === 'lesson' ? ' show-cribs' : '') + '" id="grid">' + grid + '</div>' + legend + '</div>' +
      '<aside class="entry" id="entry" aria-live="polite"><p class="entry-placeholder">Select a character to see its meaning and stroke order.</p></aside>' + tr + '</div>';

    var gridEl = document.getElementById('grid');
    view.querySelectorAll('.title-char').forEach(function (b) {
      b.addEventListener('click', function () {
        gridEl.querySelectorAll('.cell[aria-pressed="true"]').forEach(function (c) { c.setAttribute('aria-pressed', 'false'); });
        view.querySelectorAll('.title-char.on').forEach(function (c) { c.classList.remove('on'); });
        b.classList.add('on');
        showEntry(b.getAttribute('data-k'), it);
        if (window.innerWidth <= 860) document.getElementById('entry').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
    document.getElementById('crib-toggle').addEventListener('click', function () {
      var on = gridEl.classList.toggle('show-cribs');
      this.setAttribute('aria-pressed', on);
    });
    gridEl.addEventListener('click', function (e) {
      var b = e.target.closest('button.cell');
      if (!b) return;
      gridEl.querySelectorAll('.cell[aria-pressed="true"]').forEach(function (c) { c.setAttribute('aria-pressed', 'false'); });
      view.querySelectorAll('.title-char.on').forEach(function (c) { c.classList.remove('on'); });
      var unit = b.closest('.unit');
      unit.querySelectorAll('.cell').forEach(function (c) { c.setAttribute('aria-pressed', 'true'); });
      showEntry(b.getAttribute('data-k'), it);
      if (window.innerWidth <= 860) document.getElementById('entry').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    view.querySelectorAll('[data-tr]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        view.querySelectorAll('[data-tr]').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
        btn.setAttribute('aria-pressed', 'true');
        var t = it.translations[+btn.getAttribute('data-tr')];
        view.querySelector('.tr-body').innerHTML = '<p class="tr-title">' + esc(t.title) + '</p>' +
          (t.note ? '<p class="tr-note">' + esc(t.note) + '</p>' : '') + '<p class="tr-text">' + esc(t.text) + '</p>';
      });
    });
  }

  // ---------- common radicals ----------
  function renderRadicals() {
    setNav('radicals');
    var it = radicals();
    if (!it) { view.innerHTML = '<h2>Common Radicals</h2><p class="empty">No radicals have been added yet.</p>'; return; }
    var cells = it.keys.map(function (k) {
      var e = C.lexicon[k] || {};
      return '<div class="unit radical"><div class="cells"><button class="cell" lang="zh-Hant" data-k="' + esc(k) + '" aria-pressed="false" aria-label="' + esc(k) + '">' + esc(k) + '</button>' +
        (e.forms || []).map(function (f) { return '<button class="cell form" lang="zh-Hant" data-k="' + esc(k) + '" aria-pressed="false" aria-label="' + esc(f) + '">' + esc(f) + '</button>'; }).join('') +
        '</div><div class="crib">' + rich(e.crib || '') + '</div></div>';
    }).join('');
    view.innerHTML = '<div class="poem-layout"><div class="poem-main"><div class="poem-title"><span class="zh" lang="zh-Hant">部首</span><span class="en">Common Radicals</span></div>' +
      '<p class="radicals-note">Radicals are the recurring parts from which characters are built, and a clue to their meaning. Several take a different shape when they stand at the side of a character; that form is shown beside the full one.</p>' +
      '<div class="toolbar btn-row"><a class="btn" href="#/cards?set=radicals">Practice the radicals</a><a class="btn" href="#/sheet/radicals" target="_blank">Print a writing sheet</a></div>' +
      '<div class="grid show-cribs radical-grid" id="grid">' + cells + '</div></div>' +
      '<aside class="entry" id="entry" aria-live="polite"><p class="entry-placeholder">Select a radical to see its meaning and stroke order.</p></aside></div>';
    var gridEl = document.getElementById('grid');
    gridEl.addEventListener('click', function (ev) {
      var b = ev.target.closest('button.cell'); if (!b) return;
      gridEl.querySelectorAll('.cell[aria-pressed="true"]').forEach(function (c) { c.setAttribute('aria-pressed', 'false'); });
      b.closest('.unit').querySelectorAll('.cell').forEach(function (c) { c.setAttribute('aria-pressed', 'true'); });
      showEntry(b.getAttribute('data-k'), null);
      if (b.classList.contains('form')) { var fb = document.querySelector('[data-form="' + b.textContent + '"]'); if (fb) fb.click(); }
      if (window.innerWidth <= 860) document.getElementById('entry').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // ---------- printable writing sheets ----------
  // Letter paper, 0.5in margins. Ten 0.75in boxes to a row. Up to three characters to a page, and the
  // page is always filled: spare rows are shared out as extra blank rows among the characters on it.
  var SHEET_COLS = 10, MIN_TRACE = 3, PER_PAGE = 3;
  var PAGE_IN = 9.85, HEAD_IN = 0.6, BLOCK_IN = 0.56, ROW_IN = 0.75;
  function sheetBox(paths, colors) {          // one 米字格 box, optionally holding strokes
    var g = '<svg viewBox="0 0 100 100" class="sbox" aria-hidden="true"><path d="M0 0.5H100M0.5 0V100" stroke="#B8321F" stroke-width="1" fill="none"/>' +
      '<g stroke="#E3B9AE" stroke-width="0.7" stroke-dasharray="4 4"><line x1="0" y1="50" x2="100" y2="50"/><line x1="50" y1="0" x2="50" y2="100"/>' +
      '<line x1="0" y1="0" x2="100" y2="100"/><line x1="100" y1="0" x2="0" y2="100"/></g>';
    if (paths && paths.length) {
      var k = 0.86 * 100 / 1024, off = 7;
      g += '<g transform="translate(' + off + ',' + (off + 900 * k).toFixed(2) + ') scale(' + k.toFixed(5) + ',' + (-k).toFixed(5) + ')">' +
        paths.map(function (d, i) { return '<path d="' + d + '" fill="' + colors[i] + '"/>'; }).join('') + '</g>';
    }
    return g + '</svg>';
  }
  function minRows(n) {                       // rows a character needs: sequence and tracing, then one blank row
    var left = (SHEET_COLS - n % SHEET_COLS) % SHEET_COLS;
    return Math.ceil(n / SHEET_COLS) + (left < MIN_TRACE ? 1 : 0) + 1;
  }
  function sheetBoxes(strokes, extraRows) {   // stroke sequence, tracing copies, then rows to write freely
    var n = strokes.length, boxes = [], i;
    for (i = 0; i < n; i++) boxes.push(sheetBox(strokes.slice(0, i + 1), strokes.slice(0, i + 1).map(function (_, j) { return j === i ? '#B8321F' : '#2C2C2A'; })));
    var grey = strokes.map(function () { return '#CFCBC1'; });
    var left = (SHEET_COLS - n % SHEET_COLS) % SHEET_COLS;
    for (i = 0; i < left; i++) boxes.push(sheetBox(strokes, grey));         // trace to the end of the row
    if (left < MIN_TRACE) for (i = 0; i < SHEET_COLS; i++) boxes.push(i < MIN_TRACE ? sheetBox(strokes, grey) : sheetBox());
    for (i = 0; i < SHEET_COLS * (1 + (extraRows || 0)); i++) boxes.push(sheetBox());
    return boxes.join('');
  }
  function paginate(blocks) {                 // group blocks into pages; give each its share of spare rows
    var pages = [], cur = [];
    function fits(list) {
      var rows = list.reduce(function (t, b) { return t + b.min; }, 0);
      return list.length <= PER_PAGE && HEAD_IN + list.length * BLOCK_IN + rows * ROW_IN <= PAGE_IN;
    }
    blocks.forEach(function (b) { if (cur.length && !fits(cur.concat([b]))) { pages.push(cur); cur = []; } cur.push(b); });
    if (cur.length) pages.push(cur);
    pages.forEach(function (pg) {
      var used = pg.reduce(function (t, b) { return t + b.min; }, 0);
      var spare = Math.max(0, Math.floor((PAGE_IN - HEAD_IN - pg.length * BLOCK_IN) / ROW_IN + 1e-6) - used);
      pg.forEach(function (b, i) { b.extra = Math.floor(spare / pg.length) + (i < spare % pg.length ? 1 : 0); });
    });
    return pages;
  }
  function sheetChars(args) {                 // what a sheet address asks for
    if (args[0] === 'week') {
      var w = +args[1], list = [];
      scheduled().forEach(function (i) { if (i.week === w) i.assigned.forEach(function (k) { if (k.length === 1 && list.indexOf(k) < 0) list.push(k); }); });
      return { heading: 'Week ' + w + ': characters to learn', list: list };
    }
    if (args[0] === 'radicals' && radicals()) return { heading: 'Common Radicals', list: radicals().keys.slice() };
    return { heading: 'Writing practice', list: Array.from(args[1] || '').filter(function (c) { return lexFor(c); }) };
  }
  function lexFor(c) {                        // a character's entry, or the entry it is a component form of
    if (C.lexicon[c]) return { key: c, e: C.lexicon[c] };
    for (var k in C.lexicon) if ((C.lexicon[k].forms || []).indexOf(c) >= 0) return { key: k, e: C.lexicon[k], form: true };
    return null;
  }
  function renderSheet(args) {
    setNav('');
    var req = sheetChars(args), blocks = [];
    req.list.forEach(function (c) {
      var L = lexFor(c);
      blocks.push({ ch: c, e: L.e, label: L.form ? 'as a component of ' + L.key : '' });
      if (args[0] === 'radicals') (L.e.forms || []).forEach(function (f) { blocks.push({ ch: f, e: L.e, label: 'as a component of ' + c }); });
    });
    document.body.classList.add('sheet-mode');
    view.innerHTML = '<div class="sheet"><div class="sheet-tools">' +
      '<div class="btn-row"><button class="btn primary" id="print">Print or save as PDF</button>' +
      '<form id="add-form" class="add-form"><label for="add">Add characters to this sheet</label><input id="add" lang="zh-Hant" autocomplete="off" placeholder="e.g. 山水">' +
      '<button class="btn" type="submit">Add</button></form></div><p class="add-error" id="add-error" role="alert"></p>' +
      '<p class="sans muted">Letter paper, portrait. Up to three characters a page; spare space becomes extra rows to write in.</p></div>' +
      '<div id="pages"><p class="muted">Preparing the sheet…</p></div></div>';

    function go(list) { location.hash = '#/sheet/chars/' + encodeURIComponent(list.join('')); }
    document.getElementById('print').addEventListener('click', function () { window.print(); });
    var input = document.getElementById('add'), err = document.getElementById('add-error');
    input.addEventListener('input', function () { err.textContent = ''; });
    document.getElementById('add-form').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var chars = Array.from(input.value).filter(function (c) { return /\S/.test(c) && !/[,，、;；\s]/.test(c); });
      if (!chars.length) { err.textContent = 'Type or paste a character first.'; return; }
      var bad = chars.filter(function (c) { return !lexFor(c); });
      if (bad.length) { err.textContent = 'Not yet in the course lexicon: ' + bad.join(' ') + '. Only characters with entries can be added.'; return; }
      go(blocks.map(function (b) { return b.ch; }).concat(chars));
    });

    if (!blocks.length) { document.getElementById('pages').innerHTML = '<p class="empty">No characters on this sheet yet. Add some above.</p>'; return; }
    Promise.all(blocks.map(function (b) {
      return new Promise(function (ok) { loader(b.ch, function (d) { b.strokes = d.strokes; ok(); }, function () { b.strokes = []; ok(); }); });
    })).then(function () {
      blocks.forEach(function (b) { b.min = b.strokes.length ? minRows(b.strokes.length) : 1; });
      var pages = paginate(blocks);
      document.getElementById('pages').innerHTML = pages.map(function (pg) {
        return '<div class="spage"><header class="sheet-head"><div><span class="zh" lang="zh-Hant">唐詩入門</span> ' + esc(req.heading) + '</div>' +
          '<div class="sheet-name">Name ______________________</div></header>' +
          pg.map(function (b) {
            var idx = blocks.indexOf(b);
            return '<section class="sblock"><div class="scap"><span class="scap-ch" lang="zh-Hant">' + esc(b.ch) + '</span>' +
              (b.label ? '<span class="scap-label">' + esc(b.label) + '</span>' :
                (b.e.simp ? '<span class="scap-simp" lang="zh-Hans">(' + esc(b.e.simp) + ')</span>' : '') +
                (b.e.py ? '<span class="scap-py">' + esc(b.e.py) + '</span>' : '') +
                '<span class="scap-gloss"><b>' + rich(b.e.crib || '') + '</b>' + (b.e.more ? '; ' + rich(b.e.more) : '') + '</span>') +
              '<span class="scap-n">' + (b.strokes.length ? b.strokes.length + (b.strokes.length === 1 ? ' stroke' : ' strokes') : '') + '</span>' +
              '<button class="scap-remove" data-i="' + idx + '" aria-label="Remove ' + esc(b.ch) + ' from this sheet">Remove</button></div>' +
              '<div class="sgrid">' + (b.strokes.length ? sheetBoxes(b.strokes, b.extra) : '') + '</div></section>';
          }).join('') + '</div>';
      }).join('');
      document.querySelectorAll('.scap-remove').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var i = +btn.getAttribute('data-i');
          go(blocks.filter(function (_, j) { return j !== i; }).map(function (b) { return b.ch; }));
        });
      });
    });
  }

  // ---------- dictionary entry ----------
  function showEntry(key, it) {
    var box = document.getElementById('entry');
    var e = C.lexicon[key];
    if (!e) { box.innerHTML = '<p class="entry-placeholder">No entry yet for ' + esc(key) + '.</p>'; return; }
    var here = it && it.overrides[key] ? '<p class="entry-here">In this poem: ' + rich(it.overrides[key]) + '</p>' : '';
    var links = '';
    if (key.length > 1) {
      links = '<p class="entry-links"><span class="muted">Components:</span> ' + key.split('').map(function (ch) {
        return '<a href="#" data-go="' + esc(ch) + '" lang="zh-Hant">' + esc(ch) + '</a>'; }).join('') + '</p>';
    } else if (e.compounds && e.compounds.length) {
      links = '<p class="entry-links"><span class="muted">See also:</span> ' + e.compounds.map(function (k) {
        return '<a href="#" data-go="' + esc(k) + '" lang="zh-Hant">' + esc(k) + '</a>'; }).join('') + '</p>';
    }
    var meta = e.rank ? '<p class="entry-meta">Number ' + e.rank + ' among the most frequent characters in the Complete Tang Poems (全唐詩)</p>' : '';
    var writer = key.length === 1 ? '<div class="writer-wrap">' +
      (e.simp || e.forms ? '<div class="btn-row form-switch"><button class="btn" data-form="' + esc(key) + '" aria-pressed="true">' + (e.simp ? 'Traditional ' : 'Full form ') + '<span lang="zh-Hant">' + esc(key) + '</span></button>' +
        (e.forms || []).map(function (f) { return '<button class="btn" data-form="' + esc(f) + '" aria-pressed="false">Component <span lang="zh-Hant">' + esc(f) + '</span></button>'; }).join('') +
        (e.simp ? '<button class="btn" data-form="' + esc(e.simp) + '" aria-pressed="false">Simplified <span lang="zh-Hans">' + esc(e.simp) + '</span></button>' : '') + '</div>' : '') +
      '<div class="writer"></div><div class="writer-status"></div>' +
      '<div class="btn-row"><button class="btn primary" data-act="animate">Animate strokes</button><button class="btn" data-act="quiz">Practice writing</button></div>' +
      '<p class="entry-sheet"><a href="#/sheet/chars/' + encodeURIComponent(key) + '" target="_blank">Print a writing sheet for <span lang="zh-Hant">' + esc(key) + '</span></a></p></div>' : '';

    box.innerHTML = '<div class="entry-head"><span class="entry-char" lang="zh-Hant">' + esc(key) + '</span>' +
      (e.simp ? '<span class="entry-simp" lang="zh-Hans">(' + esc(e.simp) + ')</span>' : '') +
      (e.py ? '<span class="entry-py">' + esc(e.py) + '</span>' : '') +
      (e.forms ? '<span class="entry-form">as a component <span lang="zh-Hant">' + e.forms.map(esc).join(' ') + '</span></span>' : '') + '</div>' + here +
      '<p class="entry-crib">' + rich(e.crib) + '</p>' + (e.more ? '<p class="entry-more">' + rich(e.more) + '</p>' : '') +
      meta + links + writer;

    box.querySelectorAll('[data-go]').forEach(function (a) {
      a.addEventListener('click', function (ev) { ev.preventDefault(); showEntry(a.getAttribute('data-go'), it); });
    });
    if (key.length !== 1) return;

    var wbox = box.querySelector('.writer'), status = box.querySelector('.writer-status');
    var form = key, w = makeWriter(wbox, form, {});
    function setForm(f) { form = f; w = makeWriter(wbox, f, {}); status.textContent = ''; }
    box.querySelectorAll('[data-form]').forEach(function (b) {
      b.addEventListener('click', function () {
        box.querySelectorAll('[data-form]').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', 'true'); setForm(b.getAttribute('data-form')); w.animateCharacter();   // show the new form's strokes at once
      });
    });
    box.querySelector('[data-act="animate"]').addEventListener('click', function () {
      w = makeWriter(wbox, form, {}); status.textContent = '';
      w.animateCharacter();
    });
    box.querySelector('[data-act="quiz"]').addEventListener('click', function () {
      w = makeWriter(wbox, form, { showCharacter: false });
      status.textContent = 'Write the character stroke by stroke, tracing the faint outline.';
      w.quiz({
        onMistake: function () { status.textContent = 'Not quite; try that stroke again.'; },
        onCorrectStroke: function (d) { status.textContent = 'Stroke ' + (d.strokeNum + 1) + ' of ' + (d.strokeNum + 1 + d.strokesRemaining); },
        onComplete: function (s) { status.textContent = s.totalMistakes ? 'Done, with ' + s.totalMistakes + ' slip' + (s.totalMistakes > 1 ? 's' : '') + '.' : 'Done, without a slip.'; }
      });
    });
  }

  // ---------- flashcards ----------
  function renderCards() {
    setNav('cards');
    var q = (location.hash.split('?')[1] || '');
    var wParam = (q.match(/w=(\d+)/) || [])[1];
    var weeks = []; scheduled().forEach(function (i) { if (i.assigned.length && weeks.indexOf(i.week) < 0) weeks.push(i.week); });
    weeks.sort(function (a, b) { return a - b; });
    var scope = wParam && weeks.indexOf(+wParam) >= 0 ? wParam : /set=radicals/.test(q) && radicals() ? 'radicals' : 'all';
    var mode = load('tang.mode', 'read');

    view.innerHTML = '<h2>Flashcards</h2><div class="cards-controls">' +
      '<label>Characters from <select id="scope"><option value="all">all weeks so far</option>' +
      weeks.map(function (w) { return '<option value="' + w + '"' + (String(w) === String(scope) ? ' selected' : '') + '>week ' + w + '</option>'; }).join('') +
      (radicals() ? '<option value="radicals"' + (scope === 'radicals' ? ' selected' : '') + '>common radicals</option>' : '') +
      '</select></label><div class="btn-row" role="group" aria-label="Card type">' +
      '<button class="btn" data-mode="read">Read: character to meaning</button>' +
      '<button class="btn" data-mode="write">Write: meaning to character</button></div></div>' +
      '<div id="card"></div><div class="card-count" id="count"></div>' +
      '<div class="backup">Your progress is kept in this browser only. To move it to another computer, or to keep a copy, save it to a file.' +
      '<div class="btn-row"><button class="btn" id="save-progress">Save my progress to a file</button>' +
      '<label class="btn">Load progress from a file<input type="file" id="load-progress" accept="application/json" hidden></label></div></div>';

    // Separate records for reading and writing: knowing a meaning is not knowing how to write it.
    function shape(pr) {
      pr = pr || {};
      if (pr.read || pr.write) return { read: pr.read || {}, write: pr.write || {} };
      return { read: JSON.parse(JSON.stringify(pr)), write: pr };   // older single record: copy to both
    }
    var progress = shape(load('tang.progress', {}));
    var deck = [], cur = null, round = { right: 0, missed: 0 };
    function rec() { return progress[mode]; }

    function keysInScope() {
      var s = {};
      if (scope === 'radicals') return radicals().keys.filter(function (k) { return C.lexicon[k]; });
      scheduled().forEach(function (i) { if (scope === 'all' || String(i.week) === String(scope)) i.assigned.forEach(function (k) { s[k] = 1; }); });
      return Object.keys(s).filter(function (k) { return C.lexicon[k] && (mode === 'read' || k.length === 1); });
    }
    function build() {
      var ks = shuffle(keysInScope());
      ks.sort(function (a, b) { return ((rec()[a] || {}).box || 0) - ((rec()[b] || {}).box || 0); });
      deck = ks; round = { right: 0, missed: 0 };
      next();
    }
    function grade(ok) {
      var p = rec()[cur] || { box: 0 };
      p.box = ok ? Math.min((p.box || 0) + 1, 5) : 0;
      p.seen = today(); rec()[cur] = p; save('tang.progress', progress);
      if (ok) round.right++; else round.missed++;
      if (!ok) deck.splice(Math.min(3, deck.length), 0, cur);
      next();
    }
    function counts() {
      var ks = keysInScope(), known = ks.filter(function (k) { return (rec()[k] || {}).box >= 3; }).length;
      var verb = mode === 'read' ? 'read' : 'written';
      document.getElementById('count').innerHTML = 'This round: ' + round.right + ' right, ' + round.missed + ' to review.<br>' +
        known + ' of ' + ks.length + ' ' + (ks.length === 1 ? 'character' : 'characters') + ' ' + verb + ' correctly three times running.';
    }
    function next() {
      counts();
      var card = document.getElementById('card');
      if (!deck.length) {
        card.innerHTML = keysInScope().length
          ? '<div class="card"><p class="card-prompt">You’ve gone through every card.</p><div class="btn-row"><button class="btn primary" id="again">Go through them again</button></div></div>'
          : '<div class="card"><p class="card-prompt">No characters have been assigned for this selection yet.</p></div>';
        var a = document.getElementById('again'); if (a) a.addEventListener('click', build);
        return;
      }
      cur = deck.shift();
      var e = C.lexicon[cur];
      if (mode === 'read') {
        card.innerHTML = '<div class="card"><div class="card-char" lang="zh-Hant">' + forms(cur).map(esc).join('<span class="card-sep"> </span>') + '</div>' +
          '<div class="card-answer" id="ans"></div><div class="btn-row" id="acts"><button class="btn primary" id="reveal">Show meaning</button></div></div>';
        document.getElementById('reveal').addEventListener('click', function () {
          document.getElementById('ans').innerHTML = (e.simp ? '<p class="muted">simplified <span lang="zh-Hans" class="zh">' + esc(e.simp) + '</span></p>' : '') +
            (e.py ? '<p class="card-py">' + esc(e.py) + '</p>' : '') + '<p class="card-prompt">' + rich(e.crib) + '</p>' + (e.more ? '<p class="muted">' + rich(e.more) + '</p>' : '');
          var acts = document.getElementById('acts');
          acts.innerHTML = '<button class="btn" id="miss">I didn’t know it</button><button class="btn primary" id="hit">I knew it</button>';
          document.getElementById('miss').addEventListener('click', function () { grade(false); });
          document.getElementById('hit').addEventListener('click', function () { grade(true); });
          document.getElementById('hit').focus();
        });
      } else {
        card.innerHTML = '<div class="card"><p class="card-prompt">' + rich(e.crib) + '</p>' + (e.more ? '<p class="muted">' + rich(e.more) + '</p>' : '') +
          '<div class="writer"></div><div class="writer-status" id="st">Write the character, stroke by stroke.</div>' +
          '<div class="btn-row" id="acts"><button class="btn" id="hint">Show me</button><button class="btn" id="skip">Skip</button></div></div>';
        var st = document.getElementById('st');
        var w = makeWriter(card.querySelector('.writer'), cur, { showCharacter: false, showOutline: false, showHintAfterMisses: 3 });
        w.quiz({
          onMistake: function () { st.textContent = 'Not quite; try that stroke again.'; },
          onCorrectStroke: function (d) { st.textContent = 'Stroke ' + (d.strokeNum + 1) + ' of ' + (d.strokeNum + 1 + d.strokesRemaining); },
          onComplete: function (s) {
            var ok = s.totalMistakes <= 2;
            st.innerHTML = (ok ? 'Correct' : 'Finished, with ' + s.totalMistakes + ' slips') + ': <span lang="zh-Hant" class="zh">' + esc(cur) + '</span>' + (e.simp ? ' (<span lang="zh-Hans" class="zh">' + esc(e.simp) + '</span>)' : '');
            document.getElementById('acts').innerHTML = '<button class="btn primary" id="nx">Next card</button>';
            document.getElementById('nx').addEventListener('click', function () { grade(ok); });
            document.getElementById('nx').focus();
          }
        });
        document.getElementById('hint').addEventListener('click', function () {
          w.cancelQuiz(); w.showCharacter(); w.animateCharacter();
          st.textContent = 'Watch the strokes, then try it next time round.';
          document.getElementById('acts').innerHTML = '<button class="btn primary" id="nx">Next card</button>';
          document.getElementById('nx').addEventListener('click', function () { grade(false); });
        });
        document.getElementById('skip').addEventListener('click', function () { w.cancelQuiz(); deck.push(cur); next(); });
      }
    }

    view.querySelectorAll('[data-mode]').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-mode') === mode);
      b.addEventListener('click', function () {
        mode = b.getAttribute('data-mode'); save('tang.mode', mode);
        view.querySelectorAll('[data-mode]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
        build();
      });
    });
    document.getElementById('scope').addEventListener('change', function () { scope = this.value; build(); });
    document.getElementById('save-progress').addEventListener('click', function () {
      var blob = new Blob([JSON.stringify({ progress: load('tang.progress', {}), saved: today() }, null, 1)], { type: 'application/json' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'tang-study-progress-' + today() + '.json';
      document.body.appendChild(a); a.click(); a.remove();
    });
    document.getElementById('load-progress').addEventListener('change', function () {
      var f = this.files[0]; if (!f) return;
      f.text().then(function (txt) {
        var d = JSON.parse(txt);
        if (!d.progress) throw new Error('bad file');
        progress = shape(d.progress); save('tang.progress', progress); build();
        alert('Progress loaded.');
      }).catch(function () { alert('That file doesn’t contain saved progress from this app.'); });
    });
    build();
  }

  // ---------- new-material notice ----------
  function checkNew() {
    var ids = items().map(function (i) { return i.id; });
    var seen = load('tang.seen', null);
    save('tang.seen', ids);
    if (!seen) return;
    var fresh = items().filter(function (i) { return seen.indexOf(i.id) < 0; });
    if (!fresh.length) return;
    var n = document.getElementById('notice');
    n.innerHTML = '<span>New since your last visit: ' + fresh.map(function (i) {
      return '<a href="#/' + i.type + '/' + encodeURIComponent(i.id) + '"><span lang="zh-Hant" class="zh">' + esc(titleZh(i)) + '</span>' +
        (i.type === 'poem' ? ' ' + esc(i.title.en) : '') + '</a>'; }).join(', ') + '</span><button aria-label="Dismiss">Dismiss</button>';
    n.hidden = false;
    n.querySelector('button').addEventListener('click', function () { n.hidden = true; });
  }

  // ---------- start ----------
  fetch('data/content.json', { cache: 'no-cache' })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      C = data;
      checkNew();
      window.addEventListener('hashchange', route);
      route();
    })
    .catch(function () {
      view.innerHTML = '<p class="empty">The course material couldn’t be loaded. Check your connection and reload the page.</p>';
    });

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();
