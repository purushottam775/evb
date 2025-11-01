import db from "../config/db.js";

const validSlotStatus = ["available", "occupied", "maintenance"];

/* Add slot to a station */
export const addSlot = (req, res) => {
  let { station_id, slot_number, slot_status } = req.body;

  if (!station_id || slot_number === undefined || !slot_status) {
    return res.status(400).json({ success: false, message: "All fields are required" });
  }

  station_id = parseInt(station_id, 10);
  slot_number = parseInt(slot_number, 10);
  slot_status = String(slot_status).trim();

  if (Number.isNaN(station_id) || Number.isNaN(slot_number) || slot_number <= 0) {
    return res.status(400).json({ success: false, message: "station_id and slot_number must be positive integers" });
  }
  if (!validSlotStatus.includes(slot_status)) {
    return res.status(400).json({ success: false, message: "Invalid slot_status" });
  }

  db.getConnection((err, conn) => {
    if (err) return res.status(500).json({ success: false, message: err.message });

    conn.beginTransaction(errTx => {
      if (errTx) { conn.release(); return res.status(500).json({ success: false, message: errTx.message }); }

      // Check station exists and total_slots
      const stationQ = `SELECT total_slots FROM ChargingStation WHERE station_id = ? FOR UPDATE`;
      conn.query(stationQ, [station_id], (errSt, stRows) => {
        if (errSt) {
          return conn.rollback(() => { conn.release(); res.status(500).json({ success: false, message: errSt.message }); });
        }
        if (stRows.length === 0) {
          return conn.rollback(() => { conn.release(); res.status(404).json({ success: false, message: "Station not found" }); });
        }
        const totalSlots = stRows[0].total_slots;

        // Validate slot_number is within 1..totalSlots
        if (slot_number > totalSlots) {
          return conn.rollback(() => { conn.release(); res.status(400).json({ success: false, message: `slot_number cannot be > station.total_slots (${totalSlots})` }); });
        }

        // Ensure station hasn't reached its slots count (count rows) OR a missing-number slot may be allowed if slot_number isn't used
        const countQuery = `SELECT COUNT(*) AS existingSlots FROM Slot WHERE station_id = ?`;
        conn.query(countQuery, [station_id], (errCnt, cntRows) => {
          if (errCnt) {
            return conn.rollback(() => { conn.release(); res.status(500).json({ success: false, message: errCnt.message }); });
          }
          const existingSlots = cntRows[0].existingSlots;

          // Check duplicate slot_number for this station
          const checkQuery = `SELECT * FROM Slot WHERE station_id = ? AND slot_number = ?`;
          conn.query(checkQuery, [station_id, slot_number], (errCheck, checkRows) => {
            if (errCheck) {
              return conn.rollback(() => { conn.release(); res.status(500).json({ success: false, message: errCheck.message }); });
            }
            if (checkRows.length > 0) {
              return conn.rollback(() => { conn.release(); res.status(400).json({ success: false, message: "Slot number already exists for this station" }); });
            }

            // if existingSlots >= totalSlots then the station is full (unless there are gaps but slot_number is new and within range)
            if (existingSlots >= totalSlots) {
              // If there's still a free slot_number because of gaps, we allowed it above; otherwise reject.
              return conn.rollback(() => { conn.release(); res.status(400).json({ success: false, message: `Cannot add more slots. Station has reached its total limit of ${totalSlots} slots.` }); });
            }

            const insertQ = `INSERT INTO Slot (station_id, slot_number, slot_status) VALUES (?, ?, ?)`;
            conn.query(insertQ, [station_id, slot_number, slot_status], (errIns, insRes) => {
              if (errIns) {
                return conn.rollback(() => { conn.release(); res.status(500).json({ success: false, message: errIns.message }); });
              }

              // adjust available_slots only if slot inserted is 'available'
              if (slot_status === "available") {
                const incQ = `UPDATE ChargingStation SET available_slots = available_slots + 1 WHERE station_id = ?`;
                conn.query(incQ, [station_id], (errInc) => {
                  if (errInc) {
                    return conn.rollback(() => { conn.release(); res.status(500).json({ success: false, message: errInc.message }); });
                  }
                  conn.commit(errCommit => {
                    if (errCommit) return conn.rollback(() => { conn.release(); res.status(500).json({ success: false, message: errCommit.message }); });
                    conn.release();
                    res.status(201).json({ success: true, message: "Slot added successfully", slot_id: insRes.insertId });
                  });
                });
              } else {
                conn.commit(errCommit => {
                  if (errCommit) return conn.rollback(() => { conn.release(); res.status(500).json({ success: false, message: errCommit.message }); });
                  conn.release();
                  res.status(201).json({ success: true, message: "Slot added successfully", slot_id: insRes.insertId });
                });
              }
            });
          });

        });
      });
    });
  });
};

