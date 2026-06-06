import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { useChatStore } from "../store/useChatStore";

const CreateGroupModal = ({ users, onClose }) => {
  const { createGroup } = useChatStore();
  const [name, setName] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [isCreating, setIsCreating] = useState(false);

  const canCreate = useMemo(
    () => name.trim().length >= 2 && selectedMemberIds.length >= 2,
    [name, selectedMemberIds.length]
  );

  const toggleMember = (userId) => {
    setSelectedMemberIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canCreate) return;

    setIsCreating(true);
    try {
      await createGroup({ name: name.trim(), memberIds: selectedMemberIds });
      onClose();
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-base-100 border border-base-300 rounded-lg w-full max-w-md shadow-xl"
      >
        <div className="p-4 border-b border-base-300 flex items-center justify-between">
          <h2 className="font-semibold">Create group</h2>
          <button type="button" className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
            <X className="size-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <input
            className="input input-bordered w-full"
            placeholder="Group name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
          />

          <div className="space-y-2">
            <div className="text-sm font-medium">Members</div>
            <div className="max-h-64 overflow-y-auto border border-base-300 rounded-lg divide-y divide-base-300">
              {users.map((user) => (
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
            <p className="text-xs text-base-content/60">Pick at least 2 people.</p>
          </div>
        </div>

        <div className="p-4 border-t border-base-300 flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!canCreate || isCreating}>
            {isCreating ? "Creating..." : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateGroupModal;
