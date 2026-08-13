import { Check, Palette, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CHAT_BACKGROUNDS } from "../lib/chatBackgrounds";

const ChatBackgroundPicker = ({ selectedBackground, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const closeOnOutsideClick = (event) => {
      if (!pickerRef.current?.contains(event.target)) setIsOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  const chooseBackground = (backgroundId) => {
    onSelect(backgroundId);
    setIsOpen(false);
  };

  return (
    <div className="chat-background-picker-anchor" ref={pickerRef}>
      <button
        type="button"
        className={`btn btn-ghost btn-sm btn-circle ${isOpen ? "bg-base-200 text-primary" : ""}`}
        onClick={() => setIsOpen((open) => !open)}
        title="Choose chat background"
        aria-label="Choose chat background"
        aria-expanded={isOpen}
      >
        <Palette className="size-4" />
      </button>

      {isOpen && (
        <div className="chat-background-picker" role="dialog" aria-label="Chat backgrounds">
          <div className="chat-background-picker-header">
            <div>
              <strong>Chat background</strong>
              <span>Choose your conversation style</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close background picker"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="chat-background-grid">
            {CHAT_BACKGROUNDS.map((background) => {
              const isSelected = selectedBackground === background.id;
              return (
                <button
                  type="button"
                  key={background.id}
                  className={`chat-background-option ${isSelected ? "chat-background-option-selected" : ""}`}
                  onClick={() => chooseBackground(background.id)}
                  aria-pressed={isSelected}
                >
                  <span className={`chat-background-preview chat-bg-${background.id}`}>
                    {isSelected && (
                      <span className="chat-background-check">
                        <Check className="size-3.5" />
                      </span>
                    )}
                  </span>
                  <span className="chat-background-option-copy">
                    <strong>{background.name}</strong>
                    <small>{background.description}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatBackgroundPicker;
