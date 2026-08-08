// In-Memory-Speicher für Terminbuchungen (Prototyp): Der Server merkt sich
// alle Termine nur während der Laufzeit – bei Neustart ist die Liste leer.
// Persistente Speicherung (Datei/Datenbank) folgt, sobald geklärt ist, wie
// und wo die fertige Kundenwebsite mit aktivierter Buchung später läuft.
//
// Jede Buchung hat einen Status:
//   pending   – Kundenanfrage, noch nicht vom Admin bestätigt/abgelehnt
//   confirmed – bestätigt (vom Admin akzeptiert, oder direkt vom Admin
//               eingetragen, z. B. nach einem Telefonanruf)
//   declined  – vom Admin abgelehnt; Slot gilt wieder als frei
let bookings = [];
let nextId = 1;

function addBooking({ name, email, date, time, note, status }) {
  const booking = {
    id: nextId++,
    name: String(name).trim(),
    email: email ? String(email).trim() : '',
    date: String(date).trim(),
    time: String(time).trim(),
    note: note ? String(note).trim() : '',
    status: status || 'pending',
    createdAt: new Date().toISOString(),
  };
  bookings.push(booking);
  return booking;
}

function listBookings() {
  return bookings.slice().sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

function getBooking(id) {
  return bookings.find((b) => b.id === id) || null;
}

function setBookingStatus(id, status) {
  const booking = getBooking(id);
  if (!booking) return null;
  booking.status = status;
  return booking;
}

// Ein Slot gilt als belegt, wenn dort bereits eine offene Anfrage (pending)
// oder ein bestätigter Termin (confirmed) liegt. Abgelehnte Termine (declined)
// geben den Slot wieder frei.
function isSlotTaken(date, time) {
  return bookings.some((b) => b.date === date && b.time === time && b.status !== 'declined');
}

function listBookingsForDate(date) {
  return bookings.filter((b) => b.date === date && b.status !== 'declined');
}

module.exports = { addBooking, listBookings, getBooking, setBookingStatus, isSlotTaken, listBookingsForDate };
