import { useEffect, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import SidebarSkeleton from "./skeletons/SidebarSkeleton";
import CreateGroupModal from "./CreateGroupModal";
import { Plus, Users } from "lucide-react";

const Sidebar = () => {
  const {
    getUsers,
    users,
    groups,
    selectedChat,
    setSelectedChat,
    isUsersLoading,
    addIncomingGroup,
  } = useChatStore();

  const { onlineUsers, socket } = useAuthStore();
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);

  useEffect(() => {
    getUsers();
  }, [getUsers]);

  useEffect(() => {
    if (!socket) return;

    socket.on("newGroup", addIncomingGroup);
    return () => socket.off("newGroup", addIncomingGroup);
  }, [socket, addIncomingGroup]);

  const filteredUsers = showOnlineOnly
    ? users.filter((user) => onlineUsers.includes(user._id))
    : users;

  if (isUsersLoading) return <SidebarSkeleton />;

  return (
    <aside className="h-full w-20 lg:w-72 border-r border-base-300 flex flex-col transition-all duration-200">
      <div className="border-b border-base-300 w-full p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="size-6" />
            <span className="font-medium hidden lg:block">Chats</span>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-circle"
            onClick={() => setIsGroupModalOpen(true)}
            title="Create group"
          >
            <Plus className="size-5" />
          </button>
        </div>
        <div className="mt-3 hidden lg:flex items-center gap-2">
          <label className="cursor-pointer flex items-center gap-2">
            <input
              type="checkbox"
              checked={showOnlineOnly}
              onChange={(e) => setShowOnlineOnly(e.target.checked)}
              className="checkbox checkbox-sm"
            />
            <span className="text-sm">Show online only</span>
          </label>
          <span className="text-xs text-zinc-500">({onlineUsers.length - 1} online)</span>
        </div>
      </div>

      <div className="overflow-y-auto w-full py-3">
        {groups.length > 0 && (
          <>
            <div className="hidden lg:block px-3 pb-2 text-xs font-semibold uppercase text-base-content/50">
              Groups
            </div>
            {groups.map((group) => (
              <button
                key={group._id}
                onClick={() => setSelectedChat({ ...group, isGroup: true })}
                className={`
                  w-full p-3 flex items-center gap-3
                  hover:bg-base-300 transition-colors
                  ${selectedChat?._id === group._id ? "bg-base-300 ring-1 ring-base-300" : ""}
                `}
              >
                <div className="relative mx-auto lg:mx-0">
                  <div className="size-12 rounded-full bg-primary/15 text-primary flex items-center justify-center">
                    <Users className="size-6" />
                  </div>
                </div>

                <div className="hidden lg:block text-left min-w-0">
                  <div className="font-medium truncate">{group.name}</div>
                  <div className="text-sm text-zinc-400">{group.members.length} members</div>
                </div>
              </button>
            ))}
          </>
        )}

        <div className="hidden lg:block px-3 py-2 text-xs font-semibold uppercase text-base-content/50">
          Contacts
        </div>
        {filteredUsers.map((user) => (
          <button
            key={user._id}
            onClick={() => setSelectedChat({ ...user, isGroup: false })}
            className={`
              w-full p-3 flex items-center gap-3
              hover:bg-base-300 transition-colors
              ${selectedChat?._id === user._id ? "bg-base-300 ring-1 ring-base-300" : ""}
            `}
          >
            <div className="relative mx-auto lg:mx-0">
              <img
                src={user.profilePic || "/avatar.png"}
                alt={user.name}
                className="size-12 object-cover rounded-full"
              />
              {onlineUsers.includes(user._id) && (
                <span
                  className="absolute bottom-0 right-0 size-3 bg-green-500 
                  rounded-full ring-2 ring-zinc-900"
                />
              )}
            </div>

            {/* User info - only visible on larger screens */}
            <div className="hidden lg:block text-left min-w-0">
              <div className="font-medium truncate">{user.fullName}</div>
              <div className="text-sm text-zinc-400">
                {onlineUsers.includes(user._id) ? "Online" : "Offline"}
              </div>
            </div>
          </button>
        ))}

        {filteredUsers.length === 0 && (
          <div className="text-center text-zinc-500 py-4">
            {showOnlineOnly ? "No online users" : "No contacts yet"}
          </div>
        )}
      </div>

      {isGroupModalOpen && (
        <CreateGroupModal users={users} onClose={() => setIsGroupModalOpen(false)} />
      )}
    </aside>
  );
};
export default Sidebar;
