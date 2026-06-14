import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

const MESSAGE_PAGE_LIMIT = 30;
const typingTimeouts = new Map();
let activeMessageHandlers = null;

const getId = (value) => (typeof value === "object" ? value?._id : value);

const hasReceipt = (receipts = [], userId) =>
  receipts.some((receipt) => getId(receipt.userId) === userId);

const addReadReceipt = (message, readerId, readAt) => {
  if (hasReceipt(message.readBy, readerId)) return message;

  return {
    ...message,
    readBy: [...(message.readBy || []), { userId: readerId, readAt }],
  };
};

const getRecipientIds = (selectedChat, authUser) => {
  if (!selectedChat || !authUser) return [];

  if (selectedChat.isGroup) {
    return selectedChat.members
      .map((member) => getId(member))
      .filter((memberId) => memberId && memberId !== authUser._id);
  }

  return selectedChat._id === authUser._id ? [] : [selectedChat._id];
};

const getMessageSenderId = (message) => getId(message.senderId);

const getMessageChatKey = (message, authUserId) => {
  if (message.groupId) return { type: "group", id: getId(message.groupId) };

  const senderId = getMessageSenderId(message);
  const receiverId = getId(message.receiverId);

  return { type: "user", id: senderId === authUserId ? receiverId : senderId };
};

const moveItemToTop = (items, itemId, updateItem) => {
  let movedItem = null;
  const remainingItems = [];

  items.forEach((item) => {
    if (item._id === itemId && !movedItem) {
      movedItem = updateItem(item);
      return;
    }

    remainingItems.push(item);
  });

  return movedItem ? [movedItem, ...remainingItems] : items;
};

const isAppVisible = () =>
  typeof document === "undefined" || document.visibilityState === "visible";

const updateUserFields = (user, userId, fields) =>
  user?._id === userId ? { ...user, ...fields } : user;

