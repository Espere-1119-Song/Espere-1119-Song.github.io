/* Interactive views of the InteractionBench post (/blog/interactionbench/): the Figure 1 step-through,
   the scorer, the Table 2 explorer, the delay-scale, reply-deletion and mechanism views, and the table
   views of Figures 2, 5, 6 and 7. Data: js/interactionbench-data.js. The EN / 中文 toggle, footnotes and
   contents come from js/blog-article.js; figure-view buttons are .ib-toggle so the two do not clash. */
(function () {
  'use strict';
  var DATA = window.IB_DATA;
  var root = document.getElementById('vi-article');
  if (!root || !DATA) { return; }
  var NS = 'http://www.w3.org/2000/svg';
  var renderers = [];

  function lang() { return root.getAttribute('data-lang') === 'zh' ? 'zh' : 'en'; }
  function L(en, zh) { return lang() === 'zh' ? zh : en; }
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
  function shown(node) { return !!node && node.offsetParent !== null; }

  /* ------------------------------------------------ figure views: the paper figure, or a table or explorer */
  Array.prototype.forEach.call(root.querySelectorAll('.ib-toggle'), function (btn) {
    btn.addEventListener('click', function () {
      var fig = btn.closest('.vi-fig');
      var alt = document.getElementById(btn.getAttribute('aria-controls'));
      var primary = fig.querySelector('.vi-fig__img') || fig.querySelector('.ib-primary');
      var show = alt.hasAttribute('hidden');
      if (show) { alt.removeAttribute('hidden'); primary.setAttribute('hidden', ''); }
      else { alt.setAttribute('hidden', ''); primary.removeAttribute('hidden'); }
      btn.setAttribute('aria-expanded', String(show));
      btn.querySelector('[data-state="fig"]').toggleAttribute('hidden', show);
      btn.querySelector('[data-state="alt"]').toggleAttribute('hidden', !show);
      renderers.forEach(function (fn) { fn(); });
    });
  });

  /* ------------------------------------------------ tooltip shared by the charts */
  function tipFor(host) {
    var tip = host.querySelector(':scope > .ib-tip');
    if (!tip) { tip = h('div', { 'class': 'ib-tip', hidden: '' }); host.appendChild(tip); }
    return {
      show: function (target, html) {
        tip.innerHTML = html;
        tip.removeAttribute('hidden');
        var hb = host.getBoundingClientRect(), tb = target.getBoundingClientRect();
        var w = tip.offsetWidth, ht = tip.offsetHeight;
        var left = Math.max(0, Math.min(hb.width - w, tb.left - hb.left + tb.width / 2 - w / 2));
        var top = tb.top - hb.top - ht - 8;
        if (top < 0) { top = tb.bottom - hb.top + 8; }
        tip.style.transform = 'translate(' + Math.round(left) + 'px,' + Math.round(top) + 'px)';
      },
      hide: function () { tip.setAttribute('hidden', ''); }
    };
  }
  function hover(node, tip, html) {
    node.setAttribute('tabindex', '0');
    var show = function () { tip.show(node, html()); };
    node.addEventListener('pointerenter', show);
    node.addEventListener('focus', show);
    node.addEventListener('click', show);
    node.addEventListener('pointerleave', tip.hide);
    node.addEventListener('blur', tip.hide);
  }
  function axes(svg, X, Y, W, H, m, xt, yt, xlab, ylab, xcls, ycls) {
    xt.forEach(function (v) {
      svg.appendChild(el('line', { 'class': 'grid', x1: X(v), x2: X(v), y1: Y(yt[0]), y2: Y(yt[yt.length - 1]) }));
      svg.appendChild(el('text', { x: X(v), y: Y(yt[0]) + 17, 'text-anchor': 'middle' }, String(v)));
    });
    yt.forEach(function (v) {
      svg.appendChild(el('line', { 'class': 'grid', x1: X(xt[0]), x2: X(xt[xt.length - 1]), y1: Y(v), y2: Y(v) }));
      svg.appendChild(el('text', { x: X(xt[0]) - 7, y: Y(v) + 4, 'text-anchor': 'end' }, String(v)));
    });
    svg.appendChild(el('text', { 'class': 'axis-title', x: (X(xt[0]) + X(xt[xt.length - 1])) / 2, y: H - 4, 'text-anchor': 'middle', style: xcls ? 'fill:' + xcls : null }, xlab));
    svg.appendChild(el('text', { 'class': 'axis-title', transform: 'translate(11 ' + (Y(yt[0]) + Y(yt[yt.length - 1])) / 2 + ') rotate(-90)', 'text-anchor': 'middle', style: ycls ? 'fill:' + ycls : null }, ylab));
  }
  function star(x, y, r, fill) {
    var pts = [];
    for (var k = 0; k < 10; k++) {
      var a = -Math.PI / 2 + k * Math.PI / 5, rad = k % 2 ? r * 0.42 : r;
      pts.push((x + rad * Math.cos(a)).toFixed(1) + ',' + (y + rad * Math.sin(a)).toFixed(1));
    }
    return el('polygon', { points: pts.join(' '), fill: fill, stroke: '#f4f7fc', 'stroke-width': 1 });
  }
  function widthOf(node, min) { return Math.max(min || 260, Math.floor(node.getBoundingClientRect().width)); }

  /* ------------------------------------------------ Figure 1, step through */
  var ZH = {
    'Answer a query': '回答提问', 'Wait for evidence': '等待证据', 'Update as needed': '按需更新',
    'Speak once, when the user asks.': '用户提问时回答一次。', 'Speak as soon as the condition holds.': '条件一成立就开口。',
    'Speak whenever the answer changes.': '答案一变就开口。', 'Silent until asked and after answering.': '提问前与回答后保持沉默。',
    'Silent until then and after speaking.': '此前与开口之后保持沉默。', 'Silent while it stays the same.': '答案不变时保持沉默。',
    'jump ball': '跳球', 'basket': '进球', 'score card': '记分牌', 'team photo': '合影', 'heating': '加热中', 'simmering': '冒小泡',
    'boil begins': '开始沸腾', '15 s later': '15 秒后', 'four eggs': '四个蛋', 'fifth egg': '第五个蛋', 'sixth egg': '第六个蛋', 'beaten': '打散',
    'Jump ball at centre court between players 32 and 17; the source is an edited reel.': '32 号和 17 号球员在中圈跳球；原视频是剪辑过的集锦。',
    'The ball drops through the hoop.': '球落入篮筐。', 'Flip score card reads 14 on yellow and 15 on blue.': '翻牌记分牌上黄队 14、蓝队 15。',
    'Players pose for a group photo; the score card is out of view.': '球员们合影，记分牌不在画面里。',
    'Still water; a few specks on the bottom.': '水面平静，锅底有几个小点。', 'Small bubbles cover the bottom; the surface is calm.': '锅底布满小气泡，水面仍然平静。',
    'Bubbles break the whole surface; boiling has started.': '气泡冲破整个水面，开始沸腾。', 'Rolling boil continues; it weakens only after 121 s.': '持续翻滚沸腾，121 秒之后才减弱。',
    'Bowl holds four yolks; two eggs remain in the carton.': '碗里有四个蛋黄，蛋托里还剩两个蛋。',
    'A fifth yolk has just been added; one egg remains in the carton.': '刚加入第五个蛋黄，蛋托里还剩一个蛋。',
    'After a cut, the bowl holds six yolks.': '镜头切换后，碗里有六个蛋黄。', 'The six eggs are beaten with a fork.': '六个蛋被叉子打散。',
    'answers from the current view': '依据当前画面作答', 'answers from earlier evidence': '依据更早的证据作答',
    'waits for a temporal relation': '等待一个时间关系', 'waits for a visual event': '等待一个视觉事件',
    'updates a count or state': '更新计数或状态', 'describes new steps': '描述新的步骤',
    'What’s the score?': '现在比分多少？', 'What was the score?': '刚才比分是多少？', 'Tell me 15 s after it boils.': '水开 15 秒后告诉我。',
    'Tell me when it boils.': '水开了告诉我。', 'Count the eggs in the bowl.': '数一数碗里有几个蛋。', 'Narrate what she does.': '解说她在做什么。',
    'not asked yet': '还没被问到', '14 to 15.': '14 比 15。', 'already said': '已经说过', 'It was 14 to 15.': '刚才是 14 比 15。',
    'not boiling yet': '还没开', 'not 15 s yet': '还不到 15 秒', '15 s of boiling.': '已经开了 15 秒。', 'near miss': '近失误',
    'It’s boiling.': '水开了。', '4 eggs.': '4 个蛋。', '5 eggs.': '5 个蛋。', '6 eggs.': '6 个蛋。', 'same count': '数量没变',
    'She cracks eggs.': '她在打蛋。', 'same step': '同一个步骤', 'She beats them.': '她在搅蛋。'
  };
  function T(s) { return lang() === 'zh' && ZH[s] ? ZH[s] : s; }
  (function cases() {
    var host = document.getElementById('x-tasks');
    var state = { row: 1, frame: 2, timer: null };
    function clock(s) { var t = Math.floor(s); return Math.floor(t / 60) + ':' + ('0' + (t % 60)).slice(-2) + (s % 1 ? '.5' : ''); }
    function stop() { if (state.timer) { clearInterval(state.timer); state.timer = null; } }
    function render() {
      if (!shown(host)) { return; }
      var row = DATA.cases[state.row];
      host.innerHTML = '';
      var top = h('div', { 'class': 'ib-controls' });
      var seg = h('div', { 'class': 'ib-seg ib-seg--plain', role: 'group', 'aria-label': L('Video', '视频') });
      DATA.cases.forEach(function (r, i) {
        var b = h('button', { type: 'button', 'aria-pressed': String(i === state.row) }, esc(T(r.group)));
        b.addEventListener('click', function () { stop(); state.row = i; state.frame = 0; render(); });
        seg.appendChild(b);
      });
      top.appendChild(seg);
      var nav = h('div', { 'class': 'ib-seg', role: 'group', 'aria-label': L('Step', '逐帧') });
      var prev = h('button', { type: 'button', 'aria-label': L('Previous frame', '上一帧') }, '◀');
      var play = h('button', { type: 'button' }, state.timer ? L('Pause', '暂停') : L('Play', '播放'));
      var next = h('button', { type: 'button', 'aria-label': L('Next frame', '下一帧') }, '▶');
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
      grid.appendChild(h('div', { 'class': 'ib-task ib-spacer' }, '<b>' + esc(T(row.group)) + '</b>' + esc(T(row.gloss)) + ' ' + esc(T(row.silence))));
      row.frames.forEach(function (f, j) {
        var b = h('button', { type: 'button', 'class': 'ib-frame', 'aria-pressed': String(j === state.frame) },
          '<img src="/images/blogs/interactionbench/frames/' + esc(f.file) + '" alt="' + esc(f.obs) + '" loading="lazy"><span><b>' + clock(f.t) + '</b> · ' + esc(T(f.label)) + '</span>');
        b.addEventListener('click', function () { stop(); state.frame = j; render(); });
        grid.appendChild(b);
      });
      row.tasks.forEach(function (t) {
        var asked = t.query ? L('asked at ' + t.query + ' s', '第 ' + t.query + ' 秒提问') : L('given at 0 s', '0 秒给出');
        grid.appendChild(h('div', { 'class': 'ib-task' }, '<b>' + esc(t.name) + '</b>' + esc(T(t.meaning)) + '<q>' + esc(T(t.instruction)) + '</q>' + esc(asked)));
        t.decisions.forEach(function (d, j) {
          var cls = 'ib-cell ' + (d.speak ? 'speak' : 'silent') + (j === state.frame ? ' on' : '');
          var text = d.speak ? '“' + T(d.text) + '”' : L('silent · ', '沉默 · ') + T(d.text);
          grid.appendChild(h('div', { 'class': cls }, esc(text)));
        });
      });
      host.appendChild(grid);
      var f = row.frames[state.frame];
      var said = row.tasks.filter(function (t) { return t.decisions[state.frame].speak; }).map(function (t) { return t.name; });
      var verdict = said.length ? L(said.join(' and ') + ' speak' + (said.length === 1 ? 's' : '') + ' at this frame.', '这一帧 ' + said.join(' 和 ') + ' 要开口。')
        : L('Both tasks stay silent at this frame.', '这一帧两个任务都保持沉默。');
      host.appendChild(h('p', { 'class': 'ib-obs', 'aria-live': 'polite' }, '<b>' + clock(f.t) + ' · ' + esc(T(f.label)) + L('.', '。') + '</b> ' + esc(T(f.obs)) + ' ' + esc(verdict)));
    }
    document.addEventListener('keydown', function (e) {
      if (host.hasAttribute('hidden') || !host.contains(document.activeElement)) { return; }
      if (e.key === 'ArrowRight') { stop(); state.frame = Math.min(3, state.frame + 1); render(); host.querySelectorAll('.ib-frame')[state.frame].focus(); }
      if (e.key === 'ArrowLeft') { stop(); state.frame = Math.max(0, state.frame - 1); render(); host.querySelectorAll('.ib-frame')[state.frame].focus(); }
    });
    renderers.push(render);
  })();

  /* ------------------------------------------------ the scorer */
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
        if (!narrow) { svg.appendChild(el('text', { x: X(0) + 5, y: yTop + 14 }, L('too early', '太早'))); }
        EVENTS.forEach(function (r, n) {
          var a = r - EPS, b = n + 1 < EVENTS.length ? EVENTS[n + 1] - EPS : END;
          svg.appendChild(el('rect', { 'class': n % 2 ? 'win-b' : 'win-a', x: X(a), y: yTop, width: X(b) - X(a), height: yAx - yTop }));
          svg.appendChild(el('text', { x: X(b) - 5, y: yTop + 14, 'text-anchor': 'end' }, narrow ? 'w' + (n + 1) : L('window ', '窗口 ') + (n + 1)));
          svg.appendChild(el('line', { 'class': 'ev', x1: X(r), x2: X(r), y1: yTop - 3, y2: yAx }));
          svg.appendChild(el('text', { 'class': 'evlab', x: X(r), y: yTop - 7, 'text-anchor': 'middle' }, L('green at ' + r + ' s', '第 ' + r + ' 秒变绿')));
        });
      } else {
        svg.appendChild(el('rect', { 'class': 'neg', x: X(0), y: yTop, width: X(END) - X(0), height: yAx - yTop }));
        svg.appendChild(el('text', { x: X(0) + 5, y: yTop + 14 }, L('no event: silence is correct throughout', '没有事件：全程沉默才对')));
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
        var b = h('button', { type: 'button', 'class': 'rm', 'aria-label': L('Remove the reply at ' + t + ' s', '删除第 ' + t + ' 秒的回复') }, L('Remove', '删除'));
        b.addEventListener('click', function () { set(S.replies.filter(function (x) { return x !== t; })); });
        li.appendChild(b);
      } else { li.appendChild(h('span')); }
      return li;
    }
    function describe(c) {
      if (c.kind === 'matched') {
        var tail = c.d === 0 ? L('on time, full timing credit', '准时，时机满分') : L(c.d + ' s late, ' + Math.round(c.credit * 100) + '% timing credit', '迟到 ' + c.d + ' 秒，时机得 ' + Math.round(c.credit * 100) + '%');
        return row(c.t, '<span class="k-matched">' + L('Answers green light ' + (c.n + 1), '回应第 ' + (c.n + 1) + ' 次变绿') + '</span>, ' + tail, true);
      }
      if (c.kind === 'redundant') { return row(c.t, '<span class="k-redundant">' + L('Repeats green light ' + (c.n + 1), '重复第 ' + (c.n + 1) + ' 次变绿') + '</span>, ' + L('a silence violation', '算一次沉默违规'), true); }
      if (c.kind === 'premature') { return row(c.t, '<span class="k-premature">' + L('Before any green light', '在任何变绿之前') + '</span>, ' + L('a premature reply', '属于提前回复'), true); }
      return row(c.t, '<span class="k-false">' + L('False alarm', '误报') + '</span>: ' + L('the light never turns green', '信号灯从未变绿'), true);
    }
    function meter(label, cls, bar, v) {
      return '<div class="ib-meter"><span class="' + cls + '">' + label + '</span><span class="bar"><i class="' + bar + '" style="width:' + (v === null ? 0 : v) + '%"></i></span><output>' + f1(v) + '</output></div>';
    }
    function render() {
      var res = score();
      host.innerHTML = '';
      host.appendChild(h('p', { 'class': 'ib-instr' }, '<span class="ib-label">' + L('Instruction at 0 s', '0 秒时的指令') + '</span>' + L('“Tell me each time the light turns green.”', '“每次信号灯变绿都告诉我。”')));
      var ctr = h('div', { 'class': 'ib-controls' });
      var seg = h('div', { 'class': 'ib-seg', role: 'group', 'aria-label': L('Reply patterns', '回复模式') });
      [['ontime', 'On time', '准时'], ['late', '3 s late', '晚 3 秒'], ['early', 'Too early', '太早'], ['repeat', 'Repeats', '重复'], ['every', 'Every second', '每秒都说'], ['silent', 'Silent', '沉默']].forEach(function (p) {
        var b = h('button', { type: 'button', 'aria-pressed': String(S.preset === p[0]) }, L(p[1], p[2]));
        b.addEventListener('click', function () { set(PRESETS[p[0]], p[0]); });
        seg.appendChild(b);
      });
      ctr.appendChild(seg);
      var dseg = h('div', { 'class': 'ib-seg', role: 'group', 'aria-label': L('Delay scale', '延迟尺度') });
      [2, 3, 5, 8, 10].forEach(function (d) {
        var b = h('button', { type: 'button', 'aria-pressed': String(S.delta === d) }, 'Δ ' + d + ' s');
        b.addEventListener('click', function () { S.delta = d; render(); });
        dseg.appendChild(b);
      });
      ctr.appendChild(dseg);
      host.appendChild(ctr);
      var tg = h('div', { 'class': 'ib-toggles' });
      tg.innerHTML = '<label><input type="checkbox" id="sc-neg"' + (S.negative ? ' checked' : '') + '>' + L('Negative stream: the light never turns green', '负样本流：信号灯从未变绿') + '</label>' +
        '<label><input type="checkbox" id="sc-content"' + (S.content ? ' checked' : '') + '>' + L('Replies say the right thing', '回复内容正确') + '</label>';
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
      host.appendChild(h('div', { 'class': 'ib-keys' }, '<span><i class="k-m"></i>' + L('matched', '匹配') + '</span><span><i class="k-r"></i>' + L('repeated', '重复') + '</span><span><i class="k-p"></i>' + L('too early or false alarm', '提前或误报') + '</span>'));
      var add = h('form', { 'class': 'ib-add' });
      add.innerHTML = '<label for="sc-add">' + L('Add a reply at', '在第') + '</label><input id="sc-add" type="number" min="0" max="59" step="1" value="30" inputmode="numeric"><span>' + L('s', '秒加一条回复') + '</span><button type="submit" class="ib-btn">' + L('Add', '添加') + '</button>';
      add.addEventListener('submit', function (e) {
        e.preventDefault();
        var v = Math.round(Number(add.querySelector('input').value));
        if (isFinite(v) && v >= 0 && v < END && S.replies.indexOf(v) < 0) { set(S.replies.concat([v])); }
      });
      host.appendChild(add);
      var out = h('div', { 'class': 'ib-results' });
      var note = S.negative ? L('On a negative stream Overall equals silence compliance, and one reply forfeits it.', '负样本流上 Overall 等于沉默合规度，回复一次就归零。')
        : res.silent ? L('A silent positive item scores zero, and its silence score is undefined.', '完全沉默的正例得零分，沉默分无定义。')
        : 'H(TA, SC) = ' + f1(res.h) + L('. Overall averages it with content accuracy.', '，Overall 再与内容准确率取平均。');
      out.appendChild(h('div', { 'class': 'ib-meters', 'aria-live': 'polite' },
        meter(L('Content · Acc', '内容 · Acc'), 'm-acc', 'b-acc', res.acc) + meter(L('Timing · TA', '时机 · TA'), 'm-ta', 'b-ta', res.ta) +
        meter(L('Silence · SC', '沉默 · SC'), 'm-sc', 'b-sc', res.sc) + '<div class="ib-meter big"><span class="m-ov">Overall</span><span class="bar"><i class="b-ov" style="width:' + res.overall + '%"></i></span><output>' + f1(res.overall) + '</output></div>' +
        '<p class="ib-note" style="margin:0">' + esc(note) + '</p>'));
      var log = h('ol', { 'class': 'ib-log' });
      if (res.cls.length > 8) {
        var counts = { redundant: 0, premature: 0, 'false': 0 };
        res.cls.forEach(function (c) { if (counts[c.kind] !== undefined) { counts[c.kind]++; } });
        res.cls.filter(function (c) { return c.kind === 'matched'; }).forEach(function (c) { log.appendChild(describe(c)); });
        if (counts.redundant) { log.appendChild(row(null, '<span class="k-redundant">' + L(counts.redundant + ' repeated replies', counts.redundant + ' 次重复回复') + '</span>, ' + L('each a silence violation', '每次都是沉默违规'), false)); }
        if (counts.premature) { log.appendChild(row(null, '<span class="k-premature">' + L(counts.premature + ' replies before any green light', counts.premature + ' 次在变绿之前回复') + '</span>, ' + L('each a silence violation', '每次都是沉默违规'), false)); }
        if (counts['false']) { log.appendChild(row(null, '<span class="k-false">' + L(counts['false'] + ' false alarms', counts['false'] + ' 次误报') + '</span>', false)); }
      } else { res.cls.forEach(function (c) { log.appendChild(describe(c)); }); }
      res.missed.forEach(function (n) { log.appendChild(row(null, '<span class="k-missed">' + L('Green light ' + (n + 1) + ' gets no reply', '第 ' + (n + 1) + ' 次变绿没有回复') + '</span>, ' + L('so it adds no timing credit', '时机记零'), false)); });
      if (!res.rs.length) { log.appendChild(row(null, S.negative ? L('No reply: full credit on a negative stream.', '没有回复：负样本流得满分。') : L('No reply at all.', '一次都没有回复。'), false)); }
      out.appendChild(log);
      host.appendChild(out);
    }
    renderers.push(render);
  })();

  /* ------------------------------------------------ Table 2 explorer */
  var FAMS = [
    { key: 'Turn-based polling', en: 'Turn-based polling', zh: '轮次制轮询', color: '#de6f66' },
    { key: 'Native streaming', en: 'Native streaming', zh: '原生流式', color: '#f2c33f' },
    { key: 'Native Real-time Interaction System', en: 'Native real-time interaction system', zh: '原生实时交互系统', color: '#bc73c9' },
    { key: 'Agentic Interaction System', en: 'Agentic interaction system', zh: 'agent 交互系统', color: '#6fa1f2' },
    { key: 'Offline temporal grounding', en: 'Offline temporal grounding', zh: '离线时序定位（grounding）', color: '#828589' },
    { key: 'References', en: 'References', zh: '参照', color: '#1a1a1a' }
  ];
  var FAMZH = { 'References': '参照', 'Native streaming': '原生流式', 'Turn-based polling': '轮次制轮询', 'Offline temporal grounding': '离线时序定位（grounding）',
    'Native Real-time Interaction System (JoyAI-VL)': '原生实时交互系统（JoyAI-VL）', 'Agentic Interaction System (Qwen-MM-Plugins)': 'agent 交互系统（Qwen-MM-Plugins）',
    'Agentic Interaction System (Claude Code tools)': 'agent 交互系统（Claude Code 工具）' };
  function famOf(r) { for (var i = 0; i < FAMS.length; i++) { if (r.family.indexOf(FAMS[i].key) === 0) { return FAMS[i]; } } return FAMS[5]; }
  (function results() {
    var ctl = document.getElementById('c-results'), host = document.getElementById('x-results'), tbl = document.getElementById('t-results');
    var TASKS = ['Look', 'Recall', 'Time', 'Alert', 'Track', 'Commentate'];
    var S = { task: 'all', off: {}, sort: null, dir: -1 };
    var tip = tipFor(host);
    function val(r, k) {
      if (S.task === 'all') { return r[{ acc: 'content', ta: 'timing', sc: 'silence', overall: 'overall' }[k]]; }
      return k === 'overall' ? null : r.tasks[S.task][k];
    }
    function controls() {
      ctl.innerHTML = '';
      var seg = h('div', { 'class': 'ib-seg ib-seg--plain', role: 'group', 'aria-label': L('Task', '任务') });
      ['all'].concat(TASKS).forEach(function (t) {
        var b = h('button', { type: 'button', 'aria-pressed': String(S.task === t) }, t === 'all' ? L('All tasks', '全部任务') : t);
        b.addEventListener('click', function () { S.task = t; S.sort = null; draw(); });
        seg.appendChild(b);
      });
      ctl.appendChild(seg);
      var chips = h('div', { 'class': 'ib-controls', style: 'margin:0' });
      FAMS.forEach(function (f) {
        var b = h('button', { type: 'button', 'class': 'ib-chip', 'aria-pressed': String(!S.off[f.key]) },
          '<i style="background:' + (f.key === 'Offline temporal grounding' ? 'transparent;border:2px solid ' + f.color : f.color) + '"></i>' + esc(L(f.en, f.zh)));
        b.addEventListener('click', function () { S.off[f.key] = !S.off[f.key]; draw(); });
        chips.appendChild(b);
      });
      ctl.appendChild(chips);
    }
    function chart() {
      if (!shown(host)) { return; }
      var W = widthOf(host), H = Math.round(Math.min(470, Math.max(300, W * 0.66)));
      var m = { l: 42, r: 8, t: 8, b: 40 };
      var X = function (v) { return m.l + (W - m.l - m.r) * v / 100; };
      var Y = function (v) { return H - m.b - (H - m.t - m.b) * v / 100; };
      var svg = el('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': L('Timing accuracy against silence compliance', '时机准确率与沉默合规度') });
      svg.appendChild(el('rect', { x: X(70), y: Y(100), width: X(100) - X(70), height: Y(70) - Y(100), fill: 'rgba(71,175,125,0.10)' }));
      if (W > 420) { svg.appendChild(el('text', { x: X(70) + 5, y: Y(100) + 14, style: 'fill:#2c8559;font-weight:600' }, L('above 70 on both', '两项都高于 70'))); }
      axes(svg, X, Y, W, H, m, [0, 25, 50, 75, 100], [0, 25, 50, 75, 100], L('Timing accuracy →', '时机准确率 →'), L('Silence compliance →', '沉默合规度 →'), '#c04f46', '#2c8559');
      host.replaceChildren(svg);
      tip = tipFor(host);
      DATA.systems.forEach(function (r) {
        var f = famOf(r);
        if (S.off[f.key]) { return; }
        var ta = val(r, 'ta'), sc = val(r, 'sc');
        if (ta === null || sc === null) { return; }
        var x = X(ta), y = Y(sc), g = el('g', { role: 'img', 'aria-label': r.system });
        if (r.system === 'Human reference') { g.appendChild(star(x, y, 9, '#011F5B')); }
        else if (f.key === 'References') {
          g.appendChild(el('path', { d: 'M' + (x - 5) + ' ' + (y - 5) + 'L' + (x + 5) + ' ' + (y + 5) + 'M' + (x + 5) + ' ' + (y - 5) + 'L' + (x - 5) + ' ' + (y + 5), stroke: '#828589', 'stroke-width': 2.2 }));
          g.appendChild(el('circle', { cx: x, cy: y, r: 8, fill: 'transparent' }));
        } else if (f.key === 'Offline temporal grounding') { g.appendChild(el('circle', { cx: x, cy: y, r: 5.5, fill: '#f4f7fc', stroke: f.color, 'stroke-width': 2 })); }
        else { g.appendChild(el('circle', { cx: x, cy: y, r: 5.8, fill: f.color, stroke: '#f4f7fc', 'stroke-width': 1.2 })); }
        svg.appendChild(g);
        hover(g, tip, function () {
          var acc = val(r, 'acc');
          return '<b>' + esc(r.system) + '</b>' + esc(lang() === 'zh' ? (FAMZH[r.family] || r.family) : r.family) + '<br>' +
            (S.task === 'all' ? 'Overall <b style="display:inline">' + f1(r.overall) + '</b> · ' : S.task + ' · ') +
            L('Content ', '内容 ') + f1(acc) + '<br><span class="m-ta">' + L('Timing ', '时机 ') + f1(ta) + '</span> · <span class="m-sc">' + L('Silence ', '沉默 ') + f1(sc) + '</span>';
        });
      });
    }
    function table() {
      if (!shown(tbl)) { return; }
      var cols = S.task === 'all' ? [['overall', 'Overall', 'Overall'], ['acc', 'Content', '内容'], ['ta', 'Timing', '时机'], ['sc', 'Silence', '沉默']]
        : [['acc', 'Acc', 'Acc'], ['ta', 'TA', 'TA'], ['sc', 'SC', 'SC']];
      var t = h('table', { 'class': 'ib-table-sort' });
      var head = '<thead><tr><th scope="col">' + L('System', '系统') + '</th>' + cols.map(function (c) {
        var s = S.sort === c[0] ? (S.dir < 0 ? 'descending' : 'ascending') : 'none';
        return '<th scope="col" class="n" data-k="' + c[0] + '" aria-sort="' + s + '" tabindex="0">' + L(c[1], c[2]) + '</th>';
      }).join('') + '</tr></thead>';
      var rows = DATA.systems.filter(function (r) { return !S.off[famOf(r).key]; });
      var body = '';
      if (S.sort) {
        rows = rows.slice().sort(function (a, b) { var va = val(a, S.sort), vb = val(b, S.sort); return ((va === null ? -1 : va) - (vb === null ? -1 : vb)) * S.dir; });
        rows.forEach(function (r) {
          body += '<tr><td>' + esc(r.system) + ' <span style="color:#87867f">· ' + esc(L(famOf(r).en, famOf(r).zh)) + '</span></td>' + cols.map(function (c) { return '<td class="n">' + f1(val(r, c[0])) + '</td>'; }).join('') + '</tr>';
        });
      } else {
        var last = null;
        rows.forEach(function (r) {
          if (r.family !== last) { last = r.family; body += '<tr class="vi-results__group"><td colspan="' + (cols.length + 1) + '">' + esc(lang() === 'zh' ? (FAMZH[r.family] || r.family) : r.family) + '</td></tr>'; }
          var bestKeys = S.task === 'all' ? r.best.map(function (k) { return { overall: 'overall', content: 'acc', timing: 'ta', silence: 'sc' }[k]; }) : [];
          body += '<tr><td>' + esc(r.system) + '</td>' + cols.map(function (c) {
            var v = f1(val(r, c[0]));
            return '<td class="n">' + (bestKeys.indexOf(c[0]) >= 0 ? '<b>' + v + '</b>' : v) + '</td>';
          }).join('') + '</tr>';
        });
      }
      t.innerHTML = head + '<tbody>' + body + '</tbody>';
      tbl.innerHTML = '';
      tbl.appendChild(t);
      tbl.appendChild(h('p', { 'class': 'ib-note' }, esc(S.task === 'all' ? L('Bold marks the leader of each family, as in the paper. Click a column to sort.', '加粗为各组最高，与论文一致。点击列名可排序。')
        : L(S.task + ' scores from Table 2. Click a column to sort.', '表 2 中 ' + S.task + ' 的分数。点击列名可排序。'))));
      Array.prototype.forEach.call(t.querySelectorAll('th[data-k]'), function (th) {
        var go = function () { var k = th.getAttribute('data-k'); if (S.sort === k) { S.dir = -S.dir; } else { S.sort = k; S.dir = -1; } table(); };
        th.addEventListener('click', go);
        th.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      });
    }
    function draw() { controls(); chart(); table(); }
    renderers.push(draw);
  })();

  /* ------------------------------------------------ table views of Figures 2, 5, 6 and 7 */
  (function tables() {
    function tableHTML(head, rows) {
      return '<table><thead><tr>' + head.map(function (c, i) { return '<th' + (i ? ' class="n"' : '') + '>' + c + '</th>'; }).join('') + '</tr></thead><tbody>' +
        rows.map(function (r) { return '<tr>' + r.map(function (c, i) { return '<td' + (i ? ' class="n"' : '') + '>' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
    }
    function stats() {
      var s = DATA.stats, box = document.getElementById('t-stats');
      if (!shown(box)) { return; }
      var tasks = Object.keys(s.tasks).map(function (k) { return [k, s.tasks[k]]; });
      var DZ = { 'Sports and exercise coaching': '体育与运动指导', 'Home and life skills': '家居与生活技能', 'Cooking and kitchen': '烹饪与厨房',
        'Education and children': '教育与儿童', 'Professional, office and accessibility': '职业、办公与无障碍', 'Games, AR and entertainment': '游戏、AR 与娱乐',
        'Driving, traffic and mobility': '驾驶、交通与出行', 'Crafts, creation and skills': '手工、创作与技能', 'Medical, first-aid and care': '医疗、急救与护理',
        'Industrial, repair and operations': '工业、维修与操作' };
      var doms = s.domains.map(function (d) { return [esc(lang() === 'zh' ? (DZ[d[1]] || d[1]) : d[1]), d[2]]; });
      var lens = Object.keys(s.length_bins).map(function (k) { return [k + L(' min', ' 分钟'), s.length_bins[k]]; });
      box.innerHTML = '<div class="ib-tables3">' + tableHTML([L('Task', '任务'), L('Interactions', '交互')], tasks.concat([['<b>' + L('Total', '合计') + '</b>', '<b>1,060</b>']])) +
        tableHTML([L('Domain', '领域'), L('Videos', '视频')], doms) + tableHTML([L('Length', '时长'), L('Videos', '视频')], lens.concat([['<b>' + L('Mean', '平均') + '</b>', '<b>' + s.mean_duration_s.toFixed(0) + ' s</b>']])) + '</div>';
    }
    function silence() {
      var box = document.getElementById('t-silence');
      if (!shown(box)) { return; }
      box.innerHTML = tableHTML([L('System', '系统'), L('Premature per event ↓', '每事件提前 ↓'), L('Repeated per event ↓', '每事件重复 ↓'), L('False-alarm streams % ↓', '误报流 % ↓'), L('Suites passed % ↑', '套件通过 % ↑')],
        DATA.silence.map(function (r) { return [esc(r.system === 'Grounding' ? L('Qwen3-VL-8B, grounding', 'Qwen3-VL-8B，grounding') : r.system === 'Blind' ? L('Qwen3-VL-8B, blind', 'Qwen3-VL-8B，不看画面') : r.system), f1(r.prem), f1(r.redun), f1(r.neg_fa), f1(r.pairsel)]; }));
    }
    function backbone() {
      var box = document.getElementById('t-backbone');
      if (!shown(box)) { return; }
      box.innerHTML = tableHTML([L('Backbone', '骨干'), L('Offline content', '离线内容'), 'Overall', L('Timing', '时机'), L('Silence', '沉默'), L('Polls within 1 s %', '1 秒内完成的轮询 %')],
        DATA.backbone.map(function (r) { return [esc(r.system), f1(r.offline), f1(r.overall), f1(r.ta), f1(r.sc), f1(r.fast)]; }));
    }
    function grounding() {
      var box = document.getElementById('t-grounding');
      if (!shown(box)) { return; }
      var g = DATA.grounding;
      box.innerHTML = tableHTML([L('Configuration', '配置'), L('Content, grounding', '内容，grounding'), L('Content, online', '内容，在线'), L('Timing, grounding', '时机，grounding'), L('Timing, online', '时机，在线'), L('Silence, grounding', '沉默，grounding'), L('Silence, online', '沉默，在线')],
        g.rows.map(function (r) { return [esc(r.system), f1(r.Acc[0]), f1(r.Acc[1]), f1(r.TA[0]), f1(r.TA[1]), f1(r.SC[0]), f1(r.SC[1])]; })
          .concat([['<b>' + L('Pearson r', 'Pearson r') + '</b>', '', '<b>' + g.r.Acc.toFixed(2) + '</b>', '', '<b>' + g.r.TA.toFixed(2) + '</b>', '', '<b>' + g.r.SC.toFixed(2).replace('-', '−') + '</b>']]));
    }
    renderers.push(stats, silence, backbone, grounding);
  })();

  /* ------------------------------------------------ Figure 3, switch the delay scale */
  (function delta() {
    var host = document.getElementById('x-delta'), S = { k: 0 };
    var D = DATA.delta, i5 = D.scales.indexOf(5);
    function render() {
      if (!shown(host)) { return; }
      host.innerHTML = '';
      var ctl = h('div', { 'class': 'ib-controls' });
      ctl.appendChild(h('span', { 'class': 'ib-label' }, L('Delay scale', '延迟尺度')));
      var seg = h('div', { 'class': 'ib-seg', role: 'group', 'aria-label': L('Delay scale', '延迟尺度') });
      D.scales.forEach(function (d, k) {
        var b = h('button', { type: 'button', 'aria-pressed': String(S.k === k) }, d + ' s' + (d === 5 ? L(' (default)', '（默认）') : ''));
        b.addEventListener('click', function () { S.k = k; move(); });
        seg.appendChild(b);
      });
      ctl.appendChild(seg);
      host.appendChild(ctl);
      var W = widthOf(host), H = Math.round(Math.min(430, Math.max(280, W * 0.6)));
      var m = { l: 42, r: 8, t: 8, b: 40 };
      var X = function (v) { return m.l + (W - m.l - m.r) * v / 100; };
      var Y = function (v) { return H - m.b - (H - m.t - m.b) * v / 100; };
      var svg = el('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': L('Timing at the chosen scale against the default', '所选尺度下的时机准确率对比默认值') });
      axes(svg, X, Y, W, H, m, [0, 25, 50, 75, 100], [0, 25, 50, 75, 100], L('Timing at the 5 s default', '默认 5 秒下的时机准确率'), L('Timing at the chosen scale', '所选尺度下的时机准确率'));
      svg.appendChild(el('line', { x1: X(0), y1: Y(0), x2: X(100), y2: Y(100), stroke: '#828589', 'stroke-dasharray': '4 4', 'stroke-width': 1 }));
      var tip = tipFor(host);
      var dots = [];
      D.runs.forEach(function (r) {
        var g = el('g');
        g.appendChild(el('circle', { cx: 0, cy: 0, r: 5.5, fill: r.reference ? '#828589' : '#1a1a1a', stroke: '#f4f7fc', 'stroke-width': 1.2 }));
        svg.appendChild(g);
        dots.push({ g: g, r: r });
        hover(g, tip, function () {
          return '<b>' + esc(r.run) + '</b>' + L('Timing ', '时机 ') + f1(r.ta[S.k]) + L(' at ', '（') + D.scales[S.k] + L(' s, ', ' 秒），') + f1(r.ta[i5]) + L(' at 5 s', '（5 秒）') +
            '<br>Overall ' + f1(r.overall[S.k]) + L(' at ', '（') + D.scales[S.k] + L(' s', ' 秒）');
        });
      });
      host.appendChild(svg);
      var ro = h('div', { 'class': 'ib-readout', 'aria-live': 'polite' });
      host.appendChild(ro);
      function move() {
        Array.prototype.forEach.call(seg.children, function (b, k) { b.setAttribute('aria-pressed', String(k === S.k)); });
        dots.forEach(function (d) { d.g.style.transform = 'translate(' + X(d.r.ta[i5]).toFixed(1) + 'px,' + Y(d.r.ta[S.k]).toFixed(1) + 'px)'; });
        var t = D.tau[S.k];
        ro.innerHTML = '<span>' + L('Kendall τ of the Overall ranking ', 'Overall 排名的 Kendall τ ') + '<b>' + t.tau_overall.toFixed(3) + '</b></span><span>' + L('of the timing order ', '时机排序 ') + '<b>' + t.tau_timing.toFixed(3) + '</b></span><span>' +
          L('largest rank move ', '最大名次变动 ') + '<b>' + t.max_move + '</b></span><span>' + L('mean Overall ', '平均 Overall ') + '<b>' + t.mean_overall.toFixed(1) + '</b></span>';
      }
      move();
      requestAnimationFrame(function () { dots.forEach(function (d) { d.g.classList.add('ib-move'); }); });
      host.appendChild(h('p', { 'class': 'ib-note' }, esc(L('30 configurations; black are online systems and grey are references and whole-video configurations. The τ values compare each ranking with the five-second default.', '30 个配置；黑点为在线系统，灰点为参照与看整段视频的配置。τ 值是各排名与默认 5 秒排名的比较。'))));
    }
    renderers.push(render);
  })();

  /* ------------------------------------------------ Figure 4, drag the share of replies kept */
  (function deletion() {
    var host = document.getElementById('x-deletion'), S = { k: 0, oracle: false, thr: true };
    var D = DATA.thinning, COL = { 'Qwen3-VL-8B': '#6fa1f2', 'LLaVA-OV2': '#de6f66', 'JoyAI-VL': '#47af7d', 'MMDuet2': '#bc73c9' };
    function render() {
      if (!shown(host)) { return; }
      host.innerHTML = '';
      var ctl = h('div', { 'class': 'ib-controls' });
      var lab = h('label', { 'class': 'ib-label', 'for': 'del-k' }, L('Replies kept', '保留的回复'));
      var range = h('input', { type: 'range', id: 'del-k', 'class': 'ib-range', min: '0', max: String(D.keep_levels.length - 1), step: '1', value: String(S.k) });
      var val = h('b', { style: 'font-family:var(--sans);font-size:0.9rem;min-width:3.2em;display:inline-block' }, D.keep_levels[S.k] + '%');
      ctl.appendChild(lab); ctl.appendChild(range); ctl.appendChild(val);
      var seg = h('div', { 'class': 'ib-seg', role: 'group' });
      var bo = h('button', { type: 'button', 'aria-pressed': String(S.oracle) }, L('Oracle filter', 'oracle 过滤'));
      var bt = h('button', { type: 'button', 'aria-pressed': String(S.thr) }, L('Thresholds', '阈值'));
      bo.addEventListener('click', function () { S.oracle = !S.oracle; render(); });
      bt.addEventListener('click', function () { S.thr = !S.thr; render(); });
      seg.appendChild(bo); seg.appendChild(bt);
      ctl.appendChild(seg);
      host.appendChild(ctl);
      var W = widthOf(host), H = Math.round(Math.min(430, Math.max(280, W * 0.6)));
      var m = { l: 42, r: 10, t: 8, b: 40 };
      var X = function (v) { return m.l + (W - m.l - m.r) * v / 104; };
      var Y = function (v) { return H - m.b - (H - m.t - m.b) * v / 102; };
      var svg = el('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': L('Timing against silence under reply deletion', '删除回复后的时机与沉默') });
      axes(svg, X, Y, W, H, m, [0, 25, 50, 75, 100], [0, 25, 50, 75, 100], L('Silence compliance →', '沉默合规度 →'), L('Timing accuracy →', '时机准确率 →'), '#2c8559', '#c04f46');
      var tip = tipFor(host);
      if (S.thr) {
        var pts = D.threshold.map(function (t) { return X(t.sc) + ',' + Y(t.ta); }).join(' ');
        svg.appendChild(el('polyline', { points: pts, fill: 'none', stroke: '#f2c33f', 'stroke-width': 1.5, opacity: 0.8 }));
        D.threshold.forEach(function (t) {
          var x = X(t.sc), y = Y(t.ta);
          var g = el('g');
          g.appendChild(el('path', { d: 'M' + x + ' ' + (y - 6.5) + 'L' + (x + 6) + ' ' + (y + 4.5) + 'L' + (x - 6) + ' ' + (y + 4.5) + 'Z', fill: '#f2c33f', stroke: '#f4f7fc', 'stroke-width': 1 }));
          svg.appendChild(g);
          hover(g, tip, function () { return '<b>VideoLLM-online</b>' + L('threshold ', '阈值 ') + t.threshold + '<br><span class="m-ta">' + L('Timing ', '时机 ') + f1(t.ta) + '</span> · <span class="m-sc">' + L('Silence ', '沉默 ') + f1(t.sc) + '</span>'; });
        });
      }
      var rows = [];
      D.series.forEach(function (s) {
        var c = COL[s.system];
        svg.appendChild(el('polyline', { points: s.sc.map(function (v, k) { return X(v) + ',' + Y(s.ta[k]); }).join(' '), fill: 'none', stroke: c, 'stroke-width': 1.2, opacity: 0.35 }));
        if (S.oracle) {
          svg.appendChild(el('line', { x1: X(s.sc[0]), y1: Y(s.ta[0]), x2: X(s.oracle.sc), y2: Y(s.oracle.ta), stroke: c, 'stroke-width': 1, 'stroke-dasharray': '3 3', opacity: 0.7 }));
          var ox = X(s.oracle.sc), oy = Y(s.oracle.ta), og = el('g');
          og.appendChild(el('path', { d: 'M' + ox + ' ' + (oy - 6) + 'L' + (ox + 6) + ' ' + oy + 'L' + ox + ' ' + (oy + 6) + 'L' + (ox - 6) + ' ' + oy + 'Z', fill: c, stroke: '#f4f7fc', 'stroke-width': 1 }));
          svg.appendChild(og);
          hover(og, tip, function () { return '<b>' + esc(s.system) + L(', oracle filter', '，oracle 过滤') + '</b><span class="m-ta">' + L('Timing ', '时机 ') + f1(s.oracle.ta) + '</span> · <span class="m-sc">' + L('Silence ', '沉默 ') + f1(s.oracle.sc) + '</span>'; });
        }
        var g = el('g');
        g.appendChild(el('circle', { cx: 0, cy: 0, r: 7, fill: c, stroke: '#f4f7fc', 'stroke-width': 1.5 }));
        svg.appendChild(g);
        rows.push({ g: g, s: s });
        hover(g, tip, function () { return '<b>' + esc(s.system) + '</b>' + L('keeping ', '保留 ') + D.keep_levels[S.k] + '%' + L(' of replies', ' 的回复') + '<br><span class="m-ta">' + L('Timing ', '时机 ') + f1(s.ta[S.k]) + '</span> · <span class="m-sc">' + L('Silence ', '沉默 ') + f1(s.sc[S.k]) + '</span>'; });
        var above = { 'Qwen3-VL-8B': false, 'LLaVA-OV2': true, 'JoyAI-VL': false, 'MMDuet2': true }[s.system];
        var lx = X(64), ly = Y(s.ta[0]) + (above ? -6 : 15);
        svg.appendChild(el('text', { x: lx, y: ly, style: 'fill:' + c + ';font-weight:600' }, s.system));
      });
      host.appendChild(svg);
      var ro = h('div', { 'class': 'ib-readout', 'aria-live': 'polite' });
      host.appendChild(ro);
      function move() {
        val.textContent = D.keep_levels[S.k] + '%';
        rows.forEach(function (r) { r.g.style.transform = 'translate(' + X(r.s.sc[S.k]).toFixed(1) + 'px,' + Y(r.s.ta[S.k]).toFixed(1) + 'px)'; });
        ro.innerHTML = '<span>' + L('Timing / silence at ', '保留 ') + D.keep_levels[S.k] + L('% kept:', '% 时的时机 / 沉默：') + '</span>' + rows.map(function (r) {
          return '<span><b style="color:' + COL[r.s.system] + '">' + esc(r.s.system) + '</b> <b class="m-ta">' + f1(r.s.ta[S.k]) + '</b> / <b class="m-sc">' + f1(r.s.sc[S.k]) + '</b></span>';
        }).join('');
      }
      range.addEventListener('input', function () { S.k = Number(range.value); move(); });
      move();
      requestAnimationFrame(function () { rows.forEach(function (r) { r.g.classList.add('ib-move'); }); });
      host.appendChild(h('p', { 'class': 'ib-note' }, esc(L('Random deletion runs on all 1,060 items; the oracle filter removes only premature, repeated, and negative-stream replies using the reference annotations; the VideoLLM-online thresholds (0.5, 0.725, 0.9) use the agent items.',
        '随机删除用全部 1,060 道题；oracle 过滤借助参考标注只删提前、重复和负样本流上的回复；VideoLLM-online 的三个阈值（0.5、0.725、0.9）用的是 agent 题集。'))));
    }
    renderers.push(render);
  })();

  /* ------------------------------------------------ Figure 8, configurations by name */
  (function mechanisms() {
    var host = document.getElementById('x-mech'), S = { k: 'sc' };
    var M = DATA.mechanisms;
    var GZH = { 'Turn-based polling': '轮次制轮询（全新提示）', 'Polling with more frames or hints': '轮询 + 更多帧或提示', 'Polling with reply history': '轮询 + 回复历史',
      'Agentic interaction system': 'agent 交互系统', 'Native interaction system': '原生交互系统', 'Native streaming': '原生流式', 'Offline temporal grounding': '离线时序定位（grounding）' };
    var MET = { overall: ['Overall', 'Overall', '#bc73c9'], ta: ['Timing', '时机', '#de6f66'], sc: ['Silence', '沉默', '#47af7d'] };
    function render() {
      if (!shown(host)) { return; }
      host.innerHTML = '';
      var ctl = h('div', { 'class': 'ib-controls' });
      var seg = h('div', { 'class': 'ib-seg', role: 'group', 'aria-label': L('Score', '分数') });
      ['overall', 'ta', 'sc'].forEach(function (k) {
        var b = h('button', { type: 'button', 'aria-pressed': String(S.k === k) }, L(MET[k][0], MET[k][1]));
        b.addEventListener('click', function () { S.k = k; render(); });
        seg.appendChild(b);
      });
      ctl.appendChild(seg);
      host.appendChild(ctl);
      var W = widthOf(host), narrow = W < 520;
      var left = narrow ? 8 : 198, rowH = 34, top = 8, n = M.groups.length, H = top + rowH * n + 40;
      var X = function (v) { return left + (W - left - 10) * v / 100; };
      var svg = el('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': L('Configurations by group', '按组的配置') });
      [0, 25, 50, 75, 100].forEach(function (v) {
        svg.appendChild(el('line', { 'class': 'grid', x1: X(v), x2: X(v), y1: top, y2: top + rowH * n }));
        svg.appendChild(el('text', { x: X(v), y: top + rowH * n + 17, 'text-anchor': 'middle' }, String(v)));
      });
      svg.appendChild(el('text', { 'class': 'axis-title', x: (X(0) + X(100)) / 2, y: H - 4, 'text-anchor': 'middle', style: 'fill:' + MET[S.k][2] }, L(MET[S.k][0], MET[S.k][1]) + ' →'));
      svg.appendChild(el('line', { x1: X(M.human[S.k]), x2: X(M.human[S.k]), y1: top, y2: top + rowH * n, stroke: '#828589', 'stroke-dasharray': '4 4' }));
      var tip = tipFor(host);
      M.groups.forEach(function (g, i) {
        var y = top + rowH * i + rowH / 2 + (narrow ? 6 : 0);
        svg.appendChild(el('line', { x1: X(0), x2: X(100), y1: y, y2: y, stroke: '#e0e0e2' }));
        if (narrow) { svg.appendChild(el('text', { x: X(0), y: y - 10, style: 'font-size:10.5px' }, lang() === 'zh' ? GZH[g.group] : g.group)); }
        else { svg.appendChild(el('text', { x: left - 10, y: y + 4, 'text-anchor': 'end' }, lang() === 'zh' ? GZH[g.group] : g.group)); }
        var color = g.group === 'Offline temporal grounding' ? '#828589' : MET[S.k][2];
        g.configs.forEach(function (c) {
          var dot = el('circle', { cx: X(c[S.k]), cy: y, r: 5, fill: color, stroke: '#f4f7fc', 'stroke-width': 1, opacity: 0.9 });
          svg.appendChild(dot);
          hover(dot, tip, function () { return '<b>' + esc(c.name) + '</b>Overall ' + f1(c.overall) + ' · <span class="m-ta">' + L('Timing ', '时机 ') + f1(c.ta) + '</span> · <span class="m-sc">' + L('Silence ', '沉默 ') + f1(c.sc) + '</span>'; });
        });
        svg.appendChild(el('line', { x1: X(g.median[S.k]), x2: X(g.median[S.k]), y1: y - 9, y2: y + 9, stroke: '#1a1a1a', 'stroke-width': 2.2 }));
      });
      host.appendChild(svg);
      host.appendChild(h('p', { 'class': 'ib-note' }, esc(L('Ticks are group medians and the dashed line is the human reference (' + f1(M.human[S.k]) + '). Hover a dot for the configuration.', '竖线为组中位数，虚线为人类参照（' + f1(M.human[S.k]) + '）。悬停在点上查看配置。'))));
    }
    renderers.push(render);
  })();

  Array.prototype.forEach.call(root.querySelectorAll('details'), function (d) {
    d.addEventListener('toggle', function () { renderers.forEach(function (fn) { fn(); }); });
  });
  /* js/blog-article.js switches data-lang; redraw the views in the new language */
  new MutationObserver(function () { renderers.forEach(function (fn) { fn(); }); })
    .observe(root, { attributes: true, attributeFilter: ['data-lang'] });
  renderers.forEach(function (fn) { fn(); });
  var rt = null;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { renderers.forEach(function (fn) { fn(); }); }, 150); });
})();
