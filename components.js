(() => {

  /* ─── NAV ─────────────────────────────────────────────────
     Inject the shared nav and mark the current page active.  */
  const page = window.location.pathname.split('/').pop() || 'index.html';

  const navPlaceholder = document.getElementById('nav-placeholder');
  if (navPlaceholder) {
    const a = (href, label, filename) =>
      `<a href="${href}" class="nav-link${page === filename ? ' active' : ''}">${label}</a>`;

    navPlaceholder.outerHTML = `
<nav aria-label="Main navigation">
  <div class="nav-box">
    ${a('index.html#',      'Blog',       '')}
    ${a('index.html#about', 'About',      '')}
    ${a('index.html#work',  'Work',       '')}
    ${a('tools.html',       'Tools',      'tools.html')}
    ${a('ff7.html',         'FF7',        'ff7.html')}
    <a href="https://github.com/Thassanai546" class="nav-link" target="_blank" rel="noopener">GitHub &#8599;</a>
    <a href="https://www.linkedin.com/in/thassanai-mcc/" class="nav-link" target="_blank" rel="noopener">LinkedIn &#8599;</a>
  </div>
</nav>`;
  }

  /* ─── SCROLL TO TOP ────────────────────────────────────────
     Shared behaviour for the fixed ↑ button on every page.  */
  const scrollBtn = document.getElementById('scroll-top');
  if (scrollBtn) {
    window.addEventListener('scroll', () => {
      scrollBtn.classList.toggle('visible', window.scrollY > 300);
    });
    scrollBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ─── CVE TICKER ───────────────────────────────────────────
     Fetch KEV feed and populate the ticker on every page.    */
  (async () => {
    const el = document.getElementById('cve-inner');
    if (!el) return;

    const esc = s => s
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    try {
      const ctrl  = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const r     = await fetch(
        'https://services.nvd.nist.gov/rest/json/cves/2.0?hasKev',
        { signal: ctrl.signal }
      );
      clearTimeout(timer);
      if (!r.ok) throw new Error();
      const d = await r.json();

      const items = d.vulnerabilities
        .sort((a, b) => new Date(b.cve.published) - new Date(a.cve.published))
        .map(({ cve }) => {
          const id    = esc(cve.id);
          const desc  = esc((cve.descriptions.find(x => x.lang === 'en')?.value ?? '').slice(0, 100));
          const m     = cve.metrics;
          const score = m?.cvssMetricV31?.[0]?.cvssData?.baseScore
                     ?? m?.cvssMetricV30?.[0]?.cvssData?.baseScore
                     ?? m?.cvssMetricV2?.[0]?.cvssData?.baseScore
                     ?? '?';
          return `<span class="cve-item-id">${id}</span>`
               + `<span class="cve-item-score">CVSS&nbsp;${score}</span>`
               + `<span class="cve-item-desc">${desc}</span>`
               + `<span class="cve-item-sep">//</span>`;
        }).join('');

      el.innerHTML = items + items;
      el.style.animationDuration = Math.max(40, el.scrollWidth / 2 / 90) + 's';
    } catch {
      const ticker = document.querySelector('.cve-ticker');
      if (ticker) ticker.style.display = 'none';
    }
  })();

})();
