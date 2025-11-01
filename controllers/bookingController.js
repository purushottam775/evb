import db from "../config/db.js";
import { sendEmail } from "../utils/sendEmail.js";



// ---------------- User: Create booking ----------------
export const createBooking = (req, res) => {
  const { user_id } = req.user;
  const { slot_id, station_id, booking_date, start_time, end_time } = req.body;

  // ---------------- Basic input validation ----------------
  if (!slot_id || !station_id || !booking_date || !start_time || !end_time) {
    return res.status(400).json({ message: "All fields are required" });
  }

  if (new Date(`${booking_date}T${start_time}`) >= new Date(`${booking_date}T${end_time}`)) {
    return res.status(400).json({ message: "End time must be after start time" });
  }

  // STEP 1: Validate that station and slot exist, are active, and linked
  const checkStationSlotQuery = `
    SELECT cs.station_id, cs.station_status, cs.available_slots, s.slot_id, s.slot_status
    FROM ChargingStation cs
    JOIN Slot s ON cs.station_id = s.station_id
    WHERE cs.station_id = ? AND s.slot_id = ?
  `;

  db.query(checkStationSlotQuery, [station_id, slot_id], (err, results) => {
    if (err) return res.status(500).json({ message: err.message });
    if (results.length === 0)
      return res.status(400).json({ message: "Invalid slot or station combination" });

    const station = results[0];
    if (station.station_status !== "active")
      return res.status(400).json({ message: "Station is inactive" });

    if (station.available_slots <= 0)
      return res.status(400).json({ message: "No available slots at this station" });

    if (station.slot_status !== "available")
      return res.status(400).json({ message: "Selected slot is not available" });

    // STEP 2: Prevent user overlapping bookings
    const userOverlapQuery = `
      SELECT 1 FROM bookings
      WHERE user_id=? 
        AND booking_date=? 
        AND booking_status IN ('pending','approved')
        AND ((start_time < ? AND end_time > ?) OR (start_time < ? AND end_time > ?))
      LIMIT 1
    `;
    db.query(
      userOverlapQuery,
      [user_id, booking_date, end_time, start_time, start_time, end_time],
      (errU, userResults) => {
        if (errU) return res.status(500).json({ message: errU.message });
        if (userResults.length > 0)
          return res.status(400).json({ message: "You already have a booking during this time" });

        // STEP 3: Prevent slot overlapping booking
        const slotOverlapQuery = `
          SELECT 1 FROM bookings
          WHERE slot_id=? AND station_id=? AND booking_date=? 
            AND booking_status IN ('pending','approved')
            AND ((start_time < ? AND end_time > ?) OR (start_time < ? AND end_time > ?))
          LIMIT 1
        `;
        db.query(
          slotOverlapQuery,
          [slot_id, station_id, booking_date, end_time, start_time, start_time, end_time],
          (errS, slotResults) => {
            if (errS) return res.status(500).json({ message: errS.message });
            if (slotResults.length > 0)
              return res.status(400).json({
                message: "Slot is already booked for the given time",
              });

            // STEP 4: Start transaction safely using a pooled connection
            db.getConnection((errConn, connection) => {
              if (errConn)
                return res.status(500).json({ message: "Failed to get DB connection" });

              connection.beginTransaction((errT) => {
                if (errT) {
                  connection.release();
                  return res.status(500).json({ message: "Failed to start transaction" });
                }

                const insertBooking = `
                  INSERT INTO bookings
                  (user_id, slot_id, station_id, booking_date, start_time, end_time, booking_status, payment_status)
                  VALUES (?, ?, ?, ?, ?, ?, 'pending', 'pending')
                `;

                connection.query(
                  insertBooking,
                  [user_id, slot_id, station_id, booking_date, start_time, end_time],
                  (errI, result) => {
                    if (errI) {
                      return connection.rollback(() => {
                        connection.release();
                        res.status(500).json({ message: "Failed to create booking" });
                      });
                    }

                    // Decrease available slots
                    const updateStation = `
                      UPDATE ChargingStation 
                      SET available_slots = GREATEST(available_slots - 1, 0)
                      WHERE station_id=? AND available_slots > 0
                    `;
                    connection.query(updateStation, [station_id], (errU2, stationUpdateResult) => {
                      if (errU2 || stationUpdateResult.affectedRows === 0) {
                        return connection.rollback(() => {
                          connection.release();
                          res.status(400).json({
                            message: "Failed to update station availability — please retry",
                          });
                        });
                      }

                      // Mark slot as booked
                      const updateSlot = `
                        UPDATE Slot 
                        SET slot_status='booked'
                        WHERE slot_id=? AND slot_status='available'
                      `;
                      connection.query(updateSlot, [slot_id], (errSlot) => {
                        if (errSlot) {
                          return connection.rollback(() => {
                            connection.release();
                            res.status(500).json({ message: "Failed to update slot status" });
                          });
                        }

                        // Commit transaction
                        connection.commit((errC) => {
                          if (errC) {
                            return connection.rollback(() => {
                              connection.release();
                              res.status(500).json({ message: "Commit failed" });
                            });
                          }

                          connection.release();
                          return res.status(201).json({
                            message: "Booking created successfully",
                            booking_id: result.insertId,
                          });
                        });
                      });
                    });
                  }
                );
              });
            });
          }
        );
      }
    );
  });
};


