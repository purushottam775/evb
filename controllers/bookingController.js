import db from "../config/db.js";

// ---------------- User: Create booking ----------------
export const createBooking = (req, res) => {
  const { user_id } = req.user;
  const { slot_id, station_id, booking_date, start_time, end_time } = req.body;

  if (!slot_id || !station_id || !booking_date || !start_time || !end_time) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const query = `
    INSERT INTO bookings
    (user_id, slot_id, station_id, booking_date, start_time, end_time, booking_status, payment_status) 
    VALUES (?, ?, ?, ?, ?, ?, 'pending', 'pending')
  `;

  db.query(
    query,
    [user_id, slot_id, station_id, booking_date, start_time, end_time],
    (err, result) => {
      if (err) return res.status(500).json({ message: err.message });
      res.status(201).json({ message: "Booking request sent", booking_id: result.insertId });
    }
  );
};

// ---------------- User: Update pending booking ----------------
export const updateBooking = (req, res) => {
  const { user_id } = req.user;
  const { id } = req.params;
  const { slot_id, station_id, booking_date, start_time, end_time } = req.body;

  const queryCheck = `
    SELECT * FROM bookings 
    WHERE booking_id=? AND user_id=? AND booking_status='pending'
  `;
  db.query(queryCheck, [id, user_id], (err, results) => {
    if (err) return res.status(500).json({ message: err.message });
    if (results.length === 0) return res.status(400).json({ message: "Booking cannot be updated" });

    const queryUpdate = `
      UPDATE bookings 
      SET slot_id=?, station_id=?, booking_date=?, start_time=?, end_time=? 
      WHERE booking_id=?
    `;
    db.query(queryUpdate, [slot_id, station_id, booking_date, start_time, end_time, id], (err2) => {
      if (err2) return res.status(500).json({ message: err2.message });
      res.json({ message: "Booking updated successfully" });
    });
  });
};

// ---------------- User: Cancel pending booking ----------------
export const cancelBooking = (req, res) => {
  const { user_id } = req.user;
  const { id } = req.params;

  const queryCheck = `
    SELECT * FROM bookings 
    WHERE booking_id=? AND user_id=? AND booking_status='pending'
  `;
  db.query(queryCheck, [id, user_id], (err, results) => {
    if (err) return res.status(500).json({ message: err.message });
    if (results.length === 0) return res.status(400).json({ message: "Booking cannot be cancelled" });

    const queryCancel = "UPDATE bookings SET booking_status='cancelled' WHERE booking_id=?";
    db.query(queryCancel, [id], (err2) => {
      if (err2) return res.status(500).json({ message: err2.message });
      res.json({ message: "Booking cancelled successfully" });
    });
  });
};

// ---------------- Admin: List pending bookings ----------------
export const listPendingBookings = (req, res) => {
  const query = `
    SELECT b.*, u.name as user_name, c.station_name, s.slot_number
    FROM bookings b
    JOIN user u ON b.user_id=u.user_id
    JOIN chargingstation c ON b.station_id=c.station_id
    JOIN slot s ON b.slot_id=s.slot_id
    WHERE b.booking_status='pending'
  `;
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json({ bookings: results });
  });
};

// ---------------- Admin: Approve booking ----------------
export const approveBooking = (req, res) => {
  const { id } = req.params;
  const query = "UPDATE bookings SET booking_status='approved' WHERE booking_id=?";
  db.query(query, [id], (err, result) => {
    if (err) return res.status(500).json({ message: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ message: "Booking not found" });
    res.json({ message: "Booking approved" });
  });
};

// ---------------- Admin: Reject booking ----------------
export const rejectBooking = (req, res) => {
  const { id } = req.params;
  const query = "UPDATE bookings SET booking_status='rejected' WHERE booking_id=?";
  db.query(query, [id], (err, result) => {
    if (err) return res.status(500).json({ message: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ message: "Booking not found" });
    res.json({ message: "Booking rejected" });
  });
};

// ---------------- User: View bookings ----------------
export const userBookings = (req, res) => {
  const { user_id } = req.user;
  const query = `
    SELECT b.*, c.station_name, s.slot_number
    FROM bookings b
    JOIN chargingstation c ON b.station_id=c.station_id
    JOIN slot s ON b.slot_id=s.slot_id
    WHERE b.user_id=?
  `;
  db.query(query, [user_id], (err, results) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json({ bookings: results });
  });
};
