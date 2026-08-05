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
  // ODER der Viewport zu schmal für die Tabs ist – dieselbe "collapsed"-
  // Logik für beide Fälle, siehe .nav-collapsed im CSS.
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

  // --- Anmelden-Reiter in der Navigation (auf jeder Seite, siehe nav.hbs).
  // Heute nur für den Admin-Login, später auch für Kund:innen gedacht. ---
  var loginToggle = document.getElementById('nav-login-toggle');
  var loginDropdown = document.getElementById('nav-login-dropdown');
  var loginForm = document.getElementById('nav-login-form');
  var loginError = document.getElementById('nav-login-error');

  function checkNavSession() {
    if (!loginToggle) return;
    fetch('/api/session')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        loginToggle.textContent = data.isAdmin ? 'Abmelden' : 'Anmelden';
        loginToggle.classList.toggle('is-logged-in', !!data.isAdmin);
      })
      .catch(function () {});
  }

  if (loginToggle) {
    loginToggle.addEventListener('click', function () {
      if (loginToggle.classList.contains('is-logged-in')) {
        fetch('/api/logout', { method: 'POST' }).then(function () {
          window.location.reload();
        });
        return;
      }
      if (loginDropdown) loginDropdown.hidden = !loginDropdown.hidden;
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
