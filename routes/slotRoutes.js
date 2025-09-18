import express from "express";
import { addSlot, updateSlot, listSlots, deleteSlot } from "../controllers/slotController.js";
import { adminProtect } from "../middleware/adminMiddleware.js";

const router = express.Router();

// Admin routes
router.post("/", adminProtect, addSlot);
router.put("/:id", adminProtect, updateSlot);
router.delete("/:id", adminProtect, deleteSlot);

// List slots of a station (anyone)
router.get("/station/:station_id", listSlots);

export default router;
