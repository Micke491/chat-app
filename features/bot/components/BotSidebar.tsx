'use client';

import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check, ChevronLeft, ChevronRight, Loader2, MessageSquare, MoreVertical,
  PenLine, Pin, Plus, Search, Sparkles, Trash2, X,
} from 'lucide-react';
import { BotChat } from '../types';
import { groupChatsByDate } from '../utils';

interface BotSidebarProps {
  chats: BotChat[];
  activeChatId: string | null;
  modelName: string;
  loadingChats: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenChat: (chatId: string) => void;
  onCreateChat: () => void;
  onDeleteChat: (chatId: string) => void;
  onTogglePin: (chat: BotChat) => void;
  deletingId: string | null;
  pinningId: string | null;
  openMenuId: string | null;
  onOpenMenuChange: (chatId: string | null) => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
  renamingId: string | null;
  renameTitle: string;
  onRenameTitleChange: (value: string) => void;
  onStartRename: (chat: BotChat) => void;
  onCancelRename: () => void;
  onSubmitRename: (chatId: string) => void;
  savingRename: boolean;
}

export default function BotSidebar({
  chats, activeChatId, modelName, loadingChats,
  searchQuery, onSearchChange,
  collapsed, onToggleCollapsed,
  mobileOpen, onCloseMobile,
  onOpenChat, onCreateChat, onDeleteChat, onTogglePin,
  deletingId, pinningId,
  openMenuId, onOpenMenuChange, menuRef,
  renamingId, renameTitle, onRenameTitleChange,
  onStartRename, onCancelRename, onSubmitRename, savingRename,
}: BotSidebarProps) {
  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return chats;
    const q = searchQuery.toLowerCase();
    return chats.filter(c => c.title.toLowerCase().includes(q));
  }, [chats, searchQuery]);

  const groupedChats = useMemo(() => groupChatsByDate(filteredChats), [filteredChats]);

  if (collapsed) {
    return (
      <aside className="hidden md:flex relative z-[103] h-full flex-col w-[68px] shrink-0 bg-chat-glass backdrop-blur-xl border-r border-chat-border items-center py-4 gap-3">
        <motion.button
          onClick={onToggleCollapsed}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          title="Expand conversations"
          aria-label="Expand conversations"
          className="w-10 h-10 rounded-xl bg-chat-bg-secondary border border-chat-border flex items-center justify-center text-chat-text-secondary hover:text-chat-text-primary hover:bg-chat-hover transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </motion.button>

        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-chat-accent to-purple-600 flex items-center justify-center shadow-lg shadow-chat-accent/20">
          <Sparkles className="w-5 h-5 text-white" />
        </div>

        <motion.button
          onClick={onCreateChat}
          whileHover={{ scale: 1.06, rotate: 90 }}
          whileTap={{ scale: 0.92 }}
          title="New chat"
          aria-label="Start a new chat"
          className="w-10 h-10 rounded-xl bg-chat-accent/10 hover:bg-chat-accent/20 text-chat-accent flex items-center justify-center transition-colors"
        >
          <Plus className="w-4 h-4" />
        </motion.button>

        <div className="flex-1 w-full overflow-y-auto scrollbar-thin flex flex-col items-center gap-1.5 pt-2">
          {filteredChats.slice(0, 14).map(chat => (
            <button
              key={chat._id}
              onClick={() => onOpenChat(chat._id)}
              title={chat.title}
              aria-label={chat.title}
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                activeChatId === chat._id
                  ? 'bg-chat-accent text-white shadow-md shadow-chat-accent/20'
                  : 'text-chat-text-tertiary hover:bg-chat-hover hover:text-chat-text-primary'
              }`}
            >
              {chat.pinned ? <Pin className="w-3.5 h-3.5" /> : <MessageSquare className="w-3.5 h-3.5" />}
            </button>
          ))}
        </div>
      </aside>
    );
  }

  return (
    <aside
      className={`absolute md:relative z-[103] md:z-auto h-full flex flex-col w-72 shrink-0 bg-chat-glass backdrop-blur-xl border-r border-chat-border transition-transform duration-300 ${
        mobileOpen ? 'translate-x-[280px]' : '-translate-x-full md:translate-x-0'
      }`}
    >
      <div className="p-4 border-b border-chat-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <motion.div
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-chat-accent to-purple-600 flex items-center justify-center shadow-lg shadow-chat-accent/20 shrink-0"
              whileHover={{ rotate: [0, -8, 8, 0], scale: 1.05 }}
              transition={{ duration: 0.4 }}
            >
              <Sparkles className="w-5 h-5 text-white" />
            </motion.div>
            <div className="min-w-0">
              <h2 className="font-bold text-chat-text-primary text-sm truncate">AI Assistant</h2>
              <p className="text-chat-text-tertiary text-[11px] truncate">{modelName}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <motion.button
              onClick={onCreateChat}
              whileHover={{ scale: 1.06, rotate: 90 }}
              whileTap={{ scale: 0.92 }}
              className="p-2.5 rounded-xl bg-chat-accent/10 hover:bg-chat-accent/20 text-chat-accent transition-colors"
              title="New chat"
              aria-label="Start a new chat"
            >
              <Plus className="w-4 h-4" />
            </motion.button>
            <motion.button
              onClick={onToggleCollapsed}
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.92 }}
              className="hidden md:flex p-2.5 rounded-xl text-chat-text-tertiary hover:text-chat-text-primary hover:bg-chat-hover transition-colors"
              title="Collapse conversations"
              aria-label="Collapse conversations"
            >
              <ChevronLeft className="w-4 h-4" />
            </motion.button>
            <button
              onClick={onCloseMobile}
              className="md:hidden p-2.5 rounded-xl text-chat-text-tertiary hover:text-chat-text-primary hover:bg-chat-hover transition-colors"
              title="Close"
              aria-label="Close conversations"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-chat-text-tertiary pointer-events-none" />
          <input
            type="text"
            placeholder="Search conversations..."
            aria-label="Search conversations"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full bg-chat-bg-secondary border border-chat-border rounded-xl pl-9 pr-8 py-2.5 text-xs text-chat-text-primary placeholder:text-chat-text-tertiary focus:outline-none focus:ring-2 focus:ring-chat-accent/20 focus:border-chat-accent/50 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-chat-text-tertiary hover:text-chat-text-primary hover:bg-chat-hover transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
        {loadingChats ? (
          <div className="space-y-3 p-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-4 h-4 rounded bg-chat-hover shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-chat-hover rounded w-3/4" />
                  <div className="h-2 bg-chat-hover/50 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="text-center pt-10 px-4">
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-chat-bg-secondary flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-chat-text-tertiary" />
            </div>
            <p className="text-chat-text-secondary text-sm font-medium">
              {searchQuery ? 'No matching chats' : 'No conversations yet'}
            </p>
            <p className="text-chat-text-tertiary text-xs mt-1">
              {searchQuery ? 'Try a different search term' : 'Start a new chat below'}
            </p>
          </div>
        ) : (
          groupedChats.map(group => (
            <div key={group.label} className="mb-2">
              <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-chat-text-tertiary flex items-center gap-1.5">
                {group.label === 'Pinned' && <Pin className="w-3 h-3 text-chat-accent fill-chat-accent/20" />}
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.chats.map(chat => (
                  <motion.div
                    key={chat._id}
                    onClick={() => onOpenChat(chat._id)}
                    whileHover={{ x: 2 }}
                    className={`w-full cursor-pointer text-left px-3 py-2.5 rounded-xl transition-all group flex items-center gap-2.5 relative ${
                      openMenuId === chat._id ? 'z-30' : 'z-0'
                    } ${
                      activeChatId === chat._id
                        ? 'bg-chat-accent text-white shadow-md shadow-chat-accent/20'
                        : 'hover:bg-chat-hover text-chat-text-secondary hover:text-chat-text-primary'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-60" />
                    {renamingId === chat._id ? (
                      <div className="flex-1 flex items-center gap-1 min-w-0" onClick={e => e.stopPropagation()}>
                        <input
                          type="text"
                          value={renameTitle}
                          onChange={e => onRenameTitleChange(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') onSubmitRename(chat._id);
                            else if (e.key === 'Escape') onCancelRename();
                          }}
                          className={`flex-1 min-w-0 bg-transparent border-b outline-none text-[13px] font-medium py-0.5 px-0 ${
                            activeChatId === chat._id
                              ? 'text-white border-white/40 focus:border-white'
                              : 'text-chat-text-primary border-chat-border focus:border-chat-accent'
                          }`}
                          autoFocus
                        />
                        <button
                          onClick={() => onSubmitRename(chat._id)}
                          disabled={savingRename}
                          className={`p-1 rounded transition-colors ${
                            activeChatId === chat._id ? 'hover:bg-white/20 text-white' : 'hover:bg-emerald-500/10 text-emerald-500'
                          }`}
                          title="Save"
                        >
                          {savingRename ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={onCancelRename}
                          disabled={savingRename}
                          className={`p-1 rounded transition-colors ${
                            activeChatId === chat._id ? 'hover:bg-white/20 text-white' : 'hover:bg-red-500/10 text-red-500'
                          }`}
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="flex-1 truncate text-[13px] font-medium flex items-center gap-1.5">
                          {chat.pinned && (
                            <Pin className={`w-3 h-3 shrink-0 ${activeChatId === chat._id ? 'fill-white/30 text-white' : 'fill-chat-accent/20 text-chat-accent'}`} />
                          )}
                          <span className="truncate">{chat.title}</span>
                        </span>

                        <button
                          onClick={e => {
                            e.stopPropagation();
                            onOpenMenuChange(openMenuId === chat._id ? null : chat._id);
                          }}
                          aria-label="Chat options"
                          className={`relative z-10 shrink-0 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-all ${
                            openMenuId === chat._id ? 'opacity-100' : ''
                          } ${
                            activeChatId === chat._id
                              ? 'hover:bg-white/20 text-white'
                              : 'hover:bg-chat-hover text-chat-text-secondary hover:text-chat-text-primary'
                          }`}
                          title="Options"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>

                        <AnimatePresence>
                          {openMenuId === chat._id && (
                            <motion.div
                              ref={menuRef}
                              onClick={e => e.stopPropagation()}
                              initial={{ opacity: 0, y: -4, scale: 0.97 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -4, scale: 0.97 }}
                              transition={{ duration: 0.15 }}
                              className="absolute right-2 top-11 z-50 w-44 bg-chat-bg-primary border border-chat-border rounded-xl shadow-2xl overflow-hidden"
                            >
                              <button
                                onClick={() => {
                                  onOpenMenuChange(null);
                                  onTogglePin(chat);
                                }}
                                disabled={pinningId === chat._id}
                                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-chat-text-primary hover:bg-chat-hover transition-colors disabled:opacity-50"
                              >
                                {pinningId === chat._id ? (
                                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                                ) : chat.pinned ? (
                                  <Pin className="w-4 h-4 text-chat-accent shrink-0 rotate-45" />
                                ) : (
                                  <Pin className="w-4 h-4 text-chat-text-tertiary shrink-0" />
                                )}
                                {chat.pinned ? 'Unpin Chat' : 'Pin Chat'}
                              </button>
                              <div className="h-px bg-chat-border mx-2" />
                              <button
                                onClick={() => {
                                  onOpenMenuChange(null);
                                  onStartRename(chat);
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-chat-text-primary hover:bg-chat-hover transition-colors"
                              >
                                <PenLine className="w-4 h-4 text-chat-text-tertiary shrink-0" />
                                Rename
                              </button>
                              <div className="h-px bg-chat-border mx-2" />
                              <button
                                onClick={() => {
                                  onOpenMenuChange(null);
                                  onDeleteChat(chat._id);
                                }}
                                disabled={deletingId === chat._id}
                                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                              >
                                {deletingId === chat._id ? (
                                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                                ) : (
                                  <Trash2 className="w-4 h-4 shrink-0" />
                                )}
                                Delete Chat
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
