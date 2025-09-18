// adminUserController.js
import db from "../config/db.js"; // MySQL connection
import bcrypt from "bcryptjs";

// ------------------- Get all users -------------------
export const getAllUsers = async (req, res) => {
  try {
    const [users] = await db.promise().query(
      `SELECT 
         user_id, name, email, phone_number, vehicle_number, vehicle_type, 
         role, status, is_blocked, created_at, updated_at 
       FROM user`
    );
    res.status(200).json({ success: true, users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ------------------- Block a user -------------------
export const blockUser = async (req, res) => {
  const { user_id } = req.params;
  try {
    await db.promise().query(
      "UPDATE user SET is_blocked = TRUE WHERE user_id = ?",
      [user_id]
    );
    res.status(200).json({ success: true, message: "User blocked successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ------------------- Unblock a user -------------------
export const unblockUser = async (req, res) => {
  const { user_id } = req.params;
  try {
    await db.promise().query(
      "UPDATE user SET is_blocked = FALSE WHERE user_id = ?",
      [user_id]
    );
    res.status(200).json({ success: true, message: "User unblocked successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ------------------- Update user role/status -------------------
export const updateUser = async (req, res) => {
  const { user_id } = req.params;
  const { role, status } = req.body; // role: 'user'/'admin', status: 'active'/'inactive'
  try {
    await db.promise().query(
      "UPDATE user SET role = ?, status = ? WHERE user_id = ?",
      [role, status, user_id]
    );
    res.status(200).json({ success: true, message: "User updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ------------------- Delete a user -------------------
export const deleteUser = async (req, res) => {
  const { user_id } = req.params;
  try {
    await db.promise().query(
      "DELETE FROM user WHERE user_id = ?",
      [user_id]
    );
    res.status(200).json({ success: true, message: "User deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
