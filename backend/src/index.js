import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";

import path from "path";
import { fileURLToPath } from "url";

import { connectDB } from "./lib/db.js";
import { clientOrigins } from "./lib/config.js";

import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import { app, server } from "./lib/socket.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");

dotenv.config({ path: path.join(rootDir, "backend", ".env") });

const PORT = process.env.PORT || 5001;

app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use(
  cors({
    origin: clientOrigins,
    credentials: true,
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(rootDir, "frontend", "dist")));

  app.get("*", (req, res) => {
    res.sendFile(path.join(rootDir, "frontend", "dist", "index.html"));
  });
}

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log("server is running on PORT:" + PORT);
  });
});
