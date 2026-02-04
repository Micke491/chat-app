import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Message from '@/models/Message';
import { verifyToken } from '@/lib/auth';

export async function PATCH(
  req: Request,
  { params }: { params: { messageId: string } }
) {
  try {
    await connectDB();
    const auth = verifyToken(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { messageId } = params;
    const { text } = await req.json();

    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'Message text required' }, { status: 400 });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    if (message.sender.toString() !== auth.id) {
      return NextResponse.json({ error: 'Unauthorized to edit this message' }, { status: 403 });
    }
    if (message.isDeletedForEveryone) {
      return NextResponse.json({ error: 'Cannot edit deleted message' }, { status: 400 });
    }

    const timeLimit = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    const messageAge = Date.now() - new Date(message.createdAt).getTime();
    if (messageAge > timeLimit) {
      return NextResponse.json({ error: 'Message too old to edit' }, { status: 400 });
    }

    if (!message.isEdited) {
      message.originalText = message.text;
    }

    message.text = text.trim();
    message.isEdited = true;
    message.editedAt = new Date();

    await message.save();

    const populatedMessage = await Message.findById(messageId)
      .populate('sender', 'username email avatar')
      .populate('replyTo');

    return NextResponse.json({ message: populatedMessage }, { status: 200 });
  } catch (error) {
    console.error('Error editing message:', error);
    return NextResponse.json({ error: 'Failed to edit message' }, { status: 500 });
  }
}