/* Update slot */
export const updateSlot = (req, res) => {
  const { id } = req.params;
  const body = req.body; // may contain: slot_number, slot_status, station_id

  if (!body.slot_number && !body.slot_status && !body.station_id) {
    return res.status(400).json({ success: false, message: "At least one field (slot_number/slot_status/station_id) is required" });
  }

  db.getConnection((err, conn) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    conn.beginTransaction(errTx => {
      if (errTx) { conn.release(); return res.status(500).json({ success: false, message: errTx.message }); }

      // Fetch existing slot
      const slotQ = `SELECT * FROM Slot WHERE slot_id = ? FOR UPDATE`;
      conn.query(slotQ, [id], (errSlot, slotRows) => {
        if (errSlot) return conn.rollback(() => { conn.release(); res.status(500).json({ success: false, message: errSlot.message }); });
        if (slotRows.length === 0) return conn.rollback(() => { conn.release(); res.status(404).json({ success: false, message: "Slot not found" }); });

        const slot = slotRows[0];
        const oldStationId = slot.station_id;
        const oldSlotStatus = slot.slot_status;
        const oldSlotNumber = slot.slot_number;

        // Prepare new values
        const newStationId = (body.station_id !== undefined) ? parseInt(body.station_id, 10) : oldStationId;
        const newSlotNumber = (body.slot_number !== undefined) ? parseInt(body.slot_number, 10) : oldSlotNumber;
        const newSlotStatus = (body.slot_status !== undefined) ? String(body.slot_status).trim() : oldSlotStatus;

        if (Number.isNaN(newStationId) || Number.isNaN(newSlotNumber) || newSlotNumber <= 0) {
          return conn.rollback(() => { conn.release(); res.status(400).json({ success: false, message: "station_id and slot_number must be positive integers" }); });
        }
        if (!validSlotStatus.includes(newSlotStatus)) {
          return conn.rollback(() => { conn.release(); res.status(400).json({ success: false, message: "Invalid slot_status" }); });
        }

        // If station changed, validate target station and its total_slots
        const validateTargetStation = (cb) => {
          const q = `SELECT total_slots FROM ChargingStation WHERE station_id = ? FOR UPDATE`;
          conn.query(q, [newStationId], (errT, tRows) => {
            if (errT) return cb(errT);
            if (tRows.length === 0) return cb({ message: "Target station not found" });

            const totalSlots = tRows[0].total_slots;
            if (newSlotNumber > totalSlots) return cb({ message: `slot_number cannot be > target station.total_slots (${totalSlots})` });

            // Also ensure target station doesn't already have a slot with that number (exclude current slot)
            const dupQ = `SELECT slot_id FROM Slot WHERE station_id = ? AND slot_number = ? AND slot_id <> ?`;
            conn.query(dupQ, [newStationId, newSlotNumber, id], (errDup, dupRows) => {
              if (errDup) return cb(errDup);
              if (dupRows.length > 0) return cb({ message: "Slot number already exists in target station" });
              cb(null);
            });
          });
        };

        validateTargetStation((errValidate) => {
          if (errValidate) return conn.rollback(() => { conn.release(); res.status(400).json({ success: false, message: errValidate.message || errValidate }); });

          // Now apply update
          const fields = [];
          const values = [];

          if (body.slot_number !== undefined) { fields.push("slot_number = ?"); values.push(newSlotNumber); }
          if (body.slot_status !== undefined) { fields.push("slot_status = ?"); values.push(newSlotStatus); }
          if (body.station_id !== undefined) { fields.push("station_id = ?"); values.push(newStationId); }

          values.push(id);
          const updQ = `UPDATE Slot SET ${fields.join(", ")} WHERE slot_id = ?`;
          conn.query(updQ, values, (errUpd) => {
            if (errUpd) return conn.rollback(() => { conn.release(); res.status(500).json({ success: false, message: errUpd.message }); });

            // Now update available_slots counts for affected station(s)
            const adjustCounts = (cb2) => {
              // If station changed, we must adjust both old and new station counts based on old/new status
              if (oldStationId !== newStationId) {
                // decrement old station if old status was 'available'
                const tasks = [];
                if (oldSlotStatus === 'available') {
                  tasks.push((next) => conn.query(`UPDATE ChargingStation SET available_slots = available_slots - 1 WHERE station_id = ?`, [oldStationId], next));
                }
                // increment new station if new status is 'available'
                if (newSlotStatus === 'available') {
                  tasks.push((next) => conn.query(`UPDATE ChargingStation SET available_slots = available_slots + 1 WHERE station_id = ?`, [newStationId], next));
                }
                // run tasks sequentially
                const runTask = (i) => {
                  if (i >= tasks.length) return cb2(null);
                  tasks[i]((errTask) => {
                    if (errTask) return cb2(errTask);
                    runTask(i+1);
                  });
                };
                runTask(0);
              } else {
                // same station - only adjust if slot_status changed
                if (oldSlotStatus !== newSlotStatus) {
                  if (oldSlotStatus === 'available' && newSlotStatus !== 'available') {
                    conn.query(`UPDATE ChargingStation SET available_slots = available_slots - 1 WHERE station_id = ?`, [oldStationId], (errA) => cb2(errA));
                  } else if (oldSlotStatus !== 'available' && newSlotStatus === 'available') {
                    conn.query(`UPDATE ChargingStation SET available_slots = available_slots + 1 WHERE station_id = ?`, [oldStationId], (errB) => cb2(errB));
                  } else {
                    cb2(null);
                  }
                } else {
                  cb2(null);
                }
              }
            };

            adjustCounts((errAdj) => {
              if (errAdj) return conn.rollback(() => { conn.release(); res.status(500).json({ success: false, message: errAdj.message || errAdj }); });

              // Optional: ensure available_slots never becomes negative (sanity fix)
              const fixNeg = `UPDATE ChargingStation SET available_slots = GREATEST(0, available_slots) WHERE station_id IN (?, ?)`;
              conn.query(fixNeg, [oldStationId, newStationId], (errFix) => {
                if (errFix) return conn.rollback(() => { conn.release(); res.status(500).json({ success: false, message: errFix.message }); });

                conn.commit(commitErr => {
                  if (commitErr) return conn.rollback(() => { conn.release(); res.status(500).json({ success: false, message: commitErr.message }); });
                  conn.release();
                  res.json({ success: true, message: "Slot updated successfully" });
                });
              });
            });
          });
        });
      });
    });
  });
};

