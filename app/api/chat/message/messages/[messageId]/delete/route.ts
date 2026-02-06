import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Message from '@/models/Message';
import { verifyToken } from '@/lib/auth';
import cloudinary from '@/lib/cloudinary';

export async function DELETE(
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
    const { searchParams } = new URL(req.url);
    const deleteForEveryone = searchParams.get('forEveryone') === 'true';

    const message = await Message.findById(messageId);
    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    if (deleteForEveryone) {
      if (message.sender.toString() !== auth.id) {
        return NextResponse.json({ error: 'Only sender can delete for everyone' }, { status: 403 });
      }
      const timeLimit = 48 * 60 * 60 * 1000; // 48 hours in milliseconds
      const messageAge = Date.now() - new Date(message.createdAt).getTime();
      if (messageAge > timeLimit) {
        return NextResponse.json({ error: 'Message too old to delete for everyone' }, { status: 400 });
      }
      if (message.mediaPublicId) {
        try {
          await cloudinary.uploader.destroy(message.mediaPublicId, {
            resource_type: message.mediaType === 'video' ? 'video' : 'image'
          });
        } catch (cloudinaryError) {
          console.error('Cloudinary deletion error:', cloudinaryError);
        }
      }

      message.isDeletedForEveryone = true;
      message.deletedForEveryoneAt = new Date();
      message.text = 'This message was deleted';
      message.mediaUrl = undefined;
      message.mediaType = undefined;
      message.mediaPublicId = undefined;
    } else {
      if (!message.deletedBy.includes(auth.id as any)) {
        message.deletedBy.push(auth.id as any);
      }
    }

    await message.save();

    const populatedMessage = await Message.findById(messageId)
      .populate('sender', 'username email avatar')
      .populate('replyTo');

    return NextResponse.json({ 
      message: populatedMessage,
      deleteForEveryone
    }, { status: 200 });
  } catch (error) {
    console.error('Error deleting message:', error);
    return NextResponse.json({ error: 'Failed to delete message' }, { status: 500 });
  }
}
