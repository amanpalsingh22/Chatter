import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  addGroupMembers,
  createGroup,
  deleteMessage,
  editMessage,
  getGroupMessages,
  getGroupsForSidebar,
  getMessages,
  getUsersForSidebar,
  leaveGroup,
  makeGroupAdmin,
  markGroupMessagesAsRead,
  markMessagesAsRead,
  removeGroupMember,
  sendGroupMessage,
  sendMessage,
  updateGroup,
} from "../controllers/message.controller.js";

const router = express.Router();

router.get("/users", protectRoute, getUsersForSidebar);
router.get("/groups", protectRoute, getGroupsForSidebar);
router.post("/groups", protectRoute, createGroup);
router.patch("/groups/:id", protectRoute, updateGroup);
router.post("/groups/:id/members", protectRoute, addGroupMembers);
router.delete("/groups/:id/members/:memberId", protectRoute, removeGroupMember);
router.post("/groups/:id/leave", protectRoute, leaveGroup);
router.patch("/groups/:id/admin", protectRoute, makeGroupAdmin);
router.get("/groups/:id", protectRoute, getGroupMessages);
router.post("/read/group/:id", protectRoute, markGroupMessagesAsRead);
router.post("/read/:id", protectRoute, markMessagesAsRead);
router.get("/:id", protectRoute, getMessages);

router.post("/send/group/:id", protectRoute, sendGroupMessage);
router.post("/send/:id", protectRoute, sendMessage);
router.patch("/:id", protectRoute, editMessage);
router.delete("/:id", protectRoute, deleteMessage);

export default router;