/* Get all slots (admin) */
export const getAllSlots = (req, res) => {
  const query = `
    SELECT s.*, cs.station_name
    FROM Slot s
    JOIN ChargingStation cs ON s.station_id = cs.station_id
    ORDER BY s.station_id, s.slot_number
  `;
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, slots: results });
  });
};

/* List slots of a station (public) */
export const listSlots = (req, res) => {
  const station_id = parseInt(req.params.station_id, 10);
  if (Number.isNaN(station_id)) return res.status(400).json({ success: false, message: "Invalid station_id" });

  const query = `SELECT * FROM Slot WHERE station_id = ? ORDER BY slot_number`;
  db.query(query, [station_id], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, slots: results });
  });
};

/* Delete slot */
export const deleteSlot = (req, res) => {
  const { id } = req.params;
  db.getConnection((err, conn) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    conn.beginTransaction(errTx => {
      if (errTx) { conn.release(); return res.status(500).json({ success: false, message: errTx.message }); }

      // fetch slot so we can decrement available_slots if necessary
      const fetchQ = `SELECT station_id, slot_status FROM Slot WHERE slot_id = ? FOR UPDATE`;
      conn.query(fetchQ, [id], (errF, rows) => {
        if (errF) return conn.rollback(() => { conn.release(); res.status(500).json({ success: false, message: errF.message }); });
        if (rows.length === 0) return conn.rollback(() => { conn.release(); res.status(404).json({ success: false, message: "Slot not found" }); });

        const stationId = rows[0].station_id;
        const slotStatus = rows[0].slot_status;

        const delQ = `DELETE FROM Slot WHERE slot_id = ?`;
        conn.query(delQ, [id], (errDel, delRes) => {
          if (errDel) return conn.rollback(() => { conn.release(); res.status(500).json({ success: false, message: errDel.message }); });
          if (delRes.affectedRows === 0) return conn.rollback(() => { conn.release(); res.status(404).json({ success: false, message: "Slot not found" }); });

          if (slotStatus === 'available') {
            conn.query(`UPDATE ChargingStation SET available_slots = available_slots - 1 WHERE station_id = ?`, [stationId], (errUpd) => {
              if (errUpd) return conn.rollback(() => { conn.release(); res.status(500).json({ success: false, message: errUpd.message }); });
              // fix negative availables
              conn.query(`UPDATE ChargingStation SET available_slots = GREATEST(0, available_slots) WHERE station_id = ?`, [stationId], (errFix) => {
                if (errFix) return conn.rollback(() => { conn.release(); res.status(500).json({ success: false, message: errFix.message }); });
                conn.commit(commitErr => {
                  if (commitErr) return conn.rollback(() => { conn.release(); res.status(500).json({ success: false, message: commitErr.message }); });
                  conn.release();
                  res.json({ success: true, message: "Slot deleted successfully" });
                });
              });
            });
          } else {
            // no available count change
            conn.commit(commitErr => {
              if (commitErr) return conn.rollback(() => { conn.release(); res.status(500).json({ success: false, message: commitErr.message }); });
              conn.release();
              res.json({ success: true, message: "Slot deleted successfully" });
            });
          }
        });
      });
    });
  });
};
