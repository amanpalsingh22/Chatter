import { useEffect, useRef, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { Image, Send, X } from "lucide-react";
import toast from "react-hot-toast";

const draftsByChat = new Map();

const MessageInput = () => {
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);
  const textInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const { clearReplyTo, replyTo, selectedChat, sendMessage, startTyping, stopTyping } =
    useChatStore();

  const resizeComposer = () => {
    const textarea = textInputRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      stopTyping();
    };
  }, [selectedChat?._id, stopTyping]);

  useEffect(() => {
    const draft = draftsByChat.get(selectedChat?._id) || { text: "", image: null };
    setText(draft.text);
    setImagePreview(draft.image);
    if (fileInputRef.current) fileInputRef.current.value = "";

    const frameId = requestAnimationFrame(() => {
      resizeComposer();
      textInputRef.current?.focus();
    });
    return () => cancelAnimationFrame(frameId);
  }, [selectedChat?._id]);

  useEffect(() => {
    if (!replyTo) return;
    const frameId = requestAnimationFrame(() => textInputRef.current?.focus());
    return () => cancelAnimationFrame(frameId);
  }, [replyTo]);

  useEffect(resizeComposer, [text]);

  const saveDraft = (nextText, nextImage = imagePreview) => {
    if (!selectedChat?._id) return;
    if (nextText || nextImage) {
      draftsByChat.set(selectedChat._id, { text: nextText, image: nextImage });
    } else {
      draftsByChat.delete(selectedChat._id);
    }
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
      saveDraft(text, reader.result);
      requestAnimationFrame(() => textInputRef.current?.focus());
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    saveDraft(text, null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    requestAnimationFrame(() => textInputRef.current?.focus());
  };

  const handleTextChange = (event) => {
    const value = event.target.value;
    setText(value);
    saveDraft(value);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (!value.trim()) {
      stopTyping();
      return;
    }

    startTyping();
    typingTimeoutRef.current = setTimeout(stopTyping, 1200);
  };

  const handleSendMessage = (event) => {
    event?.preventDefault();
    if (!text.trim() && !imagePreview) return;

    const messageData = { text: text.trim(), image: imagePreview };
    setText("");
    setImagePreview(null);
    draftsByChat.delete(selectedChat._id);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    stopTyping();
    void sendMessage(messageData);

    requestAnimationFrame(() => {
      resizeComposer();
      textInputRef.current?.focus();
    });
  };

  const handleComposerKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearReply = () => {
    clearReplyTo();
    requestAnimationFrame(() => textInputRef.current?.focus());
  };

  const replySenderName =
    typeof replyTo?.senderId === "object" ? replyTo.senderId.fullName || "Someone" : "Someone";
  const replySummary = replyTo?.isDeleted
    ? "Deleted message"
    : replyTo?.text || (replyTo?.image ? "Image" : "Message");

  return (
    <div className="message-composer-wrap">
      {replyTo && (
        <div className="message-composer-preview">
          <div className="min-w-0 border-l-2 border-primary pl-3">
            <div className="text-xs font-semibold opacity-70">{replySenderName}</div>
            <div className="truncate text-sm">{replySummary}</div>
          </div>
          <button type="button" className="btn btn-ghost btn-xs btn-circle" onClick={handleClearReply}>
            <X className="size-3" />
          </button>
        </div>
      )}

      {imagePreview && (
        <div className="message-composer-media-preview">
          <img src={imagePreview} alt="Preview" />
          <button onClick={removeImage} type="button" aria-label="Remove attachment">
            <X className="size-3" />
          </button>
        </div>
      )}

      <form onSubmit={handleSendMessage} className="message-composer">
        <textarea
          ref={textInputRef}
          rows={1}
          className="message-composer-input"
          placeholder="Type a message"
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleComposerKeyDown}
        />
        <input
          type="file"
          accept="image/*"
          className="hidden"
          ref={fileInputRef}
          onChange={handleImageChange}
        />
        <button
          type="button"
          className={`message-composer-button ${imagePreview ? "text-primary" : ""}`}
          onClick={() => fileInputRef.current?.click()}
          title="Attach image"
        >
          <Image size={19} />
        </button>
        <button
          type="submit"
          className="message-composer-button message-composer-send"
          disabled={!text.trim() && !imagePreview}
          title="Send message"
        >
          <Send size={19} />
        </button>
      </form>
    </div>
  );
};

export default MessageInput;
