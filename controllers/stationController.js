import db from "../config/db.js";

// ---------------- Admin: Add new station ----------------
export const addStation = (req, res) => {
  const { station_name, location, total_slots, charging_type, station_status } = req.body;

  if (!station_name || !location || !total_slots || !charging_type || !station_status) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const query = "INSERT INTO ChargingStation (station_name, location, total_slots, available_slots, charging_type, station_status) VALUES (?, ?, ?, ?, ?, ?)";
  db.query(query, [station_name, location, total_slots, total_slots, charging_type, station_status], (err, result) => {
    if (err) return res.status(500).json({ message: err.message });
    res.status(201).json({ message: "Station added successfully", station_id: result.insertId });
  });
};

// ---------------- Admin: Update station ----------------
export const updateStation = (req, res) => {
  const { id } = req.params;
  const { station_name, location, total_slots, available_slots, charging_type, station_status } = req.body;

  const query = "UPDATE ChargingStation SET station_name=?, location=?, total_slots=?, available_slots=?, charging_type=?, station_status=? WHERE station_id=?";
  db.query(query, [station_name, location, total_slots, available_slots, charging_type, station_status, id], (err, result) => {
    if (err) return res.status(500).json({ message: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ message: "Station not found" });
    res.json({ message: "Station updated successfully" });
  });
};

// ---------------- Admin: Delete station ----------------
export const deleteStation = (req, res) => {
  const { id } = req.params;

  const query = "DELETE FROM ChargingStation WHERE station_id=?";
  db.query(query, [id], (err, result) => {
    if (err) return res.status(500).json({ message: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ message: "Station not found" });
    res.json({ message: "Station deleted successfully" });
  });
};

// ---------------- User: List/search stations ----------------
export const listStations = (req, res) => {
  const { location, charging_type } = req.query;
  let query = "SELECT * FROM ChargingStation WHERE station_status='active'";
  const params = [];

  if (location) {
    query += " AND location LIKE ?";
    params.push(`%${location}%`);
  }
  if (charging_type) {
    query += " AND charging_type=?";
    params.push(charging_type);
  }

  db.query(query, params, (err, results) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json({ stations: results });
  });
};
