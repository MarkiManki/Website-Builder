(function () {
  var topbar = document.querySelector('.site-topbar');
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.site-nav');
  var narrowQuery = window.matchMedia('(max-width: 860px)');

  // Hero-Höhe (100vh - Topbar) braucht die ECHTE, ungescrollte Höhe der
  // Leiste (Name + Tabs), nicht die beim Scrollen leicht geschrumpfte –
  // sonst würde der Hero rückwirkend größer/kleiner springen. Deshalb wird
  // nur bei Bedarf (Start/Resize) neu gemessen, nicht bei jedem Scroll.
  function setTopbarHeightVar() {
    if (!topbar) return;
    var wasScrolled = topbar.classList.contains('is-scrolled');
    if (wasScrolled) topbar.classList.remove('is-scrolled');
    var height = topbar.offsetHeight;
    if (wasScrolled) topbar.classList.add('is-scrolled');
    document.documentElement.style.setProperty('--topbar-height', height + 'px');
  }

  function closeNav() {
    if (!nav || !toggle) return;
    nav.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
  }

  // Die Leiste wird beim Scrollen kompakter und leicht transparent (Glass-
  // Effekt), behält aber ihren Farbton (siehe .is-scrolled im CSS). Sie ist
  // bewusst position:fixed statt sticky, damit dieses Schrumpfen NICHT den
  // Dokumentfluss verschiebt (body reserviert via padding-top eine konstante
  // Höhe) – sonst würde die Hero-Höhenrechnung (100vh - Topbar) live
  // unterlaufen. Nav-Tabs werden zum Hamburger-Dropdown zusammengeklappt,
  // sobald gescrollt wurde ODER der Viewport zu schmal für die Tabs ist –
  // dieselbe "collapsed"-Logik für beide Fälle, siehe .nav-collapsed im CSS.
  function updateTopbarState() {
    if (!topbar) return;
    var scrolled = window.scrollY > 8;
    var collapsed = scrolled || narrowQuery.matches;
    var wasCollapsed = topbar.classList.contains('nav-collapsed');
    topbar.classList.toggle('is-scrolled', scrolled);
    topbar.classList.toggle('nav-collapsed', collapsed);
    if (wasCollapsed && !collapsed) closeNav();
  }

  if (topbar) {
    setTopbarHeightVar();
    updateTopbarState();
    window.addEventListener('scroll', updateTopbarState, { passive: true });
    window.addEventListener('resize', setTopbarHeightVar);
    narrowQuery.addEventListener('change', function () {
      updateTopbarState();
      setTopbarHeightVar();
    });
    // Google Fonts laden asynchron nach; falls die Marke/Tabs vorher in der
    // Fallback-Schrift (andere Zeilenhöhe) gemessen wurden, hier korrigieren
    // – sonst bliebe ein Spalt bzw. Überlapp zwischen Topbar und Hero-Bild.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(setTopbarHeightVar);
    }
  }

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var isOpen = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(isOpen));
    });
    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', closeNav);
    });
  }

  // Sanftes Einblenden von Abschnitten beim Scrollen.
  var revealEls = document.querySelectorAll('.reveal');
  if (revealEls.length && 'IntersectionObserver' in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    revealEls.forEach(function (el) { observer.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  }
})();
