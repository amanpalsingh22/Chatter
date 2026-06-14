import { useEffect, useRef, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { Image, Send, X } from "lucide-react";
import toast from "react-hot-toast";

const MessageInput = () => {
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const { clearReplyTo, isSendingMessage, replyTo, selectedChat, sendMessage, startTyping, stopTyping } =
    useChatStore();

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      stopTyping();
    };
  }, [selectedChat?._id, stopTyping]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleTextChange = (e) => {
    const value = e.target.value;
    setText(value);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    if (!value.trim()) {
      stopTyping();
      return;
    }

    startTyping();
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 1200);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (isSendingMessage) return;
    if (!text.trim() && !imagePreview) return;

    const messageData = {
      text: text.trim(),
      image: imagePreview,
    };

    setText("");
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    stopTyping();

    try {
      await sendMessage(messageData);
    } catch (error) {
      console.error("Failed to send message:", error);
      setText(messageData.text);
      setImagePreview(messageData.image);
    }
  };

  const getReplySenderName = () => {
    if (!replyTo?.senderId) return "";
    if (typeof replyTo.senderId === "object") return replyTo.senderId.fullName || "Someone";
    return "Someone";
  };

  const getReplySummary = () => {
    if (!replyTo) return "";
    if (replyTo.isDeleted) return "Deleted message";
    return replyTo.text || (replyTo.image ? "Image" : "Message");
  };

  return (
    <div className="p-4 w-full">
      {replyTo && (
        <div className="mb-3 flex items-start justify-between gap-3 rounded-lg border border-base-300 bg-base-200 p-3">
          <div className="min-w-0 border-l-2 border-primary pl-3">
            <div className="text-xs font-semibold opacity-70">{getReplySenderName()}</div>
            <div className="text-sm truncate">{getReplySummary()}</div>
          </div>
          <button type="button" className="btn btn-ghost btn-xs btn-circle" onClick={clearReplyTo}>
            <X className="size-3" />
          </button>
        </div>
      )}

      {imagePreview && (
        <div className="mb-3 flex items-center gap-2">
          <div className="relative">
            <img
              src={imagePreview}
              alt="Preview"
              className="w-20 h-20 object-cover rounded-lg border border-zinc-700"
            />
            <button
              onClick={removeImage}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-base-300
              flex items-center justify-center"
              type="button"
            >
              <X className="size-3" />
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSendMessage} className="flex items-center gap-2">
        <div className="flex-1 flex gap-2">
          <input
            type="text"
            className="w-full input input-bordered rounded-lg input-sm sm:input-md"
            placeholder="Type a message..."
            value={text}
            disabled={isSendingMessage}
            onChange={handleTextChange}
          />
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            disabled={isSendingMessage}
            onChange={handleImageChange}
          />

          <button
            type="button"
            className={`hidden sm:flex btn btn-circle
                     ${imagePreview ? "text-emerald-500" : "text-zinc-400"}`}
            onClick={() => fileInputRef.current?.click()}
            disabled={isSendingMessage}
          >
            <Image size={20} />
          </button>
        </div>
        <button
          type="submit"
          className="btn btn-sm btn-circle"
          disabled={isSendingMessage || (!text.trim() && !imagePreview)}
        >
          <Send size={22} />
        </button>
      </form>
    </div>
  );
};
export default MessageInput;
