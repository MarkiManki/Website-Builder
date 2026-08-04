// Terminbestätigungs-Mails. Ohne eigene SMTP-Zugangsdaten (.env) wird
// automatisch ein kostenloses Ethereal-Testkonto verwendet – die "E-Mail"
// wird nicht wirklich zugestellt, aber eine Vorschau-URL landet im
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

async function sendBookingConfirmation(booking) {
  const transporter = await getTransporter();
  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || '"Terminbuchung" <no-reply@website-builder.local>',
    to: booking.email,
    subject: 'Terminbestätigung',
    text: `Hallo ${booking.name},\n\nIhr Termin am ${booking.date} um ${booking.time} Uhr wurde erfolgreich gebucht.\n\nBis bald!`,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info); // null bei echtem SMTP
  if (previewUrl) {
    console.log(`📧 Test-E-Mail (Ethereal, nicht real zugestellt) – Vorschau: ${previewUrl}`);
  }
  return previewUrl || null;
}

module.exports = { sendBookingConfirmation, isRealSmtpConfigured };
