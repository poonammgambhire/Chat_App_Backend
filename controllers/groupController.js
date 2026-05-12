import Group from "../models/GroupModel.js";
import GroupMessage from "../models/GroupMessageModel.js";
import cloudinary from "../config/cloudinary.js";
import { io, onlineUsers } from "../server.js";

// ================= CREATE GROUP =================
export const createGroup = async (req, res) => {
  try {
    const { name, description, members, groupPic } = req.body;
    const adminId = req.user._id;

    if (!name) return res.status(400).json({ message: "Group name is required" });

    if (!members || members.length < 1)
      return res.status(400).json({ message: "Add at least 1 member" });

    const allMembers = [...new Set([adminId.toString(), ...members])];

    // Upload group pic to cloudinary if provided
    let groupPicUrl = "";
    if (groupPic) {
      try {
        const uploadResult = await cloudinary.uploader.upload(groupPic, {
          folder: "chatapp/group-pics",
          transformation: [{ width: 300, height: 300, crop: "fill" }],
        });
        groupPicUrl = uploadResult.secure_url;
      } catch (uploadErr) {
        console.error("Group pic upload failed:", uploadErr.message);
      }
    }

    const group = await Group.create({
      name,
      description: description || "",
      admin: adminId,
      members: allMembers,
      ...(groupPicUrl && { groupPic: groupPicUrl }),
    });

    const populatedGroup = await Group.findById(group._id)
      .populate("members", "-password")
      .populate("admin", "-password");

    allMembers.forEach((memberId) => {
      const socketId = onlineUsers[memberId.toString()];
      if (socketId) {
        io.to(socketId).emit("newGroup", populatedGroup);
      }
    });

    res.status(201).json(populatedGroup);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= GET MY GROUPS =================
export const getMyGroups = async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user._id })
      .populate("members", "-password")
      .populate("admin", "-password")
      .sort({ updatedAt: -1 });

    // Attach last message + unread count per group
    const groupsWithMeta = await Promise.all(
      groups.map(async (g) => {
        const lastMsg = await GroupMessage.findOne({ group: g._id })
          .sort({ createdAt: -1 })
          .populate("sender", "fullName")
          .select("message image file createdAt sender");

        const unread = await GroupMessage.countDocuments({
          group: g._id,
          readBy: { $ne: req.user._id },
        });

        return {
          ...g.toObject(),
          lastMessage: lastMsg || null,
          unreadCount: unread,
        };
      })
    );

    res.status(200).json(groupsWithMeta);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= GET GROUP MESSAGES =================
