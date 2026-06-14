import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import Group from "../models/group.model.js";

import cloudinary from "../lib/cloudinary.js";
import { getOnlineSocketIds, io } from "../lib/socket.js";
import { hasMessageContent, isValidObjectId } from "../lib/validators.js";

const DEFAULT_MESSAGE_LIMIT = 30;
const MAX_MESSAGE_LIMIT = 100;
const userPublicFields = "fullName email profilePic username bio lastSeen";
const messagePopulate = [
  { path: "senderId", select: "fullName profilePic username" },
  {
    path: "replyTo",
    select: "senderId text image isDeleted",
    populate: { path: "senderId", select: "fullName username" },
  },
];

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

function sortByRecentActivity(first, second) {
  const firstTime = first.lastMessageAt
    ? new Date(first.lastMessageAt).getTime()
    : first.lastActivityAt
      ? new Date(first.lastActivityAt).getTime()
      : 0;
  const secondTime = second.lastMessageAt
    ? new Date(second.lastMessageAt).getTime()
    : second.lastActivityAt
      ? new Date(second.lastActivityAt).getTime()
      : 0;

  if (secondTime !== firstTime) return secondTime - firstTime;

  const firstName = first.fullName || first.name || "";
  const secondName = second.fullName || second.name || "";
  return firstName.localeCompare(secondName);
}

function hasOnlineSockets(userId) {
  return getOnlineSocketIds([userId]).length > 0;
}

function createReceipt(userId, date, dateKey) {
  return {
    userId,
    [dateKey]: date,
  };
}

const getId = (value) => value?._id?.toString?.() || value?.toString?.();

const isSameId = (first, second) => getId(first) === getId(second);

async function getPopulatedMessage(messageId) {
  return Message.findById(messageId).populate(messagePopulate);
}

async function getPopulatedGroup(groupId) {
  return Group.findById(groupId)
    .populate("members", userPublicFields)
    .populate("admin", userPublicFields);
}

function emitToUserIds(userIds, eventName, payload) {
  getOnlineSocketIds(userIds.map((userId) => getId(userId)).filter(Boolean)).forEach((socketId) =>
    io.to(socketId).emit(eventName, payload)
  );
}

async function getMessageParticipantIds(message) {
  if (message.groupId) {
    const group = await Group.findById(message.groupId).select("members");
    return group?.members || [];
  }

  return [message.senderId, message.receiverId].filter(Boolean);
}

async function emitMessageUpdate(message, eventName = "messageUpdated") {
  const participantIds = await getMessageParticipantIds(message);
  emitToUserIds(participantIds, eventName, message);
}

async function getValidReplyMessage(replyTo, { senderId, receiverId, groupId }) {
  if (!replyTo) return null;

  if (!isValidObjectId(replyTo)) {
    throw new Error("Invalid reply message id");
  }

  const query = groupId
    ? { _id: replyTo, groupId }
    : {
        _id: replyTo,
        $or: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId },
        ],
      };

  const replyMessage = await Message.findOne(query);
  if (!replyMessage) {
    throw new Error("Reply message not found");
  }

  return replyMessage;
}

