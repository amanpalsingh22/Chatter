import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import Group from "../models/group.model.js";

import cloudinary from "../lib/cloudinary.js";
import { getOnlineSocketIds, io } from "../lib/socket.js";
import { hasMessageContent, isValidObjectId } from "../lib/validators.js";

const DEFAULT_MESSAGE_LIMIT = 30;
const MAX_MESSAGE_LIMIT = 100;

function getMessagePagination(query) {
  const parsedLimit = Number.parseInt(query.limit, 10);
  const limit =
    Number.isInteger(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, MAX_MESSAGE_LIMIT)
      : DEFAULT_MESSAGE_LIMIT;
  const before = query.before ? new Date(query.before) : null;

  return {
    limit,
    before: before && !Number.isNaN(before.getTime()) ? before : null,
  };
}

function formatMessagePage(messages, limit) {
  const hasMore = messages.length > limit;
  const pageMessages = hasMore ? messages.slice(0, limit) : messages;
  const orderedMessages = pageMessages.reverse();
  const nextCursor = hasMore ? orderedMessages[0]?.createdAt : null;

  return {
    messages: orderedMessages,
    hasMore,
    nextCursor,
  };
}

export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const filteredUsers = await User.find({ _id: { $ne: loggedInUserId } }).select("-password");

    res.status(200).json(filteredUsers);
  } catch (error) {
    console.error("Error in getUsersForSidebar: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getGroupsForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const groups = await Group.find({ members: loggedInUserId })
      .populate("members", "fullName email profilePic")
      .populate("admin", "fullName email profilePic")
      .sort({ updatedAt: -1 });

    res.status(200).json(groups);
  } catch (error) {
    console.error("Error in getGroupsForSidebar: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const createGroup = async (req, res) => {
  try {
    const { name, memberIds = [] } = req.body;
    const creatorId = req.user._id.toString();

    if (!name?.trim()) {
      return res.status(400).json({ message: "Group name is required" });
    }

    if (!Array.isArray(memberIds)) {
      return res.status(400).json({ message: "Members must be an array" });
    }

    const uniqueMemberIds = [...new Set([...memberIds, creatorId].map((id) => id.toString()))];

    if (!uniqueMemberIds.every((id) => isValidObjectId(id))) {
      return res.status(400).json({ message: "Invalid member selected" });
    }

    if (uniqueMemberIds.length < 3) {
      return res.status(400).json({ message: "Select at least 2 other members" });
    }

    const membersCount = await User.countDocuments({ _id: { $in: uniqueMemberIds } });
    if (membersCount !== uniqueMemberIds.length) {
      return res.status(400).json({ message: "One or more selected members do not exist" });
    }

    const group = await Group.create({
      name: name.trim(),
      members: uniqueMemberIds,
      admin: creatorId,
    });

    const populatedGroup = await Group.findById(group._id)
      .populate("members", "fullName email profilePic")
      .populate("admin", "fullName email profilePic");

    const creatorSocketIds = new Set(getOnlineSocketIds([creatorId]));

    getOnlineSocketIds(uniqueMemberIds)
      .filter((socketId) => !creatorSocketIds.has(socketId))
      .forEach((socketId) => io.to(socketId).emit("newGroup", populatedGroup));

    res.status(201).json(populatedGroup);
  } catch (error) {
    console.error("Error in createGroup: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user._id;

    if (!isValidObjectId(userToChatId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const { limit, before } = getMessagePagination(req.query);
    const createdAtFilter = before ? { createdAt: { $lt: before } } : {};

    const messages = await Message.find({
      ...createdAtFilter,
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(limit + 1);

    res.status(200).json(formatMessagePage(messages, limit));
  } catch (error) {
    console.log("Error in getMessages controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getGroupMessages = async (req, res) => {
  try {
    const { id: groupId } = req.params;
    const myId = req.user._id;

    if (!isValidObjectId(groupId)) {
      return res.status(400).json({ message: "Invalid group id" });
    }

    const group = await Group.findOne({ _id: groupId, members: myId });
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    const { limit, before } = getMessagePagination(req.query);
    const query = before ? { groupId, createdAt: { $lt: before } } : { groupId };

    const messages = await Message.find(query)
      .populate("senderId", "fullName profilePic")
      .sort({ createdAt: -1 })
      .limit(limit + 1);

    res.status(200).json(formatMessagePage(messages, limit));
  } catch (error) {
    console.log("Error in getGroupMessages controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { text, image } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    if (!isValidObjectId(receiverId)) {
      return res.status(400).json({ message: "Invalid receiver id" });
    }

    if (!hasMessageContent({ text, image })) {
      return res.status(400).json({ message: "Message cannot be empty" });
    }

    const receiver = await User.exists({ _id: receiverId });
    if (!receiver) {
      return res.status(404).json({ message: "Receiver not found" });
    }

    let imageUrl;
    if (image) {
      // Upload base64 image to cloudinary
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      image: imageUrl,
    });

    await newMessage.save();

    getOnlineSocketIds([receiverId]).forEach((socketId) =>
      io.to(socketId).emit("newMessage", newMessage)
    );

    res.status(201).json(newMessage);
  } catch (error) {
    console.log("Error in sendMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const sendGroupMessage = async (req, res) => {
  try {
    const { text, image } = req.body;
    const { id: groupId } = req.params;
    const senderId = req.user._id;

    if (!isValidObjectId(groupId)) {
      return res.status(400).json({ message: "Invalid group id" });
    }

    if (!hasMessageContent({ text, image })) {
      return res.status(400).json({ message: "Message cannot be empty" });
    }

    const group = await Group.findOne({ _id: groupId, members: senderId });
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    let imageUrl;
    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    const newMessage = await Message.create({
      senderId,
      groupId,
      text,
      image: imageUrl,
    });

    const populatedMessage = await Message.findById(newMessage._id).populate(
      "senderId",
      "fullName profilePic"
    );

    const senderSocketIds = new Set(getOnlineSocketIds([senderId]));

    getOnlineSocketIds(group.members)
      .filter((socketId) => !senderSocketIds.has(socketId))
      .forEach((socketId) => io.to(socketId).emit("newMessage", populatedMessage));

    res.status(201).json(populatedMessage);
  } catch (error) {
    console.log("Error in sendGroupMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
