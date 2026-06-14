import { useEffect, useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { AtSign, Calendar, Camera, Clock, Info, Loader2, Mail, Save, User } from "lucide-react";
import toast from "react-hot-toast";

const formatProfileDate = (date) => {
  if (!date) return "Not available";

  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatLastSeen = (date) => {
  if (!date) return "Not available";

  const lastSeenDate = new Date(date);
  const diffInSeconds = Math.floor((Date.now() - lastSeenDate.getTime()) / 1000);

  if (diffInSeconds < 60) return "Just now";
  if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  return lastSeenDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const ProfilePage = () => {
  const { authUser, isUpdatingProfile, updateProfile } = useAuthStore();
  const [selectedImg, setSelectedImg] = useState(null);
  const [formData, setFormData] = useState({
    fullName: "",
    username: "",
    bio: "",
  });

  useEffect(() => {
    if (!authUser) return;

    setFormData({
      fullName: authUser.fullName || "",
      username: authUser.username || "",
      bio: authUser.bio || "",
    });
  }, [authUser]);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.readAsDataURL(file);

    reader.onload = async () => {
      const base64Image = reader.result;
      setSelectedImg(base64Image);
      await updateProfile({ profilePic: base64Image });
      setSelectedImg(null);
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.fullName.trim()) return toast.error("Full name is required");
    if (!/^[a-z0-9_]{3,20}$/.test(formData.username.trim().toLowerCase())) {
      return toast.error("Username must be 3-20 letters, numbers, or underscores");
    }
    if (formData.bio.length > 160) return toast.error("Bio must be 160 characters or less");

    await updateProfile({
      fullName: formData.fullName.trim(),
      username: formData.username.trim().toLowerCase(),
      bio: formData.bio.trim(),
    });
  };

  return (
    <div className="min-h-screen pt-20 bg-base-200">
      <div className="max-w-3xl mx-auto p-4 py-8">
        <div className="bg-base-100 rounded-lg border border-base-300 p-6 space-y-8">
          <div className="text-center">
            <h1 className="text-2xl font-semibold">Profile</h1>
            <p className="mt-2 text-base-content/70">@{authUser?.username || "username"}</p>
          </div>

          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <img
                src={selectedImg || authUser?.profilePic || "/avatar.png"}
                alt="Profile"
                className="size-32 rounded-full object-cover border-4 border-base-300"
              />
              <label
                htmlFor="avatar-upload"
                className={`
                  absolute bottom-0 right-0
                  bg-base-content hover:scale-105
                  p-2 rounded-full cursor-pointer
                  transition-all duration-200
                  ${isUpdatingProfile ? "animate-pulse pointer-events-none" : ""}
                `}
              >
                <Camera className="w-5 h-5 text-base-200" />
                <input
                  type="file"
                  id="avatar-upload"
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={isUpdatingProfile}
                />
              </label>
            </div>
            <p className="text-sm text-zinc-400">
              {isUpdatingProfile ? "Saving..." : "Click the camera icon to update your photo"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <label className="form-control">
              <div className="label">
                <span className="label-text flex items-center gap-2">
                  <User className="size-4" />
                  Full Name
                </span>
              </div>
              <input
                type="text"
                className="input input-bordered w-full"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                disabled={isUpdatingProfile}
              />
            </label>

            <label className="form-control">
              <div className="label">
                <span className="label-text flex items-center gap-2">
                  <AtSign className="size-4" />
                  Username
                </span>
              </div>
              <input
                type="text"
                className="input input-bordered w-full"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                disabled={isUpdatingProfile}
              />
            </label>

            <label className="form-control">
              <div className="label">
                <span className="label-text flex items-center gap-2">
                  <Info className="size-4" />
                  Bio
                </span>
                <span className="label-text-alt">{formData.bio.length}/160</span>
              </div>
              <textarea
                className="textarea textarea-bordered min-h-28 resize-none"
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                disabled={isUpdatingProfile}
              />
            </label>

            <div className="space-y-1.5">
              <div className="text-sm text-zinc-400 flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email Address
              </div>
              <p className="px-4 py-2.5 bg-base-200 rounded-lg border border-base-300">
                {authUser?.email}
              </p>
            </div>

            <button type="submit" className="btn btn-primary w-full" disabled={isUpdatingProfile}>
              {isUpdatingProfile ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="size-4" />
                  Save Profile
                </>
              )}
            </button>
          </form>

          <div className="rounded-lg border border-base-300 bg-base-200 p-5">
            <h2 className="text-lg font-medium mb-4">Account Information</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4 py-2 border-b border-base-300">
                <span className="flex items-center gap-2">
                  <Calendar className="size-4" />
                  Member Since
                </span>
                <span>{formatProfileDate(authUser?.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between gap-4 py-2 border-b border-base-300">
                <span className="flex items-center gap-2">
                  <Clock className="size-4" />
                  Last Seen
                </span>
                <span>{formatLastSeen(authUser?.lastSeen)}</span>
              </div>
              <div className="flex items-center justify-between gap-4 py-2">
                <span>Account Status</span>
                <span className="text-green-500">Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default ProfilePage;
