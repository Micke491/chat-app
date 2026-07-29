'use client';

import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AudioLines, Check, Copy, ImageIcon, PenLine, Sparkles, User2, Video, X,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import CodeBlock from './CodeBlock';
import VoiceMessagePlayer from './VoiceMessagePlayer';
import { BotMessage, BotUser } from '../types';
import { formatTime, isAttachmentPlaceholder } from '../utils';

const PROSE_CLASSES =
  'prose prose-sm prose-invert max-w-none [&>p]:mb-3 [&>p:last-child]:mb-0 [&>ul]:mb-3 [&>ol]:mb-3 [&>h1]:text-lg [&>h1]:font-bold [&>h1]:mb-2 [&>h2]:text-base [&>h2]:font-bold [&>h2]:mb-2 [&>h3]:text-sm [&>h3]:font-bold [&>h3]:mb-1.5 [&>pre]:rounded-xl [&>pre]:border [&>pre]:border-chat-border [&>pre]:bg-[#0d1117] [&>pre]:my-3 [&>pre]:overflow-x-auto [&>blockquote]:border-l-2 [&>blockquote]:border-chat-accent/50 [&>blockquote]:pl-4 [&>blockquote]:text-chat-text-secondary [&>blockquote]:italic [&_code:not(pre_code)]:bg-white/10 [&_code:not(pre_code)]:px-1.5 [&_code:not(pre_code)]:py-0.5 [&_code:not(pre_code)]:rounded [&_code:not(pre_code)]:text-purple-300 [&_code:not(pre_code)]:text-[13px] [&_a]:text-chat-accent [&_a]:underline [&_a]:underline-offset-2 [&_table]:w-full [&_th]:text-left [&_th]:p-2 [&_th]:border-b [&_th]:border-chat-border [&_td]:p-2 [&_td]:border-b [&_td]:border-chat-border/50 [&_hr]:border-chat-border/50 [&_hr]:my-4';

function ActionButton({
  onClick, title, children, tone = 'neutral',
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  tone?: 'neutral' | 'accent';
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`flex items-center gap-1 px-1.5 py-1 rounded-md text-[10px] font-semibold transition-colors ${
        tone === 'accent'
          ? 'text-chat-accent hover:bg-chat-accent/10'
          : 'text-chat-text-tertiary hover:text-chat-text-primary hover:bg-chat-hover'
      }`}
    >
      {children}
    </button>
  );
}

function CopyAction({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  };
  return (
    <ActionButton onClick={handleCopy} title={copied ? 'Copied' : 'Copy message'}>
      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
      <span className={copied ? 'text-emerald-400' : ''}>{copied ? 'Copied' : 'Copy'}</span>
    </ActionButton>
  );
}

function InlineEditor({
  initialText, onCancel, onSubmit,
}: {
  initialText: string;
  onCancel: () => void;
  onSubmit: (text: string) => void;
}) {
  const [draft, setDraft] = useState(initialText);
  const editRef = useRef<HTMLTextAreaElement>(null);

  const autoSize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  };

  return (
    <div className="w-full md:max-w-[75%] rounded-2xl border border-chat-accent/50 bg-chat-bg-secondary p-2.5">
      <textarea
        ref={el => {
          editRef.current = el;
          if (el && document.activeElement !== el) {
            autoSize(el);
            el.focus();
            el.setSelectionRange(el.value.length, el.value.length);
          }
        }}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (draft.trim()) onSubmit(draft.trim());
          } else if (e.key === 'Escape') {
            onCancel();
          }
        }}
        onInput={e => autoSize(e.currentTarget)}
        rows={1}
        className="w-full resize-none bg-transparent border-none px-1.5 py-1 text-sm text-chat-text-primary focus:outline-none focus:ring-0 overflow-y-auto"
        style={{ maxHeight: '220px' }}
      />
      <div className="flex items-center justify-end gap-1.5 pt-1.5">
        <button
          onClick={onCancel}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-chat-text-secondary hover:bg-chat-hover transition-colors"
        >
          <X className="w-3 h-3" />
          Cancel
        </button>
        <button
          onClick={() => draft.trim() && onSubmit(draft.trim())}
          disabled={!draft.trim()}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-gradient-to-br from-chat-accent to-purple-600 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          <Check className="w-3 h-3" />
          Send
        </button>
      </div>
    </div>
  );
}

interface BotMessageRowProps {
  msg: BotMessage;
  index: number;
  currentUser: BotUser | null;
  isEditing: boolean;
  onStartEdit: (index: number) => void;
  onCancelEdit: () => void;
  onSubmitEdit: (index: number, text: string) => void;
  onPreviewMedia: (url: string, type: string) => void;
  canEdit: boolean;
}

