import { Server } from "socket.io";
import http from "http";
import express from "express";
import { clientOrigins } from "./config.js";

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

function getOnlineUserIds() {
  return [...userSocketMap.keys()];
}

io.on("connection", (socket) => {
  console.log("A user connected", socket.id);

  const userId = socket.handshake.query.userId;
  if (userId) {
    const sockets = userSocketMap.get(userId) || new Set();
    sockets.add(socket.id);
    userSocketMap.set(userId, sockets);
  }

  // io.emit() is used to send events to all the connected clients
  io.emit("getOnlineUsers", getOnlineUserIds());

  socket.on("disconnect", () => {
    console.log("A user disconnected", socket.id);
    if (userId) {
      const sockets = userSocketMap.get(userId);
      sockets?.delete(socket.id);
      if (!sockets?.size) userSocketMap.delete(userId);
    }
    io.emit("getOnlineUsers", getOnlineUserIds());
  });
});

export { io, app, server };
