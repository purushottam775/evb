import express from "express";
import { addSlot, updateSlot, listSlots, deleteSlot, getAllSlots } from "../controllers/slotController.js";
import { adminProtect } from "../middleware/adminMiddleware.js";

const router = express.Router();

// Admin routes
router.get("/", adminProtect, getAllSlots); // Get all slots
router.post("/", adminProtect, addSlot);
router.put("/:id", adminProtect, updateSlot);
router.delete("/:id", adminProtect, deleteSlot);

// List slots of a station (anyone)
router.get("/station/:station_id", listSlots);

export default router;
