/* Interactive figures of the Video-Index post. Reads window.VI_DATA (js/video-index-data.js) and mounts,
   where the page has the element:
     .vi-overlay[data-overlay]  hover regions laid over the paper's Figures 1, 6 and 7, at the positions
                                recorded from the paper's own figure files
     #vi-screen                 the screening chain, counting up when scrolled into view
     #vi-explorer               all 115 benchmarks: search, filter, sort, and each benchmark's ladder
     #vi-results                Table 1 in blocks (fixed input, agents, human), sortable within them
     .vi-pyr__lvl[data-level]   the pyramid's steps: benchmark counts on hover
   It also shares its helpers as window.VI_UI with js/video-index-appendix.js. Everything re-renders
   on the EN / 中文 toggle. No dependencies. */
(function () {
  'use strict';
  var D = window.VI_DATA;
  var root = document.getElementById('vi-article');
  if (!D || !root) { return; }

  var LV = D.levels, LV6 = D.levels.concat(['unbroken']);
  var LVN = { option: ['Option', '选项'], text: ['Text', '文本'], pool: ['Pool', '题库'], frame: ['Frame', '帧'], order: ['Order', '顺序'], unbroken: ['Unbroken', '未攻破'] };
  /* the paper's level colours: reds before any visual input, blues after */
  var LVCOL = { option: '#efaba5', text: '#e67c73', pool: '#db4437', frame: '#d5e4fd', order: '#aac8fa', unbroken: '#4285f4' };
  var LVINK = { option: '#202124', text: '#fff', pool: '#fff', frame: '#202124', order: '#202124', unbroken: '#fff' };
  var GROUPS = ['Perception', 'Temporal', 'Spatial / physical', 'Reasoning / knowledge'];
  var GN = { 'Perception': ['Perception', '感知'], 'Temporal': ['Temporal', '时序'], 'Spatial / physical': ['Spatial / physical', '空间 / 物理'], 'Reasoning / knowledge': ['Reasoning / knowledge', '推理 / 知识'] };
  var GC = { 'Perception': '#4285f4', 'Temporal': '#0f9d58', 'Spatial / physical': '#db4437', 'Reasoning / knowledge': '#f4b400' };
  var YEARS = ['≤ 2023', '2024', '2025', '2026'];
  var BLUE = '#8ab4f8', RED = '#d93025', GREY = '#c4c7cc', INK = '#202124';
  var B = D.benchmarks;
  var BY = {};
  B.forEach(function (b) { BY[b.name] = b; });
  var SVG = 'http://www.w3.org/2000/svg';

  function lang() { return root.getAttribute('data-lang') === 'zh' ? 'zh' : 'en'; }
  function t(en, zh) { return lang() === 'zh' ? zh : en; }
  function lvName(l) { return t(LVN[l][0], LVN[l][1]); }
  function gName(g) { return t(GN[g][0], GN[g][1]); }
  function yearLabel(b) { return b.year <= 2023 ? '≤ 2023' : String(b.year); }
  function fmt(n) { return (n === null || n === undefined) ? '–' : Number(n).toLocaleString('en-US'); }
  function pct(a, b) { return Math.round(100 * a / b); }
  function bar(b) { return b.bar; }
  function byName(a, b) { return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1; }
  function names(list) { return list.slice().sort(byName).map(function (b) { return b.name; }).join(', '); }
  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function easeOut(v) { v = clamp(v); return 1 - Math.pow(1 - v, 3); }
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
  function chipHtml(level) {
    return '<i class="vi-tip__dot" style="background:' + LVCOL[level] + '"></i>' +
      (level === 'unbroken' ? t('Unbroken', '未被攻破') : t('Breaks at the ' + level + ' level', '在' + lvName(level) + '层被攻破'));
  }

  /* ---------- tooltip ---------- */
  var tip = el('div', { class: 'vi-tip', hidden: '' }, document.body);
  function placeTip(x, y) {
    var w = tip.offsetWidth, h = tip.offsetHeight, left = x + 14, top = y + 14;
    if (left + w > window.innerWidth - 8) { left = Math.max(8, x - w - 14); }
    if (top + h > window.innerHeight - 8) { top = Math.max(8, y - h - 14); }
    tip.style.left = (left + window.pageXOffset) + 'px';
    tip.style.top = (top + window.pageYOffset) + 'px';
  }
  function hoverable(node, html) {
    node.addEventListener('pointerenter', function (ev) { tip.innerHTML = html(); tip.removeAttribute('hidden'); placeTip(ev.clientX, ev.clientY); });
    node.addEventListener('pointermove', function (ev) { if (tip.hasAttribute('hidden')) { tip.innerHTML = html(); tip.removeAttribute('hidden'); } placeTip(ev.clientX, ev.clientY); });   /* a scroll hid it */
    node.addEventListener('pointerleave', function () { tip.setAttribute('hidden', ''); });
  }
  function benchTip(b) {
    return '<b>' + b.name + '</b><br>' + gName(b.group) + ' · ' + b.year + ' · ' + fmt(b.items) + ' ' + t('items', '道题') + '<br>' +
      chipHtml(b.level) + '<br>' + t('Reference', '参照') + ' ' + b.ref.toFixed(1) + '% · ' + t('chance', '随机') + ' ' + b.c.toFixed(1) + '% · ' +
      'Video-Index ' + b.vi + ' ' + t('items', '道');
  }

  /* ---------- hover regions over the paper's figures ---------- */
  function overlay(wrap, spec, regions) {
    var old = wrap.querySelector('svg.vi-overlay__svg');
    if (old) { wrap.removeChild(old); }
    var s = svg('svg', { viewBox: '0 0 ' + spec.w + ' ' + spec.h, preserveAspectRatio: 'none', class: 'vi-overlay__svg', 'aria-hidden': 'true' }, wrap);
    var table = !!document.getElementById('vi-explorer');   /* the clicks list benchmarks in the table, when the page has it */
    regions.forEach(function (r) {
      var click = table ? r.click : null;
      var rect = svg('rect', { x: r.box[0], y: r.box[1], width: r.box[2], height: r.box[3], class: 'vi-hit' + (click ? ' is-link' : ''), 'vector-effect': 'non-scaling-stroke' }, s);
      hoverable(rect, r.tip);
      if (click) { rect.addEventListener('click', function () { tip.setAttribute('hidden', ''); click(); }); }
    });
  }
  function figure1(wrap) {
    var f = D.figures.fig1, regions = [];
    f.tiles.forEach(function (tile) {
      var b = BY[tile.name];
      regions.push({ box: tile.box, tip: function () { return benchTip(b); }, click: function () { selectBenchmark(b); } });
    });
    f.chain.forEach(function (st, i) {
      regions.push({ box: st.box, tip: function () {
        var prev = i ? f.chain[i - 1].items : null;
        return '<b>' + st.stage + '</b><br>' + fmt(st.items) + ' ' + t('items', '道题') +
          (prev ? '<br>' + t('removes', '去掉') + ' ' + fmt(prev - st.items) + ' (' + pct(prev - st.items, prev) + '%)' : '');
      } });
    });
    overlay(wrap, f, regions);
  }
  function figure6(wrap) {
    var f = D.figures.fig6, regions = [];
    f.funnel.forEach(function (seg) {
      var lv = seg.level;
      var reach = B.filter(function (b) { return LV6.indexOf(b.level) >= LV6.indexOf(lv); });
      var here = reach.filter(function (b) { return b.level === lv; });
      regions.push({ box: seg.box,
        tip: function () {
          if (seg.kind === 'continue') { return '<b>' + (reach.length - here.length) + ' ' + t('pass the ' + lv + ' level', '个通过' + lvName(lv) + '层') + '</b><br>' + t('of the ' + reach.length + ' that reach it', '到达该层的共 ' + reach.length + ' 个'); }
          if (seg.kind === 'survive') { return '<b>' + here.length + ' ' + t('survive every level', '个全部幸存') + '</b><br>' + names(here); }
          return '<b>' + here.length + ' ' + t('break at the ' + lv + ' level', '个在' + lvName(lv) + '层被攻破') + '</b><br>' + names(here);
        },
        click: seg.kind === 'continue' ? null : function () { filterExplorer({ level: lv }); } });
    });
    f.years.forEach(function (seg) {
      var members = B.filter(function (b) { return yearLabel(b) === seg.year; });
      var here = members.filter(function (b) { return b.level === seg.level; });
      regions.push({ box: seg.box,
        tip: function () {
          var early = members.filter(function (b) { return LV.indexOf(b.level) >= 0 && LV.indexOf(b.level) < 3; }).length;   /* option, text, pool */
          return '<b>' + seg.year + ' · ' + lvName(seg.level) + '</b><br>' + here.length + ' / ' + members.length + ' (' + pct(here.length, members.length) + '%)<br>' + names(here) +
            '<br><span class="vi-tip__note">' + t(pct(early, members.length) + '% of these releases break before any visual input', '这一年发布的 benchmark 中 ' + pct(early, members.length) + '% 在看到画面之前就被攻破') + '</span>';
        },
        click: function () { filterExplorer({ level: seg.level, year: seg.year }); } });
    });
    overlay(wrap, f, regions);
  }
  function figure7(wrap) {
    var f = D.figures.fig7, regions = [];
    f.groups.forEach(function (seg) {
      var members = B.filter(function (b) { return b.group === seg.group; });
      var here = members.filter(function (b) { return b.level === seg.level; });
      regions.push({ box: seg.box,
        tip: function () { return '<b>' + gName(seg.group) + ' · ' + lvName(seg.level) + '</b><br>' + here.length + ' / ' + members.length + ' (' + pct(here.length, members.length) + '%)<br>' + names(here); },
        click: function () { filterExplorer({ level: seg.level, group: seg.group }); } });
    });
    overlay(wrap, f, regions);
  }

  /* ---------- a benchmark's ladder: five bars climbing to its bar ---------- */
  function ladder(container, b) {
    clear(container);
    var W = 640, H = 280, x0 = 40, x1 = W - 78, yb = H - 40, yt = 24;     /* the bar's value sits in the right margin */
    var vals = b.eps.map(function (e) { return e === null ? 0 : e; });
    var top = Math.max(60, Math.ceil((Math.max.apply(null, vals.concat([bar(b)])) + 8) / 10) * 10);
    var sc = (yb - yt) / top, step = top > 60 ? 20 : 10;
    var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'vi-ladder-svg', role: 'img', 'aria-label': b.name }, container);
    for (var g = 0; g <= top; g += step) {
      svg('line', { x1: x0, x2: x1, y1: yb - g * sc, y2: yb - g * sc, class: 'vi-ladder-grid' }, s);
      svg('text', { x: x0 - 6, y: yb - g * sc + 4, 'text-anchor': 'end', class: 'vi-ladder-tick' }, s, String(g));
    }
    svg('line', { x1: x0, x2: x1, y1: yb, y2: yb, class: 'vi-ladder-axis' }, s);
    var bv = bar(b), by = yb - Math.max(0, bv) * sc;
    svg('line', { x1: x0, x2: x1, y1: by, y2: by, class: 'vi-ladder-barline' }, s);
    svg('text', { x: x1 + 8, y: by + 4, 'text-anchor': 'start', class: 'vi-ladder-bartext' }, s, t('bar ', '门槛 ') + bv.toFixed(1));
    var slot = (x1 - x0) / 5, brk = LV.indexOf(b.level), parts = [];
    LV.forEach(function (lv, k) {
      var cx = x0 + slot * (k + 0.5), e = b.eps[k];
      svg('text', { x: cx, y: yb + 22, 'text-anchor': 'middle', class: 'vi-ladder-lv' }, s, lvName(lv));
      if (e === null) { svg('text', { x: cx, y: yb - 8, 'text-anchor': 'middle', class: 'vi-ladder-na' }, s, t('not measured', '未测')); return; }
      var r = svg('rect', { x: cx - slot * 0.29, width: slot * 0.58, y: yb, height: 0, rx: 2, fill: BLUE }, s);
      var label = svg('text', { x: cx, y: yb - 6, 'text-anchor': 'middle', class: 'vi-ladder-val', opacity: 0 }, s, e.toFixed(1));
      parts.push({ k: k, e: e, r: r, label: label });
    });
    function draw(elapsed) {
      parts.forEach(function (p) {
        var q = easeOut((elapsed - p.k * 0.32) / 0.5), v = Math.max(0, p.e) * q, h = v * sc;
        p.r.setAttribute('y', yb - h);
        p.r.setAttribute('height', h);
        var color = (brk >= 0 && p.k > brk) ? GREY : (p.k === brk && v >= bv) ? RED : BLUE;
        p.r.setAttribute('fill', color);
        p.label.setAttribute('y', yb - h - 5);
        p.label.setAttribute('opacity', q >= 1 ? 1 : 0);
        p.label.setAttribute('class', 'vi-ladder-val' + (color === RED ? ' is-break' : ''));
      });
    }
    var raf = null;
    return {
      play: function () {
        if (raf) { cancelAnimationFrame(raf); }
        var t0 = null;
        function tick(ts) { if (t0 === null) { t0 = ts; } var el2 = (ts - t0) / 1000; draw(el2); raf = el2 < 2.2 ? requestAnimationFrame(tick) : null; }
        draw(0);
        raf = requestAnimationFrame(tick);
      },
      finish: function () { if (raf) { cancelAnimationFrame(raf); raf = null; } draw(10); }
    };
  }
  function verdictHtml(b) {
    return '<b>' + b.name + '</b> ' + (b.level === 'unbroken' ? t('is unbroken', '未被攻破') : t('breaks at the ', '在') + '<b>' + lvName(b.level).toLowerCase() + '</b>' + t(' level', '层被攻破')) +
      ' · ' + t('reference', '参照') + ' ' + b.ref.toFixed(1) + '%, ' + t('chance', '随机') + ' ' + b.c.toFixed(1) + '%, ' + t('bar', '门槛') + ' ' + bar(b).toFixed(1);
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
    return function go() {
      var t0 = null;
      function tick(ts) {
        if (t0 === null) { t0 = ts; }
        var p = Math.min(1, (ts - t0) / 1600), e = 1 - Math.pow(1 - p, 3);
        rows.forEach(function (r, i) { var q = clamp((e * rows.length - i * 0.6) / 1.2); r.num.textContent = fmt(Math.round(r.st.items * q)); r.fill.style.width = (r.width * q) + '%'; });
        if (p < 1) { requestAnimationFrame(tick); }
      }
      requestAnimationFrame(tick);
    };
  }

  /* ---------- the table of all 115 benchmarks ---------- */
  var ex = { q: '', level: null, group: null, year: null, sort: 'name', dir: 1, selected: null };
  var explorerRoot = null;
  function scrollToExplorer() { if (explorerRoot) { explorerRoot.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }
  function selectBenchmark(b) { ex.selected = b; renderExplorer(true); scrollToExplorer(); }
  function filterExplorer(f) { ex.q = ''; ex.level = f.level || null; ex.group = f.group || null; ex.year = f.year || null; ex.selected = null; renderExplorer(false); scrollToExplorer(); }
  function renderExplorer(animate) {
    var container = explorerRoot;
    if (!container) { return; }
    clear(container);
    var bar1 = el('div', { class: 'vi-explorer__bar' }, container);
    var search = el('input', { type: 'search', class: 'vi-input', placeholder: t('Search 115 benchmarks…', '搜索 115 个 benchmark…'), 'aria-label': t('Search', '搜索') }, bar1);
    search.value = ex.q;
    search.addEventListener('input', function () { ex.q = search.value; renderBody(); });
    var chips = el('div', { class: 'vi-chips' }, container);
    function chipBtn(label, on, onClick, color) {
      var c = el('button', { type: 'button', class: 'vi-chip' + (on ? ' is-on' : ''), 'aria-pressed': String(on) }, chips);
      if (color) { el('i', { class: 'vi-legend__dot', style: 'background:' + color }, c); }
      c.appendChild(document.createTextNode(label));
      c.addEventListener('click', onClick);
    }
    LV6.forEach(function (lv) { chipBtn(lvName(lv), ex.level === lv, function () { ex.level = ex.level === lv ? null : lv; renderExplorer(false); }, LVCOL[lv]); });
    el('span', { class: 'vi-chips__sep' }, chips);
    GROUPS.forEach(function (g) { chipBtn(gName(g), ex.group === g, function () { ex.group = ex.group === g ? null : g; renderExplorer(false); }, GC[g]); });
    el('span', { class: 'vi-chips__sep' }, chips);
    YEARS.forEach(function (y) { chipBtn(y, ex.year === y, function () { ex.year = ex.year === y ? null : y; renderExplorer(false); }); });
    if (ex.level || ex.group || ex.year || ex.q) { chipBtn(t('Clear', '清除'), false, function () { ex.level = ex.group = ex.year = null; ex.q = ''; renderExplorer(false); }); }
    var count = el('p', { class: 'vi-hint' }, container);
    var wrap = el('div', { class: 'vi-explorer__wrap' }, container);
    var table = el('table', { class: 'vi-explorer__table' }, wrap);
    var tr = el('tr', {}, el('thead', {}, table));
    var cols = [['name', t('Benchmark', 'benchmark'), ''], ['year', t('Year', '年份'), 'n'], ['group', t('Group', '能力组'), ''], ['items', t('Items', '题目数'), 'n'], ['ref', t('Reference', '参照'), 'n'], ['c', t('Chance', '随机'), 'n'], ['level', t('Breaks at', '被攻破于'), ''], ['vi', 'Video-Index', 'n']];
    cols.forEach(function (c) {
      var th = el('th', { class: c[2] + (ex.sort === c[0] ? ' is-sorted' : ''), scope: 'col' }, tr);
      var btn = el('button', { type: 'button', class: 'vi-sort' }, th, c[1] + (ex.sort === c[0] ? (ex.dir > 0 ? ' ↑' : ' ↓') : ''));
      btn.addEventListener('click', function () { if (ex.sort === c[0]) { ex.dir = -ex.dir; } else { ex.sort = c[0]; ex.dir = c[2] === 'n' ? -1 : 1; } renderExplorer(false); });
    });
    var tbody = el('tbody', {}, table);
    var detail = el('div', { class: 'vi-explorer__detail' }, container);
    function showDetail(b, play) {
      clear(detail);
      var chart = el('div', {}, detail);
      var c = ladder(chart, b, false);
      el('div', { class: 'vi-ladder-verdict' + (b.level === 'unbroken' ? ' is-safe' : ' is-break') }, detail).innerHTML = verdictHtml(b);
      if (play) { c.play(); } else { c.finish(); }
    }
    function renderBody() {
      clear(tbody);
      var q = ex.q.trim().toLowerCase();
      var list = B.filter(function (b) {
        return (!q || b.name.toLowerCase().indexOf(q) >= 0) && (!ex.level || b.level === ex.level) && (!ex.group || b.group === ex.group) && (!ex.year || yearLabel(b) === ex.year);
      });
      list.sort(function (a, b) {
        var k = ex.sort, va = a[k], vb = b[k];
        if (k === 'level') { va = LV6.indexOf(va); vb = LV6.indexOf(vb); }
        if (k === 'group') { va = GROUPS.indexOf(va); vb = GROUPS.indexOf(vb); }
        if (typeof va === 'string') { return ex.dir * (va.toLowerCase() < vb.toLowerCase() ? -1 : va.toLowerCase() > vb.toLowerCase() ? 1 : 0); }
        return ex.dir * ((va === null ? -1 : va) - (vb === null ? -1 : vb));
      });
      count.textContent = t('Showing ' + list.length + ' of 115 benchmarks.', '显示 115 个 benchmark 中的 ' + list.length + ' 个。');
      list.forEach(function (b) {
        var r = el('tr', { class: ex.selected === b ? 'is-selected' : '', tabindex: '0' }, tbody);
        el('td', {}, r, b.name);
        el('td', { class: 'n' }, r, String(b.year));
        el('td', {}, r, gName(b.group));
        el('td', { class: 'n' }, r, fmt(b.items));
        el('td', { class: 'n' }, r, b.ref.toFixed(1));
        el('td', { class: 'n' }, r, b.c.toFixed(1));
        el('span', { class: 'vi-lvchip', style: 'background:' + LVCOL[b.level] + ';color:' + LVINK[b.level] }, el('td', {}, r), lvName(b.level));
        el('td', { class: 'n' }, r, b.vi ? String(b.vi) : '–');
        function pick() {
          ex.selected = b;
          Array.prototype.forEach.call(tbody.querySelectorAll('tr'), function (x) { x.classList.remove('is-selected'); });
          r.classList.add('is-selected');
          showDetail(b, true);
        }
        r.addEventListener('click', pick);
        r.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(); } });
      });
    }
    renderBody();
    if (ex.selected) { showDetail(ex.selected, animate); }
  }

  /* ---------- Table 1, sortable within its three blocks ---------- */
  var rs = { metric: 'video', dir: -1 };
  var BLOCKS = [['fixed', 'Fixed input', '固定输入'], ['agent', 'Agent tools', 'agent 工具'], ['human', 'Human', '人类']];
  function results(container) {
    clear(container);
    var wrap = el('div', { class: 'vi-explorer__wrap' }, container);
    var table = el('table', { class: 'vi-explorer__table vi-results-table' }, wrap);
    var tr = el('tr', {}, el('thead', {}, table));
    var cols = [['model', t('Model', '模型')], ['video', t('Video', '看视频')], ['blind', t('Blind', '盲读')], ['gain', t('Gain', '增益')], ['perception', t('Percep.', '感知')], ['temporal', t('Temp.', '时序')], ['spatial', t('Spatial', '空间')], ['reasoning', t('Reason.', '推理')]];
    var metric = rs.metric === 'model' ? 'video' : rs.metric;
    cols.forEach(function (c) {
      var th = el('th', { class: (c[0] === 'model' ? '' : 'n') + (rs.metric === c[0] ? ' is-sorted' : ''), scope: 'col' }, tr);
      var btn = el('button', { type: 'button', class: 'vi-sort' }, th, c[1] + (rs.metric === c[0] ? (rs.dir > 0 ? ' ↑' : ' ↓') : ''));
      btn.addEventListener('click', function () { if (rs.metric === c[0]) { rs.dir = -rs.dir; } else { rs.metric = c[0]; rs.dir = c[0] === 'model' ? 1 : -1; } results(container); });
    });
    var best = {};
    cols.slice(1).forEach(function (c) { best[c[0]] = Math.max.apply(null, D.results.map(function (r) { return r[c[0]]; })); });
    BLOCKS.forEach(function (blk) {
      var tbody = el('tbody', { class: 'vi-results__block' }, table);
      var head = el('tr', { class: 'vi-results__blockhead' }, tbody);
      el('th', { colspan: String(cols.length), scope: 'rowgroup' }, head, t(blk[1], blk[2]));
      var list = D.results.filter(function (r) { return r.protocol === blk[0]; });
      list.sort(function (a, b) { return rs.metric === 'model' ? rs.dir * (a.model < b.model ? -1 : 1) : rs.dir * (a[rs.metric] - b[rs.metric]); });
      list.forEach(function (r) {
        var trr = el('tr', {}, tbody);
        var label = r.model === 'Human volunteers' ? t('Human volunteers', '人类志愿者') : r.model;
        el('td', {}, trr, label);
        cols.slice(1).forEach(function (c) {
          var td = el('td', { class: 'n' + (c[0] === metric ? ' is-metric' : '') }, trr);
          if (c[0] === metric) {
            var track = el('span', { class: 'vi-rbar-track' }, td);
            var fill = el('i', { class: 'vi-rbar' }, track);
            fill.style.width = '0%';
            requestAnimationFrame(function () { requestAnimationFrame(function () { fill.style.width = r[c[0]] + '%'; }); });
          }
          var v = el('span', { class: 'vi-rval' }, td, r[c[0]].toFixed(1));
          if (r[c[0]] === best[c[0]]) { v.classList.add('is-best'); }
        });
      });
    });
  }

  /* ---------- the pyramid's steps: benchmark counts on hover ---------- */
  function pyramid() {
    Array.prototype.forEach.call(root.querySelectorAll('.vi-pyr__lvl[data-level]'), function (step) {
      var lv = step.getAttribute('data-level');
      var reach = B.filter(function (b) { return LV6.indexOf(b.level) >= LV6.indexOf(lv); });
      var here = reach.filter(function (b) { return b.level === lv; });
      hoverable(step, function () {
        if (lv === 'unbroken') { return '<b>' + here.length + ' ' + t('survive every level', '个 benchmark 五层都挡住了') + '</b><br>' + names(here); }
        return '<b>' + reach.length + ' ' + t('reach the ' + lv + ' level', '个 benchmark 到达' + lvName(lv) + '层') + '</b><br>' +
          here.length + ' ' + t('break here: ', '个在这一层被攻破：') + names(here);
      });
    });
  }

  /* the helpers the appendix views of js/video-index-appendix.js share */
  window.VI_UI = { root: root, el: el, svg: svg, clear: clear, t: t, lang: lang, lvName: lvName, gName: gName, fmt: fmt,
    LVCOL: LVCOL, LVINK: LVINK, LV6: LV6, GROUPS: GROUPS, GC: GC, BY: BY, tip: tip, placeTip: placeTip, benchTip: benchTip, chipHtml: chipHtml };

  /* ---------- mount, re-render on language change ---------- */
  var MOUNT = { fig1: figure1, fig6: figure6, fig7: figure7 };
  Array.prototype.forEach.call(root.querySelectorAll('.vi-overlay[data-overlay]'), function (wrap) {
    var fn = MOUNT[wrap.getAttribute('data-overlay')];
    if (fn && D.figures) { fn(wrap); }
  });
  var screenRoot = document.getElementById('vi-screen');
  var resultsRoot = document.getElementById('vi-results');
  explorerRoot = document.getElementById('vi-explorer');
  var goScreen = null;
  function renderAll() {
    if (resultsRoot) { results(resultsRoot); }
    if (screenRoot) { goScreen = screen(screenRoot); }
    renderExplorer(false);
  }
  renderAll();
  pyramid();
  function whenVisible(node, fn) {
    if (!node) { return; }
    if (!('IntersectionObserver' in window)) { fn(); return; }
    var io = new IntersectionObserver(function (entries) { entries.forEach(function (en) { if (en.isIntersecting) { io.disconnect(); fn(); } }); }, { threshold: 0.35 });
    io.observe(node);
  }
  whenVisible(screenRoot, function () { if (goScreen) { goScreen(); } });
  if ('MutationObserver' in window) {
    new MutationObserver(function (muts) {
      muts.forEach(function (mu) {
        if (mu.attributeName !== 'data-lang') { return; }
        renderAll();
        if (goScreen) { goScreen(); }
      });
    }).observe(root, { attributes: true });
  }
  window.addEventListener('scroll', function () { tip.setAttribute('hidden', ''); }, { passive: true });
})();
