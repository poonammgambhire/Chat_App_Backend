import express from "express";
import {
  createGroup,
  getMyGroups,
  getGroupMessages,
  sendGroupMessage,
  editGroupMessage,
  deleteGroupMessage,
  reactToGroupMessage,
  forwardGroupMessage,
  pinGroupMessage,
  getPinnedGroupMessages,
  makeAdmin,
  addMember,
  removeMember,
  leaveGroup,
  deleteGroup,
  updateGroup,
} from "../controllers/groupController.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/create", protect, createGroup);
router.get("/", protect, getMyGroups);
router.get("/:id/messages", protect, getGroupMessages);
router.get("/:id/pinned", protect, getPinnedGroupMessages);       // ✅ Pinned messages
router.post("/:id/send", protect, sendGroupMessage);
router.patch("/:id/messages/:msgId/edit", protect, editGroupMessage);    // ✅ Edit
router.delete("/:id/messages/:msgId", protect, deleteGroupMessage);      // ✅ Delete
router.post("/:id/messages/:msgId/react", protect, reactToGroupMessage); // ✅ React
router.post("/:id/messages/:msgId/forward", protect, forwardGroupMessage); // ✅ Forward
router.patch("/:id/messages/:msgId/pin", protect, pinGroupMessage);      // ✅ Pin
router.post("/:id/add-member", protect, addMember);
router.post("/:id/remove-member", protect, removeMember);
router.post("/:id/make-admin", protect, makeAdmin);               // ✅ Transfer admin
router.post("/:id/leave", protect, leaveGroup);
router.delete("/:id", protect, deleteGroup);
router.put("/:id", protect, updateGroup);

export default router;