import crypto from "crypto";
import User from "../models/UserModel.js";
import Message from "../models/MessageModel.js";
import Group from "../models/GroupModel.js";
import generateToken from "../utils/generateToken.js";
import cloudinary from "../config/cloudinary.js";
import sendEmail from "../emails/sendEmail.js";
import { passwordResetOtpTemplate, welcomeEmailTemplate } from "../emails/emailTemplate.js";

// ── Helper: user stats काढतो (friends, groups, messages) ──────────────────────
const getUserStats = async (userId) => {
  const [user, groupsCount, messagesSent] = await Promise.all([
    User.findById(userId).select("friends createdAt"),
    Group.countDocuments({ members: userId }),
    Message.countDocuments({ sender: userId }),
  ]);
  return {
    friendsCount: user?.friends?.length ?? 0,
    groupsCount,
    messagesSent,
  };
};

// ── OTP Store (in-memory, 15 min expiry) ──────────────────────────────────────
const otpStore = {}

// ================= SIGNUP =================
export const signup = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password)
      return res.status(400).json({ message: "All fields are required" });

    if (password.length < 6)
      return res.status(400).json({ message: "Password must be at least 6 characters" });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email))
      return res.status(400).json({ message: "Invalid email format" });

    const userExists = await User.findOne({ email });
    if (userExists)
      return res.status(400).json({ message: "User already exists" });

    const user = await User.create({ fullName, email, password });

    res.status(201).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      profilePic: user.profilePic,
      bio: user.bio,
      createdAt: user.createdAt,
      friendsCount: 0,
      groupsCount: 0,
      messagesSent: 0,
      token: generateToken(user._id),
    });

    sendEmail({
      to: user.email,
      subject: "Welcome to ChatApp! 🎉",
      html: welcomeEmailTemplate(user.fullName),
    }).catch(err => console.log("Email error (ignored):", err.message));

  } catch (error) {
    console.error("Signup error:", error.message);
    if (!res.headersSent) {
      res.status(500).json({ message: error.message });
    }
  }
};

// ================= LOGIN =================
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "All fields are required" });

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ message: "Invalid credentials" });

    user.isOnline = true;
    user.lastSeen = new Date();
    await user.save();

    const stats = await getUserStats(user._id);

    res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      profilePic: user.profilePic,
      bio: user.bio,
      isOnline: user.isOnline,
      createdAt: user.createdAt,
      ...stats,
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json({ message: error.message });
  }
};

// ================= LOGOUT =================
export const logout = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (user) {
      user.isOnline = false;
      user.lastSeen = new Date();
      await user.save();
    }
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= CHECK AUTH =================
export const checkAuth = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    const stats = await getUserStats(req.user._id);
    res.status(200).json({ ...user.toObject(), ...stats });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= GET PROFILE =================
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    const stats = await getUserStats(req.user._id);
    res.status(200).json({ ...user.toObject(), ...stats });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= UPDATE PROFILE =================
export const updateProfile = async (req, res) => {
  try {
    const { fullName, bio } = req.body;
    let { profilePic } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (profilePic) {
      const uploadResult = await cloudinary.uploader.upload(profilePic, {
        folder: "chatapp/profiles",
        transformation: [{ width: 300, height: 300, crop: "fill" }],
      });
      profilePic = uploadResult.secure_url;
    }

    if (fullName) user.fullName = fullName;
    if (bio !== undefined) user.bio = bio;
    if (profilePic) user.profilePic = profilePic;

    await user.save();

    const stats = await getUserStats(user._id);

    res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      profilePic: user.profilePic,
      bio: user.bio,
      isOnline: user.isOnline,
      createdAt: user.createdAt,
      ...stats,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= FORGOT PASSWORD — OTP पाठव ===============================
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(404).json({ message: "No account found with this email" });

    // 6-digit OTP generate करा
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // ✅ FIX: Resend केल्यावर verified/resetToken preserve कर
    const existing = otpStore[email.toLowerCase()] || {};
    otpStore[email.toLowerCase()] = {
      otp,
      expiresAt: Date.now() + 15 * 60 * 1000,
      verified: existing.verified || false,
      resetToken: existing.resetToken || null,
      tokenExpiresAt: existing.tokenExpiresAt || null,
    };

    // Email पाठवा
    await sendEmail({
      to: user.email,
      subject: "ChatApp — Password Reset OTP",
      html: passwordResetOtpTemplate(user.fullName, otp),
    });

    res.status(200).json({ message: "OTP sent to your email" });
  } catch (error) {
    console.error("forgotPassword error:", error.message);
    const isEmailError = error.message?.includes("auth") || error.message?.includes("535") || error.message?.includes("Username and Password");
    res.status(500).json({
      message: isEmailError
        ? "Email service error. Please check server email configuration."
        : "Failed to send OTP. Please try again.",
    });
  }
};

// ================= VERIFY OTP ================================================
export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp)
      return res.status(400).json({ message: "Email and OTP required" });

    const key = email.toLowerCase().trim();
    const record = otpStore[key];

    if (!record)
      return res.status(400).json({ message: "OTP not found. Please request again." });

    if (Date.now() > record.expiresAt) {
      delete otpStore[key];
      return res.status(400).json({ message: "OTP expired. Please request a new one." });
    }

    if (record.otp !== otp.toString().trim())
      return res.status(400).json({ message: "Invalid OTP. Please try again." });

    // OTP valid — reset token द्या
    const resetToken = crypto.randomBytes(32).toString("hex");
    otpStore[key].verified = true;
    otpStore[key].resetToken = resetToken;
    otpStore[key].tokenExpiresAt = Date.now() + 10 * 60 * 1000;

    res.status(200).json({ message: "OTP verified", resetToken });
  } catch (error) {
    console.error("verifyOtp error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// ================= RESET PASSWORD ============================================
export const resetPassword = async (req, res) => {
  try {
    const { email, resetToken, newPassword } = req.body;

    if (!email || !resetToken || !newPassword)
      return res.status(400).json({ message: "All fields required" });

    if (newPassword.length < 6)
      return res.status(400).json({ message: "Password must be at least 6 characters" });

    const key = email.toLowerCase().trim();
    const record = otpStore[key];

    if (!record || !record.verified)
      return res.status(400).json({ message: "Please verify OTP first" });

    if (record.resetToken !== resetToken)
      return res.status(400).json({ message: "Invalid reset token" });

    if (Date.now() > record.tokenExpiresAt)
      return res.status(400).json({ message: "Reset token expired. Please start again." });

    const user = await User.findOne({ email: key });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Password update करा (pre-save hook hash करेल)
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    // Cleanup OTP store
    delete otpStore[key];

    res.status(200).json({ message: "Password reset successful! Please login." });
  } catch (error) {
    console.error("resetPassword error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};



