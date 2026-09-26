/* Blog article helpers: the EN / 中文 toggle (remembered per browser) and the
   chart / table view of each figure. Loaded by posts that list it under `js:`. */
(function () {
  'use strict';
  var root = document.getElementById('vi-article');
  if (!root) { return; }
  var KEY = 'vi-lang';

  function setLang(lang) {
    root.setAttribute('data-lang', lang);
    var buttons = root.querySelectorAll('.vi-lang button');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute('aria-pressed', String(buttons[i].getAttribute('data-lang') === lang));
    }
    try { localStorage.setItem(KEY, lang); } catch (e) { /* private mode */ }
  }

  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) { /* private mode */ }
  if (saved === 'zh' || saved === 'en') { setLang(saved); }

  var langButtons = root.querySelectorAll('.vi-lang button');
  for (var i = 0; i < langButtons.length; i++) {
    langButtons[i].addEventListener('click', function () { setLang(this.getAttribute('data-lang')); });
  }

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
})();