// ---------------- User: Update pending booking ----------------
export const updateBooking = (req, res) => {
  const { user_id } = req.user;
  const { id } = req.params;
  const { slot_id, station_id, booking_date, start_time, end_time } = req.body;

  const checkBookingQuery = `
    SELECT * FROM bookings 
    WHERE booking_id=? AND user_id=? AND booking_status='pending'
  `;
  db.query(checkBookingQuery, [id, user_id], (err, results) => {
    if (err) return res.status(500).json({ message: err.message });
    if (results.length === 0) return res.status(400).json({ message: "Booking cannot be updated" });

    // Step 1: Check overlapping bookings for user at this station
    const userOverlapQuery = `
      SELECT * FROM bookings
      WHERE user_id=? 
        AND station_id=? 
        AND booking_date=? 
        AND booking_id<>?
        AND booking_status IN ('pending','approved')
        AND ((start_time < ? AND end_time > ?) OR (start_time < ? AND end_time > ?))
    `;
    db.query(userOverlapQuery, [user_id, station_id, booking_date, id, end_time, start_time, start_time, end_time], (err2, userResults) => {
      if (err2) return res.status(500).json({ message: err2.message });
      if (userResults.length > 0) {
        return res.status(400).json({ message: "You already have a booking at this station during this time" });
      }

      // Step 2: Check slot availability
      const slotCheckQuery = `
        SELECT * FROM bookings
        WHERE slot_id=? 
          AND station_id=? 
          AND booking_date=? 
          AND booking_id<>?
          AND booking_status IN ('pending','approved')
          AND ((start_time < ? AND end_time > ?) OR (start_time < ? AND end_time > ?))
      `;
      db.query(slotCheckQuery, [slot_id, station_id, booking_date, id, end_time, start_time, start_time, end_time], (err3, slotResults) => {
        if (err3) return res.status(500).json({ message: err3.message });
        if (slotResults.length > 0) {
          return res.status(400).json({ message: "This slot is already booked for the given time" });
        }

        // Step 3: Update booking
        const updateQuery = `
          UPDATE bookings
          SET slot_id=?, station_id=?, booking_date=?, start_time=?, end_time=?
          WHERE booking_id=?
        `;
        db.query(updateQuery, [slot_id, station_id, booking_date, start_time, end_time, id], (err4) => {
          if (err4) return res.status(500).json({ message: err4.message });
          res.json({ message: "Booking updated successfully" });
        });
      });
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

      // Increment available slots
      const updateStation = `
        UPDATE ChargingStation cs
        JOIN bookings b ON cs.station_id=b.station_id
        SET cs.available_slots=cs.available_slots+1
        WHERE b.booking_id=?
      `;
      db.query(updateStation, [id]);
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

export const approveBooking = (req, res) => {
  const { id } = req.params;

  // Step 1: Approve booking
  const query = "UPDATE bookings SET booking_status='approved' WHERE booking_id=?";
  db.query(query, [id], (err, result) => {
    if (err) return res.status(500).json({ message: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ message: "Booking not found" });

    // Step 2: Decrease available slots
    const updateStation = `
      UPDATE ChargingStation cs
      JOIN bookings b ON cs.station_id=b.station_id
      SET cs.available_slots=cs.available_slots-1
      WHERE b.booking_id=?
    `;
    db.query(updateStation, [id]);

    // Step 3: Fetch booking + user info
    const fetchQuery = `
      SELECT u.email, u.name, c.station_name, s.slot_number, b.booking_date, b.start_time, b.end_time
      FROM bookings b
      JOIN user u ON b.user_id=u.user_id
      JOIN ChargingStation c ON b.station_id=c.station_id
      JOIN Slot s ON b.slot_id=s.slot_id
      WHERE b.booking_id=?
    `;
    db.query(fetchQuery, [id], async (err2, results) => {
      if (!err2 && results.length > 0) {
        const { email, name, station_name, slot_number, booking_date, start_time, end_time } = results[0];

        // Step 4: Send email
        try {
          await sendEmail(
            email,
            "Booking Confirmed ",
            `<h2>Hello ${name},</h2>
             <p>Your booking has been <b>approved</b> successfully 🎉</p>
             <p><b>Details:</b></p>
             <ul>
               <li>Station: ${station_name}</li>
               <li>Slot: ${slot_number}</li>
               <li>Date: ${booking_date}</li>
               <li>Time: ${start_time} - ${end_time}</li>
             </ul>
             <p>We look forward to seeing you!</p>
             <p>⚡ EV Charging Team</p>`
          );
        } catch (emailErr) {
          console.error("Email sending failed:", emailErr);
        }
      }
    });

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

    // No slot decrement on reject (optional: increment if pre-reserved)
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
