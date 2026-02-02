import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IChat extends Document {
  participants: mongoose.Types.ObjectId[];
  participantUsernames: string[];
  lastMessage?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ChatSchema = new Schema<IChat>(
  {
    // Simplified array definition to prevent validation hiccups
    participants: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }],
    // Matches your interface: string[]
    participantUsernames: [String], 
    lastMessage: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
ChatSchema.index({ participants: 1 });
ChatSchema.index({ updatedAt: -1 });

const Chat: Model<IChat> = mongoose.models.Chat || mongoose.model<IChat>('Chat', ChatSchema);

export default Chat;