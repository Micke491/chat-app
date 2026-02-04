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
    const { status } = await req.json();

    if (!status || !['delivered', 'seen'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status. Use "delivered" or "seen"' }, { status: 400 });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    if (message.sender.toString() === auth.id) {
      return NextResponse.json({ error: 'Cannot update status of your own message' }, { status: 400 });
    }

    if (status === 'delivered') {
      if (!message.deliveredTo.includes(auth.id as any)) {
        message.deliveredTo.push(auth.id as any);
      }
      
      if (message.status === 'sent') {
        message.status = 'delivered';
      }
    } else if (status === 'seen') {
      const alreadyRead = message.readBy.some(
        (entry: any) => entry.userId.toString() === auth.id
      );
      
      if (!alreadyRead) {
        message.readBy.push({
          userId: auth.id as any,
          readAt: new Date()
        });
      }
      
      if (!message.deliveredTo.includes(auth.id as any)) {
        message.deliveredTo.push(auth.id as any);
      }
      
      message.status = 'seen';
      message.read = true;
    }

    await message.save();

    const populatedMessage = await Message.findById(messageId)
      .populate('sender', 'username email avatar')
      .populate('replyTo');

    return NextResponse.json({ message: populatedMessage }, { status: 200 });
  } catch (error) {
    console.error('Error updating message status:', error);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await connectDB();
    const auth = verifyToken(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { messageIds, status } = await req.json();

    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return NextResponse.json({ error: 'Message IDs array required' }, { status: 400 });
    }

    if (!status || !['delivered', 'seen'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const updateOperations = messageIds.map(async (messageId: string) => {
      const message = await Message.findById(messageId);
      if (!message || message.sender.toString() === auth.id) {
        return null;
      }

      if (status === 'delivered') {
        if (!message.deliveredTo.includes(auth.id as any)) {
          message.deliveredTo.push(auth.id as any);
        }
        if (message.status === 'sent') {
          message.status = 'delivered';
        }
      } else if (status === 'seen') {
        const alreadyRead = message.readBy.some(
          (entry: any) => entry.userId.toString() === auth.id
        );
        if (!alreadyRead) {
          message.readBy.push({
            userId: auth.id as any,
            readAt: new Date()
          });
        }
        if (!message.deliveredTo.includes(auth.id as any)) {
          message.deliveredTo.push(auth.id as any);
        }
        message.status = 'seen';
        message.read = true;
      }

      await message.save();
      return message;
    });

    await Promise.all(updateOperations);

    return NextResponse.json({ 
      success: true, 
      updated: messageIds.length 
    }, { status: 200 });
  } catch (error) {
    console.error('Error bulk updating message status:', error);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}
