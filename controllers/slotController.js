import db from "../config/db.js";

// ---------------- Admin: Add slot to station ----------------
export const addSlot = (req, res) => {
  const { station_id, slot_number, slot_status } = req.body;

  if (!station_id || !slot_number || !slot_status) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const query = "INSERT INTO Slot (station_id, slot_number, slot_status) VALUES (?, ?, ?)";
  db.query(query, [station_id, slot_number, slot_status], (err, result) => {
    if (err) {
      if (err.code === "ER_DUP_ENTRY") return res.status(400).json({ message: "Slot number already exists for this station" });
      return res.status(500).json({ message: err.message });
    }
    res.status(201).json({ message: "Slot added successfully", slot_id: result.insertId });
  });
};

// ---------------- Admin: Update slot ----------------
export const updateSlot = (req, res) => {
  const { id } = req.params;
  const { slot_status } = req.body;

  const query = "UPDATE Slot SET slot_status=? WHERE slot_id=?";
  db.query(query, [slot_status, id], (err, result) => {
    if (err) return res.status(500).json({ message: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ message: "Slot not found" });
    res.json({ message: "Slot updated successfully" });
  });
};

// ---------------- Admin: Get all slots ----------------
export const getAllSlots = (req, res) => {
  const query = `
    SELECT s.*, cs.station_name 
    FROM Slot s 
    JOIN ChargingStation cs ON s.station_id = cs.station_id 
    ORDER BY s.station_id, s.slot_number
  `;
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json({ slots: results });
  });
};

// ---------------- Admin/User: List slots of a station ----------------
export const listSlots = (req, res) => {
  const { station_id } = req.params;

  const query = "SELECT * FROM Slot WHERE station_id=?";
  db.query(query, [station_id], (err, results) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json({ slots: results });
  });
};

// ---------------- Admin: Delete slot ----------------
export const deleteSlot = (req, res) => {
  const { id } = req.params;

  const query = "DELETE FROM Slot WHERE slot_id=?";
  db.query(query, [id], (err, result) => {
    if (err) return res.status(500).json({ message: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ message: "Slot not found" });
    res.json({ message: "Slot deleted successfully" });
  });
};
