const NOTIFICATION_PREFERENCE_KEY = "chatty.browserNotifications";

const getId = (value) => (typeof value === "object" ? value?._id : value);

export const isNotificationSupported = () => "Notification" in window;

export const getNotificationPermission = () =>
  isNotificationSupported() ? Notification.permission : "unsupported";

export const areNotificationsEnabled = () =>
  isNotificationSupported() &&
  Notification.permission === "granted" &&
  localStorage.getItem(NOTIFICATION_PREFERENCE_KEY) === "enabled";

export const setNotificationsEnabled = (enabled) => {
  localStorage.setItem(NOTIFICATION_PREFERENCE_KEY, enabled ? "enabled" : "disabled");
};

export const requestNotificationPermission = async () => {
  if (!isNotificationSupported()) return "unsupported";

  const permission =
    Notification.permission === "default"
      ? await Notification.requestPermission()
      : Notification.permission;

  setNotificationsEnabled(permission === "granted");
  return permission;
};

const getMessageText = (message) => {
  if (message.text?.trim()) return message.text.trim();
  if (message.image) return "Sent an image";
  return "New message";
};

const truncate = (text, maxLength = 90) =>
  text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;

const isMessageForSelectedChat = (message, selectedChat) => {
  if (!selectedChat) return false;

  if (message.groupId) {
    return selectedChat.isGroup && getId(message.groupId) === selectedChat._id;
  }

  return !selectedChat.isGroup && getId(message.senderId) === selectedChat._id;
};

export const showMessageNotification = ({ message, authUser, selectedChat, chat, onClick }) => {
  if (!areNotificationsEnabled()) return;
  if (getId(message.senderId) === authUser?._id) return;
  if (document.visibilityState === "visible" && isMessageForSelectedChat(message, selectedChat)) {
    return;
  }

  const senderName =
    typeof message.senderId === "object" ? message.senderId.fullName : chat?.fullName;
  const title = message.groupId
    ? `${senderName || "Someone"} in ${chat?.name || "Group"}`
    : senderName || "New message";
  const notification = new Notification(title, {
    body: truncate(getMessageText(message)),
    icon: message.senderId?.profilePic || chat?.profilePic || "/avatar.png",
    tag: `chatty-${getId(message.groupId) || getId(message.senderId)}`,
    renotify: true,
  });

  notification.onclick = () => {
    window.focus();
    onClick?.();
    notification.close();
  };
};
