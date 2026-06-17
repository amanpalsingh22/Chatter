import { Settings, Users, X } from "lucide-react";
import { useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import GroupSettingsModal from "./GroupSettingsModal";
import PresencePulseBadge from "./PresencePulseBadge";

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

const ChatHeader = () => {
  const { selectedChat, setSelectedChat, typingUsers, presencePulseUsers } = useChatStore();
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

  return (
    <div className="p-2.5 border-b border-base-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
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
                  <img src={selectedChat.profilePic || "/avatar.png"} alt={selectedChat.fullName} />
                )}
              </div>
            </div>
            {isPresencePulsing ? (
              <PresencePulseBadge className="bottom-0 right-0" isOnline={isSelectedChatOnline} />
            ) : (
              isSelectedChatOnline && (
                <span className="absolute bottom-0 right-0 size-3 bg-green-500 rounded-full ring-2 ring-zinc-900" />
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
          {selectedChat.isGroup && (
            <button
              className="btn btn-ghost btn-sm btn-circle"
              onClick={() => setIsGroupSettingsOpen(true)}
            >
              <Settings className="size-4" />
            </button>
          )}
          <button className="btn btn-ghost btn-sm btn-circle" onClick={() => setSelectedChat(null)}>
            <X className="size-4" />
          </button>
        </div>
      </div>
      {isGroupSettingsOpen && <GroupSettingsModal onClose={() => setIsGroupSettingsOpen(false)} />}
    </div>
  );
};
export default ChatHeader;