const updateGroupMemberFields = (group, userId, fields) => ({
  ...group,
  members: group.members?.map((member) =>
    typeof member === "object" ? updateUserFields(member, userId, fields) : member
  ),
  admin:
    typeof group.admin === "object" ? updateUserFields(group.admin, userId, fields) : group.admin,
});

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  groups: [],
  selectedChat: null,
  replyTo: null,
  messagePagination: {
    hasMore: false,
    nextCursor: null,
  },
  isUsersLoading: false,
  isMessagesLoading: false,
  isLoadingOlderMessages: false,
  isSendingMessage: false,
  shouldScrollToBottom: true,
  typingUsers: {},

  getUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const [usersRes, groupsRes] = await Promise.all([
        axiosInstance.get("/messages/users"),
        axiosInstance.get("/messages/groups"),
      ]);
      set({ users: usersRes.data, groups: groupsRes.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load chats");
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMessages: async (userId) => {
    const { selectedChat } = get();

    set({ isMessagesLoading: true });
    try {
      const url = selectedChat?.isGroup ? `/messages/groups/${userId}` : `/messages/${userId}`;
      const res = await axiosInstance.get(url, { params: { limit: MESSAGE_PAGE_LIMIT } });
      const page = Array.isArray(res.data)
        ? { messages: res.data, hasMore: false, nextCursor: null }
        : res.data;

      set({
        messages: page.messages,
        messagePagination: {
          hasMore: page.hasMore,
          nextCursor: page.nextCursor,
        },
        shouldScrollToBottom: true,
      });
      await get().markMessagesAsRead();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load messages");
    } finally {
      set({ isMessagesLoading: false });
    }
  },
  loadOlderMessages: async () => {
    const { selectedChat, messagePagination, messages, isLoadingOlderMessages } = get();
    if (!selectedChat || !messagePagination.hasMore || !messagePagination.nextCursor) return;
    if (isLoadingOlderMessages) return;

    set({ isLoadingOlderMessages: true });
    try {
      const url = selectedChat.isGroup
        ? `/messages/groups/${selectedChat._id}`
        : `/messages/${selectedChat._id}`;
      const res = await axiosInstance.get(url, {
        params: {
          limit: MESSAGE_PAGE_LIMIT,
          before: messagePagination.nextCursor,
        },
      });
      const page = res.data;

      set({
        messages: [...page.messages, ...messages],
        messagePagination: {
          hasMore: page.hasMore,
          nextCursor: page.nextCursor,
        },
        shouldScrollToBottom: false,
      });
      await get().markMessagesAsRead();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load older messages");
    } finally {
      set({ isLoadingOlderMessages: false });
    }
  },
  createGroup: async ({ name, memberIds }) => {
    try {
      const res = await axiosInstance.post("/messages/groups", { name, memberIds });
      set({ groups: [res.data, ...get().groups], selectedChat: { ...res.data, isGroup: true } });
      toast.success("Group created");
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to create group");
      throw error;
    }
  },
  updateGroupInState: (updatedGroup) => {
    const normalizedGroup = { ...updatedGroup, isGroup: true };
    const existingGroup = get().groups.find((group) => group._id === normalizedGroup._id);
    set({
      groups: existingGroup
        ? get().groups.map((group) =>
            group._id === normalizedGroup._id
              ? {
                  ...normalizedGroup,
                  unreadCount: group.unreadCount || 0,
                  lastMessageAt: normalizedGroup.lastMessageAt || group.lastMessageAt || null,
                  lastActivityAt:
                    normalizedGroup.lastActivityAt || group.lastActivityAt || group.createdAt,
                }
              : group
          )
        : [normalizedGroup, ...get().groups],
      selectedChat:
        get().selectedChat?._id === normalizedGroup._id
          ? {
              ...normalizedGroup,
              unreadCount: get().selectedChat.unreadCount || 0,
              lastMessageAt:
                normalizedGroup.lastMessageAt || get().selectedChat.lastMessageAt || null,
              lastActivityAt:
                normalizedGroup.lastActivityAt ||
                get().selectedChat.lastActivityAt ||
                get().selectedChat.createdAt,
            }
          : get().selectedChat,
    });
  },
  removeGroupFromState: (groupId) => {
    set({
      groups: get().groups.filter((group) => group._id !== groupId),
      selectedChat: get().selectedChat?._id === groupId ? null : get().selectedChat,
    });
  },
  updateUserPresence: ({ userId, lastSeen }) => {
    set({
      users: get().users.map((user) => updateUserFields(user, userId, { lastSeen })),
      groups: get().groups.map((group) => updateGroupMemberFields(group, userId, { lastSeen })),
      selectedChat:
        !get().selectedChat?.isGroup && get().selectedChat?._id === userId
          ? { ...get().selectedChat, lastSeen }
          : get().selectedChat?.isGroup
            ? updateGroupMemberFields(get().selectedChat, userId, { lastSeen })
            : get().selectedChat,
    });
  },
  addIncomingGroup: (newGroup) => {
    if (get().groups.some((group) => group._id === newGroup._id)) return;
    set({ groups: [newGroup, ...get().groups] });
  },
  touchChatActivity: (message, { incrementUnread = false } = {}) => {
    const authUserId = useAuthStore.getState().authUser?._id;
    const chatKey = getMessageChatKey(message, authUserId);
    const lastMessageAt = message.createdAt || new Date().toISOString();
    const updateActivity = (chat) => ({
      ...chat,
      lastMessageAt,
      lastActivityAt: lastMessageAt,
      unreadCount: incrementUnread ? (chat.unreadCount || 0) + 1 : chat.unreadCount || 0,
    });
    const selectedChat = get().selectedChat;
    const updatedSelectedChat =
      selectedChat &&
      ((chatKey.type === "group" && selectedChat.isGroup && selectedChat._id === chatKey.id) ||
        (chatKey.type === "user" && !selectedChat.isGroup && selectedChat._id === chatKey.id))
        ? updateActivity(selectedChat)
        : selectedChat;

    if (chatKey.type === "group") {
      set({
        groups: moveItemToTop(get().groups, chatKey.id, updateActivity),
        selectedChat: updatedSelectedChat,
      });
      return;
    }

    set({
      users: moveItemToTop(get().users, chatKey.id, updateActivity),
      selectedChat: updatedSelectedChat,
    });
  },
  updateGroupDetails: async ({ name, avatar }) => {
    const { selectedChat } = get();
    if (!selectedChat?.isGroup) return;

    try {
      const payload = { name };
      if (avatar) payload.avatar = avatar;

      const res = await axiosInstance.patch(`/messages/groups/${selectedChat._id}`, payload);
      get().updateGroupInState(res.data);
      toast.success("Group updated");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update group");
      throw error;
    }
  },
  addGroupMembers: async (memberIds) => {
    const { selectedChat } = get();
    if (!selectedChat?.isGroup) return;

    try {
      const res = await axiosInstance.post(`/messages/groups/${selectedChat._id}/members`, {
        memberIds,
      });
      get().updateGroupInState(res.data);
      toast.success("Members added");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to add members");
      throw error;
    }
  },
  removeGroupMember: async (memberId) => {
    const { selectedChat } = get();
    if (!selectedChat?.isGroup) return;

    try {
      const res = await axiosInstance.delete(
        `/messages/groups/${selectedChat._id}/members/${memberId}`
      );
      get().updateGroupInState(res.data);
      toast.success("Member removed");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to remove member");
      throw error;
    }
  },
  makeGroupAdmin: async (adminId) => {
    const { selectedChat } = get();
    if (!selectedChat?.isGroup) return;

    try {
      const res = await axiosInstance.patch(`/messages/groups/${selectedChat._id}/admin`, {
        adminId,
      });
      get().updateGroupInState(res.data);
      toast.success("Admin updated");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update admin");
      throw error;
    }
  },
  leaveGroup: async () => {
    const { selectedChat } = get();
    if (!selectedChat?.isGroup) return;

    try {
      const res = await axiosInstance.post(`/messages/groups/${selectedChat._id}/leave`);
      get().removeGroupFromState(res.data.groupId);
      toast.success("Left group");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to leave group");
      throw error;
    }
  },
  sendMessage: async (messageData) => {
    const { selectedChat, messages, isSendingMessage, replyTo } = get();
    if (!selectedChat) return;
    if (isSendingMessage) return;

    set({ isSendingMessage: true });
    try {
      const url = selectedChat.isGroup
        ? `/messages/send/group/${selectedChat._id}`
        : `/messages/send/${selectedChat._id}`;
      const res = await axiosInstance.post(url, { ...messageData, replyTo: replyTo?._id });
      set({ messages: [...messages, res.data], shouldScrollToBottom: true, replyTo: null });
      get().touchChatActivity(res.data);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to send message");
      throw error;
    } finally {
      set({ isSendingMessage: false });
    }
  },
  updateMessageInState: (updatedMessage) => {
    set({
      messages: get().messages.map((message) =>
        message._id === updatedMessage._id ? updatedMessage : message
      ),
      replyTo: get().replyTo?._id === updatedMessage._id ? updatedMessage : get().replyTo,
    });
  },
  editMessage: async (messageId, text) => {
    try {
      const res = await axiosInstance.patch(`/messages/${messageId}`, { text });
      get().updateMessageInState(res.data);
      toast.success("Message edited");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to edit message");
      throw error;
    }
  },
  deleteMessage: async (messageId) => {
    try {
      const res = await axiosInstance.delete(`/messages/${messageId}`);
      get().updateMessageInState(res.data);
      if (get().replyTo?._id === messageId) set({ replyTo: null });
      toast.success("Message deleted");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete message");
      throw error;
    }
  },

  setReplyTo: (message) => set({ replyTo: message }),
  clearReplyTo: () => set({ replyTo: null }),

  applyReadReceipts: ({ messageIds = [], readerId, readAt }) => {
    const messageIdSet = new Set(messageIds.map((messageId) => messageId.toString()));

    set({
      messages: get().messages.map((message) =>
        messageIdSet.has(message._id) ? addReadReceipt(message, readerId, readAt) : message
      ),
    });
  },

  markMessagesAsRead: async () => {
    const { selectedChat } = get();
    if (!selectedChat) return;
    if (!isAppVisible()) return;

    try {
      const url = selectedChat.isGroup
        ? `/messages/read/group/${selectedChat._id}`
        : `/messages/read/${selectedChat._id}`;
      const res = await axiosInstance.post(url);

      get().applyReadReceipts(res.data);
      if (selectedChat.isGroup) {
        set({
          groups: get().groups.map((group) =>
            group._id === selectedChat._id ? { ...group, unreadCount: 0 } : group
          ),
        });
      } else {
        set({
          users: get().users.map((user) =>
            user._id === selectedChat._id ? { ...user, unreadCount: 0 } : user
          ),
        });
      }
    } catch (error) {
      console.error("Failed to mark messages as read:", error);
    }
  },

  startTyping: () => {
    const { selectedChat } = get();
    const { authUser, socket } = useAuthStore.getState();
    if (!selectedChat || !authUser || !socket) return;

    socket.emit("typing:start", {
      chatId: selectedChat._id,
      isGroup: selectedChat.isGroup,
      recipientIds: getRecipientIds(selectedChat, authUser),
      fullName: authUser.fullName,
    });
  },

  stopTyping: () => {
    const { selectedChat } = get();
    const { authUser, socket } = useAuthStore.getState();
    if (!selectedChat || !authUser || !socket) return;

    socket.emit("typing:stop", {
      chatId: selectedChat._id,
      isGroup: selectedChat.isGroup,
      recipientIds: getRecipientIds(selectedChat, authUser),
    });
  },

  removeTypingUser: (userId) => {
    const nextTypingUsers = { ...get().typingUsers };
    delete nextTypingUsers[userId];
    set({ typingUsers: nextTypingUsers });
  },

  subscribeToMessages: () => {
    const { selectedChat } = get();
    if (!selectedChat) return;

    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    get().unsubscribeFromMessages();

    const handleNewMessage = (newMessage) => {
      const senderId =
        typeof newMessage.senderId === "object" ? newMessage.senderId._id : newMessage.senderId;
      const isMessageForSelectedChat = selectedChat.isGroup
        ? newMessage.groupId === selectedChat._id
        : senderId === selectedChat._id;

      if (!isMessageForSelectedChat) return;

      set({
        messages: [...get().messages, newMessage],
        shouldScrollToBottom: true,
      });

      const authUser = useAuthStore.getState().authUser;
      if (senderId !== authUser?._id && isAppVisible()) {
        get().markMessagesAsRead();
      }
    };

    const handleMessagesRead = (payload) => {
      get().applyReadReceipts(payload);
    };

    const handleMessageUpdated = (updatedMessage) => {
      get().updateMessageInState(updatedMessage);
    };

    const handleMessageDeleted = (updatedMessage) => {
      get().updateMessageInState(updatedMessage);
    };

    const handleTypingStart = (payload) => {
      const currentChat = get().selectedChat;
      const authUser = useAuthStore.getState().authUser;
      if (!currentChat || !authUser || payload.userId === authUser._id) return;

      const isTypingInCurrentChat = payload.isGroup
        ? currentChat.isGroup && payload.chatId === currentChat._id
        : !currentChat.isGroup && payload.userId === currentChat._id;

      if (!isTypingInCurrentChat) return;

      if (typingTimeouts.has(payload.userId)) {
        clearTimeout(typingTimeouts.get(payload.userId));
      }

      typingTimeouts.set(
        payload.userId,
        setTimeout(() => {
          get().removeTypingUser(payload.userId);
          typingTimeouts.delete(payload.userId);
        }, 3000)
      );

      set({
        typingUsers: {
          ...get().typingUsers,
          [payload.userId]: payload.fullName || "Someone",
        },
      });
    };

    const handleTypingStop = (payload) => {
      if (typingTimeouts.has(payload.userId)) {
        clearTimeout(typingTimeouts.get(payload.userId));
        typingTimeouts.delete(payload.userId);
      }

      get().removeTypingUser(payload.userId);
    };

    activeMessageHandlers = {
      socket,
      handleNewMessage,
      handleMessagesRead,
      handleMessageUpdated,
      handleMessageDeleted,
      handleTypingStart,
      handleTypingStop,
    };

    socket.on("newMessage", handleNewMessage);
    socket.on("messagesRead", handleMessagesRead);
    socket.on("messageUpdated", handleMessageUpdated);
    socket.on("messageDeleted", handleMessageDeleted);
    socket.on("typing:start", handleTypingStart);
    socket.on("typing:stop", handleTypingStop);
  },

  unsubscribeFromMessages: () => {
    if (!activeMessageHandlers) return;

    const {
      socket,
      handleNewMessage,
      handleMessagesRead,
      handleMessageUpdated,
      handleMessageDeleted,
      handleTypingStart,
      handleTypingStop,
    } = activeMessageHandlers;

    socket.off("newMessage", handleNewMessage);
    socket.off("messagesRead", handleMessagesRead);
    socket.off("messageUpdated", handleMessageUpdated);
    socket.off("messageDeleted", handleMessageDeleted);
    socket.off("typing:start", handleTypingStart);
    socket.off("typing:stop", handleTypingStop);
    activeMessageHandlers = null;
    typingTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    typingTimeouts.clear();
    set({ typingUsers: {} });
  },

  setSelectedChat: (selectedChat) =>
    set({
      selectedChat,
      messages: [],
      replyTo: null,
      messagePagination: { hasMore: false, nextCursor: null },
      shouldScrollToBottom: true,
      typingUsers: {},
    }),
  addUnreadForMessage: (message) => {
    const { selectedChat } = get();
    const authUser = useAuthStore.getState().authUser;
    const chatKey = getMessageChatKey(message, authUser?._id);
    const isCurrentChat =
      selectedChat &&
      ((chatKey.type === "group" && selectedChat.isGroup && selectedChat._id === chatKey.id) ||
        (chatKey.type === "user" && !selectedChat.isGroup && selectedChat._id === chatKey.id));

    get().touchChatActivity(message, { incrementUnread: !isCurrentChat || !isAppVisible() });
  },
}));
