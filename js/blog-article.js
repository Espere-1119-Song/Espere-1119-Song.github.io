/* Blog article helpers: the EN / 中文 toggle (remembered per browser), the chart / table
   view of a figure, footnote popovers gathered into the References section, and the
   contents scrollspy. Loaded by posts that list it under `js:`. */
(function () {
  'use strict';
  var root = document.getElementById('vi-article');
  if (!root) { return; }
  var KEY = 'vi-lang';

  function lang() { return root.getAttribute('data-lang') === 'zh' ? 'zh' : 'en'; }
  function setLang(l) {
    root.setAttribute('data-lang', l);
    var buttons = root.querySelectorAll('.vi-lang button');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute('aria-pressed', String(buttons[i].getAttribute('data-lang') === l));
    }
    try { localStorage.setItem(KEY, l); } catch (e) { /* private mode */ }
  }
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) { /* private mode */ }
  var q = /[?&]lang=(en|zh)/.exec(location.search);
  if (q) { setLang(q[1]); } else if (saved === 'zh' || saved === 'en') { setLang(saved); }
  var langButtons = root.querySelectorAll('.vi-lang button');
  for (var i = 0; i < langButtons.length; i++) {
    langButtons[i].addEventListener('click', function () { setLang(this.getAttribute('data-lang')); });
  }

  /* chart / table view */
  var toggles = root.querySelectorAll('.vi-fig__toggle');
  for (var j = 0; j < toggles.length; j++) {
    toggles[j].addEventListener('click', function () {
      var fig = this.closest('.vi-fig');
      var img = fig.querySelector('.vi-fig__img');
      var table = fig.querySelector('.vi-fig__table');
      var showTable = table.hasAttribute('hidden');
      if (showTable) { table.removeAttribute('hidden'); img.setAttribute('hidden', ''); }
      else { table.setAttribute('hidden', ''); img.removeAttribute('hidden'); }
      this.setAttribute('aria-expanded', String(showTable));
      var chartLabel = this.querySelector('[data-state="chart"]');
      var tableLabel = this.querySelector('[data-state="table"]');
      if (showTable) { chartLabel.setAttribute('hidden', ''); tableLabel.removeAttribute('hidden'); }
      else { tableLabel.setAttribute('hidden', ''); chartLabel.removeAttribute('hidden'); }
    });
  }

  /* footnotes: the asides move into #notes, numbered; each marker gets a popover */
  (function footnotes() {
    var asides = Array.prototype.slice.call(root.querySelectorAll('.fnote'));
    var notes = document.getElementById('notes');
    if (!asides.length || !notes) { return; }
    var groups = {}, order = [];
    asides.forEach(function (a) {
      var n = a.getAttribute('data-n');
      if (!groups[n]) { groups[n] = []; order.push(n); }
      groups[n].push(a);
    });
    order.sort(function (a, b) { return Number(a) - Number(b); });
    var ol = document.createElement('ol');
    notes.classList.add('vi-notes');
    notes.appendChild(ol);
    order.forEach(function (n) {
      var li = document.createElement('li');
      li.id = 'note-' + n;
      var b = document.createElement('b');
      b.textContent = n;
      li.appendChild(b);
      var body = document.createElement('div');
      groups[n].forEach(function (a) {
        var span = document.createElement('span');
        span.innerHTML = a.innerHTML;
        body.appendChild(span);
        a.parentNode.removeChild(a);
      });
      li.appendChild(body);
      ol.appendChild(li);
    });
    var pop = document.createElement('div');
    pop.className = 'fnpop';
    pop.id = 'fnpop';
    pop.setAttribute('hidden', '');
    pop.setAttribute('role', 'tooltip');
    document.body.appendChild(pop);
    function show(sup) {
      var n = sup.textContent.trim(), li = document.getElementById('note-' + n);
      if (!li) { return; }
      pop.innerHTML = li.lastChild.innerHTML;
      pop.setAttribute('data-n', n);
      pop.removeAttribute('hidden');
      var r = sup.getBoundingClientRect(), sx = window.pageXOffset, sy = window.pageYOffset;
      var w = pop.offsetWidth, left = r.left + sx - 12, top = r.bottom + sy + 8;
      var maxLeft = sx + document.documentElement.clientWidth - w - 12;
      if (left > maxLeft) { left = maxLeft; }
      if (left < sx + 12) { left = sx + 12; }
      if (r.bottom + 8 + pop.offsetHeight > window.innerHeight && r.top - 8 - pop.offsetHeight > 0) {
        top = r.top + sy - pop.offsetHeight - 8;
      }
      pop.style.left = left + 'px';
      pop.style.top = top + 'px';
    }
    function hide() { pop.setAttribute('hidden', ''); }
    Array.prototype.forEach.call(root.querySelectorAll('sup.fn'), function (sup) {
      var n = sup.textContent.trim();
      sup.setAttribute('tabindex', '0');
      sup.setAttribute('role', 'link');
      sup.setAttribute('aria-label', (lang() === 'zh' ? '参考文献 ' : 'Reference ') + n);
      sup.addEventListener('pointerenter', function () { show(sup); });
      sup.addEventListener('pointerleave', hide);
      sup.addEventListener('focus', function () { show(sup); });
      sup.addEventListener('blur', hide);
      sup.addEventListener('click', function () { hide(); location.hash = 'note-' + n; });
      sup.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); hide(); location.hash = 'note-' + n; }
      });
    });
    window.addEventListener('scroll', hide, { passive: true });
  })();

  /* contents scrollspy */
  (function spy() {
    var links = Array.prototype.slice.call(root.querySelectorAll('.vi-toc a[href^="#"]'));
    if (!links.length || !('IntersectionObserver' in window)) { return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) { return; }
        links.forEach(function (a) { a.classList.toggle('active', a.getAttribute('href') === '#' + en.target.id); });
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    links.forEach(function (a) {
      var s = document.getElementById(a.getAttribute('href').slice(1));
      if (s) { io.observe(s); }
    });
  })();
})();
