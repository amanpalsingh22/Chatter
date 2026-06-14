import { useMemo, useRef, useState } from "react";
import { Camera, Crown, LogOut, Trash2, UserPlus, X } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";

const getId = (value) => (typeof value === "object" ? value?._id : value);

const GroupSettingsModal = ({ onClose }) => {
  const {
    addGroupMembers,
    leaveGroup,
    makeGroupAdmin,
    removeGroupMember,
    selectedChat,
    updateGroupDetails,
    users,
  } = useChatStore();
  const { authUser } = useAuthStore();
  const fileInputRef = useRef(null);
  const [name, setName] = useState(selectedChat.name);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  const isAdmin = getId(selectedChat.admin) === authUser._id;
  const memberIds = useMemo(
    () => new Set(selectedChat.members.map((member) => getId(member))),
    [selectedChat.members]
  );
  const availableUsers = users.filter((user) => !memberIds.has(user._id));

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const toggleMember = (userId) => {
    setSelectedMemberIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]
    );
  };

  const handleSaveDetails = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateGroupDetails({ name: name.trim(), avatar: avatarPreview });
      setAvatarPreview(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddMembers = async () => {
    if (selectedMemberIds.length === 0) return;

    setIsSaving(true);
    try {
      await addGroupMembers(selectedMemberIds);
      setSelectedMemberIds([]);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLeaveGroup = async () => {
    await leaveGroup();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-base-100 border border-base-300 rounded-lg w-full max-w-xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-base-300 flex items-center justify-between">
          <h2 className="font-semibold">Group settings</h2>
          <button type="button" className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSaveDetails} className="p-4 space-y-4 border-b border-base-300">
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="relative size-16 rounded-full overflow-hidden bg-primary/15 text-primary flex items-center justify-center"
              onClick={() => isAdmin && fileInputRef.current?.click()}
              disabled={!isAdmin}
            >
              {avatarPreview || selectedChat.avatar ? (
                <img
                  src={avatarPreview || selectedChat.avatar}
                  alt={selectedChat.name}
                  className="size-full object-cover"
                />
              ) : (
                <Camera className="size-6" />
              )}
            </button>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleAvatarChange}
            />
            <input
              className="input input-bordered flex-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!isAdmin}
              maxLength={60}
            />
          </div>
          {isAdmin && (
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={isSaving || !name.trim()}
            >
              Save group
            </button>
          )}
        </form>

        {isAdmin && availableUsers.length > 0 && (
          <div className="p-4 border-b border-base-300 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Add members</h3>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleAddMembers}
                disabled={selectedMemberIds.length === 0 || isSaving}
              >
                <UserPlus className="size-4" />
                Add
              </button>
            </div>
            <div className="max-h-40 overflow-y-auto border border-base-300 rounded-lg divide-y divide-base-300">
              {availableUsers.map((user) => (
                <label
                  key={user._id}
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-base-200"
                >
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={selectedMemberIds.includes(user._id)}
                    onChange={() => toggleMember(user._id)}
                  />
                  <img
                    src={user.profilePic || "/avatar.png"}
                    alt={user.fullName}
                    className="size-9 rounded-full object-cover"
                  />
                  <span className="text-sm font-medium truncate">{user.fullName}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="p-4 border-b border-base-300 space-y-3">
          <h3 className="font-medium">Members</h3>
          <div className="space-y-2">
            {selectedChat.members.map((member) => {
              const memberId = getId(member);
              const memberIsAdmin = memberId === getId(selectedChat.admin);
              const memberIsMe = memberId === authUser._id;

              return (
                <div
                  key={memberId}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-base-200"
                >
                  <img
                    src={member.profilePic || "/avatar.png"}
                    alt={member.fullName}
                    className="size-9 rounded-full object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {member.fullName} {memberIsMe ? "(You)" : ""}
                    </div>
                    <div className="text-xs text-base-content/60">
                      {memberIsAdmin ? "Admin" : member.email}
                    </div>
                  </div>
                  {memberIsAdmin && <Crown className="size-4 text-primary" />}
                  {isAdmin && !memberIsAdmin && (
                    <>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        onClick={() => makeGroupAdmin(memberId)}
                      >
                        Make admin
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs text-error"
                        onClick={() => removeGroupMember(memberId)}
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-4 flex justify-between">
          <button type="button" className="btn btn-error btn-sm" onClick={handleLeaveGroup}>
            <LogOut className="size-4" />
            Leave group
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroupSettingsModal;
