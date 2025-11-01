import express from 'express';
import { 
    registerUser, 
    loginUser, 
    getProfile, 
    updateProfile,
    forgotPassword,
    resetPasswordWithOTP,
    verifyUser,
    getUserStats
} from '../controllers/userController.js';
import { googleAuth } from "../controllers/googleAuthController.js";
import { userProtect } from '../middleware/userMiddleware.js';

const router = express.Router();

// Public routes
router.post('/register', registerUser);
// Verification route
router.get('/verify/:token', verifyUser);

router.post('/login', loginUser);
router.post('/reset-password', forgotPassword);           // send OTP
router.post('/reset-password/confirm', resetPasswordWithOTP); // reset password using OTP

// Google OAuth routes
router.post("/google-login", googleAuth);

// Protected routes
router.get('/profile', userProtect, getProfile);
router.put('/profile', userProtect, updateProfile);
router.get('/stats/:user_id', userProtect, getUserStats);

export default router;
