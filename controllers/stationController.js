import db from "../config/db.js";

const validChargingTypes = ["fast", "slow"];
const validStationStatus = ["active", "inactive"];

/*
  Helper: run queries on a connection with callbacks and handle rollback/commit
  Assumes db.getConnection exists (mysql/mysql2).
*/

export const addStation = (req, res) => {
  let { station_name, location, total_slots, charging_type, station_status } = req.body;

  // Basic validation
  if (!station_name || !location || total_slots === undefined || !charging_type || !station_status) {
    return res.status(400).json({ message: "All fields are required" });
  }

  station_name = String(station_name).trim();
  location = String(location).trim();
  const totalSlotsNum = parseInt(total_slots, 10);

  if (Number.isNaN(totalSlotsNum) || totalSlotsNum < 0) {
    return res.status(400).json({ message: "total_slots must be a non-negative integer" });
  }
  if (!validChargingTypes.includes(charging_type)) {
    return res.status(400).json({ message: "Invalid charging type" });
  }
  if (!validStationStatus.includes(station_status)) {
    return res.status(400).json({ message: "Invalid station status" });
  }

  db.getConnection((err, conn) => {
    if (err) return res.status(500).json({ message: err.message });

    conn.beginTransaction(errTx => {
      if (errTx) { conn.release(); return res.status(500).json({ message: errTx.message }); }

      // Use case-insensitive check to avoid "Name" vs "name" duplicates
      const checkQuery = `SELECT station_id FROM ChargingStation WHERE LOWER(station_name) = ? AND LOWER(location) = ? LIMIT 1`;
      conn.query(checkQuery, [station_name.toLowerCase(), location.toLowerCase()], (errCheck, checkRows) => {
        if (errCheck) {
          return conn.rollback(() => { conn.release(); return res.status(500).json({ message: errCheck.message }); });
        }

        if (checkRows.length > 0) {
          // Station already exists — rollback and return conflict
          return conn.rollback(() => { conn.release(); return res.status(409).json({ message: "Station already exists" }); });
        }

        // Insert station with available_slots = 0 temporarily
        const insertStation = `INSERT INTO ChargingStation
          (station_name, location, total_slots, available_slots, charging_type, station_status)
          VALUES (?, ?, ?, ?, ?, ?)`;
        conn.query(insertStation, [station_name, location, totalSlotsNum, 0, charging_type, station_status], (errInsert, result) => {
          if (errInsert) {
            // DB-level unique index fallback
            if (errInsert.code === 'ER_DUP_ENTRY') {
              return conn.rollback(() => { conn.release(); return res.status(409).json({ message: "Station already exists" }); });
            }
            return conn.rollback(() => { conn.release(); return res.status(500).json({ message: errInsert.message }); });
          }

          const stationId = result.insertId;

          // Prepare slot rows (all available)
          const slots = [];
          for (let i = 1; i <= totalSlotsNum; i++) slots.push([stationId, i, "available"]);

          if (slots.length === 0) {
            // No slots to insert; set available_slots to 0 and commit
            const setAvailable = `UPDATE ChargingStation SET available_slots = 0 WHERE station_id = ?`;
            return conn.query(setAvailable, [stationId], (errAvail) => {
              if (errAvail) {
                return conn.rollback(() => { conn.release(); return res.status(500).json({ message: errAvail.message }); });
              }
              conn.commit(commitErr => {
                if (commitErr) return conn.rollback(() => { conn.release(); return res.status(500).json({ message: commitErr.message }); });
                conn.release();
                return res.status(201).json({ message: "Station created (no slots)", station_id: stationId });
              });
            });
          }

          // Insert slots in bulk
          const slotQuery = `INSERT INTO Slot (station_id, slot_number, slot_status) VALUES ?`;
          conn.query(slotQuery, [slots], (errSlots) => {
            if (errSlots) {
              // Could be duplicate slot_number or FK issue — rollback everything
              return conn.rollback(() => { conn.release(); return res.status(500).json({ message: errSlots.message }); });
            }

            // Update available_slots to match inserted available slots
            const updateAvailable = `UPDATE ChargingStation SET available_slots = ? WHERE station_id = ?`;
            conn.query(updateAvailable, [totalSlotsNum, stationId], (errUpd) => {
              if (errUpd) {
                return conn.rollback(() => { conn.release(); return res.status(500).json({ message: errUpd.message }); });
              }
              conn.commit(commitErr => {
                if (commitErr) {
                  return conn.rollback(() => { conn.release(); return res.status(500).json({ message: commitErr.message }); });
                }
                conn.release();
                return res.status(201).json({ message: "Station and slots created successfully", station_id: stationId });
              });
            });
          });
        });
      });
    });
  });
};

