import User from "../models/UserModel.js";
import { io, onlineUsers } from "../server.js";

// ================= SEND FRIEND REQUEST =================
export const sendFriendRequest = async (req, res) => {
  try {
    const senderId = req.user._id;
    const receiverId = req.params.id;

    if (senderId.toString() === receiverId)
      return res.status(400).json({ message: "Cannot send request to yourself" });

    const sender = await User.findById(senderId);
    const receiver = await User.findById(receiverId);

    if (!receiver) return res.status(404).json({ message: "User not found" });

    // Already friends?
    if (sender.friends.includes(receiverId))
      return res.status(400).json({ message: "Already friends" });

    // Request already sent?
    if (sender.friendRequestsSent.includes(receiverId))
      return res.status(400).json({ message: "Request already sent" });

    // Blocked?
    if (sender.blockedUsers.includes(receiverId))
      return res.status(403).json({ message: "You have blocked this user" });

    sender.friendRequestsSent.push(receiverId);
    receiver.friendRequestsReceived.push(senderId);

    await sender.save();
    await receiver.save();

    // Real-time notification
    const receiverSocketId = onlineUsers[receiverId.toString()];
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("friendRequest", {
        from: {
          _id: sender._id,
          fullName: sender.fullName,
          profilePic: sender.profilePic,
        },
      });
    }

    res.status(200).json({ message: "Friend request sent" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= ACCEPT FRIEND REQUEST =================
export const acceptFriendRequest = async (req, res) => {
  try {
    const userId = req.user._id;
    const senderId = req.params.id;

    const user = await User.findById(userId);
    const sender = await User.findById(senderId);

    if (!sender) return res.status(404).json({ message: "User not found" });

    if (!user.friendRequestsReceived.includes(senderId))
      return res.status(400).json({ message: "No friend request from this user" });

    // दोघांच्या friends list मध्ये add
    user.friends.push(senderId);
    sender.friends.push(userId);

    // Requests clean up
    user.friendRequestsReceived = user.friendRequestsReceived.filter(
      (id) => id.toString() !== senderId.toString()
    );
    sender.friendRequestsSent = sender.friendRequestsSent.filter(
      (id) => id.toString() !== userId.toString()
    );

    await user.save();
    await sender.save();

    // Real-time notification
    const senderSocketId = onlineUsers[senderId.toString()];
    if (senderSocketId) {
      io.to(senderSocketId).emit("friendRequestAccepted", {
        by: {
          _id: user._id,
          fullName: user.fullName,
          profilePic: user.profilePic,
        },
      });
    }

    res.status(200).json({ message: "Friend request accepted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= REJECT FRIEND REQUEST =================
export const rejectFriendRequest = async (req, res) => {
  try {
    const userId = req.user._id;
    const senderId = req.params.id;

    const user = await User.findById(userId);
    const sender = await User.findById(senderId);

    if (!sender) return res.status(404).json({ message: "User not found" });

    user.friendRequestsReceived = user.friendRequestsReceived.filter(
      (id) => id.toString() !== senderId.toString()
    );
    sender.friendRequestsSent = sender.friendRequestsSent.filter(
      (id) => id.toString() !== userId.toString()
    );

    await user.save();
    await sender.save();

    res.status(200).json({ message: "Friend request rejected" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= UNFRIEND =================
export const unfriend = async (req, res) => {
  try {
    const userId = req.user._id;
    const friendId = req.params.id;

    const user = await User.findById(userId);
    const friend = await User.findById(friendId);

    if (!friend) return res.status(404).json({ message: "User not found" });

    user.friends = user.friends.filter(
      (id) => id.toString() !== friendId.toString()
    );
    friend.friends = friend.friends.filter(
      (id) => id.toString() !== userId.toString()
    );

    await user.save();
    await friend.save();

    res.status(200).json({ message: "Unfriended successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= GET FRIENDS LIST =================
export const getFriends = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate("friends", "-password")
      .populate("friendRequestsReceived", "-password")
      .populate("friendRequestsSent", "-password");

    res.status(200).json({
      friends: user.friends,
      requestsReceived: user.friendRequestsReceived,
      requestsSent: user.friendRequestsSent,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= BLOCK USER =================
export const blockUser = async (req, res) => {
  try {
    const userId = req.user._id;
    const blockId = req.params.id;

    if (userId.toString() === blockId)
      return res.status(400).json({ message: "Cannot block yourself" });

    const user = await User.findById(userId);

    if (user.blockedUsers.includes(blockId))
      return res.status(400).json({ message: "User already blocked" });

    // Block करताना friends मधून पण remove करतो
    user.blockedUsers.push(blockId);
    user.friends = user.friends.filter(
      (id) => id.toString() !== blockId.toString()
    );

    const blockedUser = await User.findById(blockId);
    if (blockedUser) {
      blockedUser.friends = blockedUser.friends.filter(
        (id) => id.toString() !== userId.toString()
      );
      await blockedUser.save();
    }

    await user.save();

    res.status(200).json({ message: "User blocked successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= UNBLOCK USER =================
export const unblockUser = async (req, res) => {
  try {
    const userId = req.user._id;
    const unblockId = req.params.id;

    const user = await User.findById(userId);

    user.blockedUsers = user.blockedUsers.filter(
      (id) => id.toString() !== unblockId.toString()
    );

    await user.save();

    res.status(200).json({ message: "User unblocked successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= GET BLOCKED USERS =================
export const getBlockedUsers = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate(
      "blockedUsers",
      "-password"
    );
    res.status(200).json(user.blockedUsers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};