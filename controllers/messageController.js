import Message from "../models/MessageModel.js";
import User from "../models/UserModel.js";
import Notification from "../models/Notificationmodel.js";
import cloudinary from "../config/cloudinary.js";
import { io, onlineUsers } from "../server.js";
import mongoose from "mongoose";

// ================= SEND MESSAGE =================
export const sendMessage = async (req, res) => {
  try {
    const { message, image, file, fileName, fileType, voice, voiceDuration, replyTo } = req.body;
    const receiverId = req.params.id;
    const senderId = req.user._id;

    if (!message && !image && !file && !voice)
      return res.status(400).json({ message: "Message, image, file or voice is required" });

    const receiver = await User.findById(receiverId);
    if (!receiver) return res.status(404).json({ message: "User not found" });

    if (receiver.blockedUsers.includes(senderId))
      return res.status(403).json({ message: "You are blocked by this user" });

    const sender = await User.findById(senderId);
    if (sender.blockedUsers.includes(receiverId))
      return res.status(403).json({ message: "You have blocked this user" });

    let imageUrl = "";
    let imagePublicId = "";
    let fileUrl = "";
    let filePublicId = "";
    let voiceUrl = "";
    let voicePublicId = "";

    if (image) {
      const uploadResult = await cloudinary.uploader.upload(image, {
        folder: "chatapp/messages",
      });
      imageUrl = uploadResult.secure_url;
      imagePublicId = uploadResult.public_id;
    }

    if (file) {
      const uploadResult = await cloudinary.uploader.upload(file, {
        folder: "chatapp/files",
        resource_type: "raw",
      });
      fileUrl = uploadResult.secure_url;
      filePublicId = uploadResult.public_id;
    }

    // ✅ NEW: Upload voice message
    if (voice) {
      const uploadResult = await cloudinary.uploader.upload(voice, {
        folder: "chatapp/voice",
        resource_type: "video", // audio files use "video" resource type in Cloudinary
      });
      voiceUrl = uploadResult.secure_url;
      voicePublicId = uploadResult.public_id;
    }

    const newMessage = await Message.create({
      sender: senderId,
      receiver: receiverId,
      message: message || "",
      image: imageUrl,
      imagePublicId,
      file: fileUrl,
      filePublicId,
      fileName: fileName || "",
      fileType: fileType || "",
      // ✅ NEW fields
      voice: voiceUrl,
      voicePublicId,
      voiceDuration: voiceDuration || 0,
      replyTo: replyTo || null,
    });

    // ✅ Populate replyTo so frontend gets the full quoted message
    await newMessage.populate("replyTo");

    const receiverSocketId = onlineUsers[receiverId.toString()];
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }

    const newNotif = await Notification.create({
      recipient: receiverId,
      sender: senderId,
      type: "new_message",
      data: {
        messagePreview: message
          ? message.substring(0, 50)
          : image
          ? "📷 Image"
          : "📎 File",
        senderName: sender.fullName,
        senderPic: sender.profilePic,
      },
    });

    if (receiverSocketId) {
      // ✅ FIX: newNotification emit add केला — Mobile real-time notification साठी
      const populatedNotif = await newNotif.populate("sender", "fullName profilePic");
      io.to(receiverSocketId).emit("newNotification", populatedNotif);

      const unreadNotifCount = await Notification.countDocuments({
        recipient: receiverId,
        isRead: false,
      });
      io.to(receiverSocketId).emit("notificationCount", unreadNotifCount);
    }

    res.status(201).json(newMessage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= GET MESSAGES =================
export const getMessages = async (req, res) => {
  try {
    const receiverId = req.params.id;
    const senderId = req.user._id;

    const messages = await Message.find({
      $or: [
        { sender: senderId, receiver: receiverId },
        { sender: receiverId, receiver: senderId },
      ],
    }).sort({ createdAt: 1 }).populate("replyTo");

    await Message.updateMany(
      { sender: receiverId, receiver: senderId, isRead: false },
      { isRead: true }
    );

    const senderSocketId = onlineUsers[receiverId.toString()];
    if (senderSocketId) {
      io.to(senderSocketId).emit("messagesSeen", { by: senderId.toString() });
    }

    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= GET ALL USERS (sidebar) =================
export const getUsersForSidebar = async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id);

    const users = await User.find({
      _id: {
        $ne: req.user._id,
        $nin: currentUser.blockedUsers,
      },
    })
      .select("-password")
      .sort({ isOnline: -1, lastSeen: -1 });

    const usersWithMeta = await Promise.all(
      users.map(async (u) => {
        const lastMsg = await Message.findOne({
          $or: [
            { sender: req.user._id, receiver: u._id },
            { sender: u._id, receiver: req.user._id },
          ],
        })
          .sort({ createdAt: -1 })
          .select("message image file createdAt isRead sender");

        const unread = await Message.countDocuments({
          sender: u._id,
          receiver: req.user._id,
          isRead: false,
        });

        return {
          ...u.toObject(),
          lastMessage: lastMsg || null,
          unreadCount: unread,
        };
      })
    );

    res.status(200).json(usersWithMeta);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= DELETE MESSAGE =================
export const deleteMessage = async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message) return res.status(404).json({ message: "Message not found" });

    if (message.sender.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Not allowed to delete this message" });

    if (message.imagePublicId) {
      await cloudinary.uploader.destroy(message.imagePublicId);
    }

    if (message.filePublicId) {
      await cloudinary.uploader.destroy(message.filePublicId, {
        resource_type: "raw",
      });
    }

    await message.deleteOne();

    const receiverSocketId = onlineUsers[message.receiver.toString()];
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("messageDeleted", { messageId: req.params.id });
    }

    res.status(200).json({ message: "Message deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= EDIT MESSAGE =================
export const editMessage = async (req, res) => {
  try {
    const { newText } = req.body;
    const messageId = req.params.id;
    const userId = req.user._id;

    if (!newText || !newText.trim())
      return res.status(400).json({ message: "New text is required" });

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });

    if (message.sender.toString() !== userId.toString())
      return res.status(403).json({ message: "Only the sender can edit this message" });

    if (!message.message)
      return res.status(400).json({ message: "Cannot edit image/file-only messages" });

    message.message = newText.trim();
    message.isEdited = true;
    message.editedAt = new Date();
    await message.save();

    const otherUserId =
      message.sender.toString() === userId.toString()
        ? message.receiver.toString()
        : message.sender.toString();

    const otherSocketId = onlineUsers[otherUserId];
    if (otherSocketId) {
      io.to(otherSocketId).emit("messageEdited", {
        messageId,
        newText: message.message,
        editedAt: message.editedAt,
      });
    }

    res.status(200).json(message);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= PIN / UNPIN MESSAGE =================
export const pinMessage = async (req, res) => {
  try {
    const messageId = req.params.id;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });

    const isParticipant =
      message.sender.toString() === userId.toString() ||
      message.receiver.toString() === userId.toString();
    if (!isParticipant) return res.status(403).json({ message: "Not allowed" });

    message.isPinned = !message.isPinned;
    message.pinnedAt = message.isPinned ? new Date() : null;
    await message.save();

    const otherUserId =
      message.sender.toString() === userId.toString()
        ? message.receiver.toString()
        : message.sender.toString();

    const otherSocketId = onlineUsers[otherUserId];
    if (otherSocketId) {
      io.to(otherSocketId).emit("messagePinned", {
        messageId,
        isPinned: message.isPinned,
        pinnedAt: message.pinnedAt,
      });
    }

    res.status(200).json({ isPinned: message.isPinned, pinnedAt: message.pinnedAt });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= GET PINNED MESSAGES =================
export const getPinnedMessages = async (req, res) => {
  try {
    const otherUserId = req.params.id;
    const myId = req.user._id;

    const pinned = await Message.find({
      $or: [
        { sender: myId, receiver: otherUserId },
        { sender: otherUserId, receiver: myId },
      ],
      isPinned: true,
    }).sort({ pinnedAt: -1 });

    res.status(200).json(pinned);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= SEARCH USERS =================
export const searchUsers = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.trim() === "")
      return res.status(400).json({ message: "Search query is required" });

    const users = await User.find({
      _id: { $ne: req.user._id },
      $or: [
        { fullName: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } },
      ],
    }).select("-password");

    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= UNREAD MESSAGE COUNT =================
export const getUnreadCount = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);

    const unreadCounts = await Message.aggregate([
      { $match: { receiver: userId, isRead: false } },
      { $group: { _id: "$sender", count: { $sum: 1 } } },
    ]);

    const result = {};
    unreadCounts.forEach((item) => {
      result[item._id.toString()] = item.count;
    });

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= FORWARD MESSAGE =================
// FIX: Forwarded messages intentionally store empty imagePublicId / filePublicId ("").
// This means deleteMessage on a forwarded copy will NOT call cloudinary.uploader.destroy
// (the guard `if (message.imagePublicId)` prevents it), so the original Cloudinary
// asset is never deleted when a forward is removed — correct behaviour.
//
// IMPORTANT: Never copy the original publicId into the forwarded document.
// The forwarded message reuses only the public *URL* for display. Cloudinary
// asset lifecycle is owned solely by the original message.
export const forwardMessage = async (req, res) => {
  try {
    const { receiverId } = req.body;
    const messageId = req.params.id;
    const senderId = req.user._id;

    const originalMessage = await Message.findById(messageId);
    if (!originalMessage)
      return res.status(404).json({ message: "Message not found" });

    const receiver = await User.findById(receiverId);
    if (!receiver) return res.status(404).json({ message: "User not found" });

    if (receiver.blockedUsers.includes(senderId))
      return res.status(403).json({ message: "You are blocked by this user" });

    const sender = await User.findById(senderId);
    if (sender.blockedUsers.includes(receiverId))
      return res.status(403).json({ message: "You have blocked this user" });

    const forwardedMessage = await Message.create({
      sender: senderId,
      receiver: receiverId,
      message: originalMessage.message,
      image: originalMessage.image,
      imagePublicId: "", // intentionally empty — we do NOT own this Cloudinary asset
      file: originalMessage.file,
      filePublicId: "",  // intentionally empty — same reason as above
      fileName: originalMessage.fileName,
      fileType: originalMessage.fileType,
      isForwarded: true,
      forwardedFrom: originalMessage._id,
    });

    const receiverSocketId = onlineUsers[receiverId.toString()];
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", forwardedMessage);
    }

    res.status(201).json(forwardedMessage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= SEARCH MESSAGES =================
export const searchMessages = async (req, res) => {
  try {
    const { query, userId } = req.query;
    const myId = req.user._id;

    if (!query || query.trim() === "")
      return res.status(400).json({ message: "Search query is required" });

    const filter = {
      message: { $regex: query.trim(), $options: "i" },
    };

    if (userId) {
      filter.$or = [
        { sender: myId, receiver: userId },
        { sender: userId, receiver: myId },
      ];
    } else {
      filter.$or = [{ sender: myId }, { receiver: myId }];
    }

    const messages = await Message.find(filter).sort({ createdAt: -1 }).limit(30);

    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= MESSAGE REACTION =================
export const reactToMessage = async (req, res) => {
  try {
    const { emoji } = req.body;
    const messageId = req.params.id;
    const userId = req.user._id;

    const validEmojis = ["❤️", "😂", "👍", "😮", "😢", "🔥"];
    if (!validEmojis.includes(emoji))
      return res.status(400).json({ message: "Invalid emoji" });

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });

    const existingIndex = message.reactions.findIndex(
      (r) => r.user.toString() === userId.toString() && r.emoji === emoji
    );

    if (existingIndex !== -1) {
      message.reactions.splice(existingIndex, 1);
    } else {
      message.reactions = message.reactions.filter(
        (r) => r.user.toString() !== userId.toString()
      );
      message.reactions.push({ user: userId, emoji });
    }

    await message.save();

    const otherUserId =
      message.sender.toString() === userId.toString()
        ? message.receiver.toString()
        : message.sender.toString();

    const otherSocketId = onlineUsers[otherUserId];
    if (otherSocketId) {
      io.to(otherSocketId).emit("messageReaction", {
        messageId,
        reactions: message.reactions,
      });
    }

    res.status(200).json({ reactions: message.reactions });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= GET LAST SEEN =================
export const getLastSeen = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select("lastSeen isOnline");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json({
      isOnline: onlineUsers[userId] ? true : false,
      lastSeen: user.lastSeen || null,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
