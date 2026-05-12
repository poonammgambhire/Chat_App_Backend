import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  message: {
    type: String,
    trim: true,
    default: "",
  },

  // Image
  image: { type: String, default: "" },
  imagePublicId: { type: String, default: "" },

  // File Upload (PDF, DOC, etc.)
  file: { type: String, default: "" },
  filePublicId: { type: String, default: "" },
  fileName: { type: String, default: "" },
  fileType: { type: String, default: "" },

  // ✅ NEW: Voice Message
  voice: { type: String, default: "" },
  voicePublicId: { type: String, default: "" },
  voiceDuration: { type: Number, default: 0 },

  // ✅ NEW: Reply To (Quote message)
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Message",
    default: null,
  },

  // Message Forward
  isForwarded: { type: Boolean, default: false },
  forwardedFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Message",
    default: null,
  },

  // Message Edit
  isEdited: { type: Boolean, default: false },
  editedAt: { type: Date, default: null },

  // Pinned message
  isPinned: { type: Boolean, default: false },
  pinnedAt: { type: Date, default: null },

  // Message Reactions
  reactions: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      emoji: { type: String },
    },
  ],

  isRead: { type: Boolean, default: false },

}, { timestamps: true });

const Message = mongoose.model("Message", messageSchema);
export default Message;
