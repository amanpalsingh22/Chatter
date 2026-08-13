import { useChatStore } from "../store/useChatStore";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import SharedNotebookPanel from "./SharedNotebookPanel";
import { useAuthStore } from "../store/useAuthStore";
import { formatMessageTime } from "../lib/utils";
import {
  AlertCircle,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Clock3,
  Copy,
  Download,
  Pencil,
  Reply,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import UserAvatar from "./UserAvatar";
import {
  DEFAULT_CHAT_BACKGROUND,
  isValidChatBackground,
} from "../lib/chatBackgrounds";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

const getId = (value) => (typeof value === "object" ? value?._id : value);

const getChatBackgroundStorageKey = (userId) => `chat-background:${userId || "guest"}`;

const formatDateSeparator = (value) => {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
};

const ChatContainer = () => {
  const {
    messages,
    getMessages,
    isMessagesLoading,
    isLoadingOlderMessages,
    loadOlderMessages,
    messagePagination,
    deleteMessage,
    editMessage,
    retryMessage,
    selectedChat,
    setReplyTo,
    toggleMessageReaction,
    markMessagesAsRead,
    syncPresenceView,
    stopPresenceView,
    subscribeToMessages,
    unsubscribeFromMessages,
  } = useChatStore();
  const { authUser } = useAuthStore();
  const messageListRef = useRef(null);
  const messageMenuRef = useRef(null);
  const messageSearchInputRef = useRef(null);
  const isAtBottomRef = useRef(true);
  const lastMessageIdRef = useRef(null);
  const initialScrollChatRef = useRef(null);
  const initialUnreadCountRef = useRef(selectedChat.unreadCount || 0);
  const highlightTimerRef = useRef(null);
  const [messageSearchQuery, setMessageSearchQuery] = useState("");
  const [isMessageSearchOpen, setIsMessageSearchOpen] = useState(false);
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [openMessageMenuId, setOpenMessageMenuId] = useState(null);
  const [messageMenuPlacement, setMessageMenuPlacement] = useState("down");
  const [unreadBoundaryId, setUnreadBoundaryId] = useState(null);
  const [newMessagesBelow, setNewMessagesBelow] = useState(0);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [loadedMedia, setLoadedMedia] = useState({});
  const [viewingMedia, setViewingMedia] = useState(null);
  const [chatBackground, setChatBackground] = useState(() => {
    const savedBackground = localStorage.getItem(getChatBackgroundStorageKey(authUser?._id));
    return isValidChatBackground(savedBackground) ? savedBackground : DEFAULT_CHAT_BACKGROUND;
  });

  const changeChatBackground = (backgroundId) => {
    if (!isValidChatBackground(backgroundId)) return;
    setChatBackground(backgroundId);
    localStorage.setItem(getChatBackgroundStorageKey(authUser?._id), backgroundId);
  };

  const scrollToLatestMessage = useCallback((behavior = "smooth") => {
    const messageList = messageListRef.current;
    if (!messageList) return;
    messageList.scrollTo({ top: messageList.scrollHeight, behavior });
    isAtBottomRef.current = true;
    setShowScrollButton(false);
    setNewMessagesBelow(0);
  }, []);

  const scrollToMessage = useCallback((messageId, highlight = false) => {
    const target = document.getElementById(`message-${messageId}`);
    if (!target) return false;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    if (highlight) {
      setHighlightedMessageId(messageId);
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = setTimeout(() => setHighlightedMessageId(null), 1800);
    }
    return true;
  }, []);

  const closeMessageSearch = () => {
    setIsMessageSearchOpen(false);
    setMessageSearchQuery("");
  };

  const toggleMessageSearch = () => {
    if (isMessageSearchOpen) {
      closeMessageSearch();
      return;
    }
    setIsMessageSearchOpen(true);
  };

  const getReceiptUserId = (receipt) => getId(receipt.userId);
  const hasReceiptFromUser = (receipts = [], userId) =>
    receipts.some((receipt) => getReceiptUserId(receipt) === userId);

  const getMessageStatus = (message) => {
    if (getId(message.senderId) !== authUser._id) return null;
    if (message._sendState) return message._sendState;

    if (selectedChat.isGroup) {
      const memberIds = selectedChat.members
        .map(getId)
        .filter((memberId) => memberId !== authUser._id);
      const allMembersRead =
        memberIds.length > 0 &&
        memberIds.every((memberId) => hasReceiptFromUser(message.readBy, memberId));
      const anyMemberReceived = memberIds.some(
        (memberId) =>
          hasReceiptFromUser(message.deliveredTo, memberId) ||
          hasReceiptFromUser(message.readBy, memberId)
      );

      if (allMembersRead) return "seen";
      if (anyMemberReceived) return "delivered";
      return "sent";
    }

    if (hasReceiptFromUser(message.readBy, selectedChat._id)) return "seen";
    if (hasReceiptFromUser(message.deliveredTo, selectedChat._id)) return "delivered";
    return "sent";
  };

  const renderMessageStatus = (message) => {
    const status = getMessageStatus(message);
    if (!status) return null;
    if (status === "sending") {
      return <Clock3 className="message-status-icon" aria-label="Sending" />;
    }
    if (status === "failed") {
      return (
        <button
          type="button"
          className="message-retry-button"
          onClick={() => retryMessage(message._id)}
          title="Send again"
        >
          <AlertCircle className="message-status-icon" />
          <span>Retry</span>
          <RotateCcw className="message-status-icon" />
        </button>
      );
    }
    if (status === "seen") {
      return <CheckCheck className="message-status-icon message-status-seen" aria-label="Seen" />;
    }
    if (status === "delivered") {
      return (
        <CheckCheck className="message-status-icon message-status-delivered" aria-label="Delivered" />
      );
    }
    return <Check className="message-status-icon message-status-sent" aria-label="Sent" />;
  };

  const messagesBelongTogether = (firstMessage, secondMessage) => {
    if (!firstMessage || !secondMessage) return false;
    if (getId(firstMessage.senderId) !== getId(secondMessage.senderId)) return false;
    if (
      new Date(firstMessage.createdAt).toDateString() !==
      new Date(secondMessage.createdAt).toDateString()
    ) return false;
    const firstTimestamp = new Date(firstMessage.createdAt).getTime();
    const secondTimestamp = new Date(secondMessage.createdAt).getTime();
    return Math.abs(secondTimestamp - firstTimestamp) <= 5 * 60 * 1000;
  };

  const getReplySummary = (message) => {
    if (!message) return "";
    if (message.isDeleted) return "Deleted message";
    return message.text || (message.image ? "Image" : "Message");
  };

  const getReplySenderName = (message) => {
    const sender = message?.senderId;
    if (!sender) return "";
    if (typeof sender === "object") return sender._id === authUser._id ? "You" : sender.fullName || "Someone";
    return sender === authUser._id ? "You" : "Someone";
  };

  const getReactionGroups = (message) => {
    const groups = new Map();
    (message.reactions || []).forEach((reaction) => {
      const current = groups.get(reaction.emoji) || { emoji: reaction.emoji, count: 0, mine: false };
      current.count += 1;
      current.mine ||= getId(reaction.userId) === authUser._id;
      groups.set(reaction.emoji, current);
    });
    return [...groups.values()];
  };

  const renderHighlightedText = (text) => {
    const query = messageSearchQuery.trim();
    if (!text || !query) return text;
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return text.split(new RegExp(`(${escapedQuery})`, "gi")).map((part, index) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={`${part}-${index}`} className="message-search-highlight">{part}</mark>
      ) : (
        part
      )
    );
  };

  const startEditing = (message) => {
    setOpenMessageMenuId(null);
    setEditingMessageId(message._id);
    setEditingText(message.text || "");
  };

  const handleReply = (message) => {
    setReplyTo(message);
    setOpenMessageMenuId(null);
  };

  const handleReactionFromMenu = (messageId, emoji) => {
    setOpenMessageMenuId(null);
    void toggleMessageReaction(messageId, emoji);
  };

  const handleQuotedReplyClick = async (message) => {
    const replyId = message.replyTo?._id;
    if (!replyId) return;
    setMessageSearchQuery("");
    setIsMessageSearchOpen(false);
    let found = useChatStore.getState().messages.some((item) => item._id === replyId);
    while (!found && useChatStore.getState().messagePagination.hasMore) {
      await useChatStore.getState().loadOlderMessages();
      found = useChatStore.getState().messages.some((item) => item._id === replyId);
    }
    requestAnimationFrame(() => {
      if (!scrollToMessage(replyId, true)) toast.error("Original message is unavailable");
    });
  };

  const handleCopy = async (message) => {
    const content = message.text || message.image;
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      toast.success(message.text ? "Message copied" : "Image link copied");
    } catch {
      toast.error("Could not copy message");
    } finally {
      setOpenMessageMenuId(null);
    }
  };

  const handleDelete = async (messageId) => {
    setOpenMessageMenuId(null);
    await deleteMessage(messageId);
  };

  const toggleMessageMenu = (messageId, event) => {
    if (openMessageMenuId === messageId) {
      setOpenMessageMenuId(null);
      return;
    }
    const triggerRect = event.currentTarget.getBoundingClientRect();
    setMessageMenuPlacement(window.innerHeight - triggerRect.bottom < 245 ? "up" : "down");
    setOpenMessageMenuId(messageId);
  };

  const cancelEditing = () => {
    setEditingMessageId(null);
    setEditingText("");
  };

  const handleEditSubmit = async (event, messageId) => {
    event.preventDefault();
    if (!editingText.trim()) return;
    await editMessage(messageId, editingText.trim());
    cancelEditing();
  };

  const handleListScroll = () => {
    const list = messageListRef.current;
    if (!list) return;
    const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 90;
    isAtBottomRef.current = atBottom;
    setShowScrollButton(!atBottom);
    if (atBottom) setNewMessagesBelow(0);
  };

  const handleLoadOlder = async () => {
    const list = messageListRef.current;
    const previousHeight = list?.scrollHeight || 0;
    await loadOlderMessages();
    requestAnimationFrame(() => {
      if (list) list.scrollTop += list.scrollHeight - previousHeight;
    });
  };

  const downloadMedia = async () => {
    if (!viewingMedia?.src) return;
    try {
      const response = await fetch(viewingMedia.src);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `chat-image-${Date.now()}.jpg`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(viewingMedia.src, "_blank", "noopener,noreferrer");
    }
  };

  const normalizedSearchQuery = messageSearchQuery.trim().toLowerCase();
  const filteredMessages = useMemo(
    () =>
      messages.filter((message) => {
        if (!normalizedSearchQuery) return true;
        const replySender = message.replyTo?.senderId;
        const replySenderName =
          typeof replySender === "object"
            ? replySender._id === authUser._id
              ? "You"
              : replySender.fullName || "Someone"
            : replySender === authUser._id
              ? "You"
              : "Someone";
        return (
          message.text?.toLowerCase().includes(normalizedSearchQuery) ||
          message.replyTo?.text?.toLowerCase().includes(normalizedSearchQuery) ||
          replySenderName.toLowerCase().includes(normalizedSearchQuery)
        );
      }),
    [authUser._id, messages, normalizedSearchQuery]
  );

  const navigateSearch = (direction) => {
    if (!filteredMessages.length) return;
    const nextIndex =
      (activeSearchIndex + direction + filteredMessages.length) % filteredMessages.length;
    setActiveSearchIndex(nextIndex);
    scrollToMessage(filteredMessages[nextIndex]._id, true);
  };

  useEffect(() => {
    initialUnreadCountRef.current = selectedChat.unreadCount || 0;
    initialScrollChatRef.current = null;
    lastMessageIdRef.current = null;
    isAtBottomRef.current = true;
    setUnreadBoundaryId(null);
    setNewMessagesBelow(0);
    setShowScrollButton(false);
    setMessageSearchQuery("");
    setOpenMessageMenuId(null);
    setViewingMedia(null);
    getMessages(selectedChat._id);
    subscribeToMessages();
    return () => unsubscribeFromMessages();
  }, [
    selectedChat._id,
    selectedChat.unreadCount,
    getMessages,
    subscribeToMessages,
    unsubscribeFromMessages,
  ]);

  useEffect(() => {
    if (!isMessageSearchOpen) return;
    const frameId = requestAnimationFrame(() => messageSearchInputRef.current?.focus());
    return () => cancelAnimationFrame(frameId);
  }, [isMessageSearchOpen]);

  useEffect(() => {
    if (!normalizedSearchQuery) {
      setActiveSearchIndex(0);
      return;
    }
    const nextIndex = Math.max(filteredMessages.length - 1, 0);
    setActiveSearchIndex(nextIndex);
    if (filteredMessages[nextIndex]) {
      requestAnimationFrame(() => scrollToMessage(filteredMessages[nextIndex]._id, true));
    }
  }, [normalizedSearchQuery, filteredMessages, scrollToMessage]);

  useEffect(() => {
    if (normalizedSearchQuery && messagePagination.hasMore && !isLoadingOlderMessages) {
      void loadOlderMessages();
    }
  }, [
    isLoadingOlderMessages,
    loadOlderMessages,
    messagePagination.hasMore,
    normalizedSearchQuery,
  ]);

  useEffect(() => {
    if (!openMessageMenuId) return;
    const handlePointerDown = (event) => {
      if (!messageMenuRef.current?.contains(event.target)) setOpenMessageMenuId(null);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setOpenMessageMenuId(null);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMessageMenuId]);

  useEffect(() => {
    const markVisibleChatAsRead = () => {
      if (document.visibilityState === "visible") markMessagesAsRead();
    };
    document.addEventListener("visibilitychange", markVisibleChatAsRead);
    window.addEventListener("focus", markVisibleChatAsRead);
    return () => {
      document.removeEventListener("visibilitychange", markVisibleChatAsRead);
      window.removeEventListener("focus", markVisibleChatAsRead);
    };
  }, [markMessagesAsRead, selectedChat._id]);

  useEffect(() => {
    syncPresenceView();
    const stopCurrentPresenceView = () => stopPresenceView();
    document.addEventListener("visibilitychange", syncPresenceView);
    window.addEventListener("focus", syncPresenceView);
    window.addEventListener("pagehide", stopCurrentPresenceView);
    return () => {
      document.removeEventListener("visibilitychange", syncPresenceView);
      window.removeEventListener("focus", syncPresenceView);
      window.removeEventListener("pagehide", stopCurrentPresenceView);
      stopPresenceView();
    };
  }, [selectedChat._id, selectedChat.isGroup, stopPresenceView, syncPresenceView]);

  useLayoutEffect(() => {
    if (isMessagesLoading || !messages.length || initialScrollChatRef.current === selectedChat._id) {
      return;
    }
    initialScrollChatRef.current = selectedChat._id;
    const unreadCount = Math.min(initialUnreadCountRef.current, messages.length);
    const boundaryMessage = unreadCount > 0 ? messages[messages.length - unreadCount] : null;
    setUnreadBoundaryId(boundaryMessage?._id || null);
    lastMessageIdRef.current = messages[messages.length - 1]?._id || null;

    requestAnimationFrame(() => {
      if (boundaryMessage) {
        document.getElementById(`message-${boundaryMessage._id}`)?.scrollIntoView({ block: "center" });
        isAtBottomRef.current = false;
        setShowScrollButton(true);
      } else {
        scrollToLatestMessage("auto");
      }
    });
  }, [isMessagesLoading, messages, scrollToLatestMessage, selectedChat._id]);

  useEffect(() => {
    if (isMessagesLoading || !messages.length || initialScrollChatRef.current !== selectedChat._id) {
      return;
    }
    const latestMessage = messages[messages.length - 1];
    if (latestMessage._id === lastMessageIdRef.current) return;
    const isOwnMessage = getId(latestMessage.senderId) === authUser._id;
    lastMessageIdRef.current = latestMessage._id;

    if (isOwnMessage || isAtBottomRef.current) {
      requestAnimationFrame(() => scrollToLatestMessage());
    } else {
      setNewMessagesBelow((count) => count + 1);
    }
  }, [authUser._id, isMessagesLoading, messages, scrollToLatestMessage, selectedChat._id]);

  useEffect(() => () => {
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
  }, []);

  if (isMessagesLoading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <ChatHeader
          selectedBackground={chatBackground}
          onBackgroundChange={changeChatBackground}
        />
        <MessageSkeleton />
        <MessageInput />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <ChatHeader
        isSearchOpen={isMessageSearchOpen}
        onToggleSearch={toggleMessageSearch}
        selectedBackground={chatBackground}
        onBackgroundChange={changeChatBackground}
      />

      {isMessageSearchOpen && (
        <div className="message-search-wrap">
          <label className="message-search-box">
          <Search className="size-4 opacity-60" />
          <input
            ref={messageSearchInputRef}
            type="text"
            placeholder="Search messages"
            value={messageSearchQuery}
            onChange={(event) => setMessageSearchQuery(event.target.value)}
            onKeyDown={(event) => event.key === "Escape" && closeMessageSearch()}
          />
          {normalizedSearchQuery && (
            <>
              <span className="message-search-count">
                {filteredMessages.length ? activeSearchIndex + 1 : 0}/{filteredMessages.length}
              </span>
              <button type="button" onClick={() => navigateSearch(-1)} disabled={!filteredMessages.length}>
                <ChevronUp className="size-4" />
              </button>
              <button type="button" onClick={() => navigateSearch(1)} disabled={!filteredMessages.length}>
                <ChevronDown className="size-4" />
              </button>
            </>
          )}
            <button type="button" onClick={closeMessageSearch} title="Close search">
              <X className="size-4" />
            </button>
          </label>
        </div>
      )}

      <div
        ref={messageListRef}
        className={`message-list chat-bg-${chatBackground}`}
        onScroll={handleListScroll}
      >
        {messagePagination.hasMore && (
          <div className="flex justify-center">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleLoadOlder}
              disabled={isLoadingOlderMessages}
            >
              {isLoadingOlderMessages ? "Loading..." : "Load earlier messages"}
            </button>
          </div>
        )}

        {filteredMessages.map((message, index) => {
          const previousMessage = filteredMessages[index - 1];
          const nextMessage = filteredMessages[index + 1];
          const isOwnMessage = getId(message.senderId) === authUser._id;
          const startsMessageGroup = !messagesBelongTogether(previousMessage, message);
          const endsMessageGroup = !messagesBelongTogether(message, nextMessage);
          const startsNewDate =
            !previousMessage ||
            new Date(previousMessage.createdAt).toDateString() !==
              new Date(message.createdAt).toDateString();
          const messageGroupPosition =
            startsMessageGroup && endsMessageGroup
              ? "message-row-single"
              : startsMessageGroup
                ? "message-row-group-start"
                : endsMessageGroup
                  ? "message-row-group-end"
                  : "message-row-group-middle";
          const sender = typeof message.senderId === "object" ? message.senderId : selectedChat;
          const reactionGroups = getReactionGroups(message);

          return (
            <div key={message._id}>
              {startsNewDate && (
                <div className="message-date-separator">
                  <span>{formatDateSeparator(message.createdAt)}</span>
                </div>
              )}
              {unreadBoundaryId === message._id && !normalizedSearchQuery && (
                <div className="message-unread-divider"><span>Unread messages</span></div>
              )}
              <div
                id={`message-${message._id}`}
                className={`chat message-row ${isOwnMessage ? "chat-end" : "chat-start"} ${
                  index > 0
                    ? startsMessageGroup
                      ? "message-row-separated"
                      : "message-row-connected"
                    : ""
                } ${messageGroupPosition} ${
                  highlightedMessageId === message._id ? "message-row-highlighted" : ""
                }`}
              >
                {!isOwnMessage && (
                  <div className="chat-image avatar message-avatar-slot">
                    {endsMessageGroup && (
                      <UserAvatar
                        user={sender}
                        src={sender?.profilePic || selectedChat.profilePic}
                        name={sender?.fullName || selectedChat.fullName}
                        sizeClass="size-9"
                        className="border border-base-300"
                      />
                    )}
                  </div>
                )}
                <div
                  ref={openMessageMenuId === message._id ? messageMenuRef : null}
                  className={`chat-bubble message-bubble group/message relative flex flex-col overflow-visible ${
                    isOwnMessage
                      ? "message-bubble-outgoing bg-primary text-primary-content"
                      : "message-bubble-incoming bg-base-200 text-base-content"
                  } ${message._sendState === "failed" ? "message-bubble-failed" : ""} ${
                    reactionGroups.length > 0 && !message.isDeleted
                      ? "message-bubble-has-reactions"
                      : ""
                  }`}
                >
                  {!message.isDeleted && !message._sendState && editingMessageId !== message._id && (
                    <>
                      <button
                        type="button"
                        className={`message-actions-trigger ${
                          openMessageMenuId === message._id ? "message-actions-trigger-open" : ""
                        }`}
                        onClick={(event) => toggleMessageMenu(message._id, event)}
                        aria-label="Message actions"
                      >
                        <ChevronDown className="size-3" strokeWidth={2.25} />
                      </button>
                      {openMessageMenuId === message._id && (
                        <div
                          className={`message-action-menu message-action-menu-${messageMenuPlacement} ${
                            isOwnMessage ? "message-action-menu-end" : "message-action-menu-start"
                          }`}
                          role="menu"
                        >
                          <div className="message-action-reactions">
                            {QUICK_REACTIONS.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => handleReactionFromMenu(message._id, emoji)}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                          <button type="button" className="message-action-item" onClick={() => handleReply(message)}>
                            <Reply className="size-4" /> Reply
                          </button>
                          <button type="button" className="message-action-item" onClick={() => handleCopy(message)}>
                            <Copy className="size-4" /> {message.text ? "Copy" : "Copy image link"}
                          </button>
                          {isOwnMessage && (
                            <>
                              {message.text && (
                                <button type="button" className="message-action-item" onClick={() => startEditing(message)}>
                                  <Pencil className="size-4" /> Edit
                                </button>
                              )}
                              <div className="message-action-divider" />
                              <button type="button" className="message-action-item message-action-item-danger" onClick={() => handleDelete(message._id)}>
                                <Trash2 className="size-4" /> Delete
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {selectedChat.isGroup && !isOwnMessage && startsMessageGroup && (
                    <div className="message-sender-name">{sender?.fullName || "Someone"}</div>
                  )}

                  {message.replyTo && (
                    <button
                      type="button"
                      className={`message-reply-preview ${
                        isOwnMessage ? "message-reply-preview-outgoing" : "message-reply-preview-incoming"
                      }`}
                      onClick={() => handleQuotedReplyClick(message)}
                    >
                      <div className="message-reply-sender">{getReplySenderName(message.replyTo)}</div>
                      <div className="message-reply-text">{getReplySummary(message.replyTo)}</div>
                    </button>
                  )}

                  {message.isDeleted ? (
                    <p className="italic opacity-70">This message was deleted</p>
                  ) : editingMessageId === message._id ? (
                    <form onSubmit={(event) => handleEditSubmit(event, message._id)} className="message-edit-panel">
                      <label htmlFor={`edit-message-${message._id}`} className="message-edit-label">Edit message</label>
                      <input
                        id={`edit-message-${message._id}`}
                        className="message-edit-input"
                        value={editingText}
                        onChange={(event) => setEditingText(event.target.value)}
                        onKeyDown={(event) => event.key === "Escape" && cancelEditing()}
                        autoFocus
                      />
                      <div className="message-edit-actions">
                        <button type="button" className="message-edit-button message-edit-cancel" onClick={cancelEditing}>
                          <X className="size-3.5" /> Cancel
                        </button>
                        <button type="submit" className="message-edit-button message-edit-save" disabled={!editingText.trim()}>
                          <Check className="size-3.5" /> Save
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      {message.image && (
                        <button
                          type="button"
                          className={`message-media-thumb ${loadedMedia[message._id] ? "message-media-loaded" : ""}`}
                          onClick={() => setViewingMedia({
                            src: message.image,
                            caption: message.text,
                            sender: getReplySenderName(message),
                            createdAt: message.createdAt,
                          })}
                        >
                          <span className="message-media-skeleton" />
                          <img
                            src={message.image}
                            alt={message.text || "Shared attachment"}
                            loading="lazy"
                            onLoad={() => {
                              setLoadedMedia((current) => ({ ...current, [message._id]: true }));
                              if (isAtBottomRef.current) scrollToLatestMessage("auto");
                            }}
                          />
                        </button>
                      )}
                      {message.text && <p className="message-text">{renderHighlightedText(message.text)}</p>}
                    </>
                  )}

                  {!message.isDeleted && reactionGroups.length > 0 && (
                    <div className="message-reaction-counts">
                      {reactionGroups.map((reaction) => (
                        <button
                          key={reaction.emoji}
                          type="button"
                          className={reaction.mine ? "message-reaction-mine" : ""}
                          onClick={() => toggleMessageReaction(message._id, reaction.emoji)}
                        >
                          <span>{reaction.emoji}</span>
                          {reaction.count > 1 && <span>{reaction.count}</span>}
                        </button>
                      ))}
                    </div>
                  )}

                  {editingMessageId !== message._id && (
                    <div className="message-meta">
                      {message.isEdited && !message.isDeleted && <span>edited</span>}
                      <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
                      {renderMessageStatus(message)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {normalizedSearchQuery && filteredMessages.length === 0 && (
          <div className="py-8 text-center text-sm text-base-content/60">No messages found</div>
        )}
      </div>

      {(showScrollButton || newMessagesBelow > 0) && (
        <button type="button" className="scroll-to-latest" onClick={() => scrollToLatestMessage()}>
          <ChevronDown className="size-5" />
          {newMessagesBelow > 0 && <span>{newMessagesBelow > 99 ? "99+" : newMessagesBelow}</span>}
        </button>
      )}

      <MessageInput />
      <SharedNotebookPanel />

      {viewingMedia && (
        <div className="message-media-viewer" role="dialog" aria-modal="true">
          <div className="message-media-viewer-toolbar">
            <div>
              <strong>{viewingMedia.sender}</strong>
              <span>{formatMessageTime(viewingMedia.createdAt)}</span>
            </div>
            <button type="button" onClick={downloadMedia} title="Download image"><Download /></button>
            <button type="button" onClick={() => setViewingMedia(null)} title="Close"><X /></button>
          </div>
          <button type="button" className="message-media-viewer-stage" onClick={() => setViewingMedia(null)}>
            <img src={viewingMedia.src} alt={viewingMedia.caption || "Shared attachment"} />
          </button>
          {viewingMedia.caption && <div className="message-media-caption">{viewingMedia.caption}</div>}
        </div>
      )}
    </div>
  );
};

export default ChatContainer;
