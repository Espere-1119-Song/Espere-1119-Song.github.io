/* Interactive views of the appendix material in the Video-Index post. Reads window.VI_APPX
   (js/video-index-appendix-data.js) and the helpers that js/video-index-explorer.js shares as
   window.VI_UI, and mounts, where the page has the element:
     .vi-overlay[data-overlay="q1"]  Figure Q1: one benchmark's lines picked out across both panels
     .vi-overlay[data-overlay="fig8"] Figure 8: each benchmark's better resolution and frame rate on hover
     .vi-overlay[data-overlay="fig9"] Figure 9: one long-video benchmark followed across the frame budgets
     .vi-scatter[data-table]         Tables 7, 8, 14-15, 16, 17, 18 and 19 as scatter plots, with the table
     .vi-lines[data-table="20"]      Table 20 as one line per benchmark over the frame budgets, with the table
     #vi-dupshare                    Table 12, with the example questions of the flow picked in it
     #vi-rank                        Tables 34 to 37, one tab per capability group
     .vi-static[data-table]          Tables 38 and 48 to 50
     #vi-cards                       the report cards of Appendix X, one at a time
   Everything re-renders on the EN / 中文 toggle. No dependencies. */
(function () {
  'use strict';
  var A = window.VI_APPX, U = window.VI_UI;
  if (!A || !U) { return; }
  var root = U.root, el = U.el, svg = U.svg, clear = U.clear, t = U.t, tip = U.tip, BY = U.BY;
  var LVCOL = U.LVCOL, LVINK = U.LVINK, GC = U.GC;
  var TB = A.tables;

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function showTip(html, ev) { tip.innerHTML = html; tip.removeAttribute('hidden'); U.placeTip(ev.clientX, ev.clientY); }
  function moveTip(ev) { U.placeTip(ev.clientX, ev.clientY); }
  function hideTip() { tip.setAttribute('hidden', ''); }
  /* a scroll hides the tip (js/video-index-explorer.js), so moving within the same element shows it again */
  function bindTip(node, html, onEnter, onLeave) {
    node.addEventListener('pointerenter', function (ev) { if (onEnter) { onEnter(); } showTip(html(), ev); });
    node.addEventListener('pointermove', function (ev) { if (tip.hasAttribute('hidden')) { showTip(html(), ev); } else { moveTip(ev); } });
    node.addEventListener('pointerleave', function () { hideTip(); if (onLeave) { onLeave(); } });
  }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function fx(v, d) { return isNum(v) ? v.toFixed(d) : (v === null || v === undefined ? '–' : String(v)); }
  function signed(v, d) { return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d); }
  function dot(c) { return '<i class="vi-tip__dot" style="background:' + c + '"></i>'; }
  function button(parent, cls, label, pressed, onClick) {
    var b = el('button', { type: 'button', class: cls, 'aria-pressed': pressed === null ? null : String(!!pressed) }, parent);
    b.innerHTML = label;
    b.addEventListener('click', onClick);
    return b;
  }

  /* labels with sub- and superscripts, written as 'ε_{pool}^{w}' */
  function parts(s) {
    var out = [], re = /([_^])\{([^}]*)\}/g, last = 0, m;
    while ((m = re.exec(s))) {
      if (m.index > last) { out.push([s.slice(last, m.index), '']); }
      out.push([m[2], m[1] === '_' ? 'sub' : 'sup']);
      last = re.lastIndex;
    }
    if (last < s.length) { out.push([s.slice(last), '']); }
    return out;
  }
  function labHtml(s) { return parts(s).map(function (p) { return p[1] ? '<' + p[1] + '>' + esc(p[0]) + '</' + p[1] + '>' : esc(p[0]); }).join(''); }
  function labPlain(s) { return s.replace(/[_^]\{([^}]*)\}/g, function (m0, x) { return (m0[0] === '_' ? '_' : '^') + x; }); }
  function labSvg(node, s) {
    var shift = 0;
    parts(s).forEach(function (p) {
      var want = p[1] === 'sub' ? 4 : p[1] === 'sup' ? -5 : 0, a = {};
      if (want !== shift) { a.dy = String(want - shift); shift = want; }
      if (p[1]) { a['font-size'] = '0.75em'; }
      svg('tspan', a, node, p[0]);
    });
  }

  /* nice ticks for a linear axis */
  function ticks(lo, hi, n) {
    var span = hi - lo || 1, step = Math.pow(10, Math.floor(Math.log10(span / n))), err = span / n / step;
    step *= err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1;
    var out = [];
    for (var v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) { out.push(Math.abs(v) < step * 1e-9 ? 0 : v); }
    return { list: out, step: step };
  }
  function tickText(v, step) { var d = step >= 1 ? 0 : Math.min(3, Math.ceil(-Math.log10(step) - 1e-9)); return v < 0 ? '−' + Math.abs(v).toFixed(d) : v.toFixed(d); }
  function linear(d0, d1, r0, r1) { return function (v) { return r0 + (v - d0) / (d1 - d0) * (r1 - r0); }; }
  function extent(vals, pad) {
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), p = (hi - lo || Math.abs(hi) || 1) * pad;
    return [lo - p, hi + p];
  }

  /* ================= Figure Q1: follow one benchmark across both panels ================= */
  var PREF = { frames: ['#4285f4', 'Frame gain larger', '帧数增益更大'], pixels: ['#db4437', 'Pixel gain larger', '像素增益更大'], within: ['#5f6368', 'Within 5%', '相差在 5% 以内'] };
  var q1 = { pinned: null };
  function figureQ1(wrap) {
    var q = A.q1;
    var old = wrap.querySelector('svg.vi-overlay__svg');
    if (old) { wrap.removeChild(old); }
    var oldBar = wrap.previousElementSibling;
    if (oldBar && oldBar.classList.contains('vi-q1__bar')) { oldBar.parentNode.removeChild(oldBar); }
    var bar = el('div', { class: 'vi-ctl vi-q1__bar' });
    wrap.parentNode.insertBefore(bar, wrap);
    var input = el('input', { type: 'search', class: 'vi-input', list: 'vi-q1-names', placeholder: t('Find one of the 57 benchmarks…', '在 57 个 benchmark 中查找…'), 'aria-label': t('Find a benchmark', '查找 benchmark') }, bar);
    var dl = el('datalist', { id: 'vi-q1-names' }, bar);
    q.lines.map(function (l) { return l.name; }).sort(function (a, b) { return a.toLowerCase() < b.toLowerCase() ? -1 : 1; })
      .forEach(function (n) { el('option', { value: n }, dl); });
    if (q1.pinned && q1.pinned.indexOf('group:') !== 0) { input.value = q1.pinned; }

    var s = svg('svg', { viewBox: '0 0 ' + q.w + ' ' + q.h, preserveAspectRatio: 'none', class: 'vi-overlay__svg vi-q1', 'aria-hidden': 'true' }, wrap);
    q.axes.forEach(function (b) { svg('rect', { x: b[0], y: b[1], width: b[2], height: b[3], class: 'vi-q1__dim' }, s); });
    var hi = svg('g', {}, s), hits = svg('g', {}, s), named = {};
    q.labels.forEach(function (lb) { named[lb.panel + '|' + lb.name] = true; });    /* the figure already names these */
    function pts(p) { return p.map(function (xy) { return xy[0] + ',' + xy[1]; }).join(' '); }
    function draw(sel) {
      clear(hi);
      s.classList.toggle('is-active', !!sel);
      if (!sel) { return; }
      sel.forEach(function (ln) {
        var c = PREF[ln.pref][0];
        ln.pts.forEach(function (p, k) {
          svg('polyline', { points: pts(p), class: 'vi-q1__line', stroke: c }, hi);
          if (sel.length === 1 && !named[k + '|' + ln.name]) {
            var last = p[p.length - 1], right = last[0] + 4 + ln.name.length * 3.6 > q.w;
            svg('text', { x: right ? last[0] - 3 : last[0] + 3, y: last[1] + 2.4, 'text-anchor': right ? 'end' : 'start', class: 'vi-q1__name', fill: c }, hi, ln.name);
          }
        });
      });
    }
    function pinned() {
      if (!q1.pinned) { return null; }
      if (q1.pinned.indexOf('group:') === 0) { var k = q1.pinned.slice(6); return q.lines.filter(function (l) { return l.pref === k; }); }
      var one = q.lines.filter(function (l) { return l.name === q1.pinned; });
      return one.length ? one : null;
    }
    function restore() { draw(pinned()); }
    function lineTip(ln) {
      return '<b>' + esc(ln.name) + '</b><br>' + dot(PREF[ln.pref][0]) + t(PREF[ln.pref][1], PREF[ln.pref][2]) + '<br>' +
        t('Pixel gain ', '像素增益 ') + signed(ln.pix, 1) + ' · ' + t('frame gain ', '帧数增益 ') + signed(ln.frm, 1) +
        '<span class="vi-tip__grid"><span>' + t('168, 224, 336, 448 px, stored', '168、224、336、448 像素与存储分辨率') + '</span><b>' + ln.res.map(function (v) { return v.toFixed(1); }).join(' · ') + '</b>' +
        '<span>' + t('0.25, 0.5, 1, 2 fps', '0.25、0.5、1、2 fps') + '</span><b>' + ln.fps.map(function (v) { return v.toFixed(1); }).join(' · ') + '</b></span>' +
        '<span class="vi-tip__note">' + t('Accuracy in %. Click to keep it highlighted.', '准确率单位为 %。点击可保持高亮。') + '</span>';
    }
    function pin(v) { q1.pinned = q1.pinned === v ? null : v; input.value = q1.pinned && q1.pinned.indexOf('group:') !== 0 ? q1.pinned : ''; restore(); }
    function hover(node, lines, html, pinKey) {
      bindTip(node, html, function () { draw(lines); }, restore);
      node.addEventListener('click', function () { hideTip(); pin(pinKey); });
    }
    q.lines.forEach(function (ln) {
      ln.pts.forEach(function (p) {
        hover(svg('polyline', { points: pts(p), class: 'vi-q1__hit' }, hits), [ln], function () { return lineTip(ln); }, ln.name);
      });
    });
    q.labels.forEach(function (lb) {
      var ln = q.lines.filter(function (l) { return l.name === lb.name; })[0];
      if (!ln) { return; }
      var b = lb.box;
      hover(svg('rect', { x: b[0] - 1, y: b[1] - 1, width: b[2] + 2, height: b[3] + 2, class: 'vi-q1__box' }, hits), [ln], function () { return lineTip(ln); }, ln.name);
    });
    q.legend.forEach(function (lg) {
      var members = q.lines.filter(function (l) { return l.pref === lg.key; }), b = lg.box;
      hover(svg('rect', { x: b[0], y: b[1], width: b[2], height: b[3], class: 'vi-q1__box' }, hits), members, function () {
        return dot(PREF[lg.key][0]) + '<b>' + t(PREF[lg.key][1], PREF[lg.key][2]) + '</b> · ' + members.length + ' ' + t('benchmarks', '个 benchmark') + '<br>' +
          members.map(function (l) { return esc(l.name); }).sort(function (a, c) { return a.toLowerCase() < c.toLowerCase() ? -1 : 1; }).join(', ');
      }, 'group:' + lg.key);
    });
    input.addEventListener('input', function () {
      var v = input.value.trim().toLowerCase();
      var hit = q.lines.filter(function (l) { return l.name.toLowerCase() === v; })[0];
      if (hit) { q1.pinned = hit.name; } else if (!v) { q1.pinned = null; }
      restore();
    });
    restore();
  }

  /* ================= Figure 8: each benchmark's better settings on hover ================= */
  var RESL = ['168 px', '224 px', '336 px', '448 px'], FPSL = ['0.25 fps', '0.5 fps', '1 fps', '2 fps'];
  function argmax(vals) { var k = -1; vals.forEach(function (v, i) { if (v !== null && (k < 0 || v > vals[k])) { k = i; } }); return k; }
  function ladderLine(vals, labels) {
    return vals.map(function (v, i) { return labels[i] + ' ' + (v === null ? '–' : v.toFixed(1)); }).join(' · ');
  }
  function fig8Tip(it) {
    var p = it.pix - it.frm, key = p >= 5 ? 'pixels' : p <= -5 ? 'frames' : 'within';
    var verdict = { pixels: t('Pixels help more', '更多像素帮助更大'), frames: t('Frames help more', '更多帧帮助更大'), within: t('Pixels and frames help within 5 points of each other', '像素和帧数的帮助相差不到 5 个点') }[key];
    var rl = RESL.concat([t('stored', '存储分辨率')]), br = argmax(it.res), bf = argmax(it.fps);
    return '<b>' + esc(it.name) + '</b><br>' + dot(PREF[key][0]) + verdict + '<br>' +
      t('Pixel gain ', '像素增益 ') + signed(it.pix, 1) + ' · ' + t('frame gain ', '帧数增益 ') + signed(it.frm, 1) +
      '<span class="vi-tip__grid">' +
      (br >= 0 ? '<span>' + t('Best resolution', '最好的分辨率') + '</span><b class="is-axis">' + rl[br] + ' · ' + it.res[br].toFixed(1) + '%</b>' : '') +
      (bf >= 0 ? '<span>' + t('Best frame rate', '最好的帧率') + '</span><b class="is-axis">' + FPSL[bf] + ' · ' + it.fps[bf].toFixed(1) + '%</b>' : '') +
      '</span><span class="vi-tip__note">' + ladderLine(it.res, rl) + '<br>' + ladderLine(it.fps, FPSL) + '</span>';
  }
  function figure8(wrap) {
    var f = A.fig8;
    if (!f) { return; }
    var old = wrap.querySelector('svg.vi-overlay__svg');
    if (old) { wrap.removeChild(old); }
    var s = svg('svg', { viewBox: '0 0 ' + f.w + ' ' + f.h, preserveAspectRatio: 'none', class: 'vi-overlay__svg', 'aria-hidden': 'true' }, wrap);
    var ring = svg('circle', { r: 3.4, class: 'vi-ring', visibility: 'hidden' }, s);
    function mark(it) {
      var x = it.dot ? it.dot[0] : it.tick[0], y = it.dot ? it.dot[1] : it.tick[1] - 1.6;
      ring.setAttribute('cx', x); ring.setAttribute('cy', y); ring.setAttribute('visibility', 'visible');
    }
    function unmark() { ring.setAttribute('visibility', 'hidden'); }
    var byName = {};
    f.items.forEach(function (it) {
      byName[it.name] = it;
      var node = it.dot ? svg('circle', { cx: it.dot[0], cy: it.dot[1], r: 4.2, class: 'vi-hitmark' }, s)
        : svg('rect', { x: it.tick[0] - 1.6, y: it.tick[1] - 2, width: 3.2, height: it.tick[2] - it.tick[1] + 4, class: 'vi-hitmark' }, s);
      bindTip(node, function () { return fig8Tip(it); }, function () { mark(it); }, unmark);
    });
    f.labels.forEach(function (lb) {
      var it = byName[lb.name];
      if (!it) { return; }
      var b = lb.box;
      bindTip(svg('rect', { x: b[0] - 1, y: b[1] - 1, width: b[2] + 2, height: b[3] + 2, class: 'vi-hitmark' }, s), function () { return fig8Tip(it); }, function () { mark(it); }, unmark);
    });
  }

  /* ================= Figure 9: follow one long-video benchmark across the budgets ================= */
  var F9COL = ['#4285f4', '#db4437'];
  function figure9(wrap) {
    var f = A.fig9;
    if (!f) { return; }
    var old = wrap.querySelector('svg.vi-overlay__svg');
    if (old) { wrap.removeChild(old); }
    var s = svg('svg', { viewBox: '0 0 ' + f.w + ' ' + f.h, preserveAspectRatio: 'none', class: 'vi-overlay__svg', 'aria-hidden': 'true' }, wrap);
    var hl = svg('g', {}, s), hits = svg('g', {}, s);
    var GN9 = [t('Still gaining in reference', '参照模型仍在提高'), t('Remaining', '其余')];
    var byBench = {};
    f.dots.forEach(function (d) { (byBench[d[0]] = byBench[d[0]] || []).push(d); });
    function show(name, group) {
      clear(hl);
      var ds = byBench[name].slice().sort(function (a, b) { return a[2] - b[2]; });
      svg('polyline', { points: ds.map(function (d) { return d[4] + ',' + d[5]; }).join(' '), class: 'vi-f9-line', stroke: F9COL[group] }, hl);
      ds.forEach(function (d) { svg('circle', { cx: d[4], cy: d[5], r: 2.2, fill: F9COL[group], class: 'vi-f9-dot' }, hl); });
    }
    function tipFor(d) {
      var ys = f.curves[d[0]];
      return '<b>' + esc(d[0]) + '</b><br>' + dot(F9COL[d[1]]) + GN9[d[1]] + '<span class="vi-tip__grid">' + f.budgets.map(function (bud, k) {
        var cls = k === d[2] ? ' class="is-axis"' : '';
        return '<span' + cls + '>' + bud + t(' frames', ' 帧') + '</span><b' + cls + '>' + (ys[k] === null ? '–' : ys[k].toFixed(1) + '%') + '</b>';
      }).join('') + '</span>';
    }
    f.bars.forEach(function (b) {
      var x = b[6], top = b[7], bottom = b[9];
      var node = svg('rect', { x: x - 4, y: Math.min(top, b[11]) - 3, width: 8, height: Math.max(bottom, b[11]) - Math.min(top, b[11]) + 6, class: 'vi-hitmark' }, hits);
      bindTip(node, function () {
        return '<b>' + GN9[b[0]] + ' · ' + f.budgets[b[1]] + t(' frames', ' 帧') + '</b><br>' + b[2] + t(' benchmarks', ' 个 benchmark') +
          '<span class="vi-tip__grid"><span>' + t('Mean', '均值') + '</span><b class="is-axis">' + b[3].toFixed(1) + '%</b><span>Q1–Q3</span><b>' + b[4].toFixed(1) + '–' + b[5].toFixed(1) + '%</b></span>';
      });
    });
    f.dots.forEach(function (d) {
      bindTip(svg('circle', { cx: d[4], cy: d[5], r: 2.6, class: 'vi-hitmark' }, hits), function () { return tipFor(d); }, function () { show(d[0], d[1]); }, function () { clear(hl); });
    });
  }

  /* ================= Tables as scatter plots ================= */
  function chartWidth(node) { var w = node.clientWidth || 640; return Math.round(Math.max(300, Math.min(640, w))); }
  function col(i, en, zh, unit, extra) {
    var c = { i: i, en: en, zh: zh, unit: unit };
    for (var k in (extra || {})) { c[k] = extra[k]; }
    return c;
  }
  function rowsOf(k) { return TB[k].rows; }
  function decOf(k) { return TB[k].dec; }
  var ATT = { 'L0': '#9aa0a6', 'L1': '#f9ab00', 'L2-rule': '#34a853', 'L2-LLM': '#4285f4', 'L3': '#a142f4' };
  var CATCOL = { 'yes': '#d93025', 'no': '#8ab4f8' };
  var SCAT = {
    '7': { rows: function () { return rowsOf('7'); }, dec: function () { return decOf('7'); }, x: 0, y: 1,
      cols: [col(1, 'blind', '盲读', 'acc'), col(2, '1f', '单帧', 'acc'), col(3, '32f', '32 帧', 'acc')] },
    '8': { rows: function () { return rowsOf('8'); }, dec: function () { return decOf('8'); }, x: 2, y: 0,
      cols: [col(1, '32f', '32 帧', 'acc'), col(2, 'video cap.', '整段视频描述', 'acc'), col(3, 'Frame cap.', '逐帧描述', 'acc'), col(4, 'Cov.', '覆盖率', 'ratio')] },
    '14': {
      rows: function () {
        var c = {};
        TB['15'].rows.forEach(function (r) { c[r[0]] = r; });
        return TB['14'].rows.map(function (r) { var o = c[r[0]] || [r[0], r[1], null, null]; return [r[0], r[1], r[2], r[3], r[4], o[2], o[3]]; });
      },
      dec: function () { var a = TB['14'].dec, b = TB['15'].dec; return [a[0], a[1], a[2], a[3], b[1], b[2]]; }, x: 1, y: 3,
      cols: [col(1, 'n', 'n', 'count', { log: true }), col(2, 'ε_{pool}^{w}', 'ε_{pool}^{w}', 'eps'), col(3, 'Att.^{w}', '攻击者^{w}', 'cat', { pal: ATT }),
        col(4, 'ALC^{w}', 'ALC^{w}', 'alc'), col(5, 'ε_{pool}^{c}', 'ε_{pool}^{c}', 'eps'), col(6, 'Att.^{c}', '攻击者^{c}', 'cat', { pal: ATT })] },
    '16': { rows: function () { return rowsOf('16'); }, dec: function () { return decOf('16'); }, x: 1, y: 5,
      cols: [col(1, 'VS/n', 'VS/n', 'vs'), col(2, 'NearDup %', '近似重复 %', 'share'), col(3, 'SameVid %', '同视频 %', 'share2'), col(4, 'TemplEnt', '模板熵', 'ent'),
        col(5, 'AnsPosEnt', '答案位置熵', 'ent2'), col(6, 'EffN', '有效题目数', 'effn')] },
    '17': { rows: function () { return rowsOf('17'); }, dec: function () { return decOf('17'); }, x: 2, y: 6,
      cols: [col(1, 'blind', '盲读', 'acc'), col(2, '1f', '单帧', 'acc'), col(3, '32f', '32 帧', 'acc'), col(4, '448px', '448 像素', 'acc'), col(5, '224px', '224 像素', 'acc'),
        col(6, '128f', '128 帧', 'acc'), col(7, 'shuf', '打乱', 'acc'), col(8, 'half1', '前半', 'acc'), col(9, 'half2', '后半', 'acc'), col(10, 'off1', '偏移 1', 'acc'), col(11, 'off2', '偏移 2', 'acc')] },
    '18': { rows: function () { return rowsOf('18'); }, dec: function () { return decOf('18'); }, x: 0, y: 6,
      cols: [col(1, 'm', 'm', 'p1', { ref: 0 }), col(2, 'S', 'S', 'p2', { ref: 0 }), col(3, 'T_{coarse}', 'T_{coarse}', 'p3', { ref: 0 }), col(4, 'O', 'O', 'p4', { ref: 0 }),
        col(5, 'L', 'L', 'p5', { ref: 0 }), col(6, 'PosBias', 'PosBias', 'p6'), col(7, 'Φ_{flip}', 'Φ_{flip}', 'p7'), col(8, 'PriorDom', 'PriorDom', 'cat', { pal: CATCOL })] },
    '19': { rows: function () { return rowsOf('19'); }, dec: function () { return decOf('19'); }, x: 3, y: 4,
      cols: [col(1, '8f', '8 帧', 'acc'), col(2, '32f', '32 帧', 'acc'), col(3, '128f', '128 帧', 'acc'), col(4, 'Window ret.', '窗口保留率', 'ret', { ref: 1 }), col(5, 'Shuffle ret.', '打乱保留率', 'ret', { ref: 1 })] }
  };
  var DIAG = { acc: 1, eps: 1 };
  function label(c) { return t(c.en, c.zh); }

  function colourer(spec, st) {
    if (st.colour === 'level') {
      return { of: function (r) { return BY[r[0]] ? BY[r[0]].level : null; }, col: function (k) { return LVCOL[k]; }, name: function (k) { return U.lvName(k); }, keys: U.LV6 };
    }
    if (st.colour === 'group') {
      return { of: function (r) { return BY[r[0]] ? BY[r[0]].group : null; }, col: function (k) { return GC[k]; }, name: function (k) { return U.gName(k); }, keys: U.GROUPS };
    }
    var c = spec.cols.filter(function (x) { return x.unit === 'cat' && String(x.i) === st.colour; })[0];
    var keys = Object.keys(c.pal);
    return { of: function (r) { return r[c.i]; }, col: function (k) { return c.pal[k] || '#bdc1c6'; }, name: function (k) { return String(k); }, keys: keys };
  }

  function scatter(container) {
    var key = container.getAttribute('data-table'), spec = SCAT[key];
    if (!spec) { return; }
    var st = spec.st || (spec.st = { x: spec.x, y: spec.y, colour: 'level', q: '', hidden: {}, view: 'chart', sort: 0, dir: 1 });
    clear(container);
    var rows = spec.rows(), dec = spec.dec(), cols = spec.cols;
    var nums = cols.filter(function (c) { return c.unit !== 'cat'; });
    var fmtCell = function (r, c) { return fx(r[c.i], dec[c.i - 1]); };

    var bar = el('div', { class: 'vi-ctl' }, container);
    function select(labelText, options, value, onChange) {
      var lab = el('label', { class: 'vi-ctl__field' }, bar);
      el('span', {}, lab, labelText);
      var s = el('select', { class: 'vi-select' }, lab);
      options.forEach(function (o) { var op = el('option', { value: o[0] }, s, o[1]); if (String(o[0]) === String(value)) { op.selected = true; } });
      s.addEventListener('change', function () { onChange(s.value); });
      return s;
    }
    var axisOpts = nums.map(function (c, k) { return [k, labPlain(label(c))]; });
    select(t('X', 'X 轴'), axisOpts, st.x, function (v) { st.x = +v; scatter(container); });
    select(t('Y', 'Y 轴'), axisOpts, st.y, function (v) { st.y = +v; scatter(container); });
    var colourOpts = [['level', t('Breaking level', '被攻破层级')], ['group', t('Capability group', '能力组')]].concat(
      cols.filter(function (c) { return c.unit === 'cat'; }).map(function (c) { return [String(c.i), labPlain(label(c))]; }));
    select(t('Colour', '颜色'), colourOpts, st.colour, function (v) { st.colour = v; st.hidden = {}; scatter(container); });
    var search = el('input', { type: 'search', class: 'vi-input', placeholder: t('Find a benchmark…', '查找 benchmark…'), 'aria-label': t('Find a benchmark', '查找 benchmark') }, bar);
    search.value = st.q;
    var seg = el('div', { class: 'vi-seg', role: 'group' }, bar);
    button(seg, '', t('Chart', '图'), st.view === 'chart', function () { st.view = 'chart'; scatter(container); });
    button(seg, '', t('Table', '表'), st.view === 'table', function () { st.view = 'table'; scatter(container); });

    var C = colourer(spec, st);
    var legend = el('div', { class: 'vi-chips vi-legend' }, container);
    C.keys.forEach(function (k) {
      var n = rows.filter(function (r) { return C.of(r) === k; }).length;
      if (!n) { return; }
      var b = button(legend, 'vi-chip' + (st.hidden[k] ? ' is-off' : ''), '<i class="vi-legend__dot" style="background:' + C.col(k) + '"></i>' + esc(C.name(k)) + ' <span class="vi-chip__n">' + n + '</span>', !st.hidden[k], function () {
        st.hidden[k] = !st.hidden[k];
        scatter(container);
      });
      b.title = t('Show or hide', '显示或隐藏');
    });
    var body = el('div', { class: 'vi-sc-body' }, container);
    function visible(r) { return !st.hidden[C.of(r)]; }
    function matches(r) { var q = st.q.trim().toLowerCase(); return q && r[0].toLowerCase().indexOf(q) >= 0; }

    function rowTip(r, cx, cy) {
      var b = BY[r[0]];
      var grid = cols.map(function (c) {
        var axis = c === cx || c === cy;
        return '<span' + (axis ? ' class="is-axis"' : '') + '>' + labHtml(label(c)) + '</span><b' + (axis ? ' class="is-axis"' : '') + '>' + esc(fmtCell(r, c)) + '</b>';
      }).join('');
      return '<b>' + esc(r[0]) + '</b>' + (b ? '<br>' + U.chipHtml(b.level) + ' · ' + esc(U.gName(b.group)) : '') + '<span class="vi-tip__grid">' + grid + '</span>';
    }

    function chart() {
      var cx = nums[st.x], cy = nums[st.y];
      var all = rows.filter(function (r) { return isNum(r[cx.i]) && isNum(r[cy.i]); });
      var pts = all.filter(visible);
      var W = chartWidth(body), narrow = W < 520;       /* drawn at the width it gets, so text keeps its size on phones */
      var H = narrow ? Math.round(W * 0.92) : 420, L = narrow ? 48 : 60, R = narrow ? 10 : 18, T = 14, Bt = narrow ? 46 : 50;
      var diag = cx.unit === cy.unit && DIAG[cx.unit] && cx !== cy;
      var xs = pts.map(function (r) { return r[cx.i]; }), ys = pts.map(function (r) { return r[cy.i]; });
      if (!pts.length) { xs = [0, 1]; ys = [0, 1]; }
      if (cx.ref !== undefined) { xs = xs.concat([cx.ref]); }
      if (cy.ref !== undefined) { ys = ys.concat([cy.ref]); }
      var logX = !!cx.log, logY = !!cy.log;
      function tr(v, log) { return log ? Math.log10(Math.max(v, 1)) : v; }
      var dx = extent(xs.map(function (v) { return tr(v, logX); }), 0.05), dy = extent(ys.map(function (v) { return tr(v, logY); }), 0.05);
      if (diag) { dx = dy = [Math.min(dx[0], dy[0]), Math.max(dx[1], dy[1])]; }
      var sx = linear(dx[0], dx[1], L, W - R), sy = linear(dy[0], dy[1], H - Bt, T);
      var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'vi-sc-svg', role: 'img', 'aria-label': labPlain(label(cy)) + ' / ' + labPlain(label(cx)) }, body);
      function axis(domain, log, isX) {
        var list;
        if (log) {
          list = [];
          for (var e = Math.ceil(domain[0]); e <= Math.floor(domain[1]); e++) { list.push({ v: e, s: Math.pow(10, e) >= 1000 ? (Math.pow(10, e) / 1000) + 'k' : String(Math.pow(10, e)) }); }
        } else {
          var tk = ticks(domain[0], domain[1], isX ? 6 : 5);
          list = tk.list.map(function (v) { return { v: v, s: tickText(v, tk.step) }; });
        }
        list.forEach(function (o) {
          if (isX) {
            var x = sx(o.v);
            svg('line', { x1: x, x2: x, y1: T, y2: H - Bt, class: 'vi-sc-grid' }, s);
            svg('text', { x: x, y: H - Bt + 17, 'text-anchor': 'middle', class: 'vi-sc-tick' }, s, o.s);
          } else {
            var y = sy(o.v);
            svg('line', { x1: L, x2: W - R, y1: y, y2: y, class: 'vi-sc-grid' }, s);
            svg('text', { x: L - 8, y: y + 4, 'text-anchor': 'end', class: 'vi-sc-tick' }, s, o.s);
          }
        });
      }
      axis(dx, logX, true);
      axis(dy, logY, false);
      svg('line', { x1: L, x2: W - R, y1: H - Bt, y2: H - Bt, class: 'vi-sc-axis' }, s);
      svg('line', { x1: L, x2: L, y1: T, y2: H - Bt, class: 'vi-sc-axis' }, s);
      labSvg(svg('text', { x: (L + W - R) / 2, y: H - 10, 'text-anchor': 'middle', class: 'vi-sc-title' }, s), label(cx));
      labSvg(svg('text', { x: 16, y: (T + H - Bt) / 2, 'text-anchor': 'middle', transform: 'rotate(-90 16 ' + ((T + H - Bt) / 2) + ')', class: 'vi-sc-title' }, s), label(cy));
      var clipId = 'vi-sc-clip-' + key;
      var defs = svg('defs', {}, s);
      svg('rect', { x: L, y: T, width: W - R - L, height: H - Bt - T }, svg('clipPath', { id: clipId }, defs));
      var plot = svg('g', { 'clip-path': 'url(#' + clipId + ')' }, s);
      if (diag) { svg('line', { x1: sx(dx[0]), y1: sy(dx[0]), x2: sx(dx[1]), y2: sy(dx[1]), class: 'vi-sc-ref' }, plot); }
      if (cx.ref !== undefined) { svg('line', { x1: sx(tr(cx.ref, logX)), x2: sx(tr(cx.ref, logX)), y1: T, y2: H - Bt, class: 'vi-sc-ref' }, plot); }
      if (cy.ref !== undefined) { svg('line', { x1: L, x2: W - R, y1: sy(tr(cy.ref, logY)), y2: sy(tr(cy.ref, logY)), class: 'vi-sc-ref' }, plot); }
      var anyHit = pts.some(matches), hitList = [];
      pts.forEach(function (r) {
        var hit = matches(r);
        var c = svg('circle', { cx: sx(tr(r[cx.i], logX)), cy: sy(tr(r[cy.i], logY)), r: hit ? 6 : 4.6, fill: C.col(C.of(r)) || '#bdc1c6',
          class: 'vi-sc-pt' + (hit ? ' is-hit' : anyHit ? ' is-dim' : '') }, plot);
        bindTip(c, function () { return rowTip(r, cx, cy); }, function () { c.setAttribute('r', 7); }, function () { c.setAttribute('r', hit ? 6 : 4.6); });
        if (hit) { hitList.push([c, r]); }
      });
      hitList.slice(0, 12).forEach(function (h) {
        var x = +h[0].getAttribute('cx'), y = +h[0].getAttribute('cy'), right = x > W - (narrow ? 110 : 160);
        svg('text', { x: right ? x - 9 : x + 9, y: y + 4, 'text-anchor': right ? 'end' : 'start', class: 'vi-sc-label' }, plot, h[1][0]);
        plot.appendChild(h[0]);
      });
    }

    function table() {
      var wrap = el('div', { class: 'vi-explorer__wrap' }, body);
      var tb = el('table', { class: 'vi-explorer__table vi-sc-table' }, wrap);
      var tr = el('tr', {}, el('thead', {}, tb));
      [{ i: 0, en: 'Benchmark', zh: 'benchmark', unit: 'name' }].concat(cols).forEach(function (c) {
        var th = el('th', { class: c.unit === 'name' || c.unit === 'cat' ? '' : 'n', scope: 'col' }, tr);
        var b = button(th, 'vi-sort', labHtml(label(c)) + (st.sort === c.i ? (st.dir > 0 ? ' ↑' : ' ↓') : ''), null, function () {
          if (st.sort === c.i) { st.dir = -st.dir; } else { st.sort = c.i; st.dir = c.i === 0 || c.unit === 'cat' ? 1 : -1; }
          scatter(container);
        });
        b.removeAttribute('aria-pressed');
      });
      var tbody = el('tbody', {}, tb);
      var q = st.q.trim().toLowerCase();
      var list = rows.filter(function (r) { return visible(r) && (!q || r[0].toLowerCase().indexOf(q) >= 0); });
      list.sort(function (a, b) {
        var va = a[st.sort], vb = b[st.sort];
        if (va === null || va === undefined) { return 1; }
        if (vb === null || vb === undefined) { return -1; }
        if (typeof va === 'string') { return st.dir * (va.toLowerCase() < vb.toLowerCase() ? -1 : va.toLowerCase() > vb.toLowerCase() ? 1 : 0); }
        return st.dir * (va - vb);
      });
      list.forEach(function (r) {
        var row = el('tr', {}, tbody);
        var name = el('td', {}, row);
        el('i', { class: 'vi-legend__dot', style: 'background:' + (C.col(C.of(r)) || '#bdc1c6') }, name);
        name.appendChild(document.createTextNode(r[0]));
        cols.forEach(function (c) { el('td', { class: c.unit === 'cat' ? '' : 'n' }, row, fmtCell(r, c)); });
      });
    }
    function render() { clear(body); if (st.view === 'table') { table(); } else { chart(); } }
    search.addEventListener('input', function () { st.q = search.value; render(); });
    render();
  }

  /* ================= Table 20: one line per benchmark over the frame budgets ================= */
  var SAT = { 32: '#aecbfa', 128: '#669df6', 512: '#174ea6' };
  var l20 = { q: '', hidden: {}, view: 'chart', sort: 0, dir: 1 };
  var L20COLS = [col(1, 'n', 'n', 'count'), col(2, 'Chance', '随机', 'acc'), col(3, '32f', '32 帧', 'acc'), col(4, '128f', '128 帧', 'acc'), col(5, '512f', '512 帧', 'acc'),
    col(6, '600f', '600 帧', 'acc'), col(7, 'Med. frames', '帧数中位数', 'count'), col(8, 'Sat.', '饱和点', 'count')];
  function lines20(container) {
    var rows = TB['20'].rows, dec = TB['20'].dec, st = l20;
    clear(container);
    var bar = el('div', { class: 'vi-ctl' }, container);
    var search = el('input', { type: 'search', class: 'vi-input', placeholder: t('Find a benchmark…', '查找 benchmark…'), 'aria-label': t('Find a benchmark', '查找 benchmark') }, bar);
    search.value = st.q;
    var seg = el('div', { class: 'vi-seg', role: 'group' }, bar);
    button(seg, '', t('Chart', '图'), st.view === 'chart', function () { st.view = 'chart'; lines20(container); });
    button(seg, '', t('Table', '表'), st.view === 'table', function () { st.view = 'table'; lines20(container); });
    var legend = el('div', { class: 'vi-chips vi-legend' }, container);
    [32, 128, 512].forEach(function (k) {
      var n = rows.filter(function (r) { return r[8] === k; }).length;
      button(legend, 'vi-chip' + (st.hidden[k] ? ' is-off' : ''), '<i class="vi-legend__dot" style="background:' + SAT[k] + '"></i>' + t('Saturates at ' + k + ' frames', '在 ' + k + ' 帧饱和') + ' <span class="vi-chip__n">' + n + '</span>', !st.hidden[k], function () {
        st.hidden[k] = !st.hidden[k];
        lines20(container);
      });
    });
    var body = el('div', { class: 'vi-sc-body' }, container);
    function rowTip(r) {
      var grid = L20COLS.map(function (c) { return '<span>' + labHtml(label(c)) + '</span><b>' + esc(fx(r[c.i], dec[c.i - 1])) + '</b>'; }).join('');
      var b = BY[r[0]];
      return '<b>' + esc(r[0]) + '</b>' + (b ? '<br>' + U.chipHtml(b.level) : '') + '<span class="vi-tip__grid">' + grid + '</span>';
    }
    function chart() {
      var W = chartWidth(body), narrow = W < 520, xsv = [3, 4, 5, 6], xl = ['32', '128', '512', '600'];
      var H = narrow ? Math.round(W * 0.95) : 380, L = narrow ? 44 : 56, R = narrow ? 64 : 120, T = 14, Bt = 48;
      var shown = rows.filter(function (r) { return !st.hidden[r[8]]; });
      var vals = [];
      shown.forEach(function (r) { [2].concat(xsv).forEach(function (i) { if (isNum(r[i])) { vals.push(r[i]); } }); });    /* chance too, for its dashed line */
      if (!vals.length) { vals = [0, 100]; }
      var d = extent(vals, 0.06), tk = ticks(Math.max(0, d[0]), Math.min(100, d[1]), 5);
      var y0 = Math.min(tk.list[0], Math.max(0, d[0])), y1 = Math.max(tk.list[tk.list.length - 1], Math.min(100, d[1]));
      var sy = linear(y0, y1, H - Bt, T), step = (W - L - R) / (xsv.length - 1);
      function sx(k) { return L + k * step; }
      var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'vi-sc-svg', role: 'img', 'aria-label': t('Accuracy by frame budget', '各帧预算下的准确率') }, body);
      tk.list.forEach(function (v) {
        svg('line', { x1: L, x2: W - R, y1: sy(v), y2: sy(v), class: 'vi-sc-grid' }, s);
        svg('text', { x: L - 8, y: sy(v) + 4, 'text-anchor': 'end', class: 'vi-sc-tick' }, s, tickText(v, tk.step));
      });
      xl.forEach(function (lab, k) {
        svg('line', { x1: sx(k), x2: sx(k), y1: T, y2: H - Bt, class: 'vi-sc-grid' }, s);
        svg('text', { x: sx(k), y: H - Bt + 17, 'text-anchor': 'middle', class: 'vi-sc-tick' }, s, lab);
      });
      svg('line', { x1: L, x2: W - R, y1: H - Bt, y2: H - Bt, class: 'vi-sc-axis' }, s);
      svg('line', { x1: L, x2: L, y1: T, y2: H - Bt, class: 'vi-sc-axis' }, s);
      svg('text', { x: (L + W - R) / 2, y: H - 10, 'text-anchor': 'middle', class: 'vi-sc-title' }, s, t('Frames sent to Claude Opus 5', '发给 Claude Opus 5 的帧数'));
      svg('text', { x: 16, y: (T + H - Bt) / 2, 'text-anchor': 'middle', transform: 'rotate(-90 16 ' + ((T + H - Bt) / 2) + ')', class: 'vi-sc-title' }, s, t('Accuracy (%)', '准确率 (%)'));
      var chance = svg('g', {}, s), lines = svg('g', {}, s), labels = svg('g', {}, s), hits = svg('g', {}, s);
      var q = st.q.trim().toLowerCase(), anyHit = q && shown.some(function (r) { return r[0].toLowerCase().indexOf(q) >= 0; });
      var drawn = [];
      function path(r) {
        return xsv.map(function (i, k) { return isNum(r[i]) ? sx(k) + ',' + sy(r[i]) : null; }).filter(Boolean).join(' ');
      }
      shown.forEach(function (r) {
        var hit = q && r[0].toLowerCase().indexOf(q) >= 0;
        var ln = svg('polyline', { points: path(r), class: 'vi-ln' + (hit ? ' is-hit' : anyHit ? ' is-dim' : ''), stroke: SAT[r[8]] }, lines);
        drawn.push([ln, r, hit]);
      });
      function focus(r) {
        clear(chance); clear(labels);
        drawn.forEach(function (d2) { d2[0].classList.toggle('is-dim', d2[1] !== r); d2[0].classList.toggle('is-hit', d2[1] === r); if (d2[1] === r) { lines.appendChild(d2[0]); } });
        if (isNum(r[2])) {
          svg('line', { x1: L, x2: W - R, y1: sy(r[2]), y2: sy(r[2]), class: 'vi-sc-ref' }, chance);
          svg('text', { x: W - R + 6, y: sy(r[2]) + 4, class: 'vi-sc-tick' }, chance, t('chance ', '随机 ') + r[2]);
        }
        nameAt(r);
      }
      function nameAt(r) {
        var last = xsv.filter(function (i) { return isNum(r[i]); }).pop(), x = sx(xsv.indexOf(last)), y = sy(r[last]);
        svg('text', narrow ? { x: x, y: y - 9, 'text-anchor': 'end', class: 'vi-sc-label' } : { x: x + 8, y: y + 4, class: 'vi-sc-label' }, labels, r[0]);
      }
      function unfocus() {
        clear(chance); clear(labels);
        drawn.forEach(function (d2) { d2[0].classList.toggle('is-dim', !!anyHit && !d2[2]); d2[0].classList.toggle('is-hit', !!d2[2]); });
        drawn.filter(function (d2) { return d2[2]; }).slice(0, 8).forEach(function (d2) { nameAt(d2[1]); });
      }
      drawn.forEach(function (d2) {
        var hitLine = svg('polyline', { points: path(d2[1]), class: 'vi-ln-hit' }, hits);
        bindTip(hitLine, function () { return rowTip(d2[1]); }, function () { focus(d2[1]); }, unfocus);
      });
      unfocus();
    }
    function table() {
      var wrap = el('div', { class: 'vi-explorer__wrap' }, body);
      var tb = el('table', { class: 'vi-explorer__table vi-sc-table' }, wrap);
      var tr = el('tr', {}, el('thead', {}, tb));
      [{ i: 0, en: 'Benchmark', zh: 'benchmark', unit: 'name' }].concat(L20COLS).forEach(function (c) {
        var th = el('th', { class: c.unit === 'name' ? '' : 'n', scope: 'col' }, tr);
        var b = button(th, 'vi-sort', labHtml(label(c)) + (st.sort === c.i ? (st.dir > 0 ? ' ↑' : ' ↓') : ''), null, function () {
          if (st.sort === c.i) { st.dir = -st.dir; } else { st.sort = c.i; st.dir = c.i === 0 ? 1 : -1; }
          lines20(container);
        });
        b.removeAttribute('aria-pressed');
      });
      var tbody = el('tbody', {}, tb), q = st.q.trim().toLowerCase();
      var list = rows.filter(function (r) { return !st.hidden[r[8]] && (!q || r[0].toLowerCase().indexOf(q) >= 0); });
      list.sort(function (a, b) {
        var va = a[st.sort], vb = b[st.sort];
        if (typeof va === 'string') { return st.dir * (va.toLowerCase() < vb.toLowerCase() ? -1 : 1); }
        return st.dir * ((isNum(va) ? va : -1) - (isNum(vb) ? vb : -1));
      });
      list.forEach(function (r) {
        var row = el('tr', {}, tbody), name = el('td', {}, row);
        el('i', { class: 'vi-legend__dot', style: 'background:' + SAT[r[8]] }, name);
        name.appendChild(document.createTextNode(r[0]));
        L20COLS.forEach(function (c) { el('td', { class: 'n' }, row, fx(r[c.i], dec[c.i - 1])); });
      });
    }
    search.addEventListener('input', function () { st.q = search.value; clear(body); if (st.view === 'table') { table(); } else { chart(); } });
    if (st.view === 'table') { table(); } else { chart(); }
  }

  /* ================= Tables 11 and 12: duplicate flows and their example questions ================= */
  var dupSel = 0;                      /* the Table 11 flow whose questions show under the heat map */
  function examples(panel, r) {
    clear(panel);
    var head = el('p', { class: 'vi-dupex__head' }, panel);
    head.innerHTML = '<b>' + esc(r[0]) + '</b> · <b>' + esc(r[1]) + '</b> · ' +
      t(r[2] + ' near-duplicate pairs, ' + r[3] + ' of them verbatim', r[2] + ' 对近似重复，其中 ' + r[3] + ' 对逐字相同');
    function block(parent, name, text) {
      var q = el('div', { class: 'vi-dupex__q' }, parent);
      el('span', { class: 'vi-dupex__src' }, q, name);
      el('span', {}, q, text);
    }
    r[4].forEach(function (e) {
      var pair = el('div', { class: 'vi-dupex__pair' }, panel);
      el('p', { class: 'vi-dupex__kind' }, pair, t('Near-duplicate', '近似重复'));
      block(pair, r[0], e[0]);
      block(pair, r[1], e[1]);
      el('p', { class: 'vi-dupex__sim' }, pair, t('Question cosine similarity: BGE-large ', '问题余弦相似度：BGE-large ') + e[2].toFixed(3) + ' · MPNet ' + e[3].toFixed(3));
    });
    r[5].forEach(function (e) {
      var pair = el('div', { class: 'vi-dupex__pair is-exact' }, panel);
      el('p', { class: 'vi-dupex__kind' }, pair, t('Verbatim', '逐字相同'));
      if (e[0].trim() === e[1].trim()) { block(pair, r[0] + ' · ' + r[1], e[0]); } else { block(pair, r[0], e[0]); block(pair, r[1], e[1]); }
    });
  }
  function heatColour(v, max) {
    var f = Math.sqrt(Math.max(0, v) / max), a = [238, 243, 253], b = [23, 78, 166];
    return { bg: 'rgb(' + a.map(function (x, k) { return Math.round(x + (b[k] - x) * f); }).join(',') + ')', ink: f > 0.55 ? '#fff' : '#202124' };
  }
  function dupshare(container) {
    clear(container);
    var d = TB['12'], names = d.rows.map(function (r) { return r[0]; });
    var max = Math.max.apply(null, d.rows.map(function (r) { return Math.max.apply(null, r.slice(1).filter(isNum)); }));
    var flow = {};
    TB['11'].forEach(function (r, k) { flow[r[0] + '|' + r[1]] = flow[r[1] + '|' + r[0]] = k; });
    var wrap = el('div', { class: 'vi-heat-wrap' }, container);
    var tb = el('table', { class: 'vi-heat' }, wrap);
    var tr = el('tr', {}, el('thead', {}, tb));
    el('th', { class: 'row', scope: 'col' }, tr, t('Items of', '题目来自'));
    d.codes.forEach(function (c, k) {
      var th = el('th', { scope: 'col' }, tr, c);
      bindTip(th, function () { return '<b>' + c + '</b> ' + esc(names[k]); });
    });
    var tbody = el('tbody', {}, tb), linked = [];
    var panel = el('div', { class: 'vi-dupex', 'aria-live': 'polite' }, container);
    function pick(k) {
      dupSel = k;
      linked.forEach(function (td) { td.classList.toggle('is-selected', +td.getAttribute('data-flow') === k); });
      examples(panel, TB['11'][k]);
    }
    d.rows.forEach(function (r) {
      var row = el('tr', {}, tbody);
      el('th', { class: 'row', scope: 'row' }, row, r[0]);
      r.slice(1).forEach(function (v, k) {
        var other = names[k], td = el('td', {}, row, v === null ? '–' : v === 0 ? '0' : v.toFixed(1));
        if (!isNum(v) || v === 0) { return; }
        var c = heatColour(v, max);
        td.style.background = c.bg;
        td.style.color = c.ink;
        var f = flow[r[0] + '|' + other];
        if (f !== undefined) {
          td.classList.add('is-link');
          td.setAttribute('data-flow', f);
          linked.push(td);
          td.addEventListener('click', function () { hideTip(); pick(f); });
        }
        bindTip(td, function () {
          return t('<b>' + v.toFixed(1) + '%</b> of ' + esc(r[0]) + ' items have a near-duplicate in ' + esc(other), esc(r[0]) + ' 的题目中有 <b>' + v.toFixed(1) + '%</b> 在 ' + esc(other) + ' 里有近似重复');
        });
      });
    });
    pick(dupSel);
  }

  /* ================= Tables 34 to 37: the strongest benchmarks of each group ================= */
  var RK = { tab: 0 };
  var RKT = [['34', 'Perception'], ['35', 'Temporal'], ['36', 'Spatial / physical'], ['37', 'Reasoning / knowledge']];
  var RKL = { 'Survives': ['unbroken', 'Survives', '幸存'], 'Option': ['option', 'Option', '选项'], 'Text': ['text', 'Text', '文本'], 'Pool': ['pool', 'Pool', '题库'], 'Frame': ['frame', 'Frame', '帧'], 'Order': ['order', 'Order', '顺序'] };
  function rank(container) {
    clear(container);
    var tabs = el('div', { class: 'vi-chips', role: 'tablist' }, container);
    RKT.forEach(function (g, k) {
      var b = button(tabs, 'vi-chip' + (k === RK.tab ? ' is-on' : ''), '<i class="vi-legend__dot" style="background:' + GC[g[1]] + '"></i>' + esc(U.gName(g[1])), null, function () { RK.tab = k; rank(container); });
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(k === RK.tab));
    });
    var all = [];
    RKT.forEach(function (g) { TB[g[0]].forEach(function (r) { all.push(parseFloat(r[2])); }); });
    var lo = Math.min(0, Math.min.apply(null, all)), hi = Math.max.apply(null, all), zero = 100 * (-lo) / (hi - lo);
    var wrap = el('div', { class: 'vi-explorer__wrap vi-rank__wrap' }, container);
    var tb = el('table', { class: 'vi-explorer__table vi-rank' }, wrap);
    var tr = el('tr', {}, el('thead', {}, tb));
    [[t('Rank', '排名'), 'n'], [t('Benchmark', 'benchmark'), ''], [t('Level', '层级'), ''], [t('Margin', '余量'), 'n']].forEach(function (h) { el('th', { class: h[1], scope: 'col' }, tr, h[0]); });
    var tbody = el('tbody', {}, tb);
    TB[RKT[RK.tab][0]].forEach(function (r, k) {
      var row = el('tr', {}, tbody), lv = RKL[r[1]], m = parseFloat(r[2]);
      el('td', { class: 'n' }, row, String(k + 1));
      el('td', {}, row, r[0]);
      el('span', { class: 'vi-lvchip', style: 'background:' + LVCOL[lv[0]] + ';color:' + LVINK[lv[0]] }, el('td', {}, row), t(lv[1], lv[2]));
      var cell = el('td', { class: 'n' }, row);
      var track = el('span', { class: 'vi-mbar' }, cell);
      var w = 100 * Math.abs(m) / (hi - lo);
      el('i', { style: 'left:' + (m >= 0 ? zero : zero - w) + '%;width:' + w + '%;background:' + (m >= 0 ? '#4285f4' : '#d93025') }, track);
      el('b', { style: 'left:' + zero + '%' }, track);
      el('span', { class: 'vi-rval' }, cell, r[2].replace('-', '−'));
      var b = BY[r[0]];
      if (b) {
        bindTip(row, function () { return U.benchTip(b); });
      }
    });
    var fig = container.closest('figure');
    if (fig) {
      Array.prototype.forEach.call(fig.querySelectorAll('[data-rank]'), function (cap) {
        if (cap.getAttribute('data-rank') === RKT[RK.tab][0]) { cap.removeAttribute('hidden'); } else { cap.setAttribute('hidden', ''); }
      });
    }
  }

  /* ================= Tables 38 and 48 to 50 ================= */
  var STATIC = {
    '38': {
      head: [['Model', '模型'], ['Overall', '总体'], ['Blind', '盲读'], ['Gain', '增益'], ['Long video', '长视频'], ['First person', '第一人称'], ['Authenticity', '真实性']],
      rows: function () { return TB['38'].rows.concat([[t('Items', '题目数')].concat(TB['38'].items)]); }, foot: 1
    },
    '48': {
      head: [['Measure', '指标'], ['Astra', 'Astra'], ['Fable 5.1', 'Fable 5.1'], ['Gemini 3.1 Pro', 'Gemini 3.1 Pro'], ['Flash-Lite', 'Flash-Lite'], ['Opus 5', 'Opus 5']],
      rows: function () { return TB['48']; },
      zh: { 'Accuracy (%)': '准确率 (%)', 'Shell commands per item': '每题 shell 命令数', 'Sessions using ffmpeg (%)': '使用 ffmpeg 的会话 (%)',
        'Sessions using OpenCV (%)': '使用 OpenCV 的会话 (%)', 'Sessions using Pillow (%)': '使用 Pillow 的会话 (%)', 'Sessions with a contact sheet (%)': '生成帧拼图的会话 (%)',
        'Sessions with crops or zooms (%)': '有裁剪或放大的会话 (%)', 'Images produced per item': '每题生成的图像数', 'Images viewed per item': '每题查看的图像数',
        'Images produced per video second': '每秒视频生成的图像数', 'Seconds per item': '每题耗时 (秒)', 'Output tokens per item': '每题输出 token 数' }
    },
    '49': {
      head: [['Strategy', '策略'], ['Astra', 'Astra'], ['Fable 5.1', 'Fable 5.1'], ['Gemini 3.1 Pro', 'Gemini 3.1 Pro'], ['Flash-Lite', 'Flash-Lite'], ['Opus 5', 'Opus 5']],
      rows: function () { return TB['49']; },
      zh: { 'Decode every stored frame (2 fps)': '解码全部存储帧 (2 fps)', 'Every n-th frame': '每隔 n 帧取一帧', 'Explicit fps filter': '显式 fps 过滤',
        'Fixed number of frames': '固定帧数', 'Seeks to chosen timestamps': '跳到选定的时间戳', 'Two or more of the above': '以上两种或更多', 'No decoding command': '没有解码命令' }
    }
  };
  function staticTable(container) {
    var key = container.getAttribute('data-table');
    clear(container);
    var tb = el('table', {}, container);
    if (key === '50') {
      var tr0 = el('tr', {}, el('thead', {}, tb));
      [[t('Video duration', '视频时长'), ''], [t('Agent', 'agent'), ''], [t('Strategy', '策略'), ''], [t('Share (%)', '占比 (%)'), 'n'], [t('Images', '图像数'), 'n'], [t('Acc. (%)', '准确率 (%)'), 'n']]
        .forEach(function (h) { el('th', { class: h[1], scope: 'col' }, tr0, h[0]); });
      var body = el('tbody', {}, tb), rows = TB['50'];
      rows.forEach(function (r, k) {
        var row = el('tr', { class: k && rows[k - 1][0] !== r[0] ? 'vi-static__group' : '' }, body);
        if (!k || rows[k - 1][0] !== r[0]) {
          var span = rows.filter(function (x) { return x[0] === r[0]; }).length;
          var th = el('th', { rowspan: String(span), scope: 'rowgroup', class: 'vi-static__dur' }, row);
          th.innerHTML = esc(t(r[0], r[0].replace(' s', ' 秒'))) + '<br><span>' + t('(' + r[1] + ' items)', '（' + r[1] + ' 题）') + '</span>';
        }
        el('td', {}, row, r[2]);
        el('td', {}, row, r[3]);
        el('td', { class: 'n' }, row, r[4]);
        el('td', { class: 'n' }, row, r[5]);
        el('td', { class: 'n' }, row, r[6]);
      });
      return;
    }
    var spec = STATIC[key], tr = el('tr', {}, el('thead', {}, tb));
    spec.head.forEach(function (h, k) { el('th', { class: k ? 'n' : '', scope: 'col' }, tr, t(h[0], h[1])); });
    var tbody = el('tbody', {}, tb), rows = spec.rows();
    rows.forEach(function (r, k) {
      var row = el('tr', { class: spec.foot && k === rows.length - 1 ? 'vi-static__foot' : '' }, tbody);
      r.forEach(function (v, j) { el('td', { class: j ? 'n' : '' }, row, j === 0 && spec.zh ? t(v, spec.zh[v] || v) : v); });
    });
  }

  /* ================= Appendix X: the report cards ================= */
  var CD = { i: 0 };
  var CARD_DIR = '/images/blogs/video-index/cards/';
  function cards(container) {
    clear(container);
    var list = A.cards, n = list.length;
    var bar = el('div', { class: 'vi-ctl vi-cards__bar' }, container);
    var input = el('input', { type: 'search', class: 'vi-input', list: 'vi-cards-names', placeholder: t('Find one of the 115 benchmarks…', '在 115 个 benchmark 中查找…'), 'aria-label': t('Find a benchmark', '查找 benchmark') }, bar);
    var dl = el('datalist', { id: 'vi-cards-names' }, bar);
    list.forEach(function (c) { el('option', { value: c.name }, dl); });
    var nav = el('div', { class: 'vi-seg vi-cards__nav', role: 'group' }, bar);
    var prev = button(nav, '', '‹', null, function () { show(CD.i - 1); });
    var count = el('span', { class: 'vi-cards__count' }, nav);
    var next = button(nav, '', '›', null, function () { show(CD.i + 1); });
    prev.setAttribute('aria-label', t('Previous card', '上一张'));
    next.setAttribute('aria-label', t('Next card', '下一张'));
    var card = el('div', { class: 'vi-cards__card', tabindex: '0', 'aria-label': t('Report card; use the arrow keys to browse', '报告卡；用方向键翻页') }, container);
    var img = el('img', { class: 'vi-cards__img', width: '1430', height: '455', decoding: 'async', alt: '' }, card);
    function preload(k) { var im = new Image(); im.src = CARD_DIR + list[(k + n) % n].file; }
    function show(k) {
      CD.i = (k + n) % n;
      var c = list[CD.i];
      img.src = CARD_DIR + c.file;
      img.alt = t('Report card of ', '报告卡：') + c.name;
      count.textContent = (CD.i + 1) + ' / ' + n;
      if (document.activeElement !== input) { input.value = c.name; }
      preload(CD.i + 1);
      preload(CD.i - 1);
    }
    function find(v, loose) {
      v = v.trim().toLowerCase();
      if (!v) { return -1; }
      for (var k = 0; k < n; k++) { if (list[k].name.toLowerCase() === v) { return k; } }
      if (!loose) { return -1; }
      for (k = 0; k < n; k++) { if (list[k].name.toLowerCase().indexOf(v) >= 0) { return k; } }
      return -1;
    }
    input.addEventListener('input', function () { var k = find(input.value, false); if (k >= 0) { show(k); } });
    input.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { var k = find(input.value, true); if (k >= 0) { show(k); input.value = list[k].name; } } });
    input.addEventListener('blur', function () { input.value = list[CD.i].name; });
    card.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowLeft') { ev.preventDefault(); show(CD.i - 1); }
      if (ev.key === 'ArrowRight') { ev.preventDefault(); show(CD.i + 1); }
    });
    show(CD.i);
  }

  /* ================= mount, re-render on language change ================= */
  function each(sel, fn) { Array.prototype.forEach.call(root.querySelectorAll(sel), fn); }
  function mountAll() {
    each('.vi-overlay[data-overlay="q1"]', figureQ1);
    each('.vi-overlay[data-overlay="fig8"]', figure8);
    each('.vi-overlay[data-overlay="fig9"]', figure9);
    each('.vi-scatter[data-table]', scatter);
    each('.vi-lines[data-table="20"]', lines20);
    each('#vi-dupshare', dupshare);
    each('#vi-rank', rank);
    each('.vi-static[data-table]', staticTable);
    each('#vi-cards', cards);
  }
  mountAll();
  /* charts are drawn at their width: redraw them when a resize changes it */
  var lastW = null, resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var probe = root.querySelector('.vi-scatter .vi-sc-body');
      var w = probe ? chartWidth(probe) : null;
      if (w === lastW) { return; }
      lastW = w;
      each('.vi-scatter[data-table]', scatter);
      each('.vi-lines[data-table="20"]', lines20);
    }, 200);
  });
  if ('MutationObserver' in window) {
    new MutationObserver(function (muts) {
      muts.forEach(function (mu) { if (mu.attributeName === 'data-lang') { hideTip(); mountAll(); } });
    }).observe(root, { attributes: true });
  }
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { hideTip(); } });
})();
