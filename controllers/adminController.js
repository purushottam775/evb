import bcrypt from "bcryptjs";
import db from "../config/db.js";
import { generateToken } from "../utils/token.js";

// Allowed roles
const ALLOWED_ROLES = ["super admin", "station manager"];

// Helper: validate email
const isValidEmail = (email) => {
  const re = /\S+@\S+\.\S+/;
  return re.test(email);
};

// ------------------- Register Admin -------------------
export const registerAdmin = (req, res) => {
  const { name, email, password, role } = req.body || {};

  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({ message: "Request body is required" });
  }

  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: "All fields are required" });
  }

  if (!isValidEmail(email)) return res.status(400).json({ message: "Invalid email format" });

  if (!ALLOWED_ROLES.includes(role)) {
    return res
      .status(400)
      .json({ message: `Role must be one of: ${ALLOWED_ROLES.join(", ")}` });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters long" });
  }

  db.query("SELECT * FROM Admin WHERE email = ?", [email], async (err, results) => {
    if (err) return res.status(500).json({ message: err.message });
    if (results.length > 0) return res.status(400).json({ message: "Admin already exists" });

    try {
      const hashedPassword = await bcrypt.hash(password, 10);

      db.query(
        "INSERT INTO Admin (name, email, password, role) VALUES (?, ?, ?, ?)",
        [name, email, hashedPassword, role],
        (err, result) => {
          if (err) return res.status(500).json({ message: err.message });

          const newAdmin = {
            id: result.insertId,
            name,
            email,
            role
          };

          res.status(201).json({
            message: "Admin registered successfully",
            user: newAdmin
          });
        }
      );
    } catch (error) {
      return res.status(500).json({ message: "Server error", error: error.message });
    }
  });
};

// ------------------- Login Admin -------------------
export const loginAdmin = (req, res) => {
  const { email, password } = req.body || {};

  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({ message: "Request body is required" });
  }

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  db.query("SELECT * FROM Admin WHERE email = ?", [email], async (err, results) => {
    if (err) return res.status(500).json({ message: err.message });
    if (results.length === 0) return res.status(401).json({ message: "Invalid credentials" });

    const admin = results[0];

    try {
      const isMatch = await bcrypt.compare(password, admin.password);
      if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

      const userData = {
        id: admin.admin_id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        isAdmin: true,
      };

      res.json({
        message: "Login successful",
        token: generateToken({ id: admin.admin_id, role: admin.role }),
        user: userData,
      });
    } catch (error) {
      return res.status(500).json({ message: "Server error", error: error.message });
    }
  });
};

// ------------------- Dashboard -------------------
export const getDashboard = (req, res) => {
  try {
    if (!req.admin) return res.status(401).json({ message: "Admin not found or unauthorized" });

    res.json({
      message: "Admin dashboard data fetched successfully",
      user: req.admin, // keep consistent with frontend
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
