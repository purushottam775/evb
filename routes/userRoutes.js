import express from "express";
import { registerUser, loginUser, getProfile } from "../controllers/userController.js";
import { userProtect } from "../middleware/userMiddleware.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/profile", userProtect, getProfile);

export default router;
