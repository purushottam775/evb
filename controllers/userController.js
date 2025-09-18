import bcrypt from "bcryptjs";
import db from "../config/db.js";
import { generateToken } from "../utils/token.js";

// Helper function to run MySQL queries with Promises
const query = (sql, params) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });

// ---------------- Register User ----------------
export const registerUser = async (req, res) => {
  try {
    const { name, email, phone_number, password, vehicle_number, vehicle_type } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }

    // Check if user exists
    const existingUsers = await query("SELECT * FROM User WHERE email = ?", [email]);
    if (existingUsers.length > 0) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const result = await query(
      "INSERT INTO User(name, email, phone_number, password, vehicle_number, vehicle_type) VALUES (?, ?, ?, ?, ?, ?)",
      [name, email, phone_number || null, hashedPassword, vehicle_number || null, vehicle_type || null]
    );

    // Fetch the inserted user (without password)
    const [newUser] = await query("SELECT user_id, name, email, phone_number, vehicle_number, vehicle_type, role FROM User WHERE user_id = ?", [result.insertId]);

    // Registration successful - DO NOT auto-login, just return success
    res.status(201).json({
      message: "User registered successfully",
      user: {
        user_id: newUser.user_id,
        name: newUser.name,
        email: newUser.email
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ---------------- Login User ----------------
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    // Fetch user
    const users = await query("SELECT * FROM User WHERE email = ?", [email]);
    if (users.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = users[0];

    if (!user.password) {
      return res.status(500).json({ message: "User password not set in database" });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate token
    const token = generateToken({ id: user.user_id, role: user.role || "user" });

    // Remove password before sending response
    const { password: _, ...safeUser } = user;

    res.json({
      message: "Login successful",
      token,
      user: safeUser
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ---------------- Get Profile ----------------
export const getProfile = async (req, res) => {
  try {
    res.json({ message: "User profile fetched successfully", user: req.user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
