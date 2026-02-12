import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Chat from '@/models/Chat';
import User from '@/models/User';
import { verifyToken } from '@/lib/auth';
import Message from '@/models/Message';
import mongoose from 'mongoose';

export async function GET(request: Request) {
    try {
        await connectDB();
        const auth = verifyToken(request);
        if (!auth) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const userId = auth.id;

        const chats = await Chat.find({
            participants: userId,
        })
            .populate('participants', 'username name avatar email')
            .populate('lastMessage')
            .sort({ updatedAt: -1 })
            .lean();

        const unreadCounts = await Message.aggregate([
            {
                $match: {
                    chatId: { $in: chats.map(c => c._id) },
                    sender: { $ne: new mongoose.Types.ObjectId(userId) },
                    read: false
                }
            },
            {
                $group: {
                    _id: "$chatId",
                    count: { $sum: 1 }
                }
            }
        ]);

        const countsMap = unreadCounts.reduce((acc: any, curr: any) => {
            acc[curr._id.toString()] = curr.count;
            return acc;
        }, {});

        const chatsWithUnread = chats.map(chat => ({
            ...chat,
            unreadCount: countsMap[chat._id.toString()] || 0
        }));

        return NextResponse.json(chatsWithUnread, { status: 200 });
    } catch (error) {
        console.error('Error fetching chats:', error);
        return NextResponse.json({ message: 'Failed to fetch chats' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        await connectDB();
        const auth = verifyToken(request);
        if (!auth) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        const { recipientId } = await request.json();
        const currentUserId = auth.id;

        if (!recipientId) return NextResponse.json({ message: 'Recipient ID is required' }, { status: 400 });

        const userA = new mongoose.Types.ObjectId(currentUserId);
        const userB = new mongoose.Types.ObjectId(recipientId);

        let chat = await Chat.findOne({
            participants: { $all: [userA, userB] },
        }).populate('participants', 'username email avatar');

        if (!chat) {
            const users = await User.find({ _id: { $in: [userA, userB] } });

            if (users.length < 2 && currentUserId !== recipientId) {
                return NextResponse.json({ message: 'User not found' }, { status: 404 });
            }

            const participantUsernames = users.map(u => u.username);

            chat = await Chat.create({
                participants: [userA, userB],
                participantUsernames,
            });

            await chat.populate('participants', 'username email avatar');
        }

        return NextResponse.json(chat, { status: 200 });
    } catch (error: any) {
        console.error('DETAILED SERVER ERROR:', error);
        return NextResponse.json({ message: 'Server Error', details: error.message }, { status: 500 });
    }
}