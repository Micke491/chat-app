import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Message from '@/models/Message';
import Chat from '@/models/Chat';
import { verifyToken } from '@/lib/auth';

// Handle POST request to create a new message
export async function POST(req: Request) {
    try {
        await connectDB();
        const auth = verifyToken(req);
        if (!auth) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { chatId, senderId, text } = await req.json();

        // Validation
        if (!chatId || !senderId || !text || text.trim().length === 0) {
            return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
        }

        if (auth.id !== senderId) {
            return NextResponse.json({ error: "Unauthorized sender" }, { status: 403 });
        }

        // Check if user is participant in chat
        const chat = await Chat.findById(chatId);
        const mongoose = (await import('mongoose')).default;
        if (!chat || !chat.participants.includes(new mongoose.Types.ObjectId(senderId))) {
            return NextResponse.json({ error: "Chat not found or unauthorized" }, { status: 404 });
        }

        const newMessage = await Message.create({
            chatId,
            sender: senderId,
            text: text.trim(),
        });

        await Chat.findByIdAndUpdate(chatId, { lastMessage: newMessage._id });

        return NextResponse.json({ message: newMessage }, { status: 201 });
    } catch (error) {
        console.error("Error creating message:", error);
        return NextResponse.json({ error: "Failed to create message" }, { status: 500 });
    }
}

// Handle GET request to fetch messages for a chat
export async function GET(req: Request) {
    try {
        await connectDB();
        const auth = verifyToken(req);
        if (!auth) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const chatId = searchParams.get('chatId');

        if (!chatId) {
            return NextResponse.json({ error: "Chat ID required" }, { status: 400 });
        }

        // Check if user is participant
        const chat = await Chat.findById(chatId);
        const mongoose = (await import('mongoose')).default;
        if (!chat || !chat.participants.includes(new mongoose.Types.ObjectId(auth.id))) {
            return NextResponse.json({ error: "Chat not found or unauthorized" }, { status: 404 });
        }

        const messages = await Message.find({ chatId })
            .populate('sender', 'username email')
            .sort({ createdAt: 1 });

        return NextResponse.json({ messages }, { status: 200 });
    } catch (error) {
        console.error("Error fetching messages:", error);
        return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
    }
}