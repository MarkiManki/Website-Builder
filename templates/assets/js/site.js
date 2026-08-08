(function () {
  var topbar = document.querySelector('.site-topbar');
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.site-nav');
  var narrowQuery = window.matchMedia('(max-width: 860px)');

  // --topbar-height ist die GROSSE, ungescrollte Höhe – einmalig gemessen
  // (Start/Resize/Font-Ready), NICHT live. Nur dafür verwendet (siehe CSS):
  // die Hero-Höhe (100vh - Topbar). Würde dieser Wert beim Scrollen
  // mitschrumpfen, würde der Hero selbst live springen.
  function setTopbarHeightVar() {
    if (!topbar) return;
    var wasScrolled = topbar.classList.contains('is-scrolled');
    topbar.classList.remove('is-scrolled');
    var height = topbar.offsetHeight;
    topbar.classList.toggle('is-scrolled', wasScrolled);
    document.documentElement.style.setProperty('--topbar-height', height + 'px');
  }

  // --topbar-height-live verfolgt die TATSÄCHLICHE, aktuelle Höhe der Leiste
  // in Echtzeit (auch während der Schrumpf-Animation selbst) und treibt
  // body{padding-top}. Zwei per CSS nur "gleichzeitig gestartete" Übergänge
  // laufen erfahrungsgemäß leicht auseinander (Rundung, Timing) – das erzeugt
  // genau den kurzen weißen Spalt. Ein ResizeObserver umgeht das komplett,
  // weil er die Höhe jeden Frame direkt von der echten Box abliest, statt
  // sie separat zu animieren.
  function watchTopbarLiveHeight() {
    if (!topbar) return;
    var setLiveHeight = function () {
      document.documentElement.style.setProperty('--topbar-height-live', topbar.getBoundingClientRect().height + 'px');
    };
    setLiveHeight();
    if ('ResizeObserver' in window) {
      new ResizeObserver(setLiveHeight).observe(topbar);
    } else {
      // Sehr alte Browser ohne ResizeObserver: wenigstens bei Scroll/Resize nachziehen.
      window.addEventListener('scroll', setLiveHeight, { passive: true });
      window.addEventListener('resize', setLiveHeight);
    }
  }

  function closeNav() {
    if (!nav || !toggle) return;
    nav.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
  }

  // Die Leiste wird beim Scrollen kompakter und leicht transparent (Glass-
  // Effekt), behält aber ihren Farbton (siehe .is-scrolled im CSS). Sie ist
  // bewusst position:fixed statt sticky (body reserviert via padding-top
  // den Platz, live nachgeführt von watchTopbarLiveHeight() oben). Nav-Tabs
  // werden zum Hamburger-Dropdown zusammengeklappt, sobald gescrollt wurde
  // ODER der Viewport zu schmal ist – passen die Reiter inhaltlich (z. B. mit
  // "Verwaltung" nach Admin-Login) nicht mehr in eine Zeile, wickeln sie
  // stattdessen per CSS (.site-nav ul { flex-wrap: wrap }) einfach in eine
  // zweite Zeile, statt komplett hinter dem Hamburger zu verschwinden.
  //
  // Hysterese statt einer einzelnen Schwelle: ohne sie kippt "scrolled" bei
  // jedem winzigen Wackeln um genau einen Wert (z. B. Rubber-Banding beim
  // Touchpad ganz oben auf der Seite) mehrfach hin und her – jedes Kippen
  // reißt die Reiter zwischen der großen (ggf. mehrzeiligen, siehe
  // .site-nav ul { flex-wrap: wrap }) und der kompakten Hamburger-Ansicht
  // hin und her ("springende Reiter"). Mit getrennten Ein-/Ausstiegspunkten
  // bleibt der Zustand in der Mitte stabil.
  function updateTopbarState() {
    if (!topbar) return;
    var wasScrolled = topbar.classList.contains('is-scrolled');
    var scrolled = wasScrolled ? window.scrollY > 4 : window.scrollY > 24;
    var collapsed = scrolled || narrowQuery.matches;
    var wasCollapsed = topbar.classList.contains('nav-collapsed');
    topbar.classList.toggle('is-scrolled', scrolled);
    topbar.classList.toggle('nav-collapsed', collapsed);
    if (wasCollapsed && !collapsed) closeNav();
  }

  if (topbar) {
    setTopbarHeightVar();
    watchTopbarLiveHeight();
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

  // --- Eckbutton oben rechts (auf jeder Seite, siehe header.hbs). Ausgeloggt
  // öffnet er das Login-Popover; eingeloggt öffnet er stattdessen die
  // Verwaltungs-Sidebar (siehe partials/admin-sidebar.hbs). Bewusst NICHT
  // Teil der Reiter-Liste (.site-nav ul), damit die Seiten-Reiter unabhängig
  // vom Login-Status immer in eine Zeile passen. ---
  var cornerBtn = document.getElementById('admin-corner-btn');
  var loginDropdown = document.getElementById('nav-login-dropdown');
  var loginForm = document.getElementById('nav-login-form');
  var loginError = document.getElementById('nav-login-error');
  var adminSidebar = document.getElementById('admin-sidebar');
  var adminSidebarBackdrop = document.getElementById('admin-sidebar-backdrop');
  var adminSidebarClose = document.getElementById('admin-sidebar-close');
  var adminSidebarLogout = document.getElementById('admin-sidebar-logout');
  var isAdminSession = false;

  function openAdminSidebar() {
    if (!adminSidebar) return;
    if (window.AdminPanel) window.AdminPanel.init();
    adminSidebar.classList.add('is-open');
    adminSidebar.setAttribute('aria-hidden', 'false');
    if (adminSidebarBackdrop) adminSidebarBackdrop.classList.add('is-open');
  }

  function closeAdminSidebar() {
    if (!adminSidebar) return;
    adminSidebar.classList.remove('is-open');
    adminSidebar.setAttribute('aria-hidden', 'true');
    if (adminSidebarBackdrop) adminSidebarBackdrop.classList.remove('is-open');
  }

  function checkNavSession() {
    if (!cornerBtn) return;
    fetch('/api/session')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        isAdminSession = !!data.isAdmin;
        cornerBtn.textContent = isAdminSession ? 'Verwaltung' : 'Anmelden';
        cornerBtn.classList.toggle('is-logged-in', isAdminSession);
      })
      .catch(function () {});
  }

  if (cornerBtn) {
    cornerBtn.addEventListener('click', function () {
      if (isAdminSession) {
        openAdminSidebar();
        return;
      }
      if (loginDropdown) loginDropdown.hidden = !loginDropdown.hidden;
    });
  }

  if (adminSidebarClose) adminSidebarClose.addEventListener('click', closeAdminSidebar);
  if (adminSidebarBackdrop) adminSidebarBackdrop.addEventListener('click', closeAdminSidebar);
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeAdminSidebar();
  });

  if (adminSidebarLogout) {
    adminSidebarLogout.addEventListener('click', function () {
      fetch('/api/logout', { method: 'POST' }).then(function () {
        window.location.reload();
      });
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', function (event) {
      event.preventDefault();
      if (loginError) loginError.hidden = true;
      fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: loginForm.identifier.value, password: loginForm.password.value }),
      })
        .then(function (res) {
          if (!res.ok) throw new Error('Benutzername/E-Mail oder Passwort falsch.');
          window.location.reload();
        })
        .catch(function (err) {
          if (loginError) {
            loginError.hidden = false;
            loginError.textContent = err.message;
          }
        });
    });
  }

  checkNavSession();

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
