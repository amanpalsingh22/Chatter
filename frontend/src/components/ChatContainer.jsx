import { useChatStore } from "../store/useChatStore";
import { useEffect, useRef, useState } from "react";

import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import { useAuthStore } from "../store/useAuthStore";
import { formatMessageTime } from "../lib/utils";
import { Check, CheckCheck, Pencil, Reply, Search, Trash2, X } from "lucide-react";

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
    selectedChat,
    setReplyTo,
    markMessagesAsRead,
    shouldScrollToBottom,
    subscribeToMessages,
    unsubscribeFromMessages,
  } = useChatStore();
  const { authUser } = useAuthStore();
  const messageEndRef = useRef(null);
  const [messageSearchQuery, setMessageSearchQuery] = useState("");
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState("");

  const getSenderId = (senderId) => (typeof senderId === "object" ? senderId._id : senderId);
  const getReceiptUserId = (receipt) =>
    typeof receipt.userId === "object" ? receipt.userId?._id : receipt.userId;

  const hasReceiptFromUser = (receipts = [], userId) =>
    receipts.some((receipt) => getReceiptUserId(receipt) === userId);

  const getMessageStatus = (message) => {
    if (getSenderId(message.senderId) !== authUser._id) return null;

    if (selectedChat.isGroup) {
      const memberIds = selectedChat.members
        .map((member) => (typeof member === "object" ? member._id : member))
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

    if (status === "seen") {
      return <span className="text-xs opacity-60 ml-1">Seen</span>;
    }

    if (status === "delivered") {
      return <CheckCheck className="inline size-3 opacity-60 ml-1" />;
    }

    return <Check className="inline size-3 opacity-60 ml-1" />;
  };

  const getReplySummary = (message) => {
    if (!message) return "";
    if (message.isDeleted) return "Deleted message";
    return message.text || (message.image ? "Image" : "Message");
  };

  const getReplySenderName = (message) => {
    const sender = message?.senderId;
    if (!sender) return "";
    if (typeof sender === "object") return sender.fullName || "Someone";
    return sender === authUser._id ? "You" : "Someone";
  };

  const startEditing = (message) => {
    setEditingMessageId(message._id);
    setEditingText(message.text || "");
  };

  const cancelEditing = () => {
    setEditingMessageId(null);
    setEditingText("");
  };

  const handleEditSubmit = async (e, messageId) => {
    e.preventDefault();
    if (!editingText.trim()) return;

    await editMessage(messageId, editingText.trim());
    cancelEditing();
  };

  const filteredMessages = messages.filter((message) => {
    const query = messageSearchQuery.trim().toLowerCase();
    if (!query) return true;

    return (
      message.text?.toLowerCase().includes(query) ||
      message.replyTo?.text?.toLowerCase().includes(query) ||
      getReplySenderName(message.replyTo).toLowerCase().includes(query)
    );
  });

  useEffect(() => {
    getMessages(selectedChat._id);

    subscribeToMessages();

    return () => unsubscribeFromMessages();
  }, [selectedChat._id, getMessages, subscribeToMessages, unsubscribeFromMessages]);

  useEffect(() => {
    const markVisibleChatAsRead = () => {
      if (document.visibilityState === "visible") {
        markMessagesAsRead();
      }
    };

    document.addEventListener("visibilitychange", markVisibleChatAsRead);
    window.addEventListener("focus", markVisibleChatAsRead);

    return () => {
      document.removeEventListener("visibilitychange", markVisibleChatAsRead);
      window.removeEventListener("focus", markVisibleChatAsRead);
    };
  }, [markMessagesAsRead, selectedChat._id]);

  useEffect(() => {
    if (shouldScrollToBottom && messageEndRef.current && messages) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, shouldScrollToBottom]);

  if (isMessagesLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-auto">
        <ChatHeader />
        <MessageSkeleton />
        <MessageInput />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      <ChatHeader />

      <div className="px-4 pt-3">
        <label className="input input-bordered input-sm flex items-center gap-2">
          <Search className="size-4 opacity-60" />
          <input
            type="text"
            className="grow"
            placeholder="Search messages..."
            value={messageSearchQuery}
            onChange={(e) => setMessageSearchQuery(e.target.value)}
          />
        </label>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messagePagination.hasMore && (
          <div className="flex justify-center">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={loadOlderMessages}
              disabled={isLoadingOlderMessages}
            >
              {isLoadingOlderMessages ? "Loading..." : "Load earlier messages"}
            </button>
          </div>
        )}

        {filteredMessages.map((message) => (
          <div
            key={message._id}
            className={`chat ${getSenderId(message.senderId) === authUser._id ? "chat-end" : "chat-start"}`}
            ref={messageEndRef}
          >
            <div className=" chat-image avatar">
              <div className="size-10 rounded-full border">
                <img
                  src={
                    getSenderId(message.senderId) === authUser._id
                      ? authUser.profilePic || "/avatar.png"
                      : message.senderId?.profilePic || selectedChat.profilePic || "/avatar.png"
                  }
                  alt="profile pic"
                />
              </div>
            </div>
            <div className="chat-header mb-1">
              {selectedChat.isGroup && getSenderId(message.senderId) !== authUser._id && (
                <span className="text-xs font-medium">{message.senderId?.fullName}</span>
              )}
              <time className="text-xs opacity-50 ml-1">
                {formatMessageTime(message.createdAt)}
              </time>
              {renderMessageStatus(message)}
              {!message.isDeleted && (
                <span className="inline-flex items-center gap-1 ml-2 opacity-70">
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs btn-circle"
                    onClick={() => setReplyTo(message)}
                    title="Reply"
                  >
                    <Reply className="size-3" />
                  </button>
                  {getSenderId(message.senderId) === authUser._id && (
                    <>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs btn-circle"
                        onClick={() => startEditing(message)}
                        title="Edit"
                        disabled={!message.text}
                      >
                        <Pencil className="size-3" />
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs btn-circle text-error"
                        onClick={() => deleteMessage(message._id)}
                        title="Delete"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </>
                  )}
                </span>
              )}
            </div>
            <div className="chat-bubble flex flex-col">
              {message.replyTo && (
                <button
                  type="button"
                  className="mb-2 border-l-2 border-primary/70 bg-base-300/40 px-3 py-2 rounded text-left"
                  onClick={() => setReplyTo(message.replyTo)}
                >
                  <div className="text-xs font-semibold opacity-70">
                    {getReplySenderName(message.replyTo)}
                  </div>
                  <div className="text-xs opacity-80 line-clamp-2">
                    {getReplySummary(message.replyTo)}
                  </div>
                </button>
              )}
              {message.isDeleted ? (
                <p className="italic opacity-70">This message was deleted</p>
              ) : editingMessageId === message._id ? (
                <form onSubmit={(e) => handleEditSubmit(e, message._id)} className="space-y-2">
                  <input
                    className="input input-bordered input-sm w-full"
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    autoFocus
                  />
                  <div className="flex justify-end gap-1">
                    <button type="button" className="btn btn-ghost btn-xs" onClick={cancelEditing}>
                      <X className="size-3" />
                    </button>
                    <button type="submit" className="btn btn-primary btn-xs">
                      <Check className="size-3" />
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  {message.image && (
                    <img
                      src={message.image}
                      alt="Attachment"
                      className="sm:max-w-[200px] rounded-md mb-2"
                    />
                  )}
                  {message.text && <p>{message.text}</p>}
                  {message.isEdited && (
                    <span className="text-[10px] opacity-60 self-end mt-1">edited</span>
                  )}
                </>
              )}
            </div>
          </div>
        ))}

        {messageSearchQuery.trim() && filteredMessages.length === 0 && (
          <div className="text-center text-sm text-base-content/60 py-6">No messages found</div>
        )}
      </div>

      <MessageInput />
    </div>
  );
};
export default ChatContainer;
