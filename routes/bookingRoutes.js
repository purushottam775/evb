import express from "express";
import {
  createBooking,
  updateBooking,
  cancelBooking,
  listPendingBookings,
  approveBooking,
  rejectBooking,
  userBookings
} from "../controllers/bookingController.js";

import { userProtect } from "../middleware/userMiddleware.js";
import { adminProtect } from "../middleware/adminMiddleware.js";

const router = express.Router();

// =================== USER ROUTES ===================
// Create a new booking
router.post("/", userProtect, createBooking);

// Update a pending booking
router.put("/:id", userProtect, updateBooking);

// Cancel a pending booking
router.put("/:id/cancel", userProtect, cancelBooking);

// Get all bookings for the logged-in user
router.get("/", userProtect, userBookings);


// =================== ADMIN ROUTES ===================
// List all pending bookings
router.get("/admin/pending", adminProtect, listPendingBookings);

// Approve a booking
router.put("/admin/:id/approve", adminProtect, approveBooking);

// Reject a booking
router.put("/admin/:id/reject", adminProtect, rejectBooking);

export default router;
