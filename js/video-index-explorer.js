/* Interactive figures of the Video-Index post. Reads window.VI_DATA (js/video-index-data.js) and mounts,
   where the page has the element: #vi-treemap (the benchmark mosaic), #vi-play (run the pyramid on a
   benchmark), #vi-funnel (the levels), #vi-split (breaking levels by release year or capability group),
   #vi-screen (the screening chain, counting up on scroll), #vi-explorer (the table of all 115 benchmarks)
   and #vi-results (Table 1, sortable). Everything re-renders on the EN / 中文 toggle. No dependencies. */
(function () {
  'use strict';
  var D = window.VI_DATA;
  var root = document.getElementById('vi-article');
  if (!D || !root) { return; }

  var LV = D.levels;
  var LVN = { option: ['Option', '选项'], text: ['Text', '文本'], pool: ['Pool', '题库'], frame: ['Frame', '帧'], order: ['Order', '顺序'], unbroken: ['Unbroken', '未攻破'] };
  var RAMP = { option: '#AECBFA', text: '#8AB4F8', pool: '#669DF6', frame: '#4285F4', order: '#1A73E8', unbroken: '#174EA6' };
  var GROUPS = ['Perception', 'Temporal', 'Spatial / physical', 'Reasoning / knowledge'];
  var GN = { 'Perception': ['Perception', '感知'], 'Temporal': ['Temporal', '时序'], 'Spatial / physical': ['Spatial / physical', '空间 / 物理'], 'Reasoning / knowledge': ['Reasoning / knowledge', '推理 / 知识'] };
  var GC = { 'Perception': '#4285F4', 'Temporal': '#1E8E3E', 'Spatial / physical': '#D93025', 'Reasoning / knowledge': '#F9AB00' };
  var GC_SOFT = { 'Perception': '#D2E3FC', 'Temporal': '#CEEAD6', 'Spatial / physical': '#FAD2CF', 'Reasoning / knowledge': '#FEEFC3' };
  var RED = '#D93025', GREY = '#9AA0A6', INK = '#202124', MUTED = '#5F6368';
  var B = D.benchmarks;
  var SVG = 'http://www.w3.org/2000/svg';

  function lang() { return root.getAttribute('data-lang') === 'zh' ? 'zh' : 'en'; }
  function t(en, zh) { return lang() === 'zh' ? zh : en; }
  function lvName(l) { return t(LVN[l][0], LVN[l][1]); }
  function gName(g) { return t(GN[g][0], GN[g][1]); }
  function fmt(n) { return (n === null || n === undefined) ? '–' : Number(n).toLocaleString('en-US'); }
  function pct(a, b) { return Math.round(100 * a / b); }
  function period(b) { return b.year <= 2024 ? 'old' : 'new'; }
  function el(tag, attrs, parent, text) {
    var e = document.createElement(tag);
    for (var k in attrs) { if (attrs[k] !== null && attrs[k] !== undefined) { e.setAttribute(k, attrs[k]); } }
    if (text !== undefined) { e.textContent = text; }
    if (parent) { parent.appendChild(e); }
    return e;
  }
  function svg(tag, attrs, parent, text) {
    var e = document.createElementNS(SVG, tag);
    for (var k in attrs) { if (attrs[k] !== null && attrs[k] !== undefined) { e.setAttribute(k, attrs[k]); } }
    if (text !== undefined) { e.textContent = text; }
    if (parent) { parent.appendChild(e); }
    return e;
  }
  function clear(node) { while (node.firstChild) { node.removeChild(node.firstChild); } }
  function bar(b) { return Math.round((b.ref - b.c - 5) * 10) / 10; }
  function byName(a, b) { return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1; }

  /* ---------- tooltip ---------- */
  var tip = el('div', { class: 'vi-tip', hidden: '' }, document.body);
  function showTip(html, x, y) {
    tip.innerHTML = html;
    tip.removeAttribute('hidden');
    var w = tip.offsetWidth, h = tip.offsetHeight;
    var left = x + 14, top = y + 14;
    if (left + w > window.innerWidth - 8) { left = x - w - 14; }
    if (top + h > window.innerHeight - 8) { top = y - h - 14; }
    tip.style.left = (left + window.pageXOffset) + 'px';
    tip.style.top = (top + window.pageYOffset) + 'px';
  }
  function hideTip() { tip.setAttribute('hidden', ''); }
  function hoverable(node, html) {
    node.addEventListener('pointerenter', function (ev) { showTip(typeof html === 'function' ? html() : html, ev.clientX, ev.clientY); });
    node.addEventListener('pointermove', function (ev) { if (!tip.hasAttribute('hidden')) { showTip(tip.innerHTML, ev.clientX, ev.clientY); } });
    node.addEventListener('pointerleave', hideTip);
  }
  function chip(color, label) { return '<i class="vi-tip__dot" style="background:' + color + '"></i>' + label; }
  function benchTip(b) {
    var lv = b.level;
    return '<b>' + b.name + '</b><br>' + gName(b.group) + ' · ' + b.year + ' · ' + fmt(b.items) + ' ' + t('items', '道题') + '<br>' +
      chip(RAMP[lv], t('Breaks at', '被攻破于') + ' ' + lvName(lv).toLowerCase() + (lv === 'unbroken' ? '' : '')) + '<br>' +
      t('Reference', '参照') + ' ' + b.ref + '% · ' + t('chance', '随机') + ' ' + b.c + '% · Video-Index ' + b.vi + ' ' + t('items', '道');
  }

  /* ---------- the ladder: five bars against the break bar ---------- */
  function ladder(container, b, animate) {
    clear(container);
    var W = 640, H = 320, x0 = 44, x1 = W - 12, yb = H - 58, yt = 34;
    var top = Math.max(70, Math.ceil((Math.max.apply(null, b.eps.map(function (e) { return e === null ? 0 : e; }).concat([bar(b)])) + 8) / 10) * 10);
    var sc = (yb - yt) / top;
    var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'vi-ladder-svg', role: 'img' }, container);
    var step = top > 80 ? 20 : 10;
    for (var g = 0; g <= top; g += step) {
      svg('line', { x1: x0, x2: x1, y1: yb - g * sc, y2: yb - g * sc, stroke: '#E3E6EC', 'stroke-width': 1 }, s);
      svg('text', { x: x0 - 6, y: yb - g * sc + 4, 'text-anchor': 'end', class: 'vi-ladder-tick' }, s, String(g));
    }
    svg('line', { x1: x0, x2: x1, y1: yb, y2: yb, stroke: '#3C4043', 'stroke-width': 1.4 }, s);
    var bv = bar(b), by = yb - Math.max(0, bv) * sc;
    svg('line', { x1: x0, x2: x1, y1: by, y2: by, stroke: GREY, 'stroke-width': 2, 'stroke-dasharray': '6 4' }, s);
    svg('text', { x: x1, y: by - 6, 'text-anchor': 'end', class: 'vi-ladder-bar' }, s, t('bar ', '门槛 ') + bv.toFixed(1));
    var slot = (x1 - x0) / 5, brk = LV.indexOf(b.level);
    LV.forEach(function (lv, k) {
      var cx = x0 + slot * (k + 0.5), e = b.eps[k];
      svg('text', { x: cx, y: yb + 22, 'text-anchor': 'middle', class: 'vi-ladder-lv' }, s, lvName(lv));
      if (e === null) {
        svg('text', { x: cx, y: yb - 8, 'text-anchor': 'middle', class: 'vi-ladder-na' }, s, t('not measured', '未测'));
        return;
      }
      var h = Math.max(0, e) * sc, color = k === brk ? RED : (brk >= 0 && k > brk ? '#C4C7CC' : RAMP[lv]);
      var r = svg('rect', { x: cx - slot * 0.28, width: slot * 0.56, y: yb, height: 0, fill: color, rx: 2, class: 'vi-ladder-rect' }, s);
      var label = svg('text', { x: cx, y: yb - h - 6, 'text-anchor': 'middle', class: 'vi-ladder-val' + (k === brk ? ' is-break' : ''), opacity: animate ? 0 : 1 }, s, e.toFixed(1));
      if (animate) {
        r.style.transition = 'height .55s ease-out ' + (k * 0.22) + 's, y .55s ease-out ' + (k * 0.22) + 's';
        label.style.transition = 'opacity .3s ease ' + (k * 0.22 + 0.5) + 's';
        requestAnimationFrame(function () { requestAnimationFrame(function () { r.setAttribute('y', yb - h); r.setAttribute('height', h); label.setAttribute('opacity', 1); }); });
      } else { r.setAttribute('y', yb - h); r.setAttribute('height', h); }
      hoverable(r, function () { return '<b>' + b.name + '</b><br>' + lvName(lv) + ': ' + e.toFixed(1) + ' ' + t('points over chance', '点，超出随机水平') + '<br>' + t('bar', '门槛') + ' ' + bv.toFixed(1); });
    });
    var verdict = el('div', { class: 'vi-ladder-verdict' + (brk >= 0 ? ' is-break' : ' is-safe') }, container);
    verdict.style.opacity = animate ? 0 : 1;
    verdict.innerHTML = brk >= 0
      ? '<b>' + b.name + '</b> ' + t('breaks at the', '在') + ' <b>' + lvName(b.level).toLowerCase() + '</b> ' + t('level', '层被攻破') + ' · ' + t('reference', '参照') + ' ' + b.ref + '%, ' + t('chance', '随机') + ' ' + b.c + '%, ' + t('bar', '门槛') + ' ' + bv.toFixed(1)
      : '<b>' + b.name + '</b> ' + t('is unbroken', '未被攻破') + ' · ' + t('reference', '参照') + ' ' + b.ref + '%, ' + t('chance', '随机') + ' ' + b.c + '%, ' + t('bar', '门槛') + ' ' + bv.toFixed(1);
    if (animate) { verdict.style.transition = 'opacity .4s ease ' + (0.22 * (brk >= 0 ? brk : 4) + 0.6) + 's'; requestAnimationFrame(function () { requestAnimationFrame(function () { verdict.style.opacity = 1; }); }); }
  }

  /* ---------- squarified treemap ---------- */
  function squarify(items, x, y, w, h) {
    var out = [], total = items.reduce(function (a, i) { return a + i.w; }, 0);
    if (!items.length || total <= 0) { return out; }
    var scale = (w * h) / total, row = [], rest = items.slice();
    function worst(rw, side) {
      var s = rw.reduce(function (a, i) { return a + i.w * scale; }, 0), mx = 0, mn = Infinity;
      rw.forEach(function (i) { var a = i.w * scale; mx = Math.max(mx, a); mn = Math.min(mn, a); });
      return Math.max(side * side * mx / (s * s), s * s / (side * side * mn));
    }
    function layout(rw) {
      var s = rw.reduce(function (a, i) { return a + i.w * scale; }, 0);
      if (w >= h) {
        var cw = s / h, cy = y;
        rw.forEach(function (i) { var ch = i.w * scale / cw; out.push({ item: i, x: x, y: cy, w: cw, h: ch }); cy += ch; });
        x += cw; w -= cw;
      } else {
        var chh = s / w, cx = x;
        rw.forEach(function (i) { var cw2 = i.w * scale / chh; out.push({ item: i, x: cx, y: y, w: cw2, h: chh }); cx += cw2; });
        y += chh; h -= chh;
      }
    }
    while (rest.length) {
      var side = Math.min(w, h), item = rest[0];
      if (!row.length || worst(row.concat([item]), side) <= worst(row, side)) { row.push(item); rest.shift(); }
      else { layout(row); row = []; }
    }
    if (row.length) { layout(row); }
    return out;
  }
  function treemap(container) {
    clear(container);
    var W = 760, H = 520, PAD = 3;
    var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'vi-treemap-svg', role: 'img' }, container);
    var gitems = GROUPS.map(function (g) {
      var items = B.filter(function (b) { return b.group === g; }).map(function (b) { return { b: b, w: Math.log10(Math.max(b.items || 100, 100)) }; }).sort(function (a, b2) { return b2.w - a.w; });
      return { g: g, items: items, w: items.reduce(function (a, i) { return a + i.w; }, 0) };
    }).sort(function (a, b2) { return b2.w - a.w; });
    var maxVi = Math.max.apply(null, B.map(function (b) { return b.vi; }));
    squarify(gitems, 0, 0, W, H).forEach(function (region) {
      var g = region.item.g;
      squarify(region.item.items, region.x + PAD, region.y + PAD, region.w - 2 * PAD, region.h - 2 * PAD).forEach(function (cell) {
        var b = cell.item.b, shade = b.vi ? 0.35 + 0.65 * Math.sqrt(b.vi / maxVi) : 0;
        var r = svg('rect', { x: cell.x + 0.6, y: cell.y + 0.6, width: Math.max(0, cell.w - 1.2), height: Math.max(0, cell.h - 1.2), fill: GC[g], 'fill-opacity': 0.18 + 0.82 * shade, stroke: '#F4F7FC', 'stroke-width': 1, class: 'vi-tile', 'data-name': b.name }, s);
        if (cell.w > 34 && cell.h > 16) {
          var size = Math.max(7, Math.min(13, Math.sqrt(cell.w * cell.h) / 5.2));
          var label = b.name.length * size * 0.55 > cell.w - 6 ? b.name.slice(0, Math.max(3, Math.floor((cell.w - 6) / (size * 0.55)) - 1)) + '…' : b.name;
          svg('text', { x: cell.x + cell.w / 2, y: cell.y + cell.h / 2 + size * 0.35, 'text-anchor': 'middle', 'font-size': size, fill: shade > 0.55 ? '#fff' : INK, class: 'vi-tile-label', 'pointer-events': 'none' }, s, label);
        }
        hoverable(r, function () { return benchTip(b); });
        r.addEventListener('click', function () { selectBenchmark(b); });
      });
    });
    var legend = el('div', { class: 'vi-legend' }, container);
    GROUPS.forEach(function (g) {
      var n = B.filter(function (b) { return b.group === g; }).length;
      var item = el('span', { class: 'vi-legend__item' }, legend);
      el('i', { class: 'vi-legend__dot', style: 'background:' + GC[g] }, item);
      item.appendChild(document.createTextNode(gName(g) + ' (' + n + ')'));
    });
    var note = el('span', { class: 'vi-legend__item vi-legend__note' }, legend, t('darker = more items in Video-Index · click a tile', '颜色越深，为 Video-Index 贡献的题越多 · 点一块看详情'));
  }

  /* ---------- run the pyramid on one benchmark ---------- */
  var playState = { current: null };
  function play(container) {
    clear(container);
    var ctrl = el('div', { class: 'vi-play__ctrl' }, container);
    var input = el('input', { type: 'text', list: 'vi-bench-list', class: 'vi-play__input', placeholder: t('Type a benchmark name…', '输入 benchmark 名称…'), 'aria-label': t('Benchmark', 'benchmark') }, ctrl);
    var dl = el('datalist', { id: 'vi-bench-list' }, ctrl);
    B.slice().sort(byName).forEach(function (b) { el('option', { value: b.name }, dl); });
    var btnRun = el('button', { type: 'button', class: 'vi-btn' }, ctrl, t('Run', '运行'));
    var btnRnd = el('button', { type: 'button', class: 'vi-btn vi-btn--primary' }, ctrl, t('Random benchmark', '随机一个 benchmark'));
    var stage = el('div', { class: 'vi-play__stage' }, container);
    function run(b) { playState.current = b; input.value = b.name; ladder(stage, b, true); }
    btnRun.addEventListener('click', function () {
      var q = input.value.trim().toLowerCase();
      var b = B.filter(function (x) { return x.name.toLowerCase() === q; })[0] || B.filter(function (x) { return x.name.toLowerCase().indexOf(q) >= 0; })[0];
      if (b) { run(b); }
    });
    input.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { btnRun.click(); } });
    input.addEventListener('change', function () { btnRun.click(); });
    btnRnd.addEventListener('click', function () { run(B[Math.floor(Math.random() * B.length)]); });
    if (playState.current) { ladder(stage, playState.current, false); input.value = playState.current.name; }
    else { ladder(stage, B.filter(function (b) { return b.name === 'MMWorld'; })[0] || B[0], false); input.value = 'MMWorld'; }
  }

  /* ---------- the funnel of levels ---------- */
  function funnel(container) {
    clear(container);
    var W = 760, rowH = 46, H = 6 * rowH + 30, x0 = 118, x1 = W - 70;
    var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'vi-funnel-svg', role: 'img' }, container);
    var reach = 115, sc = (x1 - x0) / 115;
    LV.forEach(function (lv, k) {
      var breaks = B.filter(function (b) { return b.level === lv; }), n = breaks.length, y = 16 + k * rowH;
      svg('text', { x: x0 - 10, y: y + 20, 'text-anchor': 'end', class: 'vi-funnel-lv' }, s, lvName(lv));
      var keep = svg('rect', { x: x0, y: y, width: (reach - n) * sc, height: 30, fill: '#E3E6EC', rx: 2 }, s);
      var broke = svg('rect', { x: x0 + (reach - n) * sc, y: y, width: n * sc, height: 30, fill: RAMP[lv], rx: 2, class: 'vi-funnel-seg' }, s);
      svg('text', { x: x0 + (reach - n) * sc - 6, y: y + 20, 'text-anchor': 'end', class: 'vi-funnel-n' }, s, String(reach - n) + ' ' + t('continue', '继续'));
      svg('text', { x: x0 + reach * sc + 8, y: y + 20, class: 'vi-funnel-n is-break' }, s, String(n) + ' ' + t('break', '被攻破'));
      var names = breaks.slice().sort(byName).map(function (b) { return b.name; }).join(', ');
      hoverable(broke, function () { return '<b>' + n + ' ' + t('benchmarks break at the ' + lv + ' level', '个 benchmark 在' + lvName(lv) + '层被攻破') + '</b><br>' + names; });
      hoverable(keep, function () { return '<b>' + (reach - n) + ' ' + t('benchmarks pass the ' + lv + ' level', '个 benchmark 通过' + lvName(lv) + '层') + '</b><br>' + t('of the', '到达该层的共') + ' ' + reach + ' ' + t('that reach it', '个'); });
      broke.addEventListener('click', function () { explorerState.level = lv; renderExplorer(); scrollToExplorer(); });
      reach -= n;
    });
    var y = 16 + 5 * rowH, surv = B.filter(function (b) { return b.level === 'unbroken'; });
    svg('text', { x: x0 - 10, y: y + 20, 'text-anchor': 'end', class: 'vi-funnel-lv' }, s, lvName('unbroken'));
    var r = svg('rect', { x: x0, y: y, width: reach * sc, height: 30, fill: RAMP.unbroken, rx: 2, class: 'vi-funnel-seg' }, s);
    svg('text', { x: x0 + reach * sc + 8, y: y + 20, class: 'vi-funnel-n' }, s, String(reach) + ' ' + t('survive every level', '全部幸存'));
    hoverable(r, function () { return '<b>' + surv.length + ' ' + t('benchmarks survive every level', '个 benchmark 全部幸存') + '</b><br>' + surv.slice().sort(byName).map(function (b) { return b.name; }).join(', '); });
    r.addEventListener('click', function () { explorerState.level = 'unbroken'; renderExplorer(); scrollToExplorer(); });
    el('p', { class: 'vi-hint' }, container, t('Hover a bar for the benchmarks; click a coloured segment to list them below.', '悬停查看 benchmark 名单；点击彩色段在下方表格里筛出它们。'));
  }

  /* ---------- breaking levels by year or by group ---------- */
  var splitState = { mode: 'year' };
  function split(container) {
    clear(container);
    var ctrl = el('div', { class: 'vi-chips' }, container);
    [['year', t('By release year', '按发布年份')], ['group', t('By capability group', '按能力组')]].forEach(function (m) {
      var c = el('button', { type: 'button', class: 'vi-chip' + (splitState.mode === m[0] ? ' is-on' : ''), 'aria-pressed': String(splitState.mode === m[0]) }, ctrl, m[1]);
      c.addEventListener('click', function () { splitState.mode = m[0]; split(container); });
    });
    var rows = splitState.mode === 'year'
      ? [['≤ 2023', function (b) { return b.year <= 2023; }], ['2024', function (b) { return b.year === 2024; }], ['2025', function (b) { return b.year === 2025; }], ['2026', function (b) { return b.year === 2026; }]]
      : [['Temporal', 'Spatial / physical', 'Perception', 'Reasoning / knowledge'].map(function (g) { return [gName(g), function (b) { return b.group === g; }]; })][0];
    var W = 760, rowH = 54, x0 = 190, x1 = W - 90, H = rows.length * rowH + 40;
    var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'vi-split-svg', role: 'img' }, container);
    svg('text', { x: x1 + 12, y: 14, class: 'vi-split-head' }, s, t('Before video', '看到画面前'));
    rows.forEach(function (row, i) {
      var members = B.filter(row[1]), n = members.length, y = 26 + i * rowH, run = x0;
      svg('text', { x: x0 - 10, y: y + 22, 'text-anchor': 'end', class: 'vi-split-lv' }, s, row[0] + ' (' + n + ')');
      LV.concat(['unbroken']).forEach(function (lv, k) {
        var part = members.filter(function (b) { return b.level === lv; }), c = part.length;
        if (!c) { return; }
        var w = (x1 - x0) * c / n;
        var r = svg('rect', { x: run, y: y, width: 0, height: 34, fill: RAMP[lv], stroke: '#F4F7FC', 'stroke-width': 1, class: 'vi-split-seg' }, s);
        r.style.transition = 'width .5s ease ' + (k * 0.05) + 's';
        requestAnimationFrame(function () { requestAnimationFrame(function () { r.setAttribute('width', w); }); });
        if (w > 20) { svg('text', { x: run + w / 2, y: y + 22, 'text-anchor': 'middle', class: 'vi-split-n', fill: k >= 3 ? '#fff' : INK, 'pointer-events': 'none' }, s, String(c)); }
        hoverable(r, function () { return '<b>' + lvName(lv) + ' · ' + row[0] + '</b><br>' + c + ' ' + t('of', '/') + ' ' + n + ' (' + pct(c, n) + '%)<br>' + part.slice().sort(byName).map(function (b) { return b.name; }).join(', '); });
        run += w;
      });
      var before = members.filter(function (b) { return LV.indexOf(b.level) >= 0 && LV.indexOf(b.level) <= 2; }).length;
      svg('text', { x: x1 + 12, y: y + 22, class: 'vi-split-pct' }, s, pct(before, n) + '%');
    });
    var legend = el('div', { class: 'vi-legend' }, container);
    LV.concat(['unbroken']).forEach(function (lv) {
      var item = el('span', { class: 'vi-legend__item' }, legend);
      el('i', { class: 'vi-legend__dot', style: 'background:' + RAMP[lv] }, item);
      item.appendChild(document.createTextNode(lvName(lv)));
    });
  }

  /* ---------- the screening chain, counting up when scrolled into view ---------- */
  function screen(container) {
    clear(container);
    var lo = Math.log10(500), hi = Math.log10(600000), rows = [];
    D.screen.forEach(function (st, i) {
      var row = el('div', { class: 'vi-screen__row' + (i === D.screen.length - 1 ? ' is-final' : '') }, container);
      el('span', { class: 'vi-screen__stage' }, row, st.stage);
      var track = el('span', { class: 'vi-screen__track' }, row);
      var fill = el('i', { class: 'vi-screen__fill' }, track);
      fill.style.width = '0%';
      var num = el('span', { class: 'vi-screen__n' }, row, '0');
      rows.push({ st: st, fill: fill, num: num, width: 100 * (Math.log10(st.items) - lo) / (hi - lo) });
    });
    var done = false;
    function go() {
      if (done) { return; }
      done = true;
      var t0 = null;
      function tick(ts) {
        if (!t0) { t0 = ts; }
        var p = Math.min(1, (ts - t0) / 1600), e = 1 - Math.pow(1 - p, 3);
        rows.forEach(function (r, i) { var q = Math.min(1, Math.max(0, (e * rows.length - i * 0.6) / 1.2)); r.num.textContent = fmt(Math.round(r.st.items * q)); r.fill.style.width = (r.width * q) + '%'; });
        if (p < 1) { requestAnimationFrame(tick); }
      }
      requestAnimationFrame(tick);
    }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) { entries.forEach(function (en) { if (en.isIntersecting) { go(); io.disconnect(); } }); }, { threshold: 0.3 });
      io.observe(container);
    } else { go(); }
  }

  /* ---------- the table of all 115 benchmarks ---------- */
  var explorerState = { q: '', level: null, group: null, period: null, sort: 'name', dir: 1, selected: null };
  var explorerRoot = null;
  function scrollToExplorer() { if (explorerRoot) { explorerRoot.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }
  function selectBenchmark(b) { explorerState.selected = b; renderExplorer(); scrollToExplorer(); }
  function renderExplorer() {
    var container = explorerRoot;
    if (!container) { return; }
    clear(container);
    var st = explorerState;
    var bar1 = el('div', { class: 'vi-explorer__bar' }, container);
    var search = el('input', { type: 'search', class: 'vi-play__input', placeholder: t('Search 115 benchmarks…', '搜索 115 个 benchmark…'), value: st.q, 'aria-label': t('Search', '搜索') }, bar1);
    search.addEventListener('input', function () { st.q = search.value; renderBody(); });
    var chips = el('div', { class: 'vi-chips' }, container);
    function chipBtn(label, on, onClick, color) {
      var c = el('button', { type: 'button', class: 'vi-chip' + (on ? ' is-on' : ''), 'aria-pressed': String(on) }, chips);
      if (color) { el('i', { class: 'vi-legend__dot', style: 'background:' + color }, c); }
      c.appendChild(document.createTextNode(label));
      c.addEventListener('click', onClick);
    }
    LV.concat(['unbroken']).forEach(function (lv) { chipBtn(lvName(lv), st.level === lv, function () { st.level = st.level === lv ? null : lv; renderExplorer(); }, RAMP[lv]); });
    el('span', { class: 'vi-chips__sep' }, chips);
    GROUPS.forEach(function (g) { chipBtn(gName(g), st.group === g, function () { st.group = st.group === g ? null : g; renderExplorer(); }, GC[g]); });
    el('span', { class: 'vi-chips__sep' }, chips);
    chipBtn(t('Through 2024', '2024 年及以前'), st.period === 'old', function () { st.period = st.period === 'old' ? null : 'old'; renderExplorer(); });
    chipBtn(t('2025 and 2026', '2025 与 2026 年'), st.period === 'new', function () { st.period = st.period === 'new' ? null : 'new'; renderExplorer(); });
    if (st.level || st.group || st.period || st.q) { chipBtn(t('Clear', '清除'), false, function () { st.level = st.group = st.period = null; st.q = ''; renderExplorer(); }); }
    var count = el('p', { class: 'vi-hint' }, container);
    var wrap = el('div', { class: 'vi-explorer__wrap' }, container);
    var table = el('table', { class: 'vi-explorer__table' }, wrap);
    var thead = el('thead', {}, table), tr = el('tr', {}, thead);
    var cols = [['name', t('Benchmark', 'benchmark'), ''], ['year', t('Year', '年份'), 'n'], ['group', t('Group', '能力组'), ''], ['items', t('Items', '题目数'), 'n'], ['ref', t('Reference', '参照'), 'n'], ['c', t('Chance', '随机'), 'n'], ['level', t('Breaks at', '被攻破于'), ''], ['vi', 'Video-Index', 'n']];
    cols.forEach(function (c) {
      var th = el('th', { class: c[2] + (st.sort === c[0] ? ' is-sorted' : ''), scope: 'col' }, tr);
      var btn = el('button', { type: 'button', class: 'vi-sort' }, th, c[1] + (st.sort === c[0] ? (st.dir > 0 ? ' ↑' : ' ↓') : ''));
      btn.addEventListener('click', function () { if (st.sort === c[0]) { st.dir = -st.dir; } else { st.sort = c[0]; st.dir = (c[2] === 'n') ? -1 : 1; } renderExplorer(); });
    });
    var tbody = el('tbody', {}, table);
    var detail = el('div', { class: 'vi-explorer__detail' }, container);
    function renderBody() {
      clear(tbody);
      var q = st.q.trim().toLowerCase();
      var rows = B.filter(function (b) {
        return (!q || b.name.toLowerCase().indexOf(q) >= 0) && (!st.level || b.level === st.level) && (!st.group || b.group === st.group) && (!st.period || period(b) === st.period);
      });
      var order = { option: 0, text: 1, pool: 2, frame: 3, order: 4, unbroken: 5 };
      rows.sort(function (a, b) {
        var k = st.sort, va = a[k], vb = b[k];
        if (k === 'level') { va = order[va]; vb = order[vb]; }
        if (k === 'group') { va = GROUPS.indexOf(va); vb = GROUPS.indexOf(vb); }
        if (typeof va === 'string') { return st.dir * (va.toLowerCase() < vb.toLowerCase() ? -1 : va.toLowerCase() > vb.toLowerCase() ? 1 : 0); }
        return st.dir * ((va === null ? -1 : va) - (vb === null ? -1 : vb));
      });
      count.textContent = t('Showing ' + rows.length + ' of 115 benchmarks. Click a row for its ladder.', '显示 115 个 benchmark 中的 ' + rows.length + ' 个。点击一行查看它的阶梯图。');
      rows.forEach(function (b) {
        var r = el('tr', { class: st.selected === b ? 'is-selected' : '', tabindex: '0' }, tbody);
        el('td', {}, r, b.name);
        el('td', { class: 'n' }, r, String(b.year));
        el('td', {}, r, gName(b.group));
        el('td', { class: 'n' }, r, fmt(b.items));
        el('td', { class: 'n' }, r, b.ref.toFixed(1));
        el('td', { class: 'n' }, r, b.c.toFixed(1));
        var td = el('td', {}, r);
        var chipEl = el('span', { class: 'vi-lvchip', style: 'background:' + RAMP[b.level] + ';color:' + (['frame', 'order', 'unbroken'].indexOf(b.level) >= 0 ? '#fff' : INK) }, td, lvName(b.level));
        el('td', { class: 'n' }, r, b.vi ? String(b.vi) : '–');
        function pick() { st.selected = b; Array.prototype.forEach.call(tbody.querySelectorAll('tr'), function (x) { x.classList.remove('is-selected'); }); r.classList.add('is-selected'); ladder(detail, b, true); }
        r.addEventListener('click', pick);
        r.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(); } });
      });
    }
    renderBody();
    if (st.selected) { ladder(detail, st.selected, false); }
    else { detail.innerHTML = '<p class="vi-hint">' + t('Select a benchmark to see its exploitability at each level.', '选择一个 benchmark，查看它在每一层的可利用度。') + '</p>'; }
  }

  /* ---------- Table 1, sortable ---------- */
  var resultsState = { metric: 'video', dir: -1, protocols: { fixed: true, agent: true, human: true } };
  function results(container) {
    clear(container);
    var st = resultsState;
    var chips = el('div', { class: 'vi-chips' }, container);
    [['fixed', t('Fixed input', '固定输入'), '#669DF6'], ['agent', t('Agent tools', 'agent 工具'), '#EE675C'], ['human', t('Human', '人类'), '#BDC1C6']].forEach(function (p) {
      var c = el('button', { type: 'button', class: 'vi-chip' + (st.protocols[p[0]] ? ' is-on' : ''), 'aria-pressed': String(st.protocols[p[0]]) }, chips);
      el('i', { class: 'vi-legend__dot', style: 'background:' + p[2] }, c);
      c.appendChild(document.createTextNode(p[1]));
      c.addEventListener('click', function () { st.protocols[p[0]] = !st.protocols[p[0]]; results(container); });
    });
    var wrap = el('div', { class: 'vi-explorer__wrap' }, container);
    var table = el('table', { class: 'vi-explorer__table vi-results-table' }, wrap);
    var tr = el('tr', {}, el('thead', {}, table));
    var cols = [['model', t('Model', '模型')], ['video', t('Video', '看视频')], ['blind', t('Blind', '盲读')], ['gain', t('Gain', '增益')], ['perception', t('Percep.', '感知')], ['temporal', t('Temp.', '时序')], ['spatial', t('Spatial', '空间')], ['reasoning', t('Reason.', '推理')]];
    cols.forEach(function (c) {
      var th = el('th', { class: (c[0] === 'model' ? '' : 'n') + (st.metric === c[0] ? ' is-sorted' : ''), scope: 'col' }, tr);
      var btn = el('button', { type: 'button', class: 'vi-sort' }, th, c[1] + (st.metric === c[0] ? (st.dir > 0 ? ' ↑' : ' ↓') : ''));
      btn.addEventListener('click', function () { if (st.metric === c[0]) { st.dir = -st.dir; } else { st.metric = c[0]; st.dir = c[0] === 'model' ? 1 : -1; } results(container); });
    });
    var tbody = el('tbody', {}, table);
    var rows = D.results.filter(function (r) { return st.protocols[r.protocol]; });
    var colors = { fixed: '#669DF6', agent: '#EE675C', human: '#BDC1C6' };
    var best = {};
    cols.slice(1).forEach(function (c) { best[c[0]] = Math.max.apply(null, rows.map(function (r) { return r[c[0]]; })); });
    var metric = st.metric === 'model' ? 'video' : st.metric;
    rows.sort(function (a, b) { return st.metric === 'model' ? st.dir * (a.model < b.model ? -1 : 1) : st.dir * (a[st.metric] - b[st.metric]); });
    rows.forEach(function (r) {
      var trr = el('tr', {}, tbody);
      var name = el('td', {}, trr);
      el('i', { class: 'vi-legend__dot', style: 'background:' + colors[r.protocol] }, name);
      name.appendChild(document.createTextNode((r.model === 'Human volunteers' ? t('Human volunteers', '人类志愿者') : r.model) + (r.protocol === 'agent' ? ' · ' + t('agent', 'agent') : r.protocol === 'fixed' && r.model === 'Claude Opus 5' ? ' · ' + t('fixed input', '固定输入') : '')));
      cols.slice(1).forEach(function (c) {
        var td = el('td', { class: 'n' + (c[0] === metric ? ' is-metric' : '') }, trr);
        if (c[0] === metric) {
          var barEl = el('i', { class: 'vi-rbar', style: 'background:' + colors[r.protocol] }, td);
          barEl.style.width = '0%';
          requestAnimationFrame(function () { requestAnimationFrame(function () { barEl.style.width = (r[c[0]]) + '%'; }); });
        }
        var v = el('span', {}, td, r[c[0]].toFixed(1));
        if (r[c[0]] === best[c[0]]) { v.style.fontWeight = '700'; v.style.color = INK; }
      });
    });
    el('p', { class: 'vi-hint' }, container, t('Click a column to sort by it; the bars follow the sorted column. Bold marks the highest value of a column among the rows shown.', '点击列标题按该列排序，条形随排序列变化。加粗为当前显示行中该列的最高值。'));
  }

  /* ---------- mount and re-render on language change ---------- */
  function renderAll() {
    var m;
    if ((m = document.getElementById('vi-treemap'))) { treemap(m); }
    if ((m = document.getElementById('vi-play'))) { play(m); }
    if ((m = document.getElementById('vi-funnel'))) { funnel(m); }
    if ((m = document.getElementById('vi-split'))) { split(m); }
    if ((m = document.getElementById('vi-results'))) { results(m); }
    explorerRoot = document.getElementById('vi-explorer');
    renderExplorer();
  }
  renderAll();
  var sc = document.getElementById('vi-screen');
  if (sc) { screen(sc); }
  if ('MutationObserver' in window) {
    new MutationObserver(function (muts) { muts.forEach(function (mu) { if (mu.attributeName === 'data-lang') { renderAll(); if (sc) { screen(sc); } } }); }).observe(root, { attributes: true });
  }
  window.addEventListener('scroll', hideTip, { passive: true });
})();
