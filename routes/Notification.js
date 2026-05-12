import express from "express";
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllRead,
  markOneRead,
  deleteNotification,
  clearAllNotifications,
} from "../controllers/notificationController.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", protect, getNotifications);
router.get("/unread-count", protect, getUnreadNotificationCount);
router.patch("/mark-all-read", protect, markAllRead);
router.patch("/:id/read", protect, markOneRead);
router.delete("/clear-all", protect, clearAllNotifications);
router.delete("/:id", protect, deleteNotification);

export default router;