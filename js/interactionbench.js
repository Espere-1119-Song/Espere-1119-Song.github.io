/* The InteractionBench project page (/projects/interactionbench/): the example step-through, the scorer and
   the leaderboard. Data: js/interactionbench-data.js. Styles: the InteractionBench block of css/custom.css. */
(function () {
  'use strict';
  var DATA = window.IB_DATA;
  var FRAMES = '/projects/interactionbench/frames/';
  var VIDS = '/projects/interactionbench/videos/';
  var root = document.getElementById('ib-page');
  if (!root || !DATA) { return; }
  var NS = 'http://www.w3.org/2000/svg';
  var renderers = [];

  function f1(v) { return v === null || v === undefined ? '–' : (Math.round(v * 10) / 10).toFixed(1); }
  function el(tag, attrs, text) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) { if (attrs[k] !== undefined && attrs[k] !== null) { e.setAttribute(k, attrs[k]); } }
    if (text !== undefined) { e.textContent = text; }
    return e;
  }
  function h(tag, attrs, html) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) { if (attrs[k] !== undefined) { e.setAttribute(k, attrs[k]); } }
    if (html !== undefined) { e.innerHTML = html; }
    return e;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function widthOf(node, min) { return Math.max(min || 260, Math.floor(node.getBoundingClientRect().width)); }

  /* ------------------------------------------------ examples: three videos, all six tasks */
  (function cases() {
    var host = document.getElementById('x-tasks');
    function clock(t) { var w = Math.floor(t); return Math.floor(w / 60) + ':' + ('0' + (w % 60)).slice(-2) + (t % 1 ? '.5' : ''); }
    DATA.cases.forEach(function (row) {
      var block = h('div', { 'class': 'ib-vblock' });
      var grid = h('div', { 'class': 'ib-grid' });
      block.appendChild(h('p', { 'class': 'ib-vhead' }, '<b>' + esc(row.group) + '</b>' + esc(row.gloss) + ' ' + esc(row.silence)));
      var vid = h('video', { 'class': 'ib-video', controls: '', playsinline: '', preload: 'metadata', poster: FRAMES + row.poster, 'aria-label': row.title });
      vid.muted = true;
      vid.appendChild(h('source', { src: VIDS + row.video, type: 'video/mp4' }));
      var vcell = h('div', { 'class': 'ib-vcell' });
      vcell.appendChild(vid);
      grid.appendChild(vcell);
      grid.appendChild(h('div', { 'class': 'ib-spacer' }));
      var chips = [], cols = [];
      row.frames.forEach(function (f, j) {
        var b = h('button', { type: 'button', 'class': 'ib-moment', 'aria-pressed': 'false', 'aria-label': 'Jump to ' + clock(f.t) }, '<b>' + clock(f.t) + '</b> · ' + esc(f.label));
        b.addEventListener('click', function () { block.classList.add('is-live'); vid.currentTime = Math.max(0, f.t - row.offset + 0.05); show(j); });
        chips.push(b);
        grid.appendChild(b);
      });
      row.tasks.forEach(function (t) {
        var asked = t.query ? 'asked at ' + t.query + ' s' : 'given at 0 s';
        grid.appendChild(h('div', { 'class': 'ib-task' }, '<b>' + esc(t.name) + '</b>' + esc(t.meaning) + '<q>' + esc(t.instruction) + '</q>' + esc(asked)));
        t.decisions.forEach(function (d, j) {
          var c = h('div', { 'class': 'ib-cell ' + (d.speak ? 'speak' : 'silent') }, esc(d.speak ? '“' + d.text + '”' : 'silent · ' + d.text));
          (cols[j] = cols[j] || []).push(c);
          grid.appendChild(c);
        });
      });
      block.appendChild(grid);
      var obs = h('p', { 'class': 'ib-obs', 'aria-live': 'polite' }, 'Play the video, or click a moment to jump to it.');
      block.appendChild(obs);
      host.appendChild(block);
      var current = null;
      function show(j) {
        if (j === current) { return; }
        current = j;
        chips.forEach(function (b, k) { b.setAttribute('aria-pressed', String(k === j)); });
        cols.forEach(function (col, k) { col.forEach(function (c) { c.classList.toggle('on', k === j); }); });
        if (j < 0) { obs.innerHTML = 'The first moment comes at <b>' + clock(row.frames[0].t) + '</b>.'; return; }
        var f = row.frames[j];
        var said = row.tasks.filter(function (t) { return t.decisions[j].speak; }).map(function (t) { return t.name; });
        var verdict = said.length ? said.join(' and ') + ' speak' + (said.length === 1 ? 's' : '') + ' here.' : 'Both tasks stay silent here.';
        obs.innerHTML = '<b>' + clock(f.t) + ' · ' + esc(f.label) + '.</b> ' + esc(f.obs) + ' ' + esc(verdict);
      }
      vid.addEventListener('play', function () { block.classList.add('is-live'); });
      vid.addEventListener('timeupdate', function () {
        if (!block.classList.contains('is-live') || vid.seeking) { return; }
        var t = vid.currentTime + row.offset, j = -1;
        row.frames.forEach(function (f, k) { if (t + 0.1 >= f.t) { j = k; } });
        show(j);
      });
    });
  })();

  /* ------------------------------------------------ scoring: the formulas */
  (function formulas() {
    // The site loads KaTeX's stylesheet and fonts; the standalone page cannot, so it asks for MathML,
    // which browsers draw without them.
    var OUTPUT = 'htmlAndMathml';
    var nodes = document.querySelectorAll('#scoring [data-tex]');
    Array.prototype.forEach.call(nodes, function (el) {
      var tex = el.getAttribute('data-tex');
      if (window.katex) {
        try { window.katex.render(tex, el, { displayMode: el.classList.contains('ib-eq'), throwOnError: false, output: OUTPUT }); return; } catch (e) { /* fall through to the source */ }
      }
      el.textContent = tex;
    });
  })();

  /* ------------------------------------------------ leaderboard */
  (function leaderboard() {
    var ctl = document.getElementById('c-lb'), host = document.getElementById('x-lb'), note = document.getElementById('n-lb');
    var SETTINGS = [
      { key: 'Native streaming', label: 'Native streaming' },
      { key: 'Turn-based polling', label: 'Polling' },
      { key: 'Native Real-time Interaction System', label: 'JoyAI-VL system' },
      { key: 'Agentic Interaction System', label: 'Agentic system' },
      { key: 'Offline temporal grounding', label: 'Offline grounding' },
      { key: 'References', label: 'References' }
    ];
    var TASKS = ['Look', 'Recall', 'Time', 'Alert', 'Track', 'Commentate'];
    var COLS = ['overall'].concat(TASKS);
    var S = { off: {}, sort: 'overall', dir: -1 };
    function value(r, k) { return k === 'overall' ? r.overall : r.tasks[k].ov; }
    function setting(r) { for (var i = 0; i < SETTINGS.length; i++) { if (r.family.indexOf(SETTINGS[i].key) === 0) { return SETTINGS[i]; } } return SETTINGS[5]; }
    function settingText(r) {
      var m = r.family.match(/\((.+)\)/);
      var s = setting(r);
      if (s.key === 'Agentic Interaction System' && m) { return 'Agent, ' + m[1]; }
      return s.label === 'References' ? 'Reference' : s.label;
    }
    function isRef(r) { return r.family === 'References'; }
    function part(cls, name, v) { return '<span><i class="' + cls + '">' + name + '</i>' + f1(v) + '</span>'; }
    function tip(r, k) {
      if (k === 'overall') {
        return '<b>' + esc(r.system) + ' · all tasks</b>' + part('t-acc', 'Content', r.content) + part('t-ta', 'Timing', r.timing) + part('t-sc', 'Silence', r.silence);
      }
      var x = r.tasks[k];
      return '<b>' + esc(r.system) + ' · ' + k + '</b>' + part('t-acc', 'Acc', x.acc) + part('t-ta', 'TA', x.ta) + part('t-sc', 'SC', x.sc);
    }
    var tipEl = h('div', { 'class': 'ib-tip', role: 'tooltip' });
    document.body.appendChild(tipEl);
    function showTip(td) {
      tipEl.innerHTML = td.getAttribute('data-tip');
      tipEl.classList.add('on');
      var c = td.getBoundingClientRect(), w = tipEl.offsetWidth, hgt = tipEl.offsetHeight;
      var x = Math.min(Math.max(8, c.left + c.width / 2 - w / 2), window.innerWidth - w - 8);
      var y = c.top - hgt - 8 < 8 ? c.bottom + 8 : c.top - hgt - 8;
      tipEl.style.left = x + 'px';
      tipEl.style.top = y + 'px';
    }
    function hideTip() { tipEl.classList.remove('on'); }
    window.addEventListener('scroll', hideTip, { passive: true });
    function controls() {
      ctl.innerHTML = '';
      SETTINGS.forEach(function (s) {
        var b = h('button', { type: 'button', 'class': 'ib-chip', 'aria-pressed': String(!S.off[s.key]) }, esc(s.label));
        b.addEventListener('click', function () { S.off[s.key] = !S.off[s.key]; render(); });
        ctl.appendChild(b);
      });
    }
    function render() {
      controls();
      hideTip();
      var rows = DATA.systems.map(function (r, i) { return { r: r, i: i }; }).filter(function (o) { return !S.off[setting(o.r).key]; });
      rows.sort(function (a, b) { return (value(a.r, S.sort) - value(b.r, S.sort)) * S.dir || a.i - b.i; });
      var best = {};
      COLS.forEach(function (k) {
        var vals = rows.filter(function (o) { return !isRef(o.r); }).map(function (o) { return value(o.r, k); });
        best[k] = vals.length ? Math.max.apply(null, vals) : null;
      });
      var t = h('table', { 'class': 'ib-lb' });
      var head = '<thead><tr><th class="n">#</th><th>System</th>' + COLS.map(function (k, j) {
        var s = S.sort === k ? (S.dir < 0 ? 'descending' : 'ascending') : 'none';
        return '<th class="n' + (j === 1 ? ' ib-sep' : '') + '" data-k="' + k + '" aria-sort="' + s + '" tabindex="0">' + (k === 'overall' ? 'Overall' : k) + '</th>';
      }).join('') + '</tr></thead>';
      var body = '', rank = 0;
      rows.forEach(function (o) {
        var r = o.r, ref = isRef(r);
        if (!ref) { rank += 1; }
        body += '<tr class="ib-row' + (ref ? ' ib-ref' : '') + '">' +
          '<td class="ib-rank">' + (ref ? '' : rank) + '</td><td class="ib-sys" data-tip="' + esc('<b>' + esc(r.system) + '</b><em>' + esc(settingText(r)) + '</em>') + '" aria-label="' + esc(r.system + ', ' + settingText(r)) + '">' + esc(r.system) + (r.credit ? '<sup>†</sup>' : '') + '</td>' +
          COLS.map(function (k, j) {
            var v = f1(value(r, k)), strong = !ref && value(r, k) === best[k];
            var tipHtml = tip(r, k), label = tipHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            return '<td class="n' + (k === 'overall' ? ' ib-ovl' : '') + (j === 1 ? ' ib-sep' : '') + '" data-tip="' + esc(tipHtml) + '" aria-label="' + esc(v + ', ' + label) + '">' +
              (strong ? '<b>' + v + '</b>' : v) + '</td>';
          }).join('') + '</tr>';
      });
      t.innerHTML = head + '<tbody>' + body + '</tbody>';
      host.replaceChildren(t);
      note.innerHTML = DATA.systems.filter(function (r) { return r.credit; }).map(function (r) {
        return '† ' + esc(r.system) + ' was evaluated with the released code and contributed by ' + esc(r.credit.by) +
          ' (<a href="' + esc(r.credit.url) + '">' + esc(r.credit.link || 'pull request') + '</a>).';
      }).join('<br>');
      Array.prototype.forEach.call(t.querySelectorAll('th[data-k]'), function (th) {
        var go = function () { var k = th.getAttribute('data-k'); if (S.sort === k) { S.dir = -S.dir; } else { S.sort = k; S.dir = -1; } render(); };
        th.addEventListener('click', go);
        th.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      });
      Array.prototype.forEach.call(t.querySelectorAll('td[data-tip]'), function (td) {
        td.addEventListener('mouseenter', function () { showTip(td); });
        td.addEventListener('mouseleave', hideTip);
        td.addEventListener('click', function () { if (tipEl.classList.contains('on') && tipEl.innerHTML === td.getAttribute('data-tip')) { hideTip(); } else { showTip(td); } });
      });
    }
    renderers.push(render);
  })();

  renderers.forEach(function (fn) { fn(); });
  var rt = null;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { renderers.forEach(function (fn) { fn(); }); }, 150); });
})();
