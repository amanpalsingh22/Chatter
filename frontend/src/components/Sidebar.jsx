import { useEffect, useRef, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import SidebarSkeleton from "./skeletons/SidebarSkeleton";
import CreateGroupModal from "./CreateGroupModal";
import PresencePulseBadge from "./PresencePulseBadge";
import { Plus, Search, Users, X } from "lucide-react";
import UserAvatar from "./UserAvatar";

const Sidebar = () => {
  const {
    addUnreadForMessage,
    getUsers,
    users,
    groups,
    selectedChat,
    setSelectedChat,
    isUsersLoading,
    addIncomingGroup,
    updateGroupInState,
    updateUserPresence,
    removeGroupFromState,
    presencePulseUsers,
    handlePresencePulseStart,
    handlePresencePulseStop,
    applySharedNoteUpdate,
    sharedNoteUpdatedChatIds,
  } = useChatStore();

  const { onlineUsers, socket } = useAuthStore();
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isContactSearchOpen, setIsContactSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef(null);

  useEffect(() => {
    getUsers();
  }, [getUsers]);

  useEffect(() => {
    if (!isContactSearchOpen) return;
    const frameId = requestAnimationFrame(() => searchInputRef.current?.focus());
    return () => cancelAnimationFrame(frameId);
  }, [isContactSearchOpen]);

  const closeContactSearch = () => {
    setIsContactSearchOpen(false);
    setSearchQuery("");
  };

  useEffect(() => {
    if (!socket) return;

    socket.on("newGroup", addIncomingGroup);
    socket.on("groupUpdated", updateGroupInState);
    socket.on("groupRemoved", ({ groupId }) => removeGroupFromState(groupId));
    socket.on("newMessage", addUnreadForMessage);
    socket.on("userLastSeen", updateUserPresence);
    socket.on("presence:pulse:start", handlePresencePulseStart);
    socket.on("presence:pulse:stop", handlePresencePulseStop);
    socket.on("sharedNote:updated", applySharedNoteUpdate);

    return () => {
      socket.off("newGroup", addIncomingGroup);
      socket.off("groupUpdated", updateGroupInState);
      socket.off("groupRemoved");
      socket.off("newMessage", addUnreadForMessage);
      socket.off("userLastSeen", updateUserPresence);
      socket.off("presence:pulse:start", handlePresencePulseStart);
      socket.off("presence:pulse:stop", handlePresencePulseStop);
      socket.off("sharedNote:updated", applySharedNoteUpdate);
    };
  }, [
    socket,
    addIncomingGroup,
    updateGroupInState,
    updateUserPresence,
    removeGroupFromState,
    addUnreadForMessage,
    handlePresencePulseStart,
    handlePresencePulseStop,
    applySharedNoteUpdate,
  ]);

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const filteredUsers = showOnlineOnly
    ? users.filter((user) => onlineUsers.includes(user._id))
    : users;
  const searchedUsers = filteredUsers.filter((user) => {
    const searchableText = `${user.fullName} ${user.username || ""} ${user.email || ""}`.toLowerCase();
    return searchableText.includes(normalizedSearchQuery);
  });
  const searchedGroups = groups.filter((group) =>
    group.name.toLowerCase().includes(normalizedSearchQuery)
  );

  if (isUsersLoading) return <SidebarSkeleton />;

  return (
    <aside className="h-full w-full md:w-20 lg:w-72 border-r border-base-300 flex flex-col transition-all duration-200">
      <div className="border-b border-base-300 w-full p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="size-6" />
            <span className="font-medium block md:hidden lg:block">Chats</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className={`btn btn-ghost btn-sm btn-circle ${isContactSearchOpen ? "bg-base-200 text-primary" : ""}`}
              onClick={() => (isContactSearchOpen ? closeContactSearch() : setIsContactSearchOpen(true))}
              title={isContactSearchOpen ? "Close contact search" : "Search contacts"}
            >
              {isContactSearchOpen ? <X className="size-4" /> : <Search className="size-4" />}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-circle"
              onClick={() => setIsGroupModalOpen(true)}
              title="Create group"
            >
              <Plus className="size-5" />
            </button>
          </div>
        </div>
        <div className="mt-3 flex md:hidden lg:flex items-center gap-2">
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
        {isContactSearchOpen && (
          <label className="sidebar-search-box mt-3 flex md:hidden lg:flex">
            <Search className="size-4 opacity-55" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search chats"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && closeContactSearch()}
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery("")} title="Clear search">
                <X className="size-3.5" />
              </button>
            )}
          </label>
        )}
      </div>

      <div className="overflow-y-auto w-full py-3">
        {searchedGroups.length > 0 && (
          <>
            <div className="block md:hidden lg:block px-3 pb-2 text-xs font-semibold uppercase text-base-content/50">
              Groups
            </div>
            {searchedGroups.map((group) => (
              <button
                key={group._id}
                onClick={() => setSelectedChat({ ...group, isGroup: true })}
                className={`
                  w-full p-3 flex items-center gap-3
                  hover:bg-base-300 transition-colors
                  ${selectedChat?._id === group._id ? "bg-base-300 ring-1 ring-base-300" : ""}
                `}
              >
                <div className="relative mx-0 md:mx-auto lg:mx-0">
                  {group.avatar ? (
                    <img
                      src={group.avatar}
                      alt={group.name}
                      className="size-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="size-12 rounded-full bg-primary/15 text-primary flex items-center justify-center">
                      <Users className="size-6" />
                    </div>
                  )}
                  {group.unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-primary text-primary-content text-xs flex items-center justify-center">
                      {group.unreadCount > 99 ? "99+" : group.unreadCount}
                    </span>
                  )}
                </div>

                <div className="block md:hidden lg:block text-left min-w-0">
                  <div className="font-medium truncate">{group.name}</div>
                  <div className="text-sm text-zinc-400">{group.members.length} members</div>
                </div>
              </button>
            ))}
          </>
        )}

        <div className="block md:hidden lg:block px-3 py-2 text-xs font-semibold uppercase text-base-content/50">
          Contacts
        </div>
        {searchedUsers.map((user) => {
          const isUserOnline = onlineUsers.includes(user._id);
          const isPresencePulsing = presencePulseUsers[user._id];
          const hasNotebookUpdate = sharedNoteUpdatedChatIds[user._id];

          return (
            <button
              key={user._id}
              onClick={() => setSelectedChat({ ...user, isGroup: false })}
              className={`
                w-full p-3 flex items-center gap-3
                hover:bg-base-300 transition-colors
                ${selectedChat?._id === user._id ? "bg-base-300 ring-1 ring-base-300" : ""}
              `}
            >
              <div className="relative mx-0 md:mx-auto lg:mx-0">
                <UserAvatar user={user} sizeClass="size-12" />
                {isPresencePulsing ? (
                  <PresencePulseBadge className="avatar-online-badge" isOnline={isUserOnline} />
                ) : (
                  isUserOnline && (
                    <span
                      className="avatar-online-badge size-3 bg-green-500 
                      rounded-full"
                    />
                  )
                )}
                {user.unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-primary text-primary-content text-xs flex items-center justify-center">
                    {user.unreadCount > 99 ? "99+" : user.unreadCount}
                  </span>
                )}
                {hasNotebookUpdate && (
                  <span
                    className="absolute -bottom-1 -left-1 size-3 rounded-full bg-warning ring-2 ring-base-100"
                    title="Notebook updated"
                  />
                )}
              </div>

              {/* User info - only visible on larger screens */}
              <div className="block md:hidden lg:block text-left min-w-0">
                <div className="font-medium truncate">{user.fullName}</div>
                <div className="text-sm text-zinc-400">
                  {isUserOnline
                    ? "Online"
                    : user.username
                      ? `@${user.username}`
                      : "Offline"}
                </div>
              </div>
            </button>
          );
        })}

        {searchedUsers.length === 0 && searchedGroups.length === 0 && (
          <div className="text-center text-zinc-500 py-4">
            {normalizedSearchQuery
              ? "No chats found"
              : showOnlineOnly
                ? "No online users"
                : "No contacts yet"}
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
