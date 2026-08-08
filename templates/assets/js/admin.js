// Admin-Verwaltung (Kalender/Anfragen/Öffnungszeiten/Leistungen): läuft in der
// globalen Sidebar (siehe partials/admin-sidebar.hbs), die auf jeder Seite im
// DOM vorhanden ist. site.js entscheidet anhand der Admin-Session, ob die
// Sidebar überhaupt geöffnet werden kann, und ruft AdminPanel.init() einmalig
// auf, sobald eine Admin-Session erkannt wurde.
window.AdminPanel = (function () {
  var initialized = false;
  var loadBookings = function () {};

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function formatDate(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function pad2(n) { return String(n).padStart(2, '0'); }

  function init() {
    if (initialized) return;
    var sidebar = document.getElementById('admin-sidebar');
    if (!sidebar) return;
    initialized = true;

    // --- Verwaltung: Unter-Tabs (Kalender/Anfragen/Öffnungszeiten/Leistungen) ---
    var subtabs = sidebar.querySelectorAll('.admin-subtab');
    var subpanels = sidebar.querySelectorAll('.admin-subpanel');
    var currentSubtab = 'kalender';

    function activateSubtab(name) {
      currentSubtab = name;
      subtabs.forEach(function (tab) {
        tab.classList.toggle('active', tab.dataset.subtab === name);
      });
      subpanels.forEach(function (panel) {
        panel.hidden = panel.dataset.subpanel !== name;
      });
      if (name === 'kalender') loadBookings();
      if (name === 'anfragen') loadBookings();
      if (name === 'oeffnungszeiten') loadSettings();
      if (name === 'leistungen') loadServicesAdmin();
    }

    subtabs.forEach(function (tab) {
      tab.addEventListener('click', function () { activateSubtab(tab.dataset.subtab); });
    });

    // --- Admin-Kalender: Monatsansicht (Tage als Kästen) und Wochenansicht
    // (echtes Zeitraster, Standardansicht). Pending Anfragen werden optisch
    // von bestätigten Terminen unterschieden; abgelehnte werden gar nicht
    // angezeigt (Slot ist wieder frei). ---
    var calLabel = document.getElementById('cal-label');
    var monthViewEl = document.getElementById('cal-month-view');
    var weekViewEl = document.getElementById('cal-week-view');
    var gridEl = document.getElementById('cal-grid');
    var detailEl = document.getElementById('cal-day-detail');
    var prevBtn = document.getElementById('cal-prev');
    var nextBtn = document.getElementById('cal-next');
    var viewToggleBtns = sidebar.querySelectorAll('.view-toggle-btn');
    var anfragenBadge = document.getElementById('anfragen-badge');
    var anfragenListEl = document.getElementById('anfragen-list');

    var MONTH_NAMES = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    var WEEKDAY_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
    var HOUR_HEIGHT = 56; // px pro Stunde in der Wochenansicht

    var allBookings = [];
    var bookingsByDate = {};
    var currentView = 'woche';
    var viewDate = new Date();
    viewDate.setHours(0, 0, 0, 0);
    var selectedDate = formatDate(new Date());
    var currentWeekRange = { startHour: 8, endHour: 18 };
    var defaultSlotInterval = 30; // wird beim Öffnen aus /api/settings aktualisiert

    function statusLabel(b) {
      return b.status === 'pending' ? ' <span class="status-pill status-pending">Anfrage</span>' : '';
    }

    function bookingActionButtons(b) {
      if (b.status !== 'pending') return '';
      return '<div class="booking-actions">' +
        '<button type="button" class="btn-tiny btn-accept" data-confirm="' + b.id + '">Annehmen</button>' +
        '<button type="button" class="btn-tiny btn-decline" data-decline="' + b.id + '">Ablehnen</button>' +
        '</div>';
    }

    function renderDayDetail(dateStr) {
      selectedDate = dateStr;
      var items = (bookingsByDate[dateStr] || []).slice().sort(function (a, b) { return a.time.localeCompare(b.time); });
      var addBtn = '<button type="button" class="btn-add btn-add-inline" data-add-booking="' + dateStr + '">+ Termin eintragen</button>';
      if (!items.length) {
        detailEl.innerHTML = '<h4>' + dateStr + '</h4><p class="hint">Keine Termine an diesem Tag.</p>' + addBtn;
        return;
      }
      var rows = items
        .map(function (b) {
          var note = b.note ? '<br><em>' + escapeHtml(b.note) + '</em>' : '';
          var email = b.email ? ' (' + escapeHtml(b.email) + ')' : '';
          return '<li><strong>' + escapeHtml(b.time) + '</strong> – ' + escapeHtml(b.name) + email + statusLabel(b) + note + bookingActionButtons(b) + '</li>';
        })
        .join('');
      detailEl.innerHTML = '<h4>' + dateStr + '</h4><ul>' + rows + '</ul>' + addBtn;
    }

    function renderMonthView() {
      calLabel.textContent = MONTH_NAMES[viewDate.getMonth()] + ' ' + viewDate.getFullYear();
      gridEl.innerHTML = '';

      var firstOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
      var startWeekday = (firstOfMonth.getDay() + 6) % 7; // Montag = 0
      var daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
      var todayStr = formatDate(new Date());

      for (var i = 0; i < startWeekday; i += 1) {
        var blank = document.createElement('div');
        blank.className = 'calendar-day calendar-day-empty';
        gridEl.appendChild(blank);
      }

      for (var day = 1; day <= daysInMonth; day += 1) {
        var cellDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
        var dateStr = formatDate(cellDate);
        var dayItems = bookingsByDate[dateStr] || [];
        var count = dayItems.length;
        var hasPending = dayItems.some(function (b) { return b.status === 'pending'; });

        var cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'calendar-day';
        if (dateStr === todayStr) cell.classList.add('is-today');
        if (dateStr === selectedDate) cell.classList.add('is-selected');
        cell.dataset.date = dateStr;
        var badge = '';
        if (count) {
          badge = '<span class="calendar-day-badge' + (hasPending ? ' is-pending' : '') + '">' + count + '</span>';
        }
        cell.innerHTML = '<span class="calendar-day-num">' + day + '</span>' + badge;
        cell.addEventListener('click', function () {
          gridEl.querySelectorAll('.calendar-day').forEach(function (el) { el.classList.remove('is-selected'); });
          this.classList.add('is-selected');
          renderDayDetail(this.dataset.date);
        });
        gridEl.appendChild(cell);
      }

      renderDayDetail(selectedDate);
    }

    function getWeekStart(d) {
      var date = new Date(d);
      var day = (date.getDay() + 6) % 7; // Montag = 0
      date.setDate(date.getDate() - day);
      return date;
    }

    function computeHourRange(bookings) {
      var startHour = 8;
      var endHour = 18;
      bookings.forEach(function (b) {
        var h = parseInt(b.time.split(':')[0], 10);
        if (!isNaN(h)) {
          if (h < startHour) startHour = h;
          if (h + 1 > endHour) endHour = h + 1;
        }
      });
      return { startHour: Math.max(0, startHour), endHour: Math.min(24, endHour) };
    }

    function renderWeekView() {
      var weekStart = getWeekStart(viewDate);
      var weekDays = [];
      for (var i = 0; i < 7; i += 1) {
        var d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        weekDays.push(d);
      }
      var weekEnd = weekDays[6];
      calLabel.textContent = weekStart.getDate() + '.' + (weekStart.getMonth() + 1) + '. – ' + weekEnd.getDate() + '.' + (weekEnd.getMonth() + 1) + '.' + weekEnd.getFullYear();

      var weekBookings = [];
      weekDays.forEach(function (d) {
        (bookingsByDate[formatDate(d)] || []).forEach(function (b) { weekBookings.push(b); });
      });
      var range = computeHourRange(weekBookings);
      currentWeekRange = range;
      var totalHeight = (range.endHour - range.startHour) * HOUR_HEIGHT;
      var todayStr = formatDate(new Date());

      var html = '<div class="week-header">';
      html += '<div class="week-gutter-cell"></div>';
      weekDays.forEach(function (d) {
        var isToday = formatDate(d) === todayStr;
        html += '<div class="week-day-label' + (isToday ? ' is-today' : '') + '">' + WEEKDAY_SHORT[(d.getDay() + 6) % 7] + ' <strong>' + d.getDate() + '.' + (d.getMonth() + 1) + '.</strong></div>';
      });
      html += '</div>';

      html += '<div class="week-body" style="height:' + totalHeight + 'px;">';
      html += '<div class="week-gutter">';
      for (var h = range.startHour; h < range.endHour; h += 1) {
        html += '<div class="week-hour-label" style="height:' + HOUR_HEIGHT + 'px;">' + pad2(h) + ':00</div>';
      }
      html += '</div>';

      weekDays.forEach(function (d) {
        var dateStr = formatDate(d);
        html += '<div class="week-day-col" data-date="' + dateStr + '">';
        for (var h2 = range.startHour; h2 < range.endHour; h2 += 1) {
          html += '<div class="week-hour-line" style="height:' + HOUR_HEIGHT + 'px;"></div>';
        }
        (bookingsByDate[dateStr] || []).forEach(function (b) {
          var parts = b.time.split(':');
          var minutesFromStart = (parseInt(parts[0], 10) - range.startHour) * 60 + (parseInt(parts[1], 10) || 0);
          var top = (minutesFromStart / 60) * HOUR_HEIGHT;
          var eventHeight = Math.max(26, HOUR_HEIGHT * 0.65);
          var pendingClass = b.status === 'pending' ? ' is-pending' : '';
          var titleEmail = b.email ? ' (' + b.email + ')' : '';
          html += '<div class="week-event' + pendingClass + '" style="top:' + top + 'px; height:' + eventHeight + 'px;" title="' + escapeHtml(b.name + titleEmail) + '" data-booking-id="' + b.id + '">' +
            '<strong>' + escapeHtml(b.time) + '</strong> ' + escapeHtml(b.name) +
            '</div>';
        });
        html += '</div>';
      });
      html += '</div>';

      weekViewEl.innerHTML = html;
    }

    function renderCalendar() {
      if (currentView === 'woche') {
        monthViewEl.hidden = true;
        weekViewEl.hidden = false;
        detailEl.hidden = true;
        renderWeekView();
      } else {
        monthViewEl.hidden = false;
        weekViewEl.hidden = true;
        detailEl.hidden = false;
        renderMonthView();
      }
    }

    viewToggleBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        viewToggleBtns.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        currentView = btn.dataset.view;
        renderCalendar();
      });
    });

    prevBtn.addEventListener('click', function () {
      if (currentView === 'woche') {
        viewDate.setDate(viewDate.getDate() - 7);
      } else {
        viewDate.setMonth(viewDate.getMonth() - 1);
      }
      renderCalendar();
    });
    nextBtn.addEventListener('click', function () {
      if (currentView === 'woche') {
        viewDate.setDate(viewDate.getDate() + 7);
      } else {
        viewDate.setMonth(viewDate.getMonth() + 1);
      }
      renderCalendar();
    });

    // Klick auf eine freie Stelle in der Wochenansicht öffnet das "Termin
    // eintragen"-Modal, vorbelegt mit Datum + der angeklickten Uhrzeit
    // (auf das aktuelle Zeitraster gerundet). Klick auf ein bestehendes
    // Event wird ignoriert (kein versehentliches Doppel-Öffnen).
    weekViewEl.addEventListener('click', function (event) {
      if (event.target.closest('.week-event')) return;
      var col = event.target.closest('.week-day-col');
      if (!col) return;
      var rect = col.getBoundingClientRect();
      var offsetY = event.clientY - rect.top;
      var minutesFromStart = (offsetY / HOUR_HEIGHT) * 60;
      var totalMinutes = currentWeekRange.startHour * 60 + minutesFromStart;
      totalMinutes = Math.round(totalMinutes / defaultSlotInterval) * defaultSlotInterval;
      var hh = pad2(Math.floor(totalMinutes / 60));
      var mm = pad2(totalMinutes % 60);
      openAdminModal(col.dataset.date, hh + ':' + mm);
    });

    detailEl.addEventListener('click', function (event) {
      var addTrigger = event.target.closest('[data-add-booking]');
      if (addTrigger) {
        openAdminModal(addTrigger.dataset.addBooking, '');
        return;
      }
      var confirmTrigger = event.target.closest('[data-confirm]');
      if (confirmTrigger) { confirmBooking(confirmTrigger.dataset.confirm); return; }
      var declineTrigger = event.target.closest('[data-decline]');
      if (declineTrigger) { declineBooking(declineTrigger.dataset.decline); }
    });

    loadBookings = function () {
      // Annehmen/Ablehnen ersetzt die komplette Liste per innerHTML (siehe
      // renderAnfragenList) – der eben angeklickte Button verschwindet dabei
      // aus dem DOM. Verliert das gerade fokussierte Element seinen Fokus,
      // weil es entfernt wird, springen manche Browser zurück zum
      // Seitenanfang. Scroll-Position daher merken und direkt danach
      // wiederherstellen.
      var scrollY = window.scrollY;
      return fetch('/api/bookings')
        .then(function (res) { return res.json(); })
        .then(function (data) {
          allBookings = data.bookings || [];
          bookingsByDate = {};
          allBookings.forEach(function (b) {
            (bookingsByDate[b.date] = bookingsByDate[b.date] || []).push(b);
          });
          renderCalendar();
          renderAnfragenList();
          window.scrollTo(0, scrollY);
        })
        .catch(function () {});
    };

    // --- Anfragen: Liste aller offenen (pending) Anfragen, unabhängig vom
    // aktuell im Kalender angezeigten Zeitraum. ---
    function renderAnfragenList() {
      var pending = allBookings.filter(function (b) { return b.status === 'pending'; });
      anfragenBadge.hidden = pending.length === 0;
      anfragenBadge.textContent = pending.length;

      if (!pending.length) {
        anfragenListEl.innerHTML = '<p class="hint">Keine offenen Anfragen.</p>';
        return;
      }
      var rows = pending
        .slice()
        .sort(function (a, b) { return (a.date + a.time).localeCompare(b.date + b.time); })
        .map(function (b) {
          var note = b.note ? '<br><em>' + escapeHtml(b.note) + '</em>' : '';
          return '<li class="anfrage-item">' +
            '<div><strong>' + escapeHtml(b.date) + ' ' + escapeHtml(b.time) + ' Uhr</strong> – ' + escapeHtml(b.name) + ' (' + escapeHtml(b.email) + ')' + note + '</div>' +
            '<div class="booking-actions">' +
            '<button type="button" class="btn-tiny btn-accept" data-confirm="' + b.id + '">Annehmen</button>' +
            '<button type="button" class="btn-tiny btn-decline" data-decline="' + b.id + '">Ablehnen</button>' +
            '</div></li>';
        })
        .join('');
      anfragenListEl.innerHTML = '<ul class="anfragen-list">' + rows + '</ul>';
    }

    anfragenListEl.addEventListener('click', function (event) {
      var confirmTrigger = event.target.closest('[data-confirm]');
      if (confirmTrigger) { confirmBooking(confirmTrigger.dataset.confirm); return; }
      var declineTrigger = event.target.closest('[data-decline]');
      if (declineTrigger) { declineBooking(declineTrigger.dataset.decline); }
    });

    function confirmBooking(id) {
      fetch('/api/bookings/' + id + '/confirm', { method: 'POST' })
        .then(function (res) { return res.json(); })
        .then(function () { loadBookings(); });
    }

    function declineBooking(id) {
      fetch('/api/bookings/' + id + '/decline', { method: 'POST' })
        .then(function (res) { return res.json(); })
        .then(function () { loadBookings(); });
    }

    // --- Admin-Modal: manuelles Eintragen eines Termins (z. B. Telefonanruf) ---
    var modalBackdrop = document.getElementById('admin-modal-backdrop');
    var adminBookingForm = document.getElementById('admin-booking-form');
    var adminModalStatus = document.getElementById('admin-modal-status');

    function openAdminModal(dateStr, timeStr) {
      adminBookingForm.reset();
      adminModalStatus.hidden = true;
      adminBookingForm.date.value = dateStr || '';
      adminBookingForm.time.value = timeStr || '';
      modalBackdrop.hidden = false;
    }

    function closeAdminModal() {
      modalBackdrop.hidden = true;
    }

    document.getElementById('admin-modal-cancel').addEventListener('click', closeAdminModal);
    modalBackdrop.addEventListener('click', function (event) {
      if (event.target === modalBackdrop) closeAdminModal();
    });

    adminBookingForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var payload = {
        name: adminBookingForm.name.value,
        email: adminBookingForm.email.value,
        date: adminBookingForm.date.value,
        time: adminBookingForm.time.value,
        note: adminBookingForm.note.value,
      };
      adminModalStatus.hidden = false;
      adminModalStatus.className = 'booking-status';
      adminModalStatus.textContent = 'Wird eingetragen…';

      fetch('/api/bookings/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(function (res) {
          return res.json().then(function (body) {
            if (!res.ok) throw new Error(body.error || 'Termin konnte nicht eingetragen werden.');
            return body;
          });
        })
        .then(function () {
          closeAdminModal();
          loadBookings();
        })
        .catch(function (err) {
          adminModalStatus.className = 'booking-status booking-status-error';
          adminModalStatus.textContent = 'Fehler: ' + err.message;
        });
    });

    // --- Öffnungszeiten ---
    var settingsForm = document.getElementById('settings-form');
    var settingsDaysEl = document.getElementById('settings-days');
    var settingsStatusEl = document.getElementById('settings-status');
    var WEEKDAY_LABELS = { mo: 'Montag', di: 'Dienstag', mi: 'Mittwoch', do: 'Donnerstag', fr: 'Freitag', sa: 'Samstag', so: 'Sonntag' };
    var WEEKDAY_KEYS = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'];

    function renderSettingsForm(settings) {
      settingsForm.elements.slotInterval.value = String(settings.slotInterval);
      settingsDaysEl.innerHTML = WEEKDAY_KEYS.map(function (key) {
        var day = settings.days[key];
        var hasBreak = day.breakStart != null && day.breakEnd != null;
        var breakStartVal = hasBreak ? day.breakStart : 12;
        var breakEndVal = hasBreak ? day.breakEnd : 13;
        var disabledAttr = hasBreak ? '' : ' disabled';
        return '<div class="settings-day-row">' +
          '<div class="settings-day-main">' +
          '<label class="settings-day-toggle"><input type="checkbox" data-day="' + key + '" data-field="enabled"' + (day.enabled ? ' checked' : '') + '> ' + WEEKDAY_LABELS[key] + '</label>' +
          '<label>Von<input type="number" min="0" max="23" data-day="' + key + '" data-field="startHour" value="' + day.startHour + '"></label>' +
          '<label>Bis<input type="number" min="1" max="24" data-day="' + key + '" data-field="endHour" value="' + day.endHour + '"></label>' +
          '</div>' +
          '<div class="settings-day-break">' +
          '<label class="settings-break-toggle"><input type="checkbox" data-day="' + key + '" data-field="hasBreak"' + (hasBreak ? ' checked' : '') + '> Mittagspause</label>' +
          '<label>Pause von<input type="number" min="0" max="24" data-day="' + key + '" data-field="breakStart" value="' + breakStartVal + '"' + disabledAttr + '></label>' +
          '<label>bis<input type="number" min="0" max="24" data-day="' + key + '" data-field="breakEnd" value="' + breakEndVal + '"' + disabledAttr + '></label>' +
          '</div>' +
          '</div>';
      }).join('');
    }

    // Pause-Von/Bis nur bedienbar, wenn "Mittagspause" angehakt ist.
    settingsDaysEl.addEventListener('change', function (event) {
      if (event.target.dataset.field !== 'hasBreak') return;
      var key = event.target.dataset.day;
      var row = event.target.closest('.settings-day-row');
      row.querySelector('input[data-day="' + key + '"][data-field="breakStart"]').disabled = !event.target.checked;
      row.querySelector('input[data-day="' + key + '"][data-field="breakEnd"]').disabled = !event.target.checked;
    });

    function loadSettings() {
      fetch('/api/settings')
        .then(function (res) { return res.json(); })
        .then(function (data) { renderSettingsForm(data.settings); });
    }

    settingsForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var days = {};
      WEEKDAY_KEYS.forEach(function (key) {
        var hasBreak = settingsDaysEl.querySelector('input[data-day="' + key + '"][data-field="hasBreak"]').checked;
        days[key] = {
          enabled: settingsDaysEl.querySelector('input[data-day="' + key + '"][data-field="enabled"]').checked,
          startHour: parseInt(settingsDaysEl.querySelector('input[data-day="' + key + '"][data-field="startHour"]').value, 10),
          endHour: parseInt(settingsDaysEl.querySelector('input[data-day="' + key + '"][data-field="endHour"]').value, 10),
          breakStart: hasBreak ? parseInt(settingsDaysEl.querySelector('input[data-day="' + key + '"][data-field="breakStart"]').value, 10) : null,
          breakEnd: hasBreak ? parseInt(settingsDaysEl.querySelector('input[data-day="' + key + '"][data-field="breakEnd"]').value, 10) : null,
        };
      });
      var payload = { slotInterval: parseInt(settingsForm.elements.slotInterval.value, 10), days: days };

      settingsStatusEl.hidden = false;
      settingsStatusEl.className = 'booking-status';
      settingsStatusEl.textContent = 'Wird gespeichert…';

      fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          defaultSlotInterval = data.settings.slotInterval;
          settingsStatusEl.className = 'booking-status booking-status-success';
          settingsStatusEl.textContent = 'Öffnungszeiten gespeichert.';
          renderSettingsForm(data.settings);
        })
        .catch(function () {
          settingsStatusEl.className = 'booking-status booking-status-error';
          settingsStatusEl.textContent = 'Fehler beim Speichern.';
        });
    });

    // --- Leistungen verwalten (Name, Beschreibung, optionaler Preis, Bild) ---
    var servicesAdminListEl = document.getElementById('services-admin-list');
    document.getElementById('add-service-btn').addEventListener('click', function () {
      addServiceRow({ id: null, name: '', description: '', price: '', image: '' }, true);
    });

    // Bild wird als Datei hochgeladen (nicht per URL) und als Data-URI direkt
    // in der Leistung gespeichert – gleiches Prinzip wie beim Logo-Upload im
    // Builder-Formular selbst (siehe public/js/form.js).
    function serviceImagePreviewHtml(imageUrl) {
      if (!imageUrl) return '<p class="hint service-image-empty">Kein Bild ausgewählt.</p>';
      return '<div class="service-image-preview">' +
        '<img src="' + escapeHtml(imageUrl) + '" alt="">' +
        '<button type="button" class="btn-tiny btn-decline btn-remove-service-image">Bild entfernen</button>' +
        '</div>';
    }

    function setServiceRowImage(row, dataUrl) {
      row.querySelector('[data-field="image"]').value = dataUrl || '';
      row.querySelector('.service-image-preview-wrap').innerHTML = serviceImagePreviewHtml(dataUrl);
    }

    function serviceRowHtml(service) {
      var idAttr = service.id ? String(service.id) : '';
      return '<div class="service-admin-row" data-id="' + idAttr + '">' +
        '<label>Name<input type="text" data-field="name" value="' + escapeHtml(service.name) + '"></label>' +
        '<label>Beschreibung<textarea data-field="description" rows="2">' + escapeHtml(service.description) + '</textarea></label>' +
        '<label>Preis (optional)<input type="text" data-field="price" value="' + escapeHtml(service.price) + '" placeholder="z. B. 45 € oder ab 30 €"></label>' +
        '<div class="service-image-field">' +
        '<span class="service-image-field-label">Bild (optional)</span>' +
        '<input type="hidden" data-field="image" value="' + escapeHtml(service.image) + '">' +
        '<div class="service-image-preview-wrap">' + serviceImagePreviewHtml(service.image) + '</div>' +
        '<label class="btn btn-secondary btn-upload-label">Bild hochladen…<input type="file" accept="image/*" class="service-image-file" hidden></label>' +
        '</div>' +
        '<div class="service-admin-actions">' +
        '<button type="button" class="btn-tiny btn-save-service">Speichern</button>' +
        '<button type="button" class="btn-tiny btn-decline btn-delete-service">Löschen</button>' +
        '</div><p class="service-admin-status booking-status" hidden></p>' +
        '</div>';
    }

    function addServiceRow(service, focusName) {
      var wrapper = document.createElement('div');
      wrapper.innerHTML = serviceRowHtml(service);
      var row = wrapper.firstChild;
      servicesAdminListEl.appendChild(row);
      if (focusName) row.querySelector('input[data-field="name"]').focus();
    }

    function loadServicesAdmin() {
      // Seed-Endpoint statt einfachem GET: seedIfEmpty() liefert die
      // bestehenden Leistungen unverändert zurück, falls schon welche im
      // Server-Speicher sind (z. B. durch Admin-Bearbeitung), und seedet
      // andernfalls aus den im Builder eingetragenen Leistungen – genau wie
      // die öffentliche Leistungen-Seite es beim eigenen Laden tut. So sieht
      // man hier auch etwas, wenn die Leistungen-Seite selbst noch nie
      // aufgerufen wurde.
      var seedPayload = (window.__staticLeistungen || []).map(function (s) {
        return {
          name: s.name || '',
          description: s.description || '',
          price: '',
          image: (s.image && s.image.src) || '',
        };
      });
      fetch('/api/services/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ services: seedPayload }),
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          servicesAdminListEl.innerHTML = '';
          (data.services || []).forEach(function (service) { addServiceRow(service, false); });
        });
    }

    servicesAdminListEl.addEventListener('change', function (event) {
      if (!event.target.classList.contains('service-image-file')) return;
      var row = event.target.closest('.service-admin-row');
      var file = event.target.files && event.target.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        window.alert('Bild ist zu groß (max. 5 MB). Bitte ein kleineres Bild wählen.');
        event.target.value = '';
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        setServiceRowImage(row, String(reader.result));
      };
      reader.readAsDataURL(file);
    });

    servicesAdminListEl.addEventListener('click', function (event) {
      var row = event.target.closest('.service-admin-row');
      if (!row) return;
      var statusEl = row.querySelector('.service-admin-status');

      if (event.target.classList.contains('btn-remove-service-image')) {
        setServiceRowImage(row, '');
        return;
      }

      if (event.target.classList.contains('btn-save-service')) {
        var payload = {
          name: row.querySelector('[data-field="name"]').value,
          description: row.querySelector('[data-field="description"]').value,
          price: row.querySelector('[data-field="price"]').value,
          image: row.querySelector('[data-field="image"]').value,
        };
        var id = row.dataset.id;
        var request = id
          ? fetch('/api/services/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
          : fetch('/api/services', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

        statusEl.hidden = false;
        statusEl.className = 'service-admin-status booking-status';
        statusEl.textContent = 'Wird gespeichert…';

        request
          .then(function (res) { return res.json(); })
          .then(function (data) {
            if (data.service && data.service.id) row.dataset.id = data.service.id;
            statusEl.className = 'service-admin-status booking-status booking-status-success';
            statusEl.textContent = 'Gespeichert.';
          })
          .catch(function () {
            statusEl.className = 'service-admin-status booking-status booking-status-error';
            statusEl.textContent = 'Fehler beim Speichern.';
          });
        return;
      }

      if (event.target.classList.contains('btn-delete-service')) {
        var deleteId = row.dataset.id;
        if (!deleteId) { row.remove(); return; }
        fetch('/api/services/' + deleteId, { method: 'DELETE' })
          .then(function () { row.remove(); });
      }
    });

    // Aktuelles Zeitraster laden (für das Klick-Runden in der Wochenansicht)
    // und direkt die Kalenderansicht (Standard-Unter-Tab) befüllen.
    fetch('/api/settings')
      .then(function (res) { return res.json(); })
      .then(function (data) { defaultSlotInterval = data.settings.slotInterval || 30; })
      .catch(function () {});
    activateSubtab('kalender');
  }

  return {
    init: init,
    refresh: function () { if (initialized) loadBookings(); },
  };
})();
