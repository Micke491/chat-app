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
        if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { chatId, senderId, text } = await req.json();

        if (auth.id !== senderId) {
            return NextResponse.json({ error: "Unauthorized sender" }, { status: 403 });
        }

        const chat = await Chat.findById(chatId);
        if (!chat) return NextResponse.json({ error: "Chat not found" }, { status: 404 });

        const isParticipant = chat.participants.some(p => p.toString() === senderId);
        
        if (!isParticipant) {
            return NextResponse.json({ error: "Not a member of this chat" }, { status: 403 });
        }

        const newMessage = await Message.create({
            chatId,
            sender: senderId,
            text: text.trim(),
        });

        await Chat.findByIdAndUpdate(chatId, {
            lastMessage: newMessage._id,
            updatedAt: new Date(),
        })

        const populatedMessage = await Message.findById(newMessage._id).populate('sender', 'username avatar');

        return NextResponse.json({ message: populatedMessage }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: "Server error" }, { status: 500 });
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
        const limit = parseInt(searchParams.get('limit') || '50');
        const before = searchParams.get('before'); // Cursor for pagination

        if (!chatId) {
            return NextResponse.json({ error: "Chat ID required" }, { status: 400 });
        }

        // Mark all unread messages in this chat as read for the current user
        await Message.updateMany(
            { 
                chatId, 
                sender: { $ne: auth.id },
                read: false
            },
            { 
                $set: { read: true } 
            }
        );

        const chat = await Chat.findById(chatId);
        if (!chat || !chat.participants.some(p => p.toString() === auth.id)) {
            return NextResponse.json({ error: "Chat not found or unauthorized" }, { status: 404 });
        }

        const query: any = { chatId };
        if (before) {
            query.createdAt = { $lt: new Date(before) };
        }

        const messages = await Message.find(query)
            .populate('sender', 'username email')
            .sort({ createdAt: -1 })
            .limit(limit);

        return NextResponse.json({ messages: messages.reverse() }, { status: 200 });
    } catch (error) {
        console.error("Error fetching messages:", error);
        return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
    }
}