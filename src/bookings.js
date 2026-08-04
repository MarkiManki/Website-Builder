// In-Memory-Speicher für Terminbuchungen (Prototyp): Der Server merkt sich
// alle Termine nur während der Laufzeit – bei Neustart ist die Liste leer.
// Persistente Speicherung (Datei/Datenbank) folgt, sobald geklärt ist, wie
// und wo die fertige Kundenwebsite mit aktivierter Buchung später läuft.
let bookings = [];
let nextId = 1;

function addBooking({ name, email, date, time, note }) {
  const booking = {
    id: nextId++,
    name: String(name).trim(),
    email: String(email).trim(),
    date: String(date).trim(),
    time: String(time).trim(),
    note: note ? String(note).trim() : '',
    createdAt: new Date().toISOString(),
  };
  bookings.push(booking);
  return booking;
}

function listBookings() {
  return bookings.slice().sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

module.exports = { addBooking, listBookings };
