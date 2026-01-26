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
          const senderId = socket.data.userId; // From the auth middleware

          if (!chatId || !text.trim()) return;

          // Fix: Validate participant using string comparison
          const chat = await Chat.findById(chatId);
          const isParticipant = chat?.participants.some(p => p.toString() === senderId);

          if (!isParticipant) {
            socket.emit("error", "You are not in this chat");
            return;
          }

          const newMessage = await Message.create({
            chatId,
            sender: senderId,
            text: text.trim(),
          });

          await Chat.findByIdAndUpdate(chatId, { 
            lastMessage: newMessage._id,
            updatedAt: new Date() // Forces the chat list to re-order
          });

          const populatedMessage = await newMessage.populate('sender', 'username email avatar');

          // Emit to everyone in the room INCLUDING the sender
          io.to(chatId).emit("receive-message", populatedMessage);

        } catch (error) {
          console.error("Socket Message Error:", error);
          socket.emit("error", "Message failed to send");
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