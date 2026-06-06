import { Users, X } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";

const ChatHeader = () => {
  const { selectedChat, setSelectedChat } = useChatStore();
  const { onlineUsers } = useAuthStore();

  return (
    <div className="p-2.5 border-b border-base-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="avatar">
            <div className="size-10 rounded-full relative">
              {selectedChat.isGroup ? (
                <div className="size-10 rounded-full bg-primary/15 text-primary flex items-center justify-center">
                  <Users className="size-5" />
                </div>
              ) : (
                <img src={selectedChat.profilePic || "/avatar.png"} alt={selectedChat.fullName} />
              )}
            </div>
          </div>

          {/* User info */}
          <div>
            <h3 className="font-medium">
              {selectedChat.isGroup ? selectedChat.name : selectedChat.fullName}
            </h3>
            <p className="text-sm text-base-content/70">
              {selectedChat.isGroup
                ? `${selectedChat.members.length} members`
                : onlineUsers.includes(selectedChat._id)
                  ? "Online"
                  : "Offline"}
            </p>
          </div>
        </div>

        {/* Close button */}
        <button onClick={() => setSelectedChat(null)}>
          <X />
        </button>
      </div>
    </div>
  );
};
export default ChatHeader;