export const getGroupMessages = async (req, res) => {
  try {
    const groupId = req.params.id;
    const userId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    if (!group.members.includes(userId))
      return res.status(403).json({ message: "You are not a member of this group" });

    const messages = await GroupMessage.find({ group: groupId })
      .populate("sender", "fullName profilePic")
      .sort({ createdAt: 1 });

    // Mark all unread as read
    await GroupMessage.updateMany(
      { group: groupId, readBy: { $ne: userId } },
      { $addToSet: { readBy: userId } }
    );

    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= SEND GROUP MESSAGE =================
export const sendGroupMessage = async (req, res) => {
  try {
    const groupId = req.params.id;
    const senderId = req.user._id;
    const { message, image, file, fileName, fileType } = req.body;

    if (!message && !image && !file)
      return res.status(400).json({ message: "Message, image or file is required" });

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    if (!group.members.includes(senderId))
      return res.status(403).json({ message: "You are not a member of this group" });

    let imageUrl = "";
    let imagePublicId = "";
    let fileUrl = "";
    let filePublicId = "";

    if (image) {
      const uploadResult = await cloudinary.uploader.upload(image, {
        folder: "chatapp/group-messages",
      });
      imageUrl = uploadResult.secure_url;
      imagePublicId = uploadResult.public_id;
    }

    if (file) {
      const uploadResult = await cloudinary.uploader.upload(file, {
        folder: "chatapp/group-files",
        resource_type: "raw",
      });
      fileUrl = uploadResult.secure_url;
      filePublicId = uploadResult.public_id;
    }

    const newMessage = await GroupMessage.create({
      group: groupId,
      sender: senderId,
      message: message || "",
      image: imageUrl,
      imagePublicId,
      file: fileUrl,
      filePublicId,
      fileName: fileName || "",
      fileType: fileType || "",
      readBy: [senderId],
    });

    const populatedMessage = await GroupMessage.findById(newMessage._id)
      .populate("sender", "fullName profilePic");

    group.members.forEach((memberId) => {
      if (memberId.toString() !== senderId.toString()) {
        const socketId = onlineUsers[memberId.toString()];
        if (socketId) {
          io.to(socketId).emit("newGroupMessage", {
            groupId,
            message: populatedMessage,
          });
        }
      }
    });

    res.status(201).json(populatedMessage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= EDIT GROUP MESSAGE =================
export const editGroupMessage = async (req, res) => {
  try {
    const { newText } = req.body;
    const messageId = req.params.msgId;
    const userId = req.user._id;
    const groupId = req.params.id;

    if (!newText || !newText.trim())
      return res.status(400).json({ message: "New text is required" });

    const message = await GroupMessage.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });
    if (message.group.toString() !== groupId)
      return res.status(400).json({ message: "Message not in this group" });
    if (message.sender.toString() !== userId.toString())
      return res.status(403).json({ message: "Only sender can edit" });

    message.message = newText.trim();
    message.isEdited = true;
    message.editedAt = new Date();
    await message.save();

    const group = await Group.findById(groupId);
    group.members.forEach((memberId) => {
      if (memberId.toString() !== userId.toString()) {
        const socketId = onlineUsers[memberId.toString()];
        if (socketId) {
          io.to(socketId).emit("groupMessageEdited", {
            groupId,
            messageId,
            newText: message.message,
            editedAt: message.editedAt,
          });
        }
      }
    });

    res.status(200).json(message);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= DELETE GROUP MESSAGE =================
export const deleteGroupMessage = async (req, res) => {
  try {
    const messageId = req.params.msgId;
    const groupId = req.params.id;
    const userId = req.user._id;

    const message = await GroupMessage.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });
    if (message.group.toString() !== groupId)
      return res.status(400).json({ message: "Message not in this group" });

    const group = await Group.findById(groupId);
    const isAdmin = group.admin.toString() === userId.toString();
    const isSender = message.sender.toString() === userId.toString();

    if (!isSender && !isAdmin)
      return res.status(403).json({ message: "Not allowed to delete this message" });

    if (message.imagePublicId) await cloudinary.uploader.destroy(message.imagePublicId);
    if (message.filePublicId) await cloudinary.uploader.destroy(message.filePublicId, { resource_type: "raw" });

    await message.deleteOne();

    group.members.forEach((memberId) => {
      if (memberId.toString() !== userId.toString()) {
        const socketId = onlineUsers[memberId.toString()];
        if (socketId) {
          io.to(socketId).emit("groupMessageDeleted", { groupId, messageId });
        }
      }
    });

    res.status(200).json({ message: "Message deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= REACT TO GROUP MESSAGE =================
export const reactToGroupMessage = async (req, res) => {
  try {
    const { emoji } = req.body;
    const messageId = req.params.msgId;
    const groupId = req.params.id;
    const userId = req.user._id;

    const validEmojis = ["❤️", "😂", "👍", "😮", "😢", "🔥"];
    if (!validEmojis.includes(emoji))
      return res.status(400).json({ message: "Invalid emoji" });

    const message = await GroupMessage.findById(messageId);
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

    const group = await Group.findById(groupId);
    group.members.forEach((memberId) => {
      if (memberId.toString() !== userId.toString()) {
        const socketId = onlineUsers[memberId.toString()];
        if (socketId) {
          io.to(socketId).emit("groupMessageReaction", {
            groupId,
            messageId,
            reactions: message.reactions,
          });
        }
      }
    });

    res.status(200).json({ reactions: message.reactions });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= FORWARD GROUP MESSAGE =================
export const forwardGroupMessage = async (req, res) => {
  try {
    const messageId = req.params.msgId;
    const groupId = req.params.id;
    const { targetGroupId } = req.body;
    const senderId = req.user._id;

    const original = await GroupMessage.findById(messageId);
    if (!original) return res.status(404).json({ message: "Message not found" });

    const targetGroup = await Group.findById(targetGroupId);
    if (!targetGroup) return res.status(404).json({ message: "Target group not found" });
    if (!targetGroup.members.includes(senderId))
      return res.status(403).json({ message: "You are not a member of the target group" });

    const forwarded = await GroupMessage.create({
      group: targetGroupId,
      sender: senderId,
      message: original.message,
      image: original.image,
      file: original.file,
      fileName: original.fileName,
      fileType: original.fileType,
      isForwarded: true,
      forwardedFrom: original._id,
      readBy: [senderId],
    });

    const populatedMsg = await GroupMessage.findById(forwarded._id)
      .populate("sender", "fullName profilePic");

    targetGroup.members.forEach((memberId) => {
      if (memberId.toString() !== senderId.toString()) {
        const sid = onlineUsers[memberId.toString()];
        if (sid) {
          io.to(sid).emit("newGroupMessage", { groupId: targetGroupId, message: populatedMsg });
        }
      }
    });

    res.status(201).json(populatedMsg);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= PIN GROUP MESSAGE =================
export const pinGroupMessage = async (req, res) => {
  try {
    const messageId = req.params.msgId;
    const groupId = req.params.id;
    const userId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    const isAdmin = group.admin.toString() === userId.toString();
    const isMember = group.members.some((m) => m.toString() === userId.toString());
    if (!isMember) return res.status(403).json({ message: "Not a member" });

    const message = await GroupMessage.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });

    message.isPinned = !message.isPinned;
    message.pinnedAt = message.isPinned ? new Date() : null;
    await message.save();

    group.members.forEach((memberId) => {
      const sid = onlineUsers[memberId.toString()];
      if (sid) {
        io.to(sid).emit("groupMessagePinned", {
          groupId,
          messageId,
          isPinned: message.isPinned,
          pinnedAt: message.pinnedAt,
        });
      }
    });

    res.status(200).json({ isPinned: message.isPinned, pinnedAt: message.pinnedAt });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= GET PINNED GROUP MESSAGES =================
export const getPinnedGroupMessages = async (req, res) => {
  try {
    const groupId = req.params.id;
    const userId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });
    if (!group.members.includes(userId))
      return res.status(403).json({ message: "Not a member" });

    const pinned = await GroupMessage.find({ group: groupId, isPinned: true })
      .populate("sender", "fullName profilePic")
      .sort({ pinnedAt: -1 });

    res.status(200).json(pinned);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= MAKE ADMIN =================
export const makeAdmin = async (req, res) => {
  try {
    const groupId = req.params.id;
    const { userId } = req.body;
    const adminId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });
    if (group.admin.toString() !== adminId.toString())
      return res.status(403).json({ message: "Only admin can transfer admin" });
    if (!group.members.includes(userId))
      return res.status(400).json({ message: "User is not a member" });

    group.admin = userId;
    await group.save();

    const updatedGroup = await Group.findById(groupId)
      .populate("members", "-password")
      .populate("admin", "-password");

    group.members.forEach((memberId) => {
      const sid = onlineUsers[memberId.toString()];
      if (sid) io.to(sid).emit("groupUpdated", updatedGroup);
    });

    res.status(200).json(updatedGroup);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= ADD MEMBER =================
export const addMember = async (req, res) => {
  try {
    const groupId = req.params.id;
    const { userId } = req.body;
    const adminId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    if (group.admin.toString() !== adminId.toString())
      return res.status(403).json({ message: "Only admin can add members" });

    if (group.members.includes(userId))
      return res.status(400).json({ message: "User already in group" });

    group.members.push(userId);
    await group.save();

    const updatedGroup = await Group.findById(groupId)
      .populate("members", "-password")
      .populate("admin", "-password");

    // Notify the new member — they receive the full group object
    const newMemberSocketId = onlineUsers[userId.toString()];
    if (newMemberSocketId) {
      io.to(newMemberSocketId).emit("newGroup", updatedGroup);
    }

    // Notify existing members so their group info updates in real time
    updatedGroup.members.forEach((member) => {
      if (member._id.toString() === userId.toString()) return; // skip new member (already notified)
      const sid = onlineUsers[member._id.toString()];
      if (sid) io.to(sid).emit("groupUpdated", updatedGroup);
    });

    res.status(200).json(updatedGroup);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= REMOVE MEMBER =================
export const removeMember = async (req, res) => {
  try {
    const groupId = req.params.id;
    const { userId } = req.body;
    const adminId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    if (group.admin.toString() !== adminId.toString())
      return res.status(403).json({ message: "Only admin can remove members" });

    if (group.admin.toString() === userId.toString())
      return res.status(400).json({ message: "Admin cannot be removed" });

    group.members = group.members.filter(
      (id) => id.toString() !== userId.toString()
    );
    await group.save();

    // Notify the removed member
    const removedSocketId = onlineUsers[userId.toString()];
    if (removedSocketId) {
      io.to(removedSocketId).emit("removedFromGroup", { groupId });
    }

    // Notify remaining members so their group member list updates in real time
    group.members.forEach((memberId) => {
      const sid = onlineUsers[memberId.toString()];
      if (sid) io.to(sid).emit("groupUpdated", { _id: groupId, members: group.members });
    });

    res.status(200).json({ message: "Member removed" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= LEAVE GROUP =================
export const leaveGroup = async (req, res) => {
  try {
    const groupId = req.params.id;
    const userId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    if (group.admin.toString() === userId.toString())
      return res.status(400).json({ message: "Admin must transfer admin role before leaving" });

    group.members = group.members.filter(
      (id) => id.toString() !== userId.toString()
    );
    await group.save();

    res.status(200).json({ message: "Left group successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= DELETE GROUP =================
export const deleteGroup = async (req, res) => {
  try {
    const groupId = req.params.id;
    const adminId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    if (group.admin.toString() !== adminId.toString())
      return res.status(403).json({ message: "Only admin can delete group" });

    group.members.forEach((memberId) => {
      const socketId = onlineUsers[memberId.toString()];
      if (socketId) {
        io.to(socketId).emit("groupDeleted", { groupId });
      }
    });

    await GroupMessage.deleteMany({ group: groupId });
    await group.deleteOne();

    res.status(200).json({ message: "Group deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= UPDATE GROUP =================
export const updateGroup = async (req, res) => {
  try {
    const groupId = req.params.id;
    const adminId = req.user._id;
    const { name, description } = req.body;
    let { groupPic } = req.body;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    if (group.admin.toString() !== adminId.toString())
      return res.status(403).json({ message: "Only admin can update group" });

    if (groupPic) {
      const uploadResult = await cloudinary.uploader.upload(groupPic, {
        folder: "chatapp/group-pics",
        transformation: [{ width: 300, height: 300, crop: "fill" }],
      });
      groupPic = uploadResult.secure_url;
    }

    if (name) group.name = name;
    if (description !== undefined) group.description = description;
    if (groupPic) group.groupPic = groupPic;

    await group.save();

    const updatedGroup = await Group.findById(groupId)
      .populate("members", "-password")
      .populate("admin", "-password");

    // Notify all members using updatedGroup.members (populated, includes any recent changes)
    updatedGroup.members.forEach((member) => {
      const sid = onlineUsers[member._id.toString()];
      if (sid) io.to(sid).emit("groupUpdated", updatedGroup);
    });

    res.status(200).json(updatedGroup);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};