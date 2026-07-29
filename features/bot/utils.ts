import { BotChat, BotMessage } from './types';

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 15 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 12 * 1024 * 1024;
export const MAX_RECORDING_SECONDS = 300;
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
export const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
export const ACCEPT_ATTR = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES].join(',');

const RECORDER_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
];

export function pickRecorderMimeType(): string {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') return '';
  for (const candidate of RECORDER_MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported?.(candidate)) return candidate;
  }
  return '';
}

export function normalizeAudioMimeType(mimeType: string): string {
  return (mimeType.split(';')[0] || 'audio/webm').trim().toLowerCase();
}

const AUDIO_EXTENSIONS: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
};

export function voiceMessageFileName(mimeType: string): string {
  const ext = AUDIO_EXTENSIONS[normalizeAudioMimeType(mimeType)] || 'webm';
  return `voice-message.${ext}`;
}

export function groupChatsByDate(chats: BotChat[]): { label: string; chats: BotChat[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const pinned: BotChat[] = [];
  const rest: BotChat[] = [];
  for (const chat of chats) {
    if (chat.pinned) pinned.push(chat);
    else rest.push(chat);
  }

  const groups: { label: string; chats: BotChat[] }[] = [];
  if (pinned.length > 0) {
    groups.push({ label: 'Pinned', chats: pinned });
  }

  const dateGroups: { label: string; chats: BotChat[] }[] = [
    { label: 'Today', chats: [] },
    { label: 'Yesterday', chats: [] },
    { label: 'Previous 7 Days', chats: [] },
    { label: 'Older', chats: [] },
  ];

  for (const chat of rest) {
    const d = new Date(chat.updatedAt);
    if (d >= today) dateGroups[0].chats.push(chat);
    else if (d >= yesterday) dateGroups[1].chats.push(chat);
    else if (d >= weekAgo) dateGroups[2].chats.push(chat);
    else dateGroups[3].chats.push(chat);
  }

  return [...groups, ...dateGroups.filter(g => g.chats.length > 0)];
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function stripDataUrlPrefix(dataUrl: string): string {
  const idx = dataUrl.indexOf(',');
  return idx === -1 ? dataUrl : dataUrl.slice(idx + 1);
}

export function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(stripDataUrlPrefix(reader.result as string));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

const PLACEHOLDER_TEXT = /^(📷 Sent an image|🎥 Sent a video|🎤 Sent a voice message)$/;

export function isAttachmentPlaceholder(msg: BotMessage): boolean {
  return !!msg.attachments?.length && PLACEHOLDER_TEXT.test(msg.text);
}

export function conversationToMarkdown(chat: BotChat, modelName: string): string {
  const lines: string[] = [`# ${chat.title}`, '', `_Exported from VokiToki AI · ${modelName}_`, ''];
  for (const msg of chat.messages) {
    const who = msg.role === 'user' ? 'You' : 'VokiToki AI';
    lines.push(`## ${who} · ${new Date(msg.createdAt).toLocaleString()}`, '');
    if (msg.attachments?.length) {
      for (const att of msg.attachments) {
        lines.push(`> Attachment: ${att.fileName || att.type} (${att.type})`, '');
      }
    }
    if (msg.text && !isAttachmentPlaceholder(msg)) {
      lines.push(msg.text, '');
    }
  }
  return lines.join('\n');
}

export function conversationToPlainText(chat: BotChat): string {
  return chat.messages
    .filter(m => m.text && !isAttachmentPlaceholder(m))
    .map(m => `${m.role === 'user' ? 'You' : 'VokiToki AI'}: ${m.text}`)
    .join('\n\n');
}

export function downloadMarkdown(chat: BotChat, modelName: string) {
  const content = conversationToMarkdown(chat, modelName);
  const safeTitle = (chat.title || 'conversation').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase();
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeTitle || 'conversation'}.md`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
