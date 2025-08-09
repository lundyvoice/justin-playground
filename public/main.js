(function () {
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
  async function loadContent() {
    try {
      const res = await fetch('/content.json', { cache: 'no-cache' });
      if (!res.ok) return null; return await res.json();
    } catch { return null; }
  }

  // Nav highlighting
  const currentPath = location.pathname.replace(/\/$/, '') || '/';
  qsa('header .nav a').forEach((a) => {
    const hrefPath = new URL(a.href, location.origin).pathname.replace(/\/$/, '') || '/';
    if (hrefPath === currentPath) a.classList.add('active');
  });

  // Smooth scroll for anchor links
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    const el = document.querySelector(id);
    if (el) {
      e.preventDefault();
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.replaceState(null, '', id);
    }
  });

  // Active nav on scroll
  const sections = Array.from(document.querySelectorAll('section[id]'));
  const navLinks = Array.from(document.querySelectorAll('a[href^="#"]'));
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = `#${entry.target.id}`;
        navLinks.forEach(l => l.classList.toggle('active', l.getAttribute('href') === id));
      }
    });
  }, { rootMargin: '-40% 0px -50% 0px', threshold: 0.01 });
  sections.forEach(s => obs.observe(s));

  // Contact form handler (no backend)
  const contactForm = qs('#contact-form');
  const thanks = qs('#contact-thanks');
  if (contactForm) {
    if (localStorage.getItem('contactSubmitted') === 'true') {
      contactForm.classList.add('hidden');
      if (thanks) thanks.classList.remove('hidden');
    }
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      localStorage.setItem('contactSubmitted', 'true');
      contactForm.classList.add('hidden');
      if (thanks) thanks.classList.remove('hidden');
    });
  }

  // Ephemeral toggle on /contact
  // (not used in this site)

  // Ephemeral enablement: ?ephemeral=1 or localStorage.ephemeral === 'on'
  const params = new URLSearchParams(location.search);
  const ephParam = params.get('ephemeral');
  if (ephParam === '1') localStorage.setItem('ephemeralUI', 'enabled');
  if (ephParam === '0') localStorage.removeItem('ephemeralUI');
  const isEphemeralOn = localStorage.getItem('ephemeralUI') === 'enabled';
  if (isEphemeralOn) {
    const s = document.createElement('script');
    s.src = '/ephemeral/voiceUI.js';
    s.defer = true;
    document.body.appendChild(s);
  }

  // Console helpers
  window.enableEphemeral = () => (localStorage.setItem('ephemeralUI','enabled'), location.reload());
  window.disableEphemeral = () => (localStorage.removeItem('ephemeralUI'), location.reload());

  // Load content.json and populate page
  loadContent().then((content) => {
    if (!content) return;
    // Footer email
    const fe = qs('#footer-email'); if (fe) fe.textContent = content.site.footerEmail;
    // Home
    const ht = qs('#home-hero-title'); if (ht) ht.textContent = content.home.heroTitle;
    const hs = qs('#home-hero-sub'); if (hs) hs.textContent = content.home.heroSub;
    const cp = qs('#home-cta-primary'); if (cp) { cp.textContent = content.home.heroCtaPrimaryText; cp.href = content.home.heroCtaPrimaryHref || '#why-ally'; }
    const cs = qs('#home-cta-secondary'); if (cs) { cs.textContent = content.home.heroCtaSecondaryText; cs.href = content.home.heroCtaSecondaryHref || '#about-david'; }
    const hb = qs('#home-badges');
    if (hb) {
      hb.innerHTML = '';
      (content.home.badges || []).forEach(b => {
        const el = document.createElement('div');
        el.className = 'badge';
        el.innerHTML = `<div class="ico">${(b.icon||'').slice(0,1).toUpperCase()}</div><div><h4>${b.title}</h4><p>${b.desc}</p></div>`;
        hb.appendChild(el);
      });
    }
    // About David
    const dt = qs('#david-title'); if (dt) dt.textContent = content.aboutDavid.title;
    const dh = qs('#david-headshot'); if (dh) dh.src = content.aboutDavid.headshot;
    const db = qs('#david-bio'); if (db) { db.innerHTML = ''; (content.aboutDavid.bio || []).forEach(li => { const el = document.createElement('li'); el.textContent = li; db.appendChild(el); }); }
    const dq = qs('#david-quote'); if (dq) dq.textContent = content.aboutDavid.quote;
    // About Ally
    const at = qs('#ally-title'); if (at) at.textContent = content.aboutAlly.title;
    const as = qs('#ally-sections'); if (as) { as.innerHTML = ''; (content.aboutAlly.sections || []).forEach(sec => { const card = document.createElement('article'); card.className = 'card'; card.innerHTML = `<h3>${sec.h}</h3><p>${sec.p}</p>`; as.appendChild(card); }); }
    // Technology
    const tt = qs('#tech-title'); if (tt) tt.textContent = content.technology.title;
    const tl = qs('#tech-list'); if (tl) { tl.innerHTML = ''; (content.technology.items || []).forEach(item => { const li = document.createElement('li'); li.textContent = item; tl.appendChild(li); }); }
  });
})();


