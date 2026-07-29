export interface BotUser {
  _id: string;
  username: string;
  email: string;
  avatar?: string;
  name?: string;
  botPersona?: string;
}

export interface BotAttachment {
  type: 'image' | 'video' | 'audio';
  mimeType: string;
  fileName: string;
  thumbnailB64?: string;
}

export interface BotMessage {
  _id: string;
  role: 'user' | 'model';
  text: string;
  attachments?: BotAttachment[];
  createdAt: string;
}

export interface BotChat {
  _id: string;
  title: string;
  pinned?: boolean;
  messages: BotMessage[];
  updatedAt: string;
}

export interface PendingAttachment {
  type: 'image' | 'video' | 'audio';
  mimeType: string;
  fileName: string;
  data: string;
  previewUrl: string;
  sizeBytes: number;
  durationSec?: number;
}
