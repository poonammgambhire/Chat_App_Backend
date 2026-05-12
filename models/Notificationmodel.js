import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  type: {
    type: String,
    enum: [
      "friend_request",
      "friend_accepted",
      "new_message",
      "new_group_message",
      "added_to_group",
      "removed_from_group",
      "group_deleted",
      "message_reaction",
    ],
    required: true,
  },
  // Extra payload (group name, message preview, etc.)
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  isRead: { type: Boolean, default: false },
}, { timestamps: true });

// Auto-expire notifications after 30 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;