// templates/deals/ds-base.js
// Loads the Lotsy Design System styles + component bundle.
// When editing: update `base` to point at the _ds folder relative to this template.
(() => {
  const base = '../..';
  for (const p of ['styles.css']) {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = base + '/' + p;
    document.head.appendChild(l);
  }
  const s = document.createElement('script');
  s.src = base + '/_ds_bundle.js';
  s.onerror = () => console.error(
    'ds-base.js: failed to load ' + s.src +
    ' — check that `base` in ds-base.js points to the Lotsy DS root'
  );
  document.head.appendChild(s);
})();
