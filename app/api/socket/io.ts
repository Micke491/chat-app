import { Server as NetServer } from "http";
import { NextApiRequest, NextApiResponse } from "next";
import { Server as ServerIO } from "socket.io";
import jwt from "jsonwebtoken";
import { connectDB } from "@/lib/db";
import Message from "@/models/Message";
import Chat from "@/models/Chat";

interface DecodedToken {
  userId?: string;
  id?: string;
  _id?: string;
}

export const config = {
  api: { bodyParser: false },
};

// Extend the type of res.socket to include server with io property
type NextApiResponseWithSocket = NextApiResponse & {
  socket: {
    server: {
      io?: ServerIO;
    } & NetServer;
  };
};

const ioHandler = (req: NextApiRequest, res: NextApiResponseWithSocket) => {
  if (!res.socket?.server?.io) {
    const httpServer: NetServer = res.socket.server;
    const io = new ServerIO(httpServer, {
      path: "/api/socket/io",
      addTrailingSlash: false,
      cors: {
        origin: process.env.NEXT_PUBLIC_SITE_URL,
        methods: ["GET", "POST"],
      },
    });

    // Auth middleware
    io.use((socket, next) => {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error("Authentication error"));
      }
      try {
        const secret = process.env.JWT_SECRET;
        if (!secret) throw new Error("JWT_SECRET missing");
        const decoded = jwt.verify(token, secret) as DecodedToken;
        socket.data.userId = decoded.userId || decoded.id || decoded._id;
        next();
      } catch {
        next(new Error("Authentication error"));
      }
    });

    io.on("connection", (socket) => {
      console.log("User connected:", socket.id, "User ID:", socket.data.userId);

      socket.on("join-chat", async (chatId: string) => {
        try {
          await connectDB();
          const chat = await Chat.findById(chatId);
          if (!chat || !chat.participants.includes(socket.data.userId)) {
            socket.emit("error", "Unauthorized to join chat");
            return;
          }
          socket.join(chatId);
          socket.emit("joined-chat", chatId);
        } catch (error) {
          console.error("Error joining chat:", error);
          socket.emit("error", "Failed to join chat");
        }
      });

      socket.on("send-new-message", async (messageData: { chatId: string; text: string }) => {
        try {
          await connectDB();
          const { chatId, text } = messageData;
          const senderId = socket.data.userId;

          // Validation
          if (!chatId || !text || text.trim().length === 0) {
            socket.emit("error", "Invalid message data");
            return;
          }

          // Check if user is participant
          const chat = await Chat.findById(chatId);
          if (!chat || !chat.participants.includes(senderId)) {
            socket.emit("error", "Unauthorized");
            return;
          }

          // Create message
          const newMessage = await Message.create({
            chatId,
            sender: senderId,
            text: text.trim(),
          });

          await Chat.findByIdAndUpdate(chatId, { lastMessage: newMessage._id });

          // Populate sender for emission
          await newMessage.populate('sender', 'username email');

          io.to(chatId).emit("receive-message", {
            ...newMessage.toObject(),
            createdAt: newMessage.createdAt,
          });
        } catch (error) {
          console.error("Error sending message:", error);
          socket.emit("error", "Failed to send message");
        }
      });

      socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
      });
    });

    res.socket.server.io = io;
  }
  res.end();
};

export default ioHandler;