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
      path: "/api/socket/server",
      addTrailingSlash: false,
      cors: {
        origin: process.env.NEXT_PUBLIC_SITE_URL,
        methods: ["GET", "POST"],
      },
      pingTimeout: 60000,
      pingInterval: 25000,
    });

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
          const userRoom = `user-${socket.data.userId}`;
          socket.join(userRoom);
        } catch (error) {
          console.error("Error joining chat:", error);
          socket.emit("error", "Failed to join chat");
        }
      });
      socket.on("join-notifications", () => {
         const userRoom = `user-${socket.data.userId}`;
         socket.join(userRoom);
         console.log(`User ${socket.data.userId} joined notification channel ${userRoom}`);
      });

      socket.on("send-new-message", async (messageData: { chatId: string; text: string; replyTo?: string }) => {
        try {
          await connectDB();
          const { chatId, text, replyTo } = messageData;
          const senderId = socket.data.userId; 

          if (!chatId || !text.trim()) return;
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
            replyTo: replyTo || undefined,
          });

          await Chat.findByIdAndUpdate(chatId, { 
            lastMessage: newMessage._id,
            updatedAt: new Date() 
          });

          let populatedMessage = await newMessage.populate('sender', 'username email avatar');
          if (replyTo) {
             populatedMessage = await populatedMessage.populate({
                 path: 'replyTo',
                 populate: { path: 'sender', select: 'username' }
             });
          }
          io.to(chatId).emit("receive-message", populatedMessage);
          chat?.participants.forEach((participantId) => {
             io.to(`user-${participantId.toString()}`).emit("chat-update", {
                chatId,
                lastMessage: populatedMessage,
                unreadCount: participantId.toString() !== senderId ? 1 : 0 
             });
          });

        } catch (error) {
          console.error("Socket Message Error:", error);
          socket.emit("error", "Message failed to send");
        }
      });

      socket.on("user-typing", async (data: { chatId: string; username: string }) => {
        try {
          await connectDB();
          const { chatId, username } = data;
          const userId = socket.data.userId;

          if (!chatId || !username) return;

          const chat = await Chat.findById(chatId);
          const isParticipant = chat?.participants.some(p => p.toString() === userId);

          if (!isParticipant) {
            socket.emit("error", "You are not in this chat");
            return;
          }

          socket.to(chatId).emit("user-typing", { username, userId });
        } catch (error) {
          console.error("Error handling typing event:", error);
        }
      });

      socket.on("user-stopped-typing", async (data: { chatId: string; username: string }) => {
        try {
          await connectDB();
          const { chatId, username } = data;
          const userId = socket.data.userId;

          if (!chatId || !username) return;

          const chat = await Chat.findById(chatId);
          const isParticipant = chat?.participants.some(p => p.toString() === userId);

          if (!isParticipant) {
            socket.emit("error", "You are not in this chat");
            return;
          }
          socket.to(chatId).emit("user-stopped-typing", { username, userId });
        } catch (error) {
          console.error("Error handling stopped typing event:", error);
        }
      });

      socket.on("edit-message", async (data: { chatId: string; messageId: string; newText: string }) => {
        try {
            await connectDB();
            const { chatId, messageId, newText } = data;
            const userId = socket.data.userId;

            const message = await Message.findById(messageId);
            if (!message) return;

            if (message.sender.toString() !== userId) {
                socket.emit("error", "Unauthorized to edit this message");
                return;
            }

            message.text = newText;
            message.isEdited = true;
            message.editedAt = new Date();
            await message.save();

            const populatedMessage = await message.populate('sender', 'username email avatar');
            if (message.replyTo) {
                 await populatedMessage.populate({
                     path: 'replyTo',
                     populate: { path: 'sender', select: 'username' }
                 });
            }

            io.to(chatId).emit("message-updated", populatedMessage);
        } catch (error) {
            console.error("Error editing message:", error);
        }
      });

      socket.on("delete-message", async (data: { chatId: string; messageId: string }) => {
        try {
            await connectDB();
            const { chatId, messageId } = data;
            const userId = socket.data.userId;

            const message = await Message.findById(messageId);
            if (!message) return;

            if (message.sender.toString() !== userId) {
                 socket.emit("error", "Unauthorized to delete this message");
                 return;
            }
            message.isDeletedForEveryone = true;
            message.deletedForEveryoneAt = new Date();
            message.text = "This message was deleted"; 
            await message.save();
            
            io.to(chatId).emit("message-deleted", { messageId, chatId });
        } catch (error) {
            console.error("Error deleting message:", error);
        }
      });

      socket.on("mark-messages-read", async (data: { chatId: string; messageIds: string[] }) => {
          try {
              await connectDB();
              const { chatId, messageIds } = data;
              const userId = socket.data.userId;

              await Message.updateMany(
                  { _id: { $in: messageIds } },
                  { 
                      $addToSet: { readBy: { userId, readAt: new Date() } },
                      $set: { status: 'seen' } 
                  }
              );
              io.to(chatId).emit("messages-read", { chatId, messageIds, userId });
          } catch(error) {
              console.error("Error marking read:", error);
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
