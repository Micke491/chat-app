'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Sparkles } from 'lucide-react';
import BotEmptyState from './BotEmptyState';
import BotMessageRow from './BotMessageRow';
import { BotChat, BotUser } from '../types';

interface BotMessageListProps {
  activeChat: BotChat | null;
  currentUser: BotUser | null;
  greeting: string;
  loadingMessages: boolean;
  sending: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  endRef: React.RefObject<HTMLDivElement | null>;
  showScrollDown: boolean;
  onScrollToBottom: () => void;
  onPickSuggestion: (text: string) => void;
  editingIndex: number | null;
  onStartEdit: (index: number) => void;
  onCancelEdit: () => void;
  onSubmitEdit: (index: number, text: string) => void;
  onPreviewMedia: (url: string, type: string) => void;
}

export default function BotMessageList({
  activeChat, currentUser, greeting, loadingMessages, sending,
  containerRef, endRef, showScrollDown, onScrollToBottom, onPickSuggestion,
  editingIndex, onStartEdit, onCancelEdit, onSubmitEdit, onPreviewMedia,
}: BotMessageListProps) {
  const lastMessage = activeChat?.messages[activeChat.messages.length - 1];
  const showTyping = sending && !!activeChat && activeChat.messages.length > 0 && lastMessage?.role === 'user';

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto scrollbar-thin relative">
      {!activeChat || activeChat.messages.length === 0 ? (
        <BotEmptyState greeting={greeting} onPickSuggestion={onPickSuggestion} />
      ) : loadingMessages ? (
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 space-y-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className={`flex gap-3 ${i % 2 === 0 ? 'justify-start' : 'justify-end'} animate-pulse`}>
              <div className={`${i % 2 === 0 ? 'max-w-[80%] w-full' : 'max-w-[60%]'}`}>
                <div className="space-y-2">
                  <div className="h-3 bg-chat-hover rounded w-full" />
                  <div className="h-3 bg-chat-hover rounded w-3/4" />
                  {i % 2 === 0 && <div className="h-3 bg-chat-hover rounded w-1/2" />}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="max-w-3xl mx-auto px-4 md:px-8 pt-6 pb-40 divide-y divide-chat-border/40">
          {activeChat.messages.map((msg, msgIdx) => (
            <BotMessageRow
              key={msg._id}
              msg={msg}
              index={msgIdx}
              currentUser={currentUser}
              isEditing={editingIndex === msgIdx}
              onStartEdit={onStartEdit}
              onCancelEdit={onCancelEdit}
              onSubmitEdit={onSubmitEdit}
              onPreviewMedia={onPreviewMedia}
              canEdit={!sending && msg.role === 'user' && !msg._id.startsWith('temp-')}
            />
          ))}

          {showTyping && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="py-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-chat-accent to-purple-600 flex items-center justify-center shadow-sm">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-xs font-bold text-chat-text-primary">VokiToki AI</span>
              </div>
              <div className="flex items-center gap-1.5 py-1">
                {[0, 1, 2].map(i => (
                  <motion.span
                    key={i}
                    className="w-2 h-2 rounded-full bg-chat-accent"
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
                <span className="text-xs text-chat-text-tertiary ml-2">
                  {lastMessage?.attachments?.[0]?.type === 'audio'
                    ? 'Listening...'
                    : lastMessage?.attachments?.length
                      ? 'Analyzing...'
                      : 'Thinking...'}
                </span>
              </div>
            </motion.div>
          )}

          <div ref={endRef} className="h-1 border-none" />
        </div>
      )}

      <AnimatePresence>
        {showScrollDown && activeChat && activeChat.messages.length > 0 && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 8 }}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            onClick={onScrollToBottom}
            aria-label="Scroll to latest message"
            title="Scroll to bottom"
            className="sticky bottom-4 left-1/2 -translate-x-1/2 z-20 p-3 rounded-full bg-chat-bg-secondary border border-chat-border shadow-lg hover:bg-chat-hover transition-colors"
          >
            <ChevronDown className="w-4 h-4 text-chat-text-secondary" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
