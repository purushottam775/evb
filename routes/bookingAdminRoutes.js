import express from "express";
import { listPendingBookings, approveBooking, rejectBooking } from "../controllers/bookingController.js";
import { adminProtect } from "../middleware/adminMiddleware.js";

const router = express.Router();

// List all pending bookings
router.get("/pending", adminProtect, listPendingBookings);

// Approve a booking
router.put("/:id/approve", adminProtect, approveBooking);

// Reject a booking
router.put("/:id/reject", adminProtect, rejectBooking);

export default router;
