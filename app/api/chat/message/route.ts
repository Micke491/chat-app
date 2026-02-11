import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Message from '@/models/Message';
import Chat from '@/models/Chat';
import { verifyToken } from '@/lib/auth';

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

export async function GET(req: Request) {
    try {
        await connectDB();
        const auth = verifyToken(req);
        if (!auth) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const chatId = searchParams.get('chatId');
        const limit = parseInt(searchParams.get('limit') || '30');
        const before = searchParams.get('before');

        if (!chatId) {
            return NextResponse.json({ error: "Chat ID required" }, { status: 400 });
        }

        const chat = await Chat.findById(chatId);
        if (!chat || !chat.participants.some(p => p.toString() === auth.id)) {
            return NextResponse.json({ error: "Chat not found or unauthorized" }, { status: 404 });
        }

        const query: any = { 
            chatId,
            deletedBy: { $ne: auth.id }
        };
        
        if (before) {
            query.createdAt = { $lt: new Date(before) };
        }

        const messages = await Message.find(query)
            .populate('sender', 'username email avatar')
            .populate({
                path: 'replyTo',
                populate: { path: 'sender', select: 'username email' }
            })
            .populate({
                path: 'reactions.userId',
                select: 'username avatar'
            })
            .sort({ createdAt: -1 })
            .limit(limit + 1);

        const hasMore = messages.length > limit;
        const messagesToReturn = hasMore ? messages.slice(0, limit) : messages;
        const nextCursor = hasMore ? messagesToReturn[messagesToReturn.length - 1].createdAt.toISOString() : null;

        const unreadMessageIds = messagesToReturn
            .filter(msg => msg.sender.toString() !== auth.id && msg.status !== 'seen')
            .map(msg => msg._id);

        if (unreadMessageIds.length > 0) {
            await Message.updateMany(
                { 
                    _id: { $in: unreadMessageIds },
                    'readBy.userId': { $ne: auth.id }
                },
                { 
                    $push: { 
                        readBy: { userId: auth.id, readAt: new Date() } 
                    },
                    $addToSet: { deliveredTo: auth.id },
                    $set: { status: 'seen', read: true }
                }
            );
        }

        return NextResponse.json({ 
            messages: messagesToReturn.reverse(),
            hasMore,
            nextCursor
        }, { status: 200 });
    } catch (error) {
        console.error("Error fetching messages:", error);
        return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
    }
}