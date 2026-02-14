export interface Message {
  status: "seen" | "sent" | "delivered";
  _id: string;
  chatId: string;
  sender: {
    _id: string;
    username: string;
    email: string;
    avatar?: string;
  };
  text: string;
  createdAt: string;
  updatedAt: string;
  isEdited?: boolean;
  replyTo?: Message;
  isDeletedForEveryone?: boolean;
  mediaUrl?: string;
  mediaType?: "image" | "video" | "audio";
  reactions?: {
    userId: string;
    emoji: string;
    createdAt: string;
    user?: {
      username: string;
      avatar?: string;
    };
  }[];
}

export interface ChatWindowProps {
  chatId: string;
  currentUserId: string;
  recipientUsername?: string;
  recipientAvatar?: string;
  onClose?: () => void;
}
