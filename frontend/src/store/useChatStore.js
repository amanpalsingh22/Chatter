import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

const MESSAGE_PAGE_LIMIT = 30;

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  groups: [],
  selectedChat: null,
  messagePagination: {
    hasMore: false,
    nextCursor: null,
  },
  isUsersLoading: false,
  isMessagesLoading: false,
  isLoadingOlderMessages: false,
  isSendingMessage: false,
  shouldScrollToBottom: true,

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
  addIncomingGroup: (newGroup) => {
    if (get().groups.some((group) => group._id === newGroup._id)) return;
    set({ groups: [newGroup, ...get().groups] });
  },
  sendMessage: async (messageData) => {
    const { selectedChat, messages, isSendingMessage } = get();
    if (!selectedChat) return;
    if (isSendingMessage) return;

    set({ isSendingMessage: true });
    try {
      const url = selectedChat.isGroup
        ? `/messages/send/group/${selectedChat._id}`
        : `/messages/send/${selectedChat._id}`;
      const res = await axiosInstance.post(url, messageData);
      set({ messages: [...messages, res.data], shouldScrollToBottom: true });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to send message");
      throw error;
    } finally {
      set({ isSendingMessage: false });
    }
  },

  subscribeToMessages: () => {
    const { selectedChat } = get();
    if (!selectedChat) return;

    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.on("newMessage", (newMessage) => {
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
    });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;
    socket.off("newMessage");
  },

  setSelectedChat: (selectedChat) =>
    set({
      selectedChat,
      messages: [],
      messagePagination: { hasMore: false, nextCursor: null },
      shouldScrollToBottom: true,
    }),
}));
