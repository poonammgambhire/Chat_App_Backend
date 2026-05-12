import express from "express";
import {
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  unfriend,
  getFriends,
  blockUser,
  unblockUser,
  getBlockedUsers,
} from "../controllers/Friendcontroller.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

// Friend Requests
router.post("/request/:id", protect, sendFriendRequest);      // Request पाठवा
router.post("/accept/:id", protect, acceptFriendRequest);     // Accept करा
router.post("/reject/:id", protect, rejectFriendRequest);     // Reject करा
router.delete("/unfriend/:id", protect, unfriend);            // Unfriend
router.get("/", protect, getFriends);                         // सगळे friends

// Block / Unblock
router.post("/block/:id", protect, blockUser);                // Block
router.post("/unblock/:id", protect, unblockUser);            // Unblock
router.get("/blocked", protect, getBlockedUsers);             // Blocked list

export default router;