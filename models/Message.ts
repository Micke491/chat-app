  import mongoose, { Schema, Document, Model } from 'mongoose';

  export interface IReadByEntry {
    userId: mongoose.Types.ObjectId;
    readAt: Date;
  }

  export interface IMessage extends Document {
    chatId: mongoose.Types.ObjectId;
    sender: mongoose.Types.ObjectId;
    text: string;
    read: boolean;
    
    status: 'sent' | 'delivered' | 'seen';
    deliveredTo: mongoose.Types.ObjectId[];
    readBy: IReadByEntry[];
    
    isEdited: boolean;
    editedAt?: Date;
    originalText?: string;
    
    isDeletedForEveryone: boolean;
    deletedBy: mongoose.Types.ObjectId[];
    deletedForEveryoneAt?: Date;
    
    replyTo?: mongoose.Types.ObjectId;
    
    mediaUrl?: string;
    mediaType?: 'image' | 'video';
    mediaPublicId?: string;
    
    createdAt: Date;
    updatedAt: Date;
  }

  const ReadByEntrySchema = new Schema<IReadByEntry>(
    {
      userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      readAt: {
        type: Date,
        required: true,
        default: Date.now,
      },
    },
    { _id: false }
  );

  const MessageSchema = new Schema<IMessage>(
    {
      chatId: {
        type: Schema.Types.ObjectId,
        ref: 'Chat',
        required: true,
        index: true,
      },
      sender: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      text: {
        type: String,
        required: function(this: any) {
          return !this.mediaUrl;
        },
        trim: true,
        maxlength: 5000,
      },
      mediaUrl: {
        type: String,
      },
      mediaType: {
        type: String,
        enum: ['image', 'video'],
      },
      mediaPublicId: {
        type: String,
      },
      read: {
        type: Boolean,
        default: false,
      },
      
      status: {
        type: String,
        enum: ['sent', 'delivered', 'seen'],
        default: 'sent',
      },
      deliveredTo: [{
        type: Schema.Types.ObjectId,
        ref: 'User',
      }],
      readBy: [ReadByEntrySchema],
      
      isEdited: {
        type: Boolean,
        default: false,
      },
      editedAt: {
        type: Date,
      },
      originalText: {
        type: String,
      },
      
      isDeletedForEveryone: {
        type: Boolean,
        default: false,
      },
      deletedBy: [{
        type: Schema.Types.ObjectId,
        ref: 'User',
      }],
      deletedForEveryoneAt: {
        type: Date,
      },
      
      replyTo: {
        type: Schema.Types.ObjectId,
        ref: 'Message',
      },
    },
    {
      timestamps: true,
    }
  );

  MessageSchema.index({ chatId: 1, createdAt: -1 });
  MessageSchema.index({ sender: 1 });

  const Message: Model<IMessage> = mongoose.models.Message || mongoose.model<IMessage>('Message', MessageSchema);

  export default Message;