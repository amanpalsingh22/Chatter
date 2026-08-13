import { useEffect, useState } from "react";

const AVATAR_PRESET_COUNT = 8;
const AVATAR_PRESET_CLASSES = [
  "avatar-preset-0",
  "avatar-preset-1",
  "avatar-preset-2",
  "avatar-preset-3",
  "avatar-preset-4",
  "avatar-preset-5",
  "avatar-preset-6",
  "avatar-preset-7",
];

const getAvatarSeed = (user, name) =>
  user?._id || user?.email || user?.username || name || "chatty-user";

const getPresetIndex = (value) => {
  let hash = 0;

  for (const character of String(value)) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return hash % AVATAR_PRESET_COUNT;
};

const getInitials = (name) => {
  const parts = String(name || "User")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0]}${parts.at(-1)[0]}`.toUpperCase();
};

const getInitialTextSize = (sizeClass) => {
  if (sizeClass.includes("size-32")) return "text-4xl";
  if (sizeClass.includes("size-20")) return "text-2xl";
  if (sizeClass.includes("size-16")) return "text-xl";
  if (sizeClass.includes("size-12")) return "text-base";
  return "text-sm";
};

const UserAvatar = ({
  user,
  src,
  name,
  alt,
  sizeClass = "size-10",
  className = "",
}) => {
  const imageSource = src ?? user?.profilePic;
  const displayName = name || user?.fullName || user?.username || "User";
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [imageSource]);

  const presetIndex = getPresetIndex(getAvatarSeed(user, displayName));

  return (
    <div
      className={`${sizeClass} shrink-0 overflow-hidden rounded-full bg-base-200 ring-1 ring-base-content/10 ${className}`}
      title={displayName}
    >
      {imageSource && !imageFailed ? (
        <img
          src={imageSource}
          alt={alt || displayName}
          className="size-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div
          className={`avatar-preset ${AVATAR_PRESET_CLASSES[presetIndex]} ${getInitialTextSize(
            sizeClass
          )}`}
          role="img"
          aria-label={`${displayName} profile`}
        >
          {getInitials(displayName)}
        </div>
      )}
    </div>
  );
};

export default UserAvatar;
