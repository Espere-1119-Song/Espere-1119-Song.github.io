/* The InteractionBench project page (/projects/interactionbench/): the example step-through, the scorer and
   the leaderboard. Data: js/interactionbench-data.js. Styles: the InteractionBench block of css/custom.css. */
(function () {
  'use strict';
  var DATA = window.IB_DATA;
  var FRAMES = '/projects/interactionbench/frames/';
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

  /* ------------------------------------------------ examples: step through the frames */
  (function cases() {
    var host = document.getElementById('x-tasks');
    var state = { row: 1, frame: 2, timer: null };
    function clock(s) { var t = Math.floor(s); return Math.floor(t / 60) + ':' + ('0' + (t % 60)).slice(-2) + (s % 1 ? '.5' : ''); }
    function stop() { if (state.timer) { clearInterval(state.timer); state.timer = null; } }
    function render() {
      var row = DATA.cases[state.row];
      host.innerHTML = '';
      var top = h('div', { 'class': 'ib-controls' });
      var seg = h('div', { 'class': 'ib-seg ib-seg--plain', role: 'group', 'aria-label': 'Video' });
      DATA.cases.forEach(function (r, i) {
        var b = h('button', { type: 'button', 'aria-pressed': String(i === state.row) }, esc(r.group));
        b.addEventListener('click', function () { stop(); state.row = i; state.frame = 0; render(); });
        seg.appendChild(b);
      });
      top.appendChild(seg);
      var nav = h('div', { 'class': 'ib-seg', role: 'group', 'aria-label': 'Step' });
      var prev = h('button', { type: 'button', 'aria-label': 'Previous frame' }, '◀');
      var play = h('button', { type: 'button' }, state.timer ? 'Pause' : 'Play');
      var next = h('button', { type: 'button', 'aria-label': 'Next frame' }, '▶');
      prev.addEventListener('click', function () { stop(); state.frame = (state.frame + 3) % 4; render(); });
      next.addEventListener('click', function () { stop(); state.frame = (state.frame + 1) % 4; render(); });
      play.addEventListener('click', function () {
        if (state.timer) { stop(); render(); return; }
        if (state.frame === 3) { state.frame = 0; }
        state.timer = setInterval(function () {
          if (state.frame >= 3) { stop(); } else { state.frame += 1; }
          render();
        }, 1700);
        render();
      });
      nav.appendChild(prev); nav.appendChild(play); nav.appendChild(next);
      top.appendChild(nav);
      host.appendChild(top);
      var grid = h('div', { 'class': 'ib-grid' });
      grid.appendChild(h('div', { 'class': 'ib-task ib-spacer' }, '<b>' + esc(row.group) + '</b>' + esc(row.gloss) + ' ' + esc(row.silence)));
      row.frames.forEach(function (f, j) {
        var b = h('button', { type: 'button', 'class': 'ib-frame', 'aria-pressed': String(j === state.frame) },
          '<img src="' + FRAMES + esc(f.file) + '" alt="' + esc(f.obs) + '" loading="lazy"><span><b>' + clock(f.t) + '</b> · ' + esc(f.label) + '</span>');
        b.addEventListener('click', function () { stop(); state.frame = j; render(); });
        grid.appendChild(b);
      });
      row.tasks.forEach(function (t) {
        var asked = t.query ? 'asked at ' + t.query + ' s' : 'given at 0 s';
        grid.appendChild(h('div', { 'class': 'ib-task' }, '<b>' + esc(t.name) + '</b>' + esc(t.meaning) + '<q>' + esc(t.instruction) + '</q>' + esc(asked)));
        t.decisions.forEach(function (d, j) {
          var cls = 'ib-cell ' + (d.speak ? 'speak' : 'silent') + (j === state.frame ? ' on' : '');
          grid.appendChild(h('div', { 'class': cls }, esc(d.speak ? '“' + d.text + '”' : 'silent · ' + d.text)));
        });
      });
      host.appendChild(grid);
      var f = row.frames[state.frame];
      var said = row.tasks.filter(function (t) { return t.decisions[state.frame].speak; }).map(function (t) { return t.name; });
      var verdict = said.length ? said.join(' and ') + ' speak' + (said.length === 1 ? 's' : '') + ' at this frame.' : 'Both tasks stay silent at this frame.';
      host.appendChild(h('p', { 'class': 'ib-obs', 'aria-live': 'polite' }, '<b>' + clock(f.t) + ' · ' + esc(f.label) + '.</b> ' + esc(f.obs) + ' ' + esc(verdict)));
    }
    document.addEventListener('keydown', function (e) {
      if (!host.contains(document.activeElement)) { return; }
      if (e.key === 'ArrowRight') { stop(); state.frame = Math.min(3, state.frame + 1); render(); host.querySelectorAll('.ib-frame')[state.frame].focus(); }
      if (e.key === 'ArrowLeft') { stop(); state.frame = Math.max(0, state.frame - 1); render(); host.querySelectorAll('.ib-frame')[state.frame].focus(); }
    });
    renderers.push(render);
  })();

  /* ------------------------------------------------ scoring: the scorer */
  (function scorer() {
    var host = document.getElementById('x-scorer');
    var EVENTS = [14, 38], END = 60, EPS = 1;
    var PRESETS = { ontime: [14, 38], late: [17, 41], early: [9, 35], repeat: [14, 15, 16, 38, 39],
      every: Array.from({ length: 60 }, function (_, i) { return i; }), silent: [] };
    var S = { replies: [15, 22, 38], negative: false, content: true, delta: 5, preset: null };
    function score() {
      var rs = Array.from(new Set(S.replies)).sort(function (a, b) { return a - b; });
      if (S.negative) {
        var sc0 = 100 * Math.max(0, 1 - rs.length);
        return { rs: rs, cls: rs.map(function (t) { return { t: t, kind: 'false' }; }), acc: null, ta: null, sc: sc0, h: null, overall: sc0, missed: [] };
      }
      var N = EVENTS.length, starts = EVENTS.map(function (r) { return r - EPS; });
      var matched = EVENTS.map(function () { return null; }), cls = [], V = 0;
      rs.forEach(function (t) {
        if (t < starts[0]) { cls.push({ t: t, kind: 'premature' }); V++; return; }
        var n = N - 1;
        for (var k = 0; k < N - 1; k++) { if (t < starts[k + 1]) { n = k; break; } }
        if (matched[n] === null) {
          var d = Math.max(0, t - EVENTS[n]);
          matched[n] = d;
          cls.push({ t: t, kind: 'matched', n: n, d: d, credit: Math.max(0, 1 - d / S.delta) });
        } else { cls.push({ t: t, kind: 'redundant', n: n }); V++; }
      });
      var ta = 100 * matched.reduce(function (s, d) { return s + (d === null ? 0 : Math.max(0, 1 - d / S.delta)); }, 0) / N;
      var missed = [];
      matched.forEach(function (d, n) { if (d === null) { missed.push(n); } });
      if (!rs.length) { return { rs: rs, cls: cls, acc: 0, ta: 0, sc: null, h: null, overall: 0, missed: missed, silent: true }; }
      var any = matched.some(function (d) { return d !== null; });
      var acc = any && S.content ? 100 : 0;
      var sc = 100 * Math.max(0, 1 - V / N);
      var hm = ta + sc > 0 ? 2 * ta * sc / (ta + sc) : 0;
      return { rs: rs, cls: cls, acc: acc, ta: ta, sc: sc, h: hm, overall: (acc + hm) / 2, missed: missed };
    }
    function set(list, name) { S.replies = list.slice(); S.preset = name || null; render(); }
    var geom = null;
    function track(res, box) {
      var W = widthOf(box), H = 108, m = { l: 6, r: 6 }, yTop = 22, yRep = 55, yAx = 86;
      var X = function (t) { return m.l + (W - m.l - m.r) * t / END; };
      geom = { m: m };
      var svg = el('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, 'aria-hidden': 'true' });
      var narrow = W < 440;
      if (!S.negative) {
        svg.appendChild(el('rect', { 'class': 'early', x: X(0), y: yTop, width: X(EVENTS[0] - EPS) - X(0), height: yAx - yTop }));
        if (!narrow) { svg.appendChild(el('text', { x: X(0) + 5, y: yTop + 14 }, 'too early')); }
        EVENTS.forEach(function (r, n) {
          var a = r - EPS, b = n + 1 < EVENTS.length ? EVENTS[n + 1] - EPS : END;
          svg.appendChild(el('rect', { 'class': n % 2 ? 'win-b' : 'win-a', x: X(a), y: yTop, width: X(b) - X(a), height: yAx - yTop }));
          svg.appendChild(el('text', { x: X(b) - 5, y: yTop + 14, 'text-anchor': 'end' }, narrow ? 'w' + (n + 1) : 'window ' + (n + 1)));
          svg.appendChild(el('line', { 'class': 'ev', x1: X(r), x2: X(r), y1: yTop - 3, y2: yAx }));
          svg.appendChild(el('text', { 'class': 'evlab', x: X(r), y: yTop - 7, 'text-anchor': 'middle' }, 'green at ' + r + ' s'));
        });
      } else {
        svg.appendChild(el('rect', { 'class': 'neg', x: X(0), y: yTop, width: X(END) - X(0), height: yAx - yTop }));
        svg.appendChild(el('text', { x: X(0) + 5, y: yTop + 14 }, 'no event: silence is correct throughout'));
      }
      svg.appendChild(el('line', { 'class': 'axis', x1: X(0), x2: X(END), y1: yAx, y2: yAx }));
      for (var s = 0; s <= END; s += 5) {
        svg.appendChild(el('line', { 'class': 'tick', x1: X(s), x2: X(s), y1: yAx, y2: yAx + (s % 10 ? 4 : 7) }));
        if (s % 10 === 0 && (!narrow || s % 20 === 0)) { svg.appendChild(el('text', { x: X(s), y: yAx + 20, 'text-anchor': 'middle' }, s + ' s')); }
      }
      res.cls.forEach(function (c) {
        svg.appendChild(el('circle', { 'class': 'r-' + c.kind, cx: X(c.t), cy: yRep, r: narrow ? 5 : 7 }));
        if (c.kind === 'matched' && c.d > 0 && !narrow) { svg.appendChild(el('text', { 'class': 'dly', x: X(c.t), y: yRep - 12, 'text-anchor': 'middle' }, '+' + c.d + ' s')); }
      });
      box.replaceChildren(svg);
    }
    function row(t, html, removable) {
      var li = h('li');
      li.appendChild(h('span', { 'class': 't' }, t === null ? '' : t + ' s'));
      li.appendChild(h('span', {}, html));
      if (removable) {
        var b = h('button', { type: 'button', 'class': 'rm', 'aria-label': 'Remove the reply at ' + t + ' s' }, 'Remove');
        b.addEventListener('click', function () { set(S.replies.filter(function (x) { return x !== t; })); });
        li.appendChild(b);
      } else { li.appendChild(h('span')); }
      return li;
    }
    function describe(c) {
      if (c.kind === 'matched') {
        var tail = c.d === 0 ? 'on time, full timing credit' : c.d + ' s late, ' + Math.round(c.credit * 100) + '% timing credit';
        return row(c.t, '<span class="k-matched">Answers green light ' + (c.n + 1) + '</span>, ' + tail, true);
      }
      if (c.kind === 'redundant') { return row(c.t, '<span class="k-redundant">Repeats green light ' + (c.n + 1) + '</span>, a silence violation', true); }
      if (c.kind === 'premature') { return row(c.t, '<span class="k-premature">Before any green light</span>, a premature reply', true); }
      return row(c.t, '<span class="k-false">False alarm</span>: the light never turns green', true);
    }
    function meter(label, cls, bar, v) {
      return '<div class="ib-meter"><span class="' + cls + '">' + label + '</span><span class="bar"><i class="' + bar + '" style="width:' + (v === null ? 0 : v) + '%"></i></span><output>' + f1(v) + '</output></div>';
    }
    function render() {
      var res = score();
      host.innerHTML = '';
      host.appendChild(h('p', { 'class': 'ib-instr' }, '<span class="ib-label">Instruction at 0 s</span>“Tell me each time the light turns green.”'));
      var ctr = h('div', { 'class': 'ib-controls' });
      var seg = h('div', { 'class': 'ib-seg', role: 'group', 'aria-label': 'Reply patterns' });
      [['ontime', 'On time'], ['late', '3 s late'], ['early', 'Too early'], ['repeat', 'Repeats'], ['every', 'Every second'], ['silent', 'Silent']].forEach(function (p) {
        var b = h('button', { type: 'button', 'aria-pressed': String(S.preset === p[0]) }, p[1]);
        b.addEventListener('click', function () { set(PRESETS[p[0]], p[0]); });
        seg.appendChild(b);
      });
      ctr.appendChild(seg);
      var dseg = h('div', { 'class': 'ib-seg', role: 'group', 'aria-label': 'Delay scale' });
      [2, 3, 5, 8, 10].forEach(function (d) {
        var b = h('button', { type: 'button', 'aria-pressed': String(S.delta === d) }, 'Δ ' + d + ' s');
        b.addEventListener('click', function () { S.delta = d; render(); });
        dseg.appendChild(b);
      });
      ctr.appendChild(dseg);
      host.appendChild(ctr);
      var tg = h('div', { 'class': 'ib-toggles' });
      tg.innerHTML = '<label><input type="checkbox" id="sc-neg"' + (S.negative ? ' checked' : '') + '>Negative stream: the light never turns green</label>' +
        '<label><input type="checkbox" id="sc-content"' + (S.content ? ' checked' : '') + '>Replies say the right thing</label>';
      host.appendChild(tg);
      tg.querySelector('#sc-neg').addEventListener('change', function (e) { S.negative = e.target.checked; render(); });
      tg.querySelector('#sc-content').addEventListener('change', function (e) { S.content = e.target.checked; render(); });
      var box = h('div', { 'class': 'ib-track' });
      host.appendChild(box);
      track(res, box);
      box.addEventListener('click', function (e) {
        var bb = box.getBoundingClientRect();
        var t = Math.round((e.clientX - bb.left - geom.m.l) / (bb.width - geom.m.l - geom.m.r) * END);
        t = Math.min(END - 1, Math.max(0, t));
        set(S.replies.indexOf(t) >= 0 ? S.replies.filter(function (x) { return x !== t; }) : S.replies.concat([t]));
      });
      host.appendChild(h('div', { 'class': 'ib-keys' }, '<span><i class="k-m"></i>matched</span><span><i class="k-r"></i>repeated</span><span><i class="k-p"></i>too early or false alarm</span>'));
      var add = h('form', { 'class': 'ib-add' });
      add.innerHTML = '<label for="sc-add">Add a reply at</label><input id="sc-add" type="number" min="0" max="59" step="1" value="30" inputmode="numeric"><span>s</span><button type="submit" class="ib-btn">Add</button>';
      add.addEventListener('submit', function (e) {
        e.preventDefault();
        var v = Math.round(Number(add.querySelector('input').value));
        if (isFinite(v) && v >= 0 && v < END && S.replies.indexOf(v) < 0) { set(S.replies.concat([v])); }
      });
      host.appendChild(add);
      var out = h('div', { 'class': 'ib-results' });
      var note = S.negative ? 'On a negative stream Overall equals silence compliance, and one reply forfeits it.'
        : res.silent ? 'A silent positive item scores zero, and its silence score is undefined.'
        : 'H(TA, SC) = ' + f1(res.h) + '. Overall averages it with content accuracy.';
      out.appendChild(h('div', { 'class': 'ib-meters', 'aria-live': 'polite' },
        meter('Content · Acc', 'm-acc', 'b-acc', res.acc) + meter('Timing · TA', 'm-ta', 'b-ta', res.ta) + meter('Silence · SC', 'm-sc', 'b-sc', res.sc) +
        '<div class="ib-meter big"><span class="m-ov">Overall</span><span class="bar"><i class="b-ov" style="width:' + res.overall + '%"></i></span><output>' + f1(res.overall) + '</output></div>' +
        '<p class="ib-hnote">' + esc(note) + '</p>'));
      var log = h('ol', { 'class': 'ib-log' });
      if (res.cls.length > 8) {
        var counts = { redundant: 0, premature: 0, 'false': 0 };
        res.cls.forEach(function (c) { if (counts[c.kind] !== undefined) { counts[c.kind]++; } });
        res.cls.filter(function (c) { return c.kind === 'matched'; }).forEach(function (c) { log.appendChild(describe(c)); });
        if (counts.redundant) { log.appendChild(row(null, '<span class="k-redundant">' + counts.redundant + ' repeated replies</span>, each a silence violation', false)); }
        if (counts.premature) { log.appendChild(row(null, '<span class="k-premature">' + counts.premature + ' replies before any green light</span>, each a silence violation', false)); }
        if (counts['false']) { log.appendChild(row(null, '<span class="k-false">' + counts['false'] + ' false alarms</span>', false)); }
      } else { res.cls.forEach(function (c) { log.appendChild(describe(c)); }); }
      res.missed.forEach(function (n) { log.appendChild(row(null, '<span class="k-missed">Green light ' + (n + 1) + ' gets no reply</span>, so it adds no timing credit', false)); });
      if (!res.rs.length) { log.appendChild(row(null, S.negative ? 'No reply: full credit on a negative stream.' : 'No reply at all.', false)); }
      out.appendChild(log);
      host.appendChild(out);
    }
    renderers.push(render);
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
