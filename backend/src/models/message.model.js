import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
    },
    text: {
      type: String,
    },
    image: {
      type: String,
    },
  },
  { timestamps: true }
);

messageSchema.pre("validate", function (next) {
  if (!this.receiverId && !this.groupId) {
    this.invalidate("receiverId", "A message needs either a receiver or a group");
  }

  if (this.receiverId && this.groupId) {
    this.invalidate("groupId", "A message cannot target both a user and a group");
  }

  next();
});

messageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });
messageSchema.index({ receiverId: 1, senderId: 1, createdAt: -1 });
messageSchema.index({ groupId: 1, createdAt: -1 });

const Message = mongoose.model("Message", messageSchema);

export default Message;
