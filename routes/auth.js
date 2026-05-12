import express from "express";
import rateLimit from "express-rate-limit";
import {
  signup,
  login,
  logout,
  checkAuth,
  getProfile,
  updateProfile,
  forgotPassword,
  verifyOtp,
  resetPassword,
} from "../controllers/authController.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

// Rate limiters
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: "Too many login attempts, please try after 15 minutes" },
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20, // FIX: increased from 5 to 20 (was blocking test signups)
  message: { message: "Too many accounts created from this IP, please try after an hour" },
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // FIX: increased from 5 to 10 (was blocking OTP resend during testing)
  message: { message: "Too many OTP requests, please try after 15 minutes" },
});

// Auth routes
router.post("/signup", signupLimiter, signup);
router.post("/login", loginLimiter, login);
router.post("/logout", protect, logout);
router.get("/check", protect, checkAuth);

// Profile routes
router.get("/profile", protect, getProfile);
router.put("/update-profile", protect, updateProfile);

// Forgot Password — OTP Flow
router.post("/forgot-password", otpLimiter, forgotPassword);  // Step 1: Send OTP
router.post("/verify-otp", otpLimiter, verifyOtp);            // Step 2: Verify OTP
router.post("/reset-password", resetPassword);                // Step 3: New password

export default router;