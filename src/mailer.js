// Buchungs-E-Mails (Anfrage/Bestätigung/Absage). Ohne eigene SMTP-Zugangsdaten
// (.env) wird automatisch ein kostenloses Ethereal-Testkonto verwendet – die
// "E-Mail" wird nicht wirklich zugestellt, aber eine Vorschau-URL landet im
// Server-Log, damit man den Ablauf ohne eigenes Postfach testen kann.
// Für echten Versand: SMTP_HOST/PORT/USER/PASS/FROM in .env eintragen.
const nodemailer = require('nodemailer');

let transporterPromise = null;

function isRealSmtpConfigured() {
  return !!process.env.SMTP_HOST;
}

function getTransporter() {
  if (transporterPromise) return transporterPromise;

  if (isRealSmtpConfigured()) {
    transporterPromise = Promise.resolve(
      nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT, 10) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      })
    );
  } else {
    transporterPromise = nodemailer.createTestAccount().then((account) =>
      nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: account.user, pass: account.pass },
      })
    );
  }

  return transporterPromise;
}

async function sendMail(to, subject, text) {
  const transporter = await getTransporter();
  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || '"Terminbuchung" <no-reply@website-builder.local>',
    to,
    subject,
    text,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info); // null bei echtem SMTP
  if (previewUrl) {
    console.log(`📧 Test-E-Mail (Ethereal, nicht real zugestellt) – Vorschau: ${previewUrl}`);
  }
  return previewUrl || null;
}

// 1. Direkt nach dem Absenden des Buchungsformulars: nur eine Eingangs-
// bestätigung der ANFRAGE, noch keine Zusage.
async function sendRequestReceived(booking) {
  if (!booking.email) return null;
  return sendMail(
    booking.email,
    'Ihre Terminanfrage ist eingegangen',
    `Hallo ${booking.name},\n\nwir haben Ihre Anfrage für einen Termin am ${booking.date} um ${booking.time} Uhr erhalten.\n\nWir prüfen den Termin und melden uns in Kürze mit einer Bestätigung.\n\nBis bald!`
  );
}

// 2. Wenn der Admin die Anfrage annimmt (oder direkt selbst einen Termin einträgt).
async function sendBookingConfirmed(booking) {
  if (!booking.email) return null;
  return sendMail(
    booking.email,
    'Ihr Termin ist bestätigt',
    `Hallo ${booking.name},\n\nIhr Termin am ${booking.date} um ${booking.time} Uhr ist bestätigt.\n\nWir freuen uns auf Sie!`
  );
}

// 3. Wenn der Admin die Anfrage ablehnt.
async function sendBookingDeclined(booking) {
  if (!booking.email) return null;
  return sendMail(
    booking.email,
    'Ihre Terminanfrage konnte leider nicht bestätigt werden',
    `Hallo ${booking.name},\n\nleider können wir Ihre Anfrage für den ${booking.date} um ${booking.time} Uhr nicht bestätigen.\n\nBitte wählen Sie gerne einen anderen Termin oder kontaktieren Sie uns direkt.`
  );
}

module.exports = { sendRequestReceived, sendBookingConfirmed, sendBookingDeclined, isRealSmtpConfigured };
