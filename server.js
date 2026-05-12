import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import http from "http";
import cookieParser from "cookie-parser";
import { Server } from "socket.io";

dotenv.config();

import connectDB from "./config/db.js";
import authRoutes from "./routes/auth.js";
import messageRoutes from "./routes/message.js";
import friendRoutes from "./routes/Friend.js";
import groupRoutes from "./routes/group.js";
import notificationRoutes from "./routes/Notification.js";

connectDB();

const app = express();
const server = http.createServer(app);

// ── Allowed origins ───────────────────────────────────────────────
const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:8081",   // React Native / Expo web
  "http://localhost:8082",   // Expo fallback port
  "http://localhost:19000",  // Expo Go
  "http://localhost:19006",  // Expo web
  /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/,   // LAN / mobile device
  /^http:\/\/10\.0\.\d+\.\d+(:\d+)?$/,      // Android emulator
  /^http:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+(:\d+)?$/,  // Docker bridge
].filter(Boolean);

console.log("✅ CLIENT_URL from .env:", process.env.CLIENT_URL);

const isOriginAllowed = (origin) => {
  if (!origin) return true; // mobile apps / curl — no Origin header
  return allowedOrigins.some((o) =>
    typeof o === "string" ? o === origin : o.test(origin)
  );
};

const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      console.warn("❌ CORS blocked origin:", origin);
      callback(new Error(`CORS policy: origin '${origin}' is not allowed`), false);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// ── Middleware ────────────────────────────────────────────────────
app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

// ── Routes ────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/notifications", notificationRoutes);

app.get("/", (req, res) => res.send("🚀 Server is running..."));

// ── Global error handler ──────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("🔥 Error:", err.message || err.stack);
  if (err.message?.startsWith("CORS policy")) {
    return res.status(403).json({ message: err.message });
  }
  res.status(500).json({ message: "Something went wrong!" });
});

// ── Socket.IO ─────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        console.warn("❌ Socket.IO CORS blocked origin:", origin);
        callback(new Error(`CORS policy: origin '${origin}' is not allowed`), false);
      }
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const onlineUsers = {};

io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);

  socket.on("userOnline", (userId) => {
    onlineUsers[userId] = socket.id;
    io.emit("onlineUsers", Object.keys(onlineUsers));
    console.log("👤 User online:", userId);
  });

  // ── Direct chat typing ──────────────────────────────────────────
  socket.on("typing", ({ senderId, receiverId }) => {
    const receiverSocketId = onlineUsers[receiverId];
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("userTyping", { senderId });
    }
  });

  socket.on("stopTyping", ({ senderId, receiverId }) => {
    const receiverSocketId = onlineUsers[receiverId];
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("userStoppedTyping", { senderId });
    }
  });

  // ── Group typing ──────────────────────────────────────────────────
  socket.on("groupTyping", ({ senderId, senderName, groupId, memberIds }) => {
    if (!Array.isArray(memberIds)) return;
    memberIds.forEach((memberId) => {
      if (memberId.toString() !== senderId.toString()) {
        const sid = onlineUsers[memberId.toString()];
        if (sid) io.to(sid).emit("groupUserTyping", { senderId, senderName, groupId });
      }
    });
  });

  socket.on("groupStopTyping", ({ senderId, groupId, memberIds }) => {
    if (!Array.isArray(memberIds)) return;
    memberIds.forEach((memberId) => {
      if (memberId.toString() !== senderId.toString()) {
        const sid = onlineUsers[memberId.toString()];
        if (sid) io.to(sid).emit("groupUserStoppedTyping", { senderId, groupId });
      }
    });
  });

  socket.on("disconnect", () => {
    console.log("🔴 User disconnected:", socket.id);
    for (const userId in onlineUsers) {
      if (onlineUsers[userId] === socket.id) {
        delete onlineUsers[userId];
        break;
      }
    }
    io.emit("onlineUsers", Object.keys(onlineUsers));
  });
});

export { io, onlineUsers };

const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () =>
  console.log(`🚀 Server running on port ${PORT}`)
);