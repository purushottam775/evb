import express from "express";
import { createBooking, updateBooking, cancelBooking, userBookings } from "../controllers/bookingController.js";
import { userProtect } from "../middleware/userMiddleware.js";

const router = express.Router();

// Create a booking
router.post("/", userProtect, createBooking);

// Update pending booking
router.put("/:id", userProtect, updateBooking);

// Cancel pending booking
router.put("/:id/cancel", userProtect, cancelBooking);

// Get all bookings for logged-in user
router.get("/", userProtect, userBookings);

export default router;
