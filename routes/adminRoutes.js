import express from "express";
import { registerAdmin, loginAdmin, getDashboard } from "../controllers/adminController.js";
import { adminProtect } from "../middleware/adminMiddleware.js";

const router = express.Router();

router.post("/register", registerAdmin);
router.post("/login", loginAdmin);
router.get("/dashboard", adminProtect, getDashboard);

export default router;
