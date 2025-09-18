import db from "../config/db.js";

export const findAdminByEmail = (email, callback) => {
  db.query("SELECT * FROM Admin WHERE email = ?", [email], callback);
};

export const createAdmin = (adminData, callback) => {
  const { name, email, password, role } = adminData;
  db.query(
    "INSERT INTO Admin (name, email, password, role) VALUES (?, ?, ?, ?)",
    [name, email, password, role],
    callback
  );
};
