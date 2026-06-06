import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  createGroup,
  getGroupMessages,
  getGroupsForSidebar,
  getMessages,
  getUsersForSidebar,
  sendGroupMessage,
  sendMessage,
} from "../controllers/message.controller.js";

const router = express.Router();

router.get("/users", protectRoute, getUsersForSidebar);
router.get("/groups", protectRoute, getGroupsForSidebar);
router.post("/groups", protectRoute, createGroup);
router.get("/groups/:id", protectRoute, getGroupMessages);
router.get("/:id", protectRoute, getMessages);

router.post("/send/group/:id", protectRoute, sendGroupMessage);
router.post("/send/:id", protectRoute, sendMessage);

export default router;
