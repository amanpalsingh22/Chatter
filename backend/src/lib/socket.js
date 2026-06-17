import { Server } from "socket.io";
import http from "http";
import express from "express";
import { clientOrigins } from "./config.js";
import User from "../models/user.model.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: clientOrigins,
  },
});

export function getOnlineSocketIds(userIds) {
  return userIds.flatMap((userId) => [...(userSocketMap.get(userId.toString()) || [])]);
}

// used to store online users
const userSocketMap = new Map(); // userId -> Set<socketId>
const presenceViewMap = new Map(); // `${viewerId}:${recipientId}` -> Set<socketId>

function getOnlineUserIds() {
  return [...userSocketMap.keys()];
}

function getPresenceViewKey(viewerId, recipientId) {
  return `${viewerId}:${recipientId}`;
}

function emitPresencePulse(recipientId, eventName, viewerId) {
  getOnlineSocketIds([recipientId]).forEach((socketId) =>
    io.to(socketId).emit(eventName, { userId: viewerId })
  );
}

function startPresenceView(viewerId, recipientId, socketId) {
  if (!viewerId || !recipientId || viewerId === recipientId) return;

  const presenceKey = getPresenceViewKey(viewerId, recipientId);
  const activeSockets = presenceViewMap.get(presenceKey) || new Set();
  const wasInactive = activeSockets.size === 0;

  activeSockets.add(socketId);
  presenceViewMap.set(presenceKey, activeSockets);

  if (wasInactive) {
    emitPresencePulse(recipientId, "presence:pulse:start", viewerId);
  }
}

function stopPresenceView(viewerId, recipientId, socketId) {
  if (!viewerId || !recipientId || viewerId === recipientId) return;

  const presenceKey = getPresenceViewKey(viewerId, recipientId);
  const activeSockets = presenceViewMap.get(presenceKey);
  if (!activeSockets) return;

  activeSockets.delete(socketId);
  if (activeSockets.size > 0) return;

  presenceViewMap.delete(presenceKey);
  emitPresencePulse(recipientId, "presence:pulse:stop", viewerId);
}

function stopAllPresenceViewsForSocket(viewerId, socketId) {
  if (!viewerId) return;

  [...presenceViewMap.entries()].forEach(([presenceKey, activeSockets]) => {
    const [activeViewerId, recipientId] = presenceKey.split(":");
    if (activeViewerId !== viewerId || !activeSockets.has(socketId)) return;

    stopPresenceView(activeViewerId, recipientId, socketId);
  });
}

async function updateLastSeen(userId) {
  const lastSeen = new Date();
  try {
    await User.findByIdAndUpdate(userId, { lastSeen });
    io.emit("userLastSeen", { userId, lastSeen });
  } catch (error) {
    console.error("Failed to update user last seen:", error.message);
  }
}

io.on("connection", (socket) => {
  console.log("A user connected", socket.id);

  const userId = socket.handshake.query.userId;
  if (userId) {
    const sockets = userSocketMap.get(userId) || new Set();
    sockets.add(socket.id);
    userSocketMap.set(userId, sockets);
    User.findByIdAndUpdate(userId, { lastSeen: new Date() }).catch((error) =>
      console.error("Failed to refresh user last seen:", error.message)
    );
  }

  // io.emit() is used to send events to all the connected clients
  io.emit("getOnlineUsers", getOnlineUserIds());

  socket.on("typing:start", ({ chatId, isGroup, recipientIds = [], fullName }) => {
    if (!userId || !chatId) return;

    getOnlineSocketIds(recipientIds)
      .filter((socketId) => socketId !== socket.id)
      .forEach((socketId) =>
        io.to(socketId).emit("typing:start", {
          chatId,
          isGroup,
          userId,
          fullName,
        })
      );
  });

  socket.on("typing:stop", ({ chatId, isGroup, recipientIds = [] }) => {
    if (!userId || !chatId) return;

    getOnlineSocketIds(recipientIds)
      .filter((socketId) => socketId !== socket.id)
      .forEach((socketId) =>
        io.to(socketId).emit("typing:stop", {
          chatId,
          isGroup,
          userId,
        })
      );
  });

  socket.on("presence:view:start", ({ recipientId }) => {
    startPresenceView(userId, recipientId, socket.id);
  });

  socket.on("presence:view:stop", ({ recipientId }) => {
    stopPresenceView(userId, recipientId, socket.id);
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected", socket.id);
    if (userId) {
      stopAllPresenceViewsForSocket(userId, socket.id);

      const sockets = userSocketMap.get(userId);
      sockets?.delete(socket.id);
      if (!sockets?.size) {
        userSocketMap.delete(userId);
        updateLastSeen(userId);
      }
    }
    io.emit("getOnlineUsers", getOnlineUserIds());
  });
});

export { io, app, server };
