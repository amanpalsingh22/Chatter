import mongoose from "mongoose";

const notebookSectionsSchema = new mongoose.Schema(
  {
    important: {
      type: String,
      default: "",
      maxlength: 8000,
    },
    memories: {
      type: String,
      default: "",
      maxlength: 8000,
    },
    links: {
      type: String,
      default: "",
      maxlength: 8000,
    },
  },
  { _id: false }
);

const notebookTodoSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 250,
    },
    completed: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const notebookDataSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: "",
      trim: true,
      maxlength: 80,
    },
    content: {
      type: String,
      default: "",
      maxlength: 20000,
    },
    sections: {
      type: notebookSectionsSchema,
      default: () => ({}),
    },
    todos: {
      type: [notebookTodoSchema],
      default: [],
      validate: {
        validator: (todos) => todos.length <= 50,
        message: "A notebook can have up to 50 checklist items",
      },
    },
  },
  { _id: false }
);

const sharedNoteSchema = new mongoose.Schema(
  {
    participantKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    shared: {
      type: notebookDataSchema,
      default: () => ({}),
    },
    privateNotes: {
      type: Map,
      of: notebookDataSchema,
      default: () => ({}),
    },
    // Kept for older notebook documents created before the structured editor.
    content: {
      type: String,
      default: "",
      maxlength: 20000,
    },
    lastEditedScope: {
      type: String,
      enum: ["shared", "private"],
      default: "shared",
    },
    lastEditedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

sharedNoteSchema.pre("validate", function (next) {
  if (this.participants.length !== 2) {
    this.invalidate("participants", "A shared note must have exactly two participants");
  }

  next();
});

const SharedNote = mongoose.model("SharedNote", sharedNoteSchema);

export default SharedNote;