export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const filteredUsers = await User.find({ _id: { $ne: loggedInUserId } })
      .select("-password")
      .lean();
    const unreadCounts = await Message.aggregate([
      {
        $match: {
          receiverId: loggedInUserId,
          senderId: { $ne: loggedInUserId },
          isDeleted: { $ne: true },
          "readBy.userId": { $ne: loggedInUserId },
        },
      },
      { $group: { _id: "$senderId", count: { $sum: 1 } } },
    ]);
    const unreadCountByUser = new Map(
      unreadCounts.map((item) => [item._id.toString(), item.count])
    );
    const recentDirectMessages = await Message.aggregate([
      {
        $match: {
          receiverId: { $exists: true, $ne: null },
          $and: [
            {
              $or: [{ groupId: { $exists: false } }, { groupId: null }],
            },
            {
              $or: [{ senderId: loggedInUserId }, { receiverId: loggedInUserId }],
            },
          ],
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $project: {
          otherUserId: {
            $cond: [{ $eq: ["$senderId", loggedInUserId] }, "$receiverId", "$senderId"],
          },
          createdAt: 1,
        },
      },
      {
        $group: {
          _id: "$otherUserId",
          lastMessageAt: { $first: "$createdAt" },
        },
      },
    ]);
    const lastMessageAtByUser = new Map(
      recentDirectMessages.map((item) => [item._id.toString(), item.lastMessageAt])
    );
    const usersWithUnreadCounts = filteredUsers.map((user) => ({
      ...user,
      unreadCount: unreadCountByUser.get(user._id.toString()) || 0,
      lastMessageAt: lastMessageAtByUser.get(user._id.toString()) || null,
    })).sort(sortByRecentActivity);

    res.status(200).json(usersWithUnreadCounts);
  } catch (error) {
    console.error("Error in getUsersForSidebar: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getGroupsForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const groups = await Group.find({ members: loggedInUserId })
      .populate("members", userPublicFields)
      .populate("admin", userPublicFields)
      .sort({ updatedAt: -1 })
      .lean();
    const groupIds = groups.map((group) => group._id);
    const unreadCounts = await Message.aggregate([
      {
        $match: {
          groupId: { $in: groupIds },
          senderId: { $ne: loggedInUserId },
          isDeleted: { $ne: true },
          "readBy.userId": { $ne: loggedInUserId },
        },
      },
      { $group: { _id: "$groupId", count: { $sum: 1 } } },
    ]);
    const unreadCountByGroup = new Map(
      unreadCounts.map((item) => [item._id.toString(), item.count])
    );
    const recentGroupMessages = await Message.aggregate([
      {
        $match: {
          groupId: { $in: groupIds },
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$groupId",
          lastMessageAt: { $first: "$createdAt" },
        },
      },
    ]);
    const lastMessageAtByGroup = new Map(
      recentGroupMessages.map((item) => [item._id.toString(), item.lastMessageAt])
    );
    const groupsWithUnreadCounts = groups.map((group) => ({
      ...group,
      unreadCount: unreadCountByGroup.get(group._id.toString()) || 0,
      lastMessageAt: lastMessageAtByGroup.get(group._id.toString()) || null,
      lastActivityAt: lastMessageAtByGroup.get(group._id.toString()) || group.createdAt,
    })).sort(sortByRecentActivity);

    res.status(200).json(groupsWithUnreadCounts);
  } catch (error) {
    console.error("Error in getGroupsForSidebar: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const createGroup = async (req, res) => {
  try {
    const { name, memberIds = [], avatar } = req.body;
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

    let avatarUrl = "";
    if (avatar) {
      const uploadResponse = await cloudinary.uploader.upload(avatar);
      avatarUrl = uploadResponse.secure_url;
    }

    const group = await Group.create({
      name: name.trim(),
      avatar: avatarUrl,
      members: uniqueMemberIds,
      admin: creatorId,
    });

    const populatedGroup = await Group.findById(group._id)
      .populate("members", userPublicFields)
      .populate("admin", userPublicFields);

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

export const updateGroup = async (req, res) => {
  try {
    const { id: groupId } = req.params;
    const { name, avatar } = req.body;
    const userId = req.user._id;

    if (!isValidObjectId(groupId)) {
      return res.status(400).json({ message: "Invalid group id" });
    }

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });
    if (!isSameId(group.admin, userId)) {
      return res.status(403).json({ message: "Only group admin can update group" });
    }

    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ message: "Group name is required" });
      group.name = name.trim();
    }

    if (avatar !== undefined) {
      if (avatar) {
        const uploadResponse = await cloudinary.uploader.upload(avatar);
        group.avatar = uploadResponse.secure_url;
      } else {
        group.avatar = "";
      }
    }

    await group.save();
    const populatedGroup = await getPopulatedGroup(group._id);
    emitToUserIds(group.members, "groupUpdated", populatedGroup);

    res.status(200).json(populatedGroup);
  } catch (error) {
    console.error("Error in updateGroup: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const addGroupMembers = async (req, res) => {
  try {
    const { id: groupId } = req.params;
    const { memberIds = [] } = req.body;
    const userId = req.user._id;

    if (!isValidObjectId(groupId)) {
      return res.status(400).json({ message: "Invalid group id" });
    }

    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({ message: "Select at least one member" });
    }

    const uniqueMemberIds = [...new Set(memberIds.map((id) => id.toString()))];
    if (!uniqueMemberIds.every((id) => isValidObjectId(id))) {
      return res.status(400).json({ message: "Invalid member selected" });
    }

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });
    if (!isSameId(group.admin, userId)) {
      return res.status(403).json({ message: "Only group admin can add members" });
    }

    const membersCount = await User.countDocuments({ _id: { $in: uniqueMemberIds } });
    if (membersCount !== uniqueMemberIds.length) {
      return res.status(400).json({ message: "One or more selected members do not exist" });
    }

    const currentMemberIds = new Set(group.members.map((memberId) => memberId.toString()));
    const newMemberIds = uniqueMemberIds.filter((memberId) => !currentMemberIds.has(memberId));
    group.members.push(...newMemberIds);
    await group.save();

    const populatedGroup = await getPopulatedGroup(group._id);
    emitToUserIds(populatedGroup.members, "groupUpdated", populatedGroup);

    res.status(200).json(populatedGroup);
  } catch (error) {
    console.error("Error in addGroupMembers: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const removeGroupMember = async (req, res) => {
  try {
    const { id: groupId, memberId } = req.params;
    const userId = req.user._id;

    if (!isValidObjectId(groupId) || !isValidObjectId(memberId)) {
      return res.status(400).json({ message: "Invalid group or member id" });
    }

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });
    if (!isSameId(group.admin, userId)) {
      return res.status(403).json({ message: "Only group admin can remove members" });
    }
    if (isSameId(group.admin, memberId)) {
      return res.status(400).json({ message: "Transfer admin before removing this member" });
    }
    if (!group.members.some((member) => isSameId(member, memberId))) {
      return res.status(404).json({ message: "Member not found in group" });
    }

    group.members = group.members.filter((member) => !isSameId(member, memberId));
    await group.save();

    const populatedGroup = await getPopulatedGroup(group._id);
    emitToUserIds(populatedGroup.members, "groupUpdated", populatedGroup);
    emitToUserIds([memberId], "groupRemoved", { groupId });

    res.status(200).json(populatedGroup);
  } catch (error) {
    console.error("Error in removeGroupMember: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const makeGroupAdmin = async (req, res) => {
  try {
    const { id: groupId } = req.params;
    const { adminId } = req.body;
    const userId = req.user._id;

    if (!isValidObjectId(groupId) || !isValidObjectId(adminId)) {
      return res.status(400).json({ message: "Invalid group or admin id" });
    }

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });
    if (!isSameId(group.admin, userId)) {
      return res.status(403).json({ message: "Only group admin can transfer admin" });
    }
    if (!group.members.some((member) => isSameId(member, adminId))) {
      return res.status(400).json({ message: "New admin must be a group member" });
    }

    group.admin = adminId;
    await group.save();

    const populatedGroup = await getPopulatedGroup(group._id);
    emitToUserIds(group.members, "groupUpdated", populatedGroup);

    res.status(200).json(populatedGroup);
  } catch (error) {
    console.error("Error in makeGroupAdmin: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const leaveGroup = async (req, res) => {
  try {
    const { id: groupId } = req.params;
    const userId = req.user._id;

    if (!isValidObjectId(groupId)) {
      return res.status(400).json({ message: "Invalid group id" });
    }

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });
    if (!group.members.some((member) => isSameId(member, userId))) {
      return res.status(400).json({ message: "You are not a member of this group" });
    }

    const remainingMembers = group.members.filter((member) => !isSameId(member, userId));
    if (remainingMembers.length === 0) {
      await Group.findByIdAndDelete(groupId);
      emitToUserIds([userId], "groupRemoved", { groupId });
      return res.status(200).json({ groupId, deleted: true });
    }

    group.members = remainingMembers;
    if (isSameId(group.admin, userId)) {
      group.admin = remainingMembers[0];
    }
    await group.save();

    const populatedGroup = await getPopulatedGroup(group._id);
    emitToUserIds(remainingMembers, "groupUpdated", populatedGroup);
    emitToUserIds([userId], "groupRemoved", { groupId });

    res.status(200).json({ groupId, group: populatedGroup });
  } catch (error) {
    console.error("Error in leaveGroup: ", error.message);
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
      .populate(messagePopulate)
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
      .populate(messagePopulate)
      .sort({ createdAt: -1 })
      .limit(limit + 1);

    res.status(200).json(formatMessagePage(messages, limit));
  } catch (error) {
    console.log("Error in getGroupMessages controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const markMessagesAsRead = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const readerId = req.user._id;
    const readAt = new Date();

    if (!isValidObjectId(userToChatId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const unreadMessages = await Message.find({
      senderId: userToChatId,
      receiverId: readerId,
      "readBy.userId": { $ne: readerId },
    }).select("_id");

    const messageIds = unreadMessages.map((message) => message._id);

    if (messageIds.length > 0) {
      await Message.updateMany(
        { _id: { $in: messageIds } },
        { $push: { readBy: createReceipt(readerId, readAt, "readAt") } }
      );

      getOnlineSocketIds([userToChatId, readerId]).forEach((socketId) =>
        io.to(socketId).emit("messagesRead", {
          messageIds,
          readerId,
          readAt,
        })
      );
    }

    res.status(200).json({ messageIds, readerId, readAt });
  } catch (error) {
    console.log("Error in markMessagesAsRead controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const markGroupMessagesAsRead = async (req, res) => {
  try {
    const { id: groupId } = req.params;
    const readerId = req.user._id;
    const readAt = new Date();

    if (!isValidObjectId(groupId)) {
      return res.status(400).json({ message: "Invalid group id" });
    }

    const group = await Group.findOne({ _id: groupId, members: readerId });
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    const unreadMessages = await Message.find({
      groupId,
      senderId: { $ne: readerId },
      "readBy.userId": { $ne: readerId },
    }).select("_id");

    const messageIds = unreadMessages.map((message) => message._id);

    if (messageIds.length > 0) {
      await Message.updateMany(
        { _id: { $in: messageIds } },
        { $push: { readBy: createReceipt(readerId, readAt, "readAt") } }
      );

      getOnlineSocketIds(group.members).forEach((socketId) =>
        io.to(socketId).emit("messagesRead", {
          groupId,
          messageIds,
          readerId,
          readAt,
        })
      );
    }

    res.status(200).json({ groupId, messageIds, readerId, readAt });
  } catch (error) {
    console.log("Error in markGroupMessagesAsRead controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const editMessage = async (req, res) => {
  try {
    const { id: messageId } = req.params;
    const { text } = req.body;
    const userId = req.user._id;

    if (!isValidObjectId(messageId)) {
      return res.status(400).json({ message: "Invalid message id" });
    }

    if (!text?.trim()) {
      return res.status(400).json({ message: "Message text is required" });
    }

    const message = await Message.findOne({ _id: messageId, senderId: userId });
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    if (message.isDeleted) {
      return res.status(400).json({ message: "Deleted messages cannot be edited" });
    }

    message.text = text.trim();
    message.isEdited = true;
    message.editedAt = new Date();
    await message.save();

    const populatedMessage = await getPopulatedMessage(message._id);
    await emitMessageUpdate(populatedMessage);

    res.status(200).json(populatedMessage);
  } catch (error) {
    console.log("Error in editMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteMessage = async (req, res) => {
  try {
    const { id: messageId } = req.params;
    const userId = req.user._id;

    if (!isValidObjectId(messageId)) {
      return res.status(400).json({ message: "Invalid message id" });
    }

    const message = await Message.findOne({ _id: messageId, senderId: userId });
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    if (!message.isDeleted) {
      message.text = "";
      message.image = "";
      message.isDeleted = true;
      message.deletedAt = new Date();
      await message.save();
    }

    const populatedMessage = await getPopulatedMessage(message._id);
    await emitMessageUpdate(populatedMessage, "messageDeleted");

    res.status(200).json(populatedMessage);
  } catch (error) {
    console.log("Error in deleteMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { text, image, replyTo } = req.body;
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

    const deliveredAt = new Date();
    const deliveredTo = hasOnlineSockets(receiverId)
      ? [createReceipt(receiverId, deliveredAt, "deliveredAt")]
      : [];
    let replyMessage = null;
    try {
      replyMessage = await getValidReplyMessage(replyTo, { senderId, receiverId });
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }

    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      image: imageUrl,
      replyTo: replyMessage?._id,
      deliveredTo,
    });

    await newMessage.save();
    const populatedMessage = await getPopulatedMessage(newMessage._id);

    getOnlineSocketIds([receiverId]).forEach((socketId) =>
      io.to(socketId).emit("newMessage", populatedMessage)
    );

    res.status(201).json(populatedMessage);
  } catch (error) {
    console.log("Error in sendMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const sendGroupMessage = async (req, res) => {
  try {
    const { text, image, replyTo } = req.body;
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

    const deliveredAt = new Date();
    const deliveredTo = group.members
      .filter((memberId) => memberId.toString() !== senderId.toString())
      .filter((memberId) => hasOnlineSockets(memberId))
      .map((memberId) => createReceipt(memberId, deliveredAt, "deliveredAt"));
    let replyMessage = null;
    try {
      replyMessage = await getValidReplyMessage(replyTo, { senderId, groupId });
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }

    const newMessage = await Message.create({
      senderId,
      groupId,
      text,
      image: imageUrl,
      replyTo: replyMessage?._id,
      deliveredTo,
    });

    const populatedMessage = await getPopulatedMessage(newMessage._id);

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
