import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Chat from '@/models/Chat';
import { verifyToken } from '@/lib/auth';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ chatId: string }> }
) {
    try {
        await connectDB();
        const { chatId } = await params;
        const auth = verifyToken(request);
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const chat = await Chat.findById(chatId)
            .populate('participants', 'username email avatar');

        if (!chat) {
            return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
        }

        const isParticipant = chat.participants.some((p: any) => p._id.toString() === auth.id);
        if (!isParticipant) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        return NextResponse.json(chat, { status: 200 });
    } catch (error) {
        console.error('Error fetching chat:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
