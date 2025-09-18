import db from "../config/db.js";

export const findUserByEmail = (email, callback) => {
  db.query("SELECT * FROM User WHERE email = ?", [email], callback);
};

export const createUser = (userData, callback) => {
  const { name, email, phone_number, password, vehicle_number, vehicle_type } = userData;
  db.query(
    "INSERT INTO User (name, email, phone_number, password, vehicle_number, vehicle_type) VALUES (?, ?, ?, ?, ?, ?)",
    [name, email, phone_number, password, vehicle_number, vehicle_type],
    callback
  );
};
