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
    var ctl = document.getElementById('c-lb'), host = document.getElementById('x-lb');
    var SETTINGS = [
      { key: 'Native streaming', label: 'Native streaming' },
      { key: 'Turn-based polling', label: 'Polling' },
      { key: 'Native Real-time Interaction System', label: 'JoyAI-VL system' },
      { key: 'Agentic Interaction System', label: 'Agentic system' },
      { key: 'Offline temporal grounding', label: 'Offline grounding' },
      { key: 'References', label: 'References' }
    ];
    var TASKS = ['Look', 'Recall', 'Time', 'Alert', 'Track', 'Commentate'];
    var COLS = [['overall', 'Overall'], ['content', 'Content'], ['timing', 'Timing'], ['silence', 'Silence']];
    var S = { off: {}, sort: 'overall', dir: -1, open: {} };
    function setting(r) { for (var i = 0; i < SETTINGS.length; i++) { if (r.family.indexOf(SETTINGS[i].key) === 0) { return SETTINGS[i]; } } return SETTINGS[5]; }
    function settingText(r) {
      var m = r.family.match(/\((.+)\)/);
      var s = setting(r);
      if (s.key === 'Agentic Interaction System' && m) { return 'Agent, ' + m[1]; }
      return s.label === 'References' ? 'Reference' : s.label;
    }
    function isRef(r) { return r.family === 'References'; }
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
      var rows = DATA.systems.map(function (r, i) { return { r: r, i: i }; }).filter(function (o) { return !S.off[setting(o.r).key]; });
      rows.sort(function (a, b) { return (a.r[S.sort] - b.r[S.sort]) * S.dir || a.i - b.i; });
      var best = {};
      COLS.forEach(function (c) {
        var vals = rows.filter(function (o) { return !isRef(o.r); }).map(function (o) { return o.r[c[0]]; });
        best[c[0]] = vals.length ? Math.max.apply(null, vals) : null;
      });
      var t = h('table', { 'class': 'ib-lb' });
      var head = '<thead><tr><th>#</th><th>System</th><th>Setting</th>' + COLS.map(function (c) {
        var s = S.sort === c[0] ? (S.dir < 0 ? 'descending' : 'ascending') : 'none';
        return '<th class="n" data-k="' + c[0] + '" aria-sort="' + s + '" tabindex="0">' + c[1] + '</th>';
      }).join('') + '</tr></thead>';
      var body = '', rank = 0;
      rows.forEach(function (o) {
        var r = o.r, ref = isRef(r);
        if (!ref) { rank += 1; }
        var open = !!S.open[o.i];
        body += '<tr class="ib-row' + (ref ? ' ib-ref' : '') + (open ? ' ib-open' : '') + '" data-i="' + o.i + '" tabindex="0" aria-expanded="' + open + '">' +
          '<td class="ib-rank">' + (ref ? '' : rank) + '</td><td class="ib-sys">' + esc(r.system) + '</td><td class="ib-set">' + esc(settingText(r)) + '</td>' +
          COLS.map(function (c) {
            var v = f1(r[c[0]]), strong = !ref && r[c[0]] === best[c[0]];
            if (c[0] === 'overall') { return '<td class="n ib-ov"><i style="width:calc((100% - 16px) * ' + (r.overall / 100).toFixed(3) + ')"></i><span>' + (strong ? '<b>' + v + '</b>' : v) + '</span></td>'; }
            return '<td class="n">' + (strong ? '<b>' + v + '</b>' : v) + '</td>';
          }).join('') + '</tr>';
        if (open) {
          body += '<tr class="ib-detail"><td colspan="7"><table class="ib-tasks"><thead><tr><th>Task</th><th class="m-acc">Acc</th><th class="m-ta">TA</th><th class="m-sc">SC</th></tr></thead><tbody>' +
            TASKS.map(function (k) { var x = r.tasks[k]; return '<tr><td>' + k + '</td><td>' + f1(x.acc) + '</td><td>' + f1(x.ta) + '</td><td>' + f1(x.sc) + '</td></tr>'; }).join('') +
            '</tbody></table></td></tr>';
        }
      });
      t.innerHTML = head + '<tbody>' + body + '</tbody>';
      host.replaceChildren(t);
      Array.prototype.forEach.call(t.querySelectorAll('th[data-k]'), function (th) {
        var go = function () { var k = th.getAttribute('data-k'); if (S.sort === k) { S.dir = -S.dir; } else { S.sort = k; S.dir = -1; } render(); };
        th.addEventListener('click', go);
        th.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      });
      Array.prototype.forEach.call(t.querySelectorAll('tr.ib-row'), function (tr) {
        var go = function () { var i = tr.getAttribute('data-i'); S.open[i] = !S.open[i]; render(); };
        tr.addEventListener('click', go);
        tr.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      });
    }
    renderers.push(render);
  })();

  renderers.forEach(function (fn) { fn(); });
  var rt = null;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { renderers.forEach(function (fn) { fn(); }); }, 150); });
})();
