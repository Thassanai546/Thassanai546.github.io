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
  <div class="nav-row nav-row-pages">
    <a href="https://thass546.blogspot.com/" class="nav-link" target="_blank" rel="noopener">Blog &#8599;</a>
    ${a('index.html#about', 'About',      '')}
    ${a('index.html#work',  'Work',       '')}
    ${a('tools.html',       'Tools',      'tools.html')}
    ${a('ff7.html',         'FF7',        'ff7.html')}
    <a href="https://thassanai546.github.io/Ransom_Radar/" class="nav-link" target="_blank" rel="noopener">Ransom Radar &#8599;</a>
  </div>
  <div class="nav-row nav-row-links">
    <a href="https://github.com/Thassanai546" class="nav-link" target="_blank" rel="noopener">GitHub &#8599;</a>
    <a href="https://www.linkedin.com/in/thassanai-mcc/" class="nav-link" target="_blank" rel="noopener">LinkedIn &#8599;</a>
    <button id="ticker-toggle" class="nav-link" aria-label="Switch ticker feed"></button>
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

  /* ─── CVE / NEWS TICKER ────────────────────────────────────
     Three modes: 'cve' | 'news' | 'both'. Button cycles
     through them. 'both' runs fetches concurrently and
     concatenates; partial failure still shows what works.
     Auto-fails over to news on first load only.
     Mode persists in localStorage.                           */
  (async () => {
    const inner  = document.getElementById('cve-inner');
    const ticker = document.querySelector('.cve-ticker');
    const btn    = document.getElementById('ticker-toggle');
    if (!inner || !ticker || !btn) return;

    // Inject second ticker row (hidden until "both" mode)
    ticker.insertAdjacentHTML('beforeend',
      `<div id="ticker-row-2" class="ticker-row" style="display:none">` +
      `<div class="cve-label"><span class="cve-label-dot"></span><span>Latest News:</span></div>` +
      `<div class="cve-track"><div class="cve-inner" id="cve-inner-2"></div></div></div>`
    );
    const inner2 = document.getElementById('cve-inner-2');
    const row2   = document.getElementById('ticker-row-2');

    const esc = s => s
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    let mode = localStorage.getItem('tickerMode') || 'cve';

    const modeLabel = { cve: 'Latest CVEs:', news: 'Latest News:', both: 'CVEs + News:' };

    function syncUI() {
      const labelEl = document.getElementById('cve-label-text');
      if (labelEl) labelEl.textContent = modeLabel[mode];
      btn.textContent = `feed: ${mode}`;
      const isBoth = mode === 'both';
      row2.style.display = isBoth ? 'flex' : 'none';
      document.documentElement.style.setProperty('--ticker-h', isBoth ? '61px' : '30px');
    }
    syncUI();

    function setItems(el, html) {
      document.getElementById('cve-loading')?.remove();
      el.innerHTML = html + html;
      el.style.animationDuration = Math.max(40, el.scrollWidth / 2 / 90) + 's';
      el.classList.add('running');
    }

    // ── GitHub Advisory Database (CORS-friendly, no auth) ────
    // Fetch 100, filter to CVE-assigned only, take 30.
    async function fetchCVEs() {
      const ctrl  = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      try {
        const r = await fetch(
          'https://api.github.com/advisories?type=reviewed&per_page=100&sort=published&direction=desc',
          { signal: ctrl.signal, headers: { 'Accept': 'application/vnd.github+json' } }
        );
        if (!r.ok) throw new Error('gh-advisory');
        const items = await r.json();
        return items
          .filter(v => v.cve_id && v.summary)
          .slice(0, 30)
          .map(v => {
            const score = v.cvss?.score;
            const sev   = esc(v.severity || '');
            return `<span class="cve-item-id">${esc(v.cve_id)}</span>`
                 + `<span class="cve-item-score">${score ? `CVSS&nbsp;${score}` : sev}</span>`
                 + `<span class="cve-item-desc">${esc(v.summary.slice(0, 100))}</span>`
                 + `<span class="cve-item-sep">//</span>`;
          }).join('');
      } finally {
        clearTimeout(timer);
      }
    }

    // ── Hacker News top stories (Firebase API) ───────────────
    async function fetchNews() {
      const ctrl  = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10000);
      try {
        const base = 'https://hacker-news.firebaseio.com/v0';
        const r    = await fetch(`${base}/topstories.json`, { signal: ctrl.signal });
        if (!r.ok) throw new Error('hn');
        const ids   = await r.json();
        const items = await Promise.all(
          ids.slice(0, 20).map(id =>
            fetch(`${base}/item/${id}.json`, { signal: ctrl.signal })
              .then(r => r.json()).catch(() => null)
          )
        );
        return items
          .filter(item => item && item.type === 'story' && item.title)
          .map(item =>
            `<span class="cve-item-id">${esc(item.title)}</span>`
          + `<span class="cve-item-score">&#9650;&nbsp;${item.score ?? 0}</span>`
          + `<span class="cve-item-sep">//</span>`
          ).join('');
      } finally {
        clearTimeout(timer);
      }
    }

    async function load(autoFailover = false) {
      ticker.style.display = '';
      inner.innerHTML = '';       inner.classList.remove('running');
      inner2.innerHTML = '';      inner2.classList.remove('running');

      if (mode === 'both') {
        const [cveRes, newsRes] = await Promise.allSettled([fetchCVEs(), fetchNews()]);
        const anyOk = cveRes.status === 'fulfilled' || newsRes.status === 'fulfilled';
        if (!anyOk) { ticker.style.display = 'none'; return; }
        if (cveRes.status === 'fulfilled')  setItems(inner,  cveRes.value);
        if (newsRes.status === 'fulfilled') setItems(inner2, newsRes.value);
      } else if (mode === 'cve') {
        try {
          setItems(inner, await fetchCVEs());
        } catch {
          if (autoFailover) {
            mode = 'news';
            localStorage.setItem('tickerMode', mode);
            syncUI();
            try { setItems(inner, await fetchNews()); } catch { ticker.style.display = 'none'; }
          } else {
            ticker.style.display = 'none';
          }
        }
      } else {
        try { setItems(inner, await fetchNews()); } catch { ticker.style.display = 'none'; }
      }
    }

    btn.addEventListener('click', () => {
      mode = mode === 'cve' ? 'news' : mode === 'news' ? 'both' : 'cve';
      localStorage.setItem('tickerMode', mode);
      syncUI();
      load(false);
    });

    load(true);
  })();

})();