export default function BotMessageRow({
  msg, index, currentUser, isEditing,
  onStartEdit, onCancelEdit, onSubmitEdit, onPreviewMedia, canEdit,
}: BotMessageRowProps) {
  const placeholderOnly = isAttachmentPlaceholder(msg);
  const showText = !!msg.text && !placeholderOnly;

  if (msg.role === 'model') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="group/msg py-4"
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="shrink-0 w-6 h-6 rounded-lg bg-gradient-to-br from-chat-accent to-purple-600 flex items-center justify-center shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-xs font-bold text-chat-text-primary">VokiToki AI</span>
          <span className="text-[10px] text-chat-text-tertiary">{formatTime(msg.createdAt)}</span>
        </div>

        <div className="text-[15px] leading-7 text-chat-text-primary">
          {msg.text === '' ? (
            <div className="flex gap-1.5 items-center py-2">
              {[0, 1, 2].map(i => (
                <motion.span
                  key={i}
                  className="w-2 h-2 rounded-full bg-chat-accent"
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15 }}
                />
              ))}
            </div>
          ) : (
            <div className={PROSE_CLASSES}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={{
                  code: ({ className, children, ...props }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) => {
                    const isInline = !className;
                    if (isInline) {
                      return <code className={className} {...props}>{children}</code>;
                    }
                    return <CodeBlock className={className} {...props}>{children}</CodeBlock>;
                  },
                }}
              >
                {msg.text}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {!!msg.text && (
          <div className="flex items-center gap-1 mt-2 -ml-1.5 opacity-60 group-hover/msg:opacity-100 transition-opacity">
            <CopyAction text={msg.text} />
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="group/msg py-4 flex flex-col items-end gap-1.5"
    >
      {msg.attachments && msg.attachments.length > 0 && (
        <div className="flex flex-col items-end gap-1.5">
          {msg.attachments.map((att, i) => (
            <div key={i}>
              {att.type === 'audio' ? (
                att.thumbnailB64 ? (
                  <VoiceMessagePlayer src={att.thumbnailB64} isUser />
                ) : (
                  <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-2xl bg-chat-accent/10 border border-chat-accent/25 text-chat-text-primary min-w-[200px]">
                    <div className="w-9 h-9 rounded-full bg-chat-accent/15 text-chat-accent flex items-center justify-center shrink-0">
                      <AudioLines className="w-4 h-4" />
                    </div>
                    <span className="text-xs">Voice message</span>
                  </div>
                )
              ) : (
                <div className="rounded-2xl overflow-hidden border border-chat-border max-w-[260px]">
                  {att.thumbnailB64 ? (
                    att.thumbnailB64.startsWith('blob:') && att.type === 'video' ? (
                      <video src={att.thumbnailB64} controls className="w-full h-auto max-h-64 object-cover" />
                    ) : (
                      <div
                        className="cursor-pointer relative"
                        onClick={() => onPreviewMedia(att.thumbnailB64 || '', 'image')}
                      >
                        <img
                          src={att.thumbnailB64}
                          alt={att.fileName || (att.type === 'video' ? 'Uploaded video' : 'Uploaded image')}
                          className="w-full h-auto max-h-64 object-cover hover:opacity-90 transition-opacity"
                        />
                        {att.type === 'video' && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                            <div className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
                              <Video className="w-4 h-4 text-white" />
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-chat-bg-secondary">
                      {att.type === 'video' ? (
                        <Video className="w-4 h-4 text-chat-text-secondary shrink-0" />
                      ) : (
                        <ImageIcon className="w-4 h-4 text-chat-text-secondary shrink-0" />
                      )}
                      <span className="text-xs text-chat-text-secondary truncate">
                        {att.fileName || (att.type === 'video' ? 'Video' : 'Image')}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {isEditing ? (
        <InlineEditor
          initialText={msg.text}
          onCancel={onCancelEdit}
          onSubmit={text => onSubmitEdit(index, text)}
        />
      ) : (
        showText && (
          <div className="max-w-[85%] md:max-w-[70%] px-3.5 py-2.5 rounded-2xl rounded-tr-md bg-chat-accent/10 border border-chat-accent/25 text-[15px] leading-6 text-chat-text-primary">
            <span className="whitespace-pre-wrap">{msg.text}</span>
          </div>
        )
      )}

      {!isEditing && (
        <div className="flex items-center gap-1 opacity-60 group-hover/msg:opacity-100 transition-opacity">
          <span className="text-[10px] text-chat-text-tertiary mr-0.5">{formatTime(msg.createdAt)}</span>
          {showText && <CopyAction text={msg.text} />}
          {canEdit && showText && (
            <ActionButton onClick={() => onStartEdit(index)} title="Edit and resend" tone="accent">
              <PenLine className="w-3 h-3" />
              <span>Edit</span>
            </ActionButton>
          )}
          <div className="ml-1 shrink-0 w-6 h-6 rounded-full overflow-hidden bg-chat-bg-secondary border border-chat-border flex items-center justify-center">
            {currentUser?.avatar ? (
              <img
                src={currentUser.avatar}
                alt="You"
                className="w-full h-full object-cover"
                onError={e => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <User2 className="w-3 h-3 text-chat-text-secondary" />
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
