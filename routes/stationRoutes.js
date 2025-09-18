import express from "express";
import { addStation, updateStation, deleteStation, listStations } from "../controllers/stationController.js";
import { adminProtect } from "../middleware/adminMiddleware.js";

const router = express.Router();

// Admin routes
router.post("/", adminProtect, addStation);
router.put("/:id", adminProtect, updateStation);
router.delete("/:id", adminProtect, deleteStation);

// User routes
router.get("/", listStations);

export default router;
