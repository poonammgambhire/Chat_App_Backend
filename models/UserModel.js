import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: { type: String, required: true, minlength: 6 },

  // Chat fields
  profilePic: { type: String, default: "" },
  bio: {
    type: String,
    default: "Hey there! I am using ChatApp 😊",
    maxlength: 150,
  },
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },

  // ✅ Friend Request System
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  friendRequestsSent: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  friendRequestsReceived: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

  // ✅ Block/Unblock
  blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

  // Password Reset
  resetPasswordToken: { type: String },
  resetPasswordExpire: { type: Date },

}, { timestamps: true });

// ✅ Fix: Mongoose 9 + Kareem — async pre hooks do NOT receive 'next'
// Just use async function and 'return' early instead of calling next()
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", userSchema);
export default User;