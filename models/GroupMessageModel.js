import mongoose from "mongoose";

const groupMessageSchema = new mongoose.Schema({
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Group",
    required: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  message: {
    type: String,
    default: "",
    trim: true,
  },

  // Image
  image: { type: String, default: "" },
  imagePublicId: { type: String, default: "" },

  // File
  file: { type: String, default: "" },
  filePublicId: { type: String, default: "" },
  fileName: { type: String, default: "" },
  fileType: { type: String, default: "" },

  // Forward
  isForwarded: { type: Boolean, default: false },
  forwardedFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "GroupMessage",
    default: null,
  },

  // Edit
  isEdited: { type: Boolean, default: false },
  editedAt: { type: Date, default: null },

  // Pin
  isPinned: { type: Boolean, default: false },
  pinnedAt: { type: Date, default: null },

  // Reactions
  reactions: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      emoji: { type: String },
    },
  ],

  // Read by
  readBy: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],

}, { timestamps: true });

const GroupMessage = mongoose.model("GroupMessage", groupMessageSchema);
export default GroupMessage;