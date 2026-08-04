# Website Builder

Internes Tool, um für Kunden (Freelancer & kleine Unternehmen) schnell fertige Websites
zu generieren. Formular ausfüllen → Website wird als HTML/CSS gebaut → ZIP herunterladen
→ auf einem beliebigen Hosting-Anbieter hochladen.

Es gibt keine Datenbank und keinen Cloud-Dienst: Alles läuft lokal auf eurem Rechner,
das Ergebnis sind ganz normale HTML/CSS-Dateien, die auf jedem Webhosting funktionieren.

## Nutzung

Voraussetzung: [Node.js](https://nodejs.org) ist installiert (Version 18 oder neuer).

```bash
npm install      # einmalig, installiert die benötigten Pakete
npm start        # startet das Tool
```

Danach im Browser öffnen: **http://localhost:3000**

1. Unternehmensdaten eintragen (Name, Kontakt, Primärfarbe, Schriftart, Branche, ...)
2. Gewünschte Seiten per Checkbox aktivieren (Home & Impressum sind immer dabei)
3. Inhalte für die aktivierten Seiten ausfüllen
4. Impressumsdaten eintragen (Pflichtangaben)
5. Auf "Website generieren" klicken → es wird automatisch eine ZIP-Datei heruntergeladen

### Automatische Fotos (optional, aber empfohlen)

Passend zur gewählten Branche lädt das Tool automatisch lizenzfreie Stockfotos von
[Pexels](https://www.pexels.com) (kostenlos, keine Attribution nötig). Dafür einmalig:

1. Kostenlosen API-Key holen: https://www.pexels.com/api/ (nur E-Mail, keine Kreditkarte)
2. Datei `.env.example` im Projektordner kopieren und in `.env` umbenennen
3. In der `.env`-Datei den Key eintragen: `PEXELS_API_KEY=euer-key`
4. `npm start` neu starten

Ohne Key funktioniert das Tool ganz normal weiter, nur ohne automatische Fotos.
Die `.env`-Datei landet nie auf GitHub (steht in `.gitignore`) – bei einem Wechsel
auf einen anderen Rechner muss sie dort einmalig neu angelegt werden.

Die ZIP-Datei enthält die fertige Website (`index.html`, `impressum.html`, `css/...`) –
einfach den Inhalt per FTP/Datei-Upload beim Hosting-Anbieter hochladen.

> **Hinweis zum Impressum:** Die Felder decken die üblichen Pflichtangaben ab, ersetzen
> aber keine rechtliche Prüfung. Vor Veröffentlichung im Zweifel von einer Anwältin/einem
> Anwalt gegenprüfen lassen.

### Buchungen: Login + Terminkalender (Prototyp)

Die Seite "Buchungen" enthält ein öffentliches Buchungsformular (Name, E-Mail, Datum,
Uhrzeit) sowie einen Admin-Bereich mit Kalender-Übersicht der gebuchten Termine.

- **Admin-Login zum Testen:** Benutzername/E-Mail `admin`, Passwort `admin`
- **Speicherung:** nur im Arbeitsspeicher des Builder-Servers – bei `npm start`-Neustart
  sind alle Buchungen wieder weg. Eine dauerhafte Speicherung (Datei/Datenbank) folgt,
  sobald geklärt ist, wie die fertige Kundenwebsite mit Buchung gehostet wird.
- **Wichtig:** Login/Kalender funktionieren nur, wenn die Seite über den Button
  **"Im Browser öffnen"** aus diesem Tool aufgerufen wird (selber Server/Origin). Im
  reinen ZIP-Export, hochgeladen auf ein rein statisches Hosting ohne eigenen Server,
  funktioniert die Buchung aktuell **nicht** – das ist eine bewusste, vorübergehende
  Einschränkung dieses Prototyps.
- **Terminbestätigung per E-Mail:** Ohne eigene SMTP-Zugangsdaten wird automatisch ein
  kostenloses Ethereal-Testkonto genutzt – die Mail wird nicht wirklich zugestellt, aber
  eine Vorschau-URL landet im Terminal (Server-Log). Für echten Versand `SMTP_HOST` /
  `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` in `.env` eintragen (siehe
  `.env.example`).

## Aktueller Funktionsumfang (MVP)

Bereits verfügbare Seiten-Bausteine:

- [x] Startseite (Home) – Pflicht
- [x] Über uns / Team
- [x] Leistungen / Portfolio
- [x] Kontakt & Anfahrt
- [x] Buchungen – Login/Kalender-Prototyp, siehe oben
- [x] Impressum – Pflicht

Im Formular sichtbar, aber noch nicht umgesetzt (Phase 2, als "demnächst" markiert):

- [ ] Einzelne Leistungs-Detailseiten
- [ ] Karriere / Stellenangebote
- [ ] Blog / News

## Projektstruktur

```
server.js                 Express-Server: liefert das Formular aus, nimmt Eingaben entgegen
src/generator.js           Baut aus den Formulardaten die fertigen HTML-Seiten
src/images.js               Bildersuche über die Pexels-API (inkl. Cache)
src/bookings.js              In-Memory-Speicher für Terminbuchungen (Prototyp)
src/mailer.js                Terminbestätigungs-Mails (Ethereal-Test oder eigenes SMTP)
src/data/defaults.js       Verfügbare Seiten + Standardfarbe/-schrift + Font-Presets
src/data/professions.js     Branchen-Liste fürs Dropdown + Bildersuchbegriffe
templates/                 HTML-Bausteine (Handlebars) + Basis-CSS/JS der generierten Website
public/                    Formular-Oberfläche des Builder-Tools selbst
output/                    Generierte Websites (wird lokal erzeugt, nicht eingecheckt)
```

## Neue Branchen hinzufügen (für später)

Einfach einen neuen Eintrag in `src/data/professions.js` ergänzen (Key, deutsches
Label und 1-2 englische Suchbegriffe für Pexels). Taucht danach automatisch im
Formular-Dropdown auf.

## Neue Seiten-Bausteine hinzufügen (für später)

1. Neuen Eintrag in `src/data/defaults.js` unter `PAGE_DEFINITIONS` anlegen
   (`available: true` setzen, sobald das Template existiert)
2. Neues Template unter `templates/pages/<name>.hbs` anlegen
3. Template in `src/generator.js` bei `PAGE_TEMPLATE_FILES` eintragen
4. Formular-Abschnitt (Checkbox + Inhaltsfelder) in `public/index.html` ergänzen
