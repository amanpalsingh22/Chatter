import {
  Bold,
  BookOpen,
  ChevronDown,
  IndentDecrease,
  IndentIncrease,
  Italic,
  Link,
  List,
  ListOrdered,
  Smile,
  Underline,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";

const EMPTY_NOTEBOOK = {
  title: "Shared Notebook",
  content: "",
  sections: {
    important: "",
    memories: "",
    links: "",
  },
  todos: [],
};

const EMOJI_OPTIONS = [
  "\u{1F600}",
  "\u{1F601}",
  "\u{1F602}",
  "\u{1F60A}",
  "\u{1F60D}",
  "\u{1F618}",
  "\u{1F917}",
  "\u{1F914}",
  "\u{1F973}",
  "\u{1F97A}",
  "\u{1F60E}",
  "\u{1F634}",
  "\u{1F44B}",
  "\u{1F44D}",
  "\u{1F44F}",
  "\u{1F64C}",
  "\u{1F64F}",
  "\u{1FAF6}",
  "\u{1F495}",
  "\u{1F496}",
  "\u{1F49B}",
  "\u{1F49A}",
  "\u{1F499}",
  "\u{1F49C}",
  "\u{2728}",
  "\u{1F31F}",
  "\u{1F338}",
  "\u{1F33B}",
  "\u{1F389}",
  "\u{1F381}",
  "\u{2615}",
  "\u{1F355}",
  "\u{1F37F}",
  "\u{1F3B5}",
  "\u{1F4A1}",
  "\u{1F4CC}",
  "\u{2705}",
  "\u{1F525}",
  "\u{1F308}",
  "\u{1F319}",
];

const formatEditedTime = (date) => {
  if (!date) return "";

  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const getLastEditorName = (lastEditedBy, authUser) => {
  if (!lastEditedBy) return "";
  if (lastEditedBy._id === authUser?._id) return "you";
  return lastEditedBy.fullName || lastEditedBy.username || "someone";
};

const getSharedContent = (sharedNote) => sharedNote?.shared?.content ?? sharedNote?.content ?? "";

const createSharedNotebookPayload = (content) => ({
  ...EMPTY_NOTEBOOK,
  content,
});

const sanitizeNotebookHtml = (html) => {
  if (!html || typeof document === "undefined") return "";

  const allowedTags = new Set([
    "A",
    "B",
    "BR",
    "DIV",
    "EM",
    "I",
    "LI",
    "OL",
    "P",
    "STRONG",
    "U",
    "UL",
  ]);
  const template = document.createElement("template");
  template.innerHTML = html;

  const cleanNode = (node) => {
    [...node.childNodes].forEach(cleanNode);

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    if (!allowedTags.has(node.tagName)) {
      const fragment = document.createDocumentFragment();
      while (node.firstChild) fragment.appendChild(node.firstChild);
      node.replaceWith(fragment);
      return;
    }

    [...node.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value;

      if (node.tagName === "A" && name === "href" && !value.trim().startsWith("javascript:")) {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noreferrer");
        return;
      }

      node.removeAttribute(attribute.name);
    });
  };

  cleanNode(template.content);
  return template.innerHTML;
};

const SharedNotebookPanel = () => {
  const {
    getSharedNote,
    isSharedNoteLoading,
    isSharedNoteOpen,
    isSharedNoteSaving,
    saveSharedNote,
    selectedChat,
    setSharedNoteOpen,
    sharedNote,
  } = useChatStore();
  const { authUser } = useAuthStore();
  const [content, setContent] = useState("");
  const [lastSyncedContent, setLastSyncedContent] = useState("");
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isListMenuOpen, setIsListMenuOpen] = useState(false);
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    unorderedList: false,
    orderedList: false,
    link: false,
  });
  const contentRef = useRef("");
  const lastSyncedContentRef = useRef("");
  const editorRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const listMenuRef = useRef(null);
  const noteIdRef = useRef(null);
  const selectedChatId = selectedChat?._id;
  const selectedChatIsGroup = selectedChat?.isGroup;

  const getEditorContent = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return contentRef.current;

    return editor.innerText.trim() ? sanitizeNotebookHtml(editor.innerHTML) : "";
  }, []);

  const setEditorContent = useCallback((nextContent) => {
    const editor = editorRef.current;
    if (!editor) return;

    const sanitizedContent = sanitizeNotebookHtml(nextContent);
    if (editor.innerHTML !== sanitizedContent) {
      editor.innerHTML = sanitizedContent;
    }
  }, []);

  const updateActiveFormats = useCallback(() => {
    const readCommandState = (command) => {
      try {
        return document.queryCommandState(command);
      } catch {
        return false;
      }
    };

    const selection = document.getSelection();
    const linkNode = selection?.anchorNode?.parentElement?.closest?.("a");

    setActiveFormats({
      bold: readCommandState("bold"),
      italic: readCommandState("italic"),
      underline: readCommandState("underline"),
      unorderedList: readCommandState("insertUnorderedList"),
      orderedList: readCommandState("insertOrderedList"),
      link: Boolean(linkNode && editorRef.current?.contains(linkNode)),
    });
  }, []);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  useEffect(() => {
    lastSyncedContentRef.current = lastSyncedContent;
  }, [lastSyncedContent]);

  useEffect(() => {
    if (!isSharedNoteOpen || !selectedChatId || selectedChatIsGroup) return;

    getSharedNote(selectedChatId).catch(() => {});
  }, [getSharedNote, isSharedNoteOpen, selectedChatId, selectedChatIsGroup]);

  useEffect(() => {
    if (!isSharedNoteOpen) return;

    const nextContent = getSharedContent(sharedNote);
    const nextNoteId = sharedNote?._id || null;
    const isDifferentNote = noteIdRef.current !== nextNoteId;
    const currentEditorContent =
      document.activeElement === editorRef.current ? getEditorContent() : contentRef.current;
    const hasLocalChanges = currentEditorContent !== lastSyncedContentRef.current;

    if (isDifferentNote || !hasLocalChanges) {
      noteIdRef.current = nextNoteId;
      setContent(nextContent);
      setLastSyncedContent(nextContent);
      setEditorContent(nextContent);
    }
  }, [getEditorContent, isSharedNoteOpen, setEditorContent, sharedNote]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const hasLocalChanges = getEditorContent() !== lastSyncedContentRef.current;
    if (document.activeElement === editor && hasLocalChanges) return;

    setEditorContent(content);
  }, [content, getEditorContent, isSharedNoteOpen, setEditorContent]);

  useEffect(() => {
    if (!isSharedNoteOpen || !selectedChatId || selectedChatIsGroup || isSharedNoteLoading) return;
    if (content === lastSyncedContent) return;

    const timeoutId = setTimeout(async () => {
      try {
        const savedNote = await saveSharedNote({
          notebook: createSharedNotebookPayload(content),
          scope: "shared",
        });
        const savedContent = getSharedContent(savedNote);

        if (savedContent === contentRef.current) {
          setLastSyncedContent(savedContent);
        }
      } catch {
        // The store already shows a toast for save failures.
      }
    }, 700);

    return () => clearTimeout(timeoutId);
  }, [
    content,
    isSharedNoteLoading,
    isSharedNoteOpen,
    lastSyncedContent,
    saveSharedNote,
    selectedChatId,
    selectedChatIsGroup,
  ]);

  useEffect(() => {
    if (!isEmojiPickerOpen) return;

    const handlePointerDown = (event) => {
      if (emojiPickerRef.current?.contains(event.target)) return;
      setIsEmojiPickerOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isEmojiPickerOpen]);

  useEffect(() => {
    if (!isListMenuOpen) return;

    const handlePointerDown = (event) => {
      if (listMenuRef.current?.contains(event.target)) return;
      setIsListMenuOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isListMenuOpen]);

  useEffect(() => {
    if (!isSharedNoteOpen) return;

    const handleSelectionChange = () => {
      const selection = document.getSelection();
      if (!selection?.anchorNode || !editorRef.current?.contains(selection.anchorNode)) return;

      updateActiveFormats();
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, [isSharedNoteOpen, updateActiveFormats]);

  if (!isSharedNoteOpen || !selectedChat || selectedChatIsGroup) return null;

  const isDirty = content !== lastSyncedContent;
  const editorName = getLastEditorName(sharedNote?.lastEditedBy, authUser);
  const editedAt = formatEditedTime(sharedNote?.updatedAt);
  const metaText = editorName && editedAt ? `Last edited by ${editorName} - ${editedAt}` : "No edits yet";
  const saveStatus = isSharedNoteLoading
    ? "Loading..."
    : isSharedNoteSaving
      ? "Saving..."
      : isDirty
        ? "Unsaved"
        : "Saved";

  const handleClose = async () => {
    const latestContent = getEditorContent();
    const shouldIgnoreEmptyHydration =
      latestContent === "" &&
      contentRef.current !== "" &&
      contentRef.current === lastSyncedContentRef.current;
    const contentToSave = shouldIgnoreEmptyHydration ? contentRef.current : latestContent;

    if (contentToSave !== contentRef.current) {
      setContent(contentToSave);
    }

    if (contentToSave !== lastSyncedContentRef.current) {
      try {
        const savedNote = await saveSharedNote({
          notebook: createSharedNotebookPayload(contentToSave),
          scope: "shared",
        });
        const savedContent = getSharedContent(savedNote);

        setContent(savedContent);
        setLastSyncedContent(savedContent);
      } catch {
        return;
      }
    }

    setSharedNoteOpen(false);
  };

  const updateContentFromEditor = () => {
    setContent(getEditorContent());
    updateActiveFormats();
  };

  const runEditorCommand = (command, value = null) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    updateContentFromEditor();
    updateActiveFormats();
  };

  const runListCommand = (command) => {
    runEditorCommand(command);
    setIsListMenuOpen(false);
  };

  const addLink = () => {
    const url = window.prompt("Paste link");
    if (!url?.trim()) return;

    runEditorCommand("createLink", url.trim());
  };

  const insertEmoji = (emoji) => {
    editorRef.current?.focus();
    document.execCommand("insertText", false, emoji);
    updateContentFromEditor();
    setIsEmojiPickerOpen(false);
  };

  const handlePaste = (event) => {
    event.preventDefault();
    document.execCommand("insertText", false, event.clipboardData.getData("text/plain"));
    updateContentFromEditor();
  };

  const handleEditorKeyDown = (event) => {
    const isInList = activeFormats.unorderedList || activeFormats.orderedList;

    if (event.key === "Tab" && isInList) {
      event.preventDefault();
      runEditorCommand(event.shiftKey ? "outdent" : "indent");
    }
  };

  return (
    <div className="absolute inset-0 z-40 flex justify-end bg-transparent">
      <section className="flex h-full w-full flex-col border-l border-base-300 bg-base-100 shadow-2xl sm:w-[440px]">
        <div className="flex items-center justify-between border-b border-base-300 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BookOpen className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold">Shared Notebook</h2>
                <span className="text-xs text-base-content/45">{saveStatus}</span>
              </div>
              <p className="truncate text-xs text-base-content/60">{metaText}</p>
            </div>
          </div>
          <button type="button" className="btn btn-ghost btn-sm btn-circle" onClick={handleClose}>
            <X className="size-4" />
          </button>
        </div>

        <div className="flex items-center justify-between border-b border-base-300 px-4 py-2">
          <div className="flex items-center gap-1 text-base-content/70">
            <button
              type="button"
              className={`notebook-format-button ${activeFormats.bold ? "notebook-format-button-active" : ""}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => runEditorCommand("bold")}
              title="Bold"
            >
              <Bold className="size-4" />
            </button>
            <button
              type="button"
              className={`notebook-format-button ${activeFormats.italic ? "notebook-format-button-active" : ""}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => runEditorCommand("italic")}
              title="Italic"
            >
              <Italic className="size-4" />
            </button>
            <button
              type="button"
              className={`notebook-format-button ${activeFormats.underline ? "notebook-format-button-active" : ""}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => runEditorCommand("underline")}
              title="Underline"
            >
              <Underline className="size-4" />
            </button>
            <div ref={listMenuRef} className="relative">
              <button
                type="button"
                className={`notebook-format-button notebook-list-button ${
                  activeFormats.unorderedList || activeFormats.orderedList
                    ? "notebook-format-button-active"
                    : ""
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setIsListMenuOpen((isOpen) => !isOpen)}
                title="Lists"
              >
                <List className="size-4" />
                <ChevronDown className="size-3" />
              </button>
              {isListMenuOpen && (
                <div className="notebook-list-menu">
                  <button
                    type="button"
                    className={`notebook-list-option ${
                      activeFormats.unorderedList ? "notebook-list-option-active" : ""
                    }`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => runListCommand("insertUnorderedList")}
                  >
                    <List className="size-4" />
                    <span>Bullets</span>
                  </button>
                  <button
                    type="button"
                    className={`notebook-list-option ${
                      activeFormats.orderedList ? "notebook-list-option-active" : ""
                    }`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => runListCommand("insertOrderedList")}
                  >
                    <ListOrdered className="size-4" />
                    <span>Numbers</span>
                  </button>
                  <div className="my-1 h-px bg-base-300" />
                  <button
                    type="button"
                    className="notebook-list-option"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => runListCommand("indent")}
                  >
                    <IndentIncrease className="size-4" />
                    <span>Indent</span>
                  </button>
                  <button
                    type="button"
                    className="notebook-list-option"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => runListCommand("outdent")}
                  >
                    <IndentDecrease className="size-4" />
                    <span>Outdent</span>
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              className={`notebook-format-button ${activeFormats.link ? "notebook-format-button-active" : ""}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={addLink}
              title="Link"
            >
              <Link className="size-4" />
            </button>
          </div>

          <div ref={emojiPickerRef} className="relative">
            <button
              type="button"
              className="notebook-format-button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setIsEmojiPickerOpen((isOpen) => !isOpen)}
              title="Emojis"
            >
              <Smile className="size-4" />
            </button>
            {isEmojiPickerOpen && (
              <div className="notebook-emoji-picker">
                {EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="notebook-emoji-option"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => insertEmoji(emoji)}
                    title={`Add ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div
          ref={editorRef}
          className="shared-notebook-paper notebook-rich-surface min-h-0 flex-1 overflow-y-auto px-8 py-7 pl-14 text-base leading-8 text-base-content outline-none"
          contentEditable={!isSharedNoteLoading}
          data-placeholder="Shared notes..."
          onInput={updateContentFromEditor}
          onFocus={updateActiveFormats}
          onKeyDown={handleEditorKeyDown}
          onKeyUp={updateActiveFormats}
          onMouseUp={updateActiveFormats}
          onPaste={handlePaste}
          role="textbox"
          suppressContentEditableWarning
        />
      </section>
    </div>
  );
};

export default SharedNotebookPanel;
