// routes/adminUserRoutes.js
import express from "express";
import {
  getAllUsers,
  blockUser,
  unblockUser,
  updateUser,
  deleteUser
} from "../controllers/adminUserController.js";

import { adminProtect } from "../middleware/adminMiddleware.js"; // ensure only admin can access

const router = express.Router();

// Protect all routes so only admins can access
router.use(adminProtect);

// ---------------- User Management Routes ----------------

// Get all users
// GET /api/admins/users/
router.get("/", getAllUsers);

// Block a user
// PUT /api/admins/users/block/:user_id
router.put("/block/:user_id", blockUser);

// Unblock a user
// PUT /api/admins/users/unblock/:user_id
router.put("/unblock/:user_id", unblockUser);

// Update user role/status
// PUT /api/admins/users/update/:user_id
router.put("/update/:user_id", updateUser);

// Delete a user
// DELETE /api/admins/users/delete/:user_id
router.delete("/delete/:user_id", deleteUser);

export default router;
