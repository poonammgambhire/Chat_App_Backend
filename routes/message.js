import express from "express";
import {
  sendMessage,
  getMessages,
  getUsersForSidebar,
  deleteMessage,
  editMessage,
  pinMessage,
  getPinnedMessages,
  searchUsers,
  searchMessages,
  getUnreadCount,
  forwardMessage,
  reactToMessage,
  getLastSeen,        // ✅ NEW
} from "../controllers/messageController.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/users", protect, getUsersForSidebar);
router.get("/search", protect, searchUsers);
router.get("/search-messages", protect, searchMessages);
router.get("/unread", protect, getUnreadCount);
router.get("/last-seen/:userId", protect, getLastSeen);  // ✅ NEW: Last seen
router.post("/send/:id", protect, sendMessage);
router.post("/forward/:id", protect, forwardMessage);
router.post("/react/:id", protect, reactToMessage);
router.patch("/edit/:id", protect, editMessage);
router.patch("/pin/:id", protect, pinMessage);
router.get("/pinned/:id", protect, getPinnedMessages);
router.get("/:id", protect, getMessages);
router.delete("/:id", protect, deleteMessage);

export default router;
