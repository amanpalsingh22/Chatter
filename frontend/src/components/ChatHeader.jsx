import { ArrowLeft, BookOpen, Search, Settings, Users, X } from "lucide-react";
import { useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import GroupSettingsModal from "./GroupSettingsModal";
import PresencePulseBadge from "./PresencePulseBadge";
import UserAvatar from "./UserAvatar";
import ChatBackgroundPicker from "./ChatBackgroundPicker";

const formatLastSeen = (date) => {
  if (!date) return "Offline";

  const lastSeenDate = new Date(date);
  const diffInSeconds = Math.floor((Date.now() - lastSeenDate.getTime()) / 1000);

  if (diffInSeconds < 60) return "Last seen just now";
  if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `Last seen ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `Last seen ${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  return `Last seen ${lastSeenDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;
};

const ChatHeader = ({
  isSearchOpen = false,
  onToggleSearch,
  selectedBackground,
  onBackgroundChange,
}) => {
  const {
    presencePulseUsers,
    selectedChat,
    setSelectedChat,
    setSharedNoteOpen,
    sharedNoteUpdatedChatIds,
    typingUsers,
  } = useChatStore();
  const { onlineUsers } = useAuthStore();
  const [isGroupSettingsOpen, setIsGroupSettingsOpen] = useState(false);
  const typingNames = Object.values(typingUsers);
  const typingText =
    typingNames.length === 0
      ? ""
      : selectedChat.isGroup && typingNames.length > 1
        ? `${typingNames[0]} and ${typingNames.length - 1} other${typingNames.length > 2 ? "s" : ""} are typing...`
        : `${typingNames[0]} is typing...`;
  const directChatStatus = onlineUsers.includes(selectedChat._id)
    ? "Online"
    : formatLastSeen(selectedChat.lastSeen);
  const isPresencePulsing = !selectedChat.isGroup && presencePulseUsers[selectedChat._id];
  const isSelectedChatOnline = !selectedChat.isGroup && onlineUsers.includes(selectedChat._id);
  const hasNotebookUpdate =
    !selectedChat.isGroup && Boolean(sharedNoteUpdatedChatIds[selectedChat._id]);

  return (
    <div className="p-2.5 border-b border-base-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-circle md:hidden"
            onClick={() => setSelectedChat(null)}
            title="Back to chats"
          >
            <ArrowLeft className="size-5" />
          </button>
          {/* Avatar */}
          <div className="relative">
            <div className="avatar">
              <div className="size-10 rounded-full">
                {selectedChat.isGroup ? (
                  selectedChat.avatar ? (
                    <img src={selectedChat.avatar} alt={selectedChat.name} />
                  ) : (
                    <div className="size-10 rounded-full bg-primary/15 text-primary flex items-center justify-center">
                      <Users className="size-5" />
                    </div>
                  )
                ) : (
                  <UserAvatar user={selectedChat} sizeClass="size-10" />
                )}
              </div>
            </div>
            {isPresencePulsing ? (
              <PresencePulseBadge className="avatar-online-badge" isOnline={isSelectedChatOnline} />
            ) : (
              isSelectedChatOnline && (
                <span className="avatar-online-badge size-3 bg-green-500 rounded-full" />
              )
            )}
          </div>

          {/* User info */}
          <div>
            <h3 className="font-medium">
              {selectedChat.isGroup ? selectedChat.name : selectedChat.fullName}
            </h3>
            <p className="text-sm text-base-content/70">
              {typingText ||
                (selectedChat.isGroup
                  ? `${selectedChat.members.length} members`
                  : directChatStatus)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {!selectedChat.isGroup && (
            <button
              className="btn btn-ghost btn-sm btn-circle relative"
              onClick={() => setSharedNoteOpen(true)}
              title="Shared notebook"
            >
              <BookOpen className="size-4" />
              {hasNotebookUpdate && (
                <span className="absolute right-1 top-1 size-2 rounded-full bg-warning" />
              )}
            </button>
          )}
          {selectedBackground && onBackgroundChange && (
            <ChatBackgroundPicker
              selectedBackground={selectedBackground}
              onSelect={onBackgroundChange}
            />
          )}
          {onToggleSearch && (
            <button
              type="button"
              className={`btn btn-ghost btn-sm btn-circle ${isSearchOpen ? "bg-base-200 text-primary" : ""}`}
              onClick={onToggleSearch}
              title={isSearchOpen ? "Close message search" : "Search messages"}
            >
              {isSearchOpen ? <X className="size-4" /> : <Search className="size-4" />}
            </button>
          )}
          {selectedChat.isGroup && (
            <button
              className="btn btn-ghost btn-sm btn-circle"
              onClick={() => setIsGroupSettingsOpen(true)}
            >
              <Settings className="size-4" />
            </button>
          )}
          <button className="btn btn-ghost btn-sm btn-circle hidden md:inline-flex" onClick={() => setSelectedChat(null)}>
            <X className="size-4" />
          </button>
        </div>
      </div>
      {isGroupSettingsOpen && <GroupSettingsModal onClose={() => setIsGroupSettingsOpen(false)} />}
    </div>
  );
};
export default ChatHeader;