export const updateStation = (req, res) => {
  const { id } = req.params;
  const { station_name, location, total_slots, charging_type, station_status } = req.body;

  // Validate mandatory fields if provided
  if (charging_type && !validChargingTypes.includes(charging_type)) {
    return res.status(400).json({ message: "Invalid charging type" });
  }
  if (station_status && !validStationStatus.includes(station_status)) {
    return res.status(400).json({ message: "Invalid station status" });
  }

  const newTotal = (total_slots !== undefined) ? parseInt(total_slots, 10) : undefined;
  if (total_slots !== undefined && (Number.isNaN(newTotal) || newTotal < 0)) {
    return res.status(400).json({ message: "total_slots must be a non-negative integer" });
  }

  db.getConnection((err, conn) => {
    if (err) return res.status(500).json({ message: err.message });
    conn.beginTransaction(errTx => {
      if (errTx) { conn.release(); return res.status(500).json({ message: errTx.message }); }

      // 1) Get station and existing slot info
      const stationQuery = `SELECT * FROM ChargingStation WHERE station_id = ? FOR UPDATE`;
      conn.query(stationQuery, [id], (errSta, staRows) => {
        if (errSta) {
          return conn.rollback(() => { conn.release(); res.status(500).json({ message: errSta.message }); });
        }
        if (staRows.length === 0) {
          return conn.rollback(() => { conn.release(); res.status(404).json({ message: "Station not found" }); });
        }

        // fetch existing slot numbers and counts
        const slotInfoQuery = `SELECT COUNT(*) AS countSlots, MAX(slot_number) as maxSlotNumber,
          SUM(slot_status = 'available') AS availableCount
          FROM Slot WHERE station_id = ?`;
        conn.query(slotInfoQuery, [id], (errInfo, infoRows) => {
          if (errInfo) {
            return conn.rollback(() => { conn.release(); res.status(500).json({ message: errInfo.message }); });
          }

          const existingCount = infoRows[0].countSlots || 0;
          const maxSlotNumber = infoRows[0].maxSlotNumber || 0;

          // If trying to shrink below number of existing slots -> reject
          if (newTotal !== undefined && newTotal < existingCount) {
            return conn.rollback(() => { conn.release(); res.status(400).json({ message: "Cannot reduce total_slots below existing number of slots" }); });
          }
          // If newTotal is less than biggest slot_number present -> reject (would leave slot_number > total_slots)
          if (newTotal !== undefined && maxSlotNumber > newTotal) {
            return conn.rollback(() => { conn.release(); res.status(400).json({ message: "Cannot reduce total_slots below highest existing slot_number" }); });
          }

          // Build update fields
          const fields = [];
          const values = [];

          if (station_name) { fields.push("station_name=?"); values.push(station_name.trim()); }
          if (location) { fields.push("location=?"); values.push(location.trim()); }
          if (total_slots !== undefined) { fields.push("total_slots=?"); values.push(newTotal); }
          if (charging_type) { fields.push("charging_type=?"); values.push(charging_type); }
          if (station_status) { fields.push("station_status=?"); values.push(station_status); }

          // If nothing to update
          if (fields.length === 0) {
            conn.rollback(() => { conn.release(); res.status(400).json({ message: "No fields provided to update" }); });
            return;
          }

          // If we are adding slots (newTotal > existingCount), we must insert missing slot_numbers
          const addedSlots = (newTotal !== undefined) ? (newTotal - existingCount) : 0;

          // Update station row first (except available_slots which we'll recalc)
          const updateQuery = `UPDATE ChargingStation SET ${fields.join(", ")} WHERE station_id=?`;
          values.push(id);
          conn.query(updateQuery, values, (errUpd, updRes) => {
            if (errUpd) {
              return conn.rollback(() => { conn.release(); res.status(500).json({ message: errUpd.message }); });
            }
            if (updRes.affectedRows === 0) {
              return conn.rollback(() => { conn.release(); res.status(404).json({ message: "Station not found" }); });
            }

            // If adding slots, figure which slot_numbers are missing in 1..newTotal and insert them
            const handleAddedSlots = (cb) => {
              if (addedSlots <= 0) return cb(null);

              // get existing slot_numbers
              const numbersQuery = `SELECT slot_number FROM Slot WHERE station_id = ?`;
              conn.query(numbersQuery, [id], (errNums, nums) => {
                if (errNums) return cb(errNums);

                const existingNumbers = new Set(nums.map(r => r.slot_number));
                const toInsert = [];
                for (let i = 1; i <= newTotal; i++) {
                  if (!existingNumbers.has(i)) toInsert.push([id, i, "available"]);
                }

                if (toInsert.length === 0) return cb(null);

                const insertSlotsQ = `INSERT INTO Slot (station_id, slot_number, slot_status) VALUES ?`;
                conn.query(insertSlotsQ, [toInsert], (errIns) => {
                  if (errIns) return cb(errIns);
                  cb(null);
                });
              });
            };

            handleAddedSlots((errAdd) => {
              if (errAdd) {
                return conn.rollback(() => { conn.release(); res.status(500).json({ message: errAdd.message }); });
              }

              // Recalculate available_slots from actual slot rows (most robust)
              const recalcQuery = `SELECT COUNT(*) AS availCount FROM Slot WHERE station_id = ? AND slot_status = 'available'`;
              conn.query(recalcQuery, [id], (errRecalc, recalcRows) => {
                if (errRecalc) {
                  return conn.rollback(() => { conn.release(); res.status(500).json({ message: errRecalc.message }); });
                }
                const newAvailable = recalcRows[0].availCount || 0;
                const setAvailableQ = `UPDATE ChargingStation SET available_slots = ? WHERE station_id = ?`;
                conn.query(setAvailableQ, [newAvailable, id], (errSetAv) => {
                  if (errSetAv) {
                    return conn.rollback(() => { conn.release(); res.status(500).json({ message: errSetAv.message }); });
                  }
                  conn.commit(commitErr => {
                    if (commitErr) {
                      return conn.rollback(() => { conn.release(); res.status(500).json({ message: commitErr.message }); });
                    }
                    conn.release();
                    res.json({ message: "Station updated successfully" });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
};

export const deleteStation = (req, res) => {
  const { id } = req.params;
  db.getConnection((err, conn) => {
    if (err) return res.status(500).json({ message: err.message });
    conn.beginTransaction(errTx => {
      if (errTx) { conn.release(); return res.status(500).json({ message: errTx.message }); }

      // Delete station (slots will be deleted by FK cascade)
      const delQ = `DELETE FROM ChargingStation WHERE station_id = ?`;
      conn.query(delQ, [id], (errDel, resultDel) => {
        if (errDel) {
          return conn.rollback(() => { conn.release(); res.status(500).json({ message: errDel.message }); });
        }
        if (resultDel.affectedRows === 0) {
          return conn.rollback(() => { conn.release(); res.status(404).json({ message: "Station not found" }); });
        }

        conn.commit(commitErr => {
          if (commitErr) return conn.rollback(() => { conn.release(); res.status(500).json({ message: commitErr.message }); });
          conn.release();
          res.json({ message: "Station and its slots deleted successfully" });
        });
      });
    });
  });
};

export const listStations = (req, res) => {
  const { location, charging_type } = req.query;
  // We compute available_slots from Slot table to ensure accurate data
  let query = `
    SELECT cs.*, IFNULL(s.availCount, 0) AS available_slots_calc
    FROM ChargingStation cs
    LEFT JOIN (
      SELECT station_id, COUNT(*) AS availCount
      FROM Slot
      WHERE slot_status = 'available'
      GROUP BY station_id
    ) s ON s.station_id = cs.station_id
    WHERE cs.station_status = 'active'
  `;
  const params = [];

  if (location) {
    query += " AND cs.location LIKE ?";
    params.push(`%${location}%`);
  }
  if (charging_type) {
    if (!validChargingTypes.includes(charging_type)) {
      return res.status(400).json({ message: "Invalid charging_type filter" });
    }
    query += " AND cs.charging_type = ?";
    params.push(charging_type);
  }

  db.query(query, params, (err, results) => {
    if (err) return res.status(500).json({ message: err.message });
    // Return DB column available_slots as well for compatibility, but advise using available_slots_calc
    const mapped = results.map(r => ({
      station_id: r.station_id,
      station_name: r.station_name,
      location: r.location,
      total_slots: r.total_slots,
      available_slots: r.available_slots_calc, // use calculated value
      charging_type: r.charging_type,
      station_status: r.station_status
    }));
    res.json({ stations: mapped });
  });
};
