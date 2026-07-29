'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import SideBar from '@/features/sidebar/components/Sidebar';
import ImagePreviewModal from '@/components/ui/ImagePreviewModal';
import {
  Check, Clock, Copy, Download, FileWarning, MoreVertical,
  Paperclip, Pin, Sparkles, X, Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import 'highlight.js/styles/github-dark.css';

import BotSidebar from '@/features/bot/components/BotSidebar';
import BotMessageList from '@/features/bot/components/BotMessageList';
import BotComposer, { MicDeviceMenu } from '@/features/bot/components/BotComposer';
import { useVoiceRecorder } from '@/features/bot/hooks/useVoiceRecorder';
import { BotChat, BotMessage, BotUser, PendingAttachment } from '@/features/bot/types';
import {
  ACCEPTED_IMAGE_TYPES, ACCEPTED_VIDEO_TYPES, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES,
  conversationToPlainText, downloadMarkdown, fileToBase64, formatBytes,
  normalizeAudioMimeType, voiceMessageFileName,
} from '@/features/bot/utils';

const SIDEBAR_COLLAPSED_KEY = 'vokitoki:bot-sidebar-collapsed';

export default function BotPage() {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const chatMenuRef = useRef<HTMLDivElement>(null);
  const shareMenuRef = useRef<HTMLDivElement>(null);
  const createdBlobUrls = useRef<string[]>([]);

  const [currentUser, setCurrentUser] = useState<BotUser | null>(null);
  const [chats, setChats] = useState<BotChat[]>([]);
  const [activeChat, setActiveChat] = useState<BotChat | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [savingRename, setSavingRename] = useState(false);
  const [pinningId, setPinningId] = useState<string | null>(null);
  const [openChatMenuId, setOpenChatMenuId] = useState<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [modelName, setModelName] = useState('Gemini Flash');
  const [toastError, setToastError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [isComposerFocused, setIsComposerFocused] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);
  const [rateLimitType, setRateLimitType] = useState<'rpm' | 'rpd' | null>(null);
  const rateLimitTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null);
  const [attachmentLoading, setAttachmentLoading] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const dragCounterRef = useRef(0);

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewMediaType, setPreviewMediaType] = useState<string>('image');

  const clearPendingAttachment = useCallback(() => setPendingAttachment(null), []);

  const recorder = useVoiceRecorder({
    // The recording is sent to the model as real audio — it is never transcribed
    // client-side, so the model hears tone, pauses and language directly.
    onRecording: async (blob, durationSec) => {
      setAttachmentLoading(true);
      try {
        const mimeType = normalizeAudioMimeType(blob.type);
        const data = await fileToBase64(blob);
        const previewUrl = URL.createObjectURL(blob);
        createdBlobUrls.current.push(previewUrl);
        setPendingAttachment({
          type: 'audio',
          mimeType,
          fileName: voiceMessageFileName(mimeType),
          data,
          previewUrl,
          sizeBytes: blob.size,
          durationSec: Math.round(durationSec),
        });
      } catch {
        setToastError('Could not process the recording. Please try again.');
      } finally {
        setAttachmentLoading(false);
      }
    },
    onError: message => setToastError(message),
    disabled: () => sending || attachmentLoading,
  });

  useEffect(() => {
    apiFetch('/api/users/current_user')
      .then(r => r.json())
      .then(d => setCurrentUser(d.user))
      .catch(() => router.push('/auth-pages/login'));
  }, [router]);

  useEffect(() => {
    try {
      setSidebarCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1');
    } catch {
      // storage unavailable
    }
  }, []);

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        // storage unavailable
      }
      return next;
    });
  };

  const fetchChats = useCallback(async () => {
    setLoadingChats(true);
    try {
      const res = await apiFetch('/api/bot/chats');
      const data = await res.json();
      setChats(Array.isArray(data) ? data : []);
    } catch {
      setChats([]);
    } finally {
      setLoadingChats(false);
    }
  }, []);

  useEffect(() => { fetchChats(); }, [fetchChats]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChat?.messages]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      setShowScrollDown(scrollHeight - scrollTop - clientHeight > 200);
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [activeChat]);

  useEffect(() => {
    return () => {
      createdBlobUrls.current.forEach(url => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      });
      if (rateLimitTimerRef.current) clearInterval(rateLimitTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!openChatMenuId) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (chatMenuRef.current?.contains(e.target as Node)) return;
      setOpenChatMenuId(null);
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenChatMenuId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [openChatMenuId]);

  useEffect(() => {
    if (!shareMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (shareMenuRef.current?.contains(e.target as Node)) return;
      setShareMenuOpen(false);
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShareMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [shareMenuOpen]);

  const openChat = async (chatId: string) => {
    setLoadingMessages(true);
    setMobileSidebarOpen(false);
    setEditingIndex(null);
    clearPendingAttachment();
    try {
      const res = await apiFetch(`/api/bot/chats/${chatId}`);
      const data = await res.json();
      setActiveChat(data);
    } catch {
      // ignore
    } finally {
      setLoadingMessages(false);
    }
  };

  const createChat = () => {
    setActiveChat(null);
    setMobileSidebarOpen(false);
    setEditingIndex(null);
    clearPendingAttachment();
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const deleteChat = async (chatId: string) => {
    setDeletingId(chatId);
    try {
      await apiFetch(`/api/bot/chats/${chatId}`, { method: 'DELETE' });
      setChats(prev => prev.filter(c => c._id !== chatId));
      if (activeChat?._id === chatId) setActiveChat(null);
    } catch {
      // ignore
    } finally {
      setDeletingId(null);
    }
  };

  const togglePinChat = async (chat: BotChat) => {
    setPinningId(chat._id);
    const nextPinned = !chat.pinned;
    setChats(prev => prev.map(c => c._id === chat._id ? { ...c, pinned: nextPinned } : c));
    if (activeChat?._id === chat._id) {
      setActiveChat(prev => prev ? { ...prev, pinned: nextPinned } : prev);
    }
    try {
      const res = await apiFetch(`/api/bot/chats/${chat._id}/pin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned: nextPinned }),
      });
      if (!res.ok) throw new Error('Failed to update pin');
    } catch {
      setChats(prev => prev.map(c => c._id === chat._id ? { ...c, pinned: chat.pinned } : c));
      if (activeChat?._id === chat._id) {
        setActiveChat(prev => prev ? { ...prev, pinned: chat.pinned } : prev);
      }
      setToastError('Failed to update pin status');
    } finally {
      setPinningId(null);
    }
  };

  const startRename = (chat: BotChat) => {
    setRenamingId(chat._id);
    setRenameTitle(chat.title);
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameTitle('');
  };

  const handleRename = async (chatId: string) => {
    const trimmedTitle = renameTitle.trim();
    if (!trimmedTitle) {
      setToastError('Title cannot be empty');
      return;
    }
    setSavingRename(true);
    try {
      const res = await apiFetch(`/api/bot/chats/${chatId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmedTitle }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to rename chat');
      }
      const data = await res.json();
      const updatedTitle = data.title;
      setChats(prev => prev.map(c => c._id === chatId ? { ...c, title: updatedTitle } : c));
      if (activeChat?._id === chatId) {
        setActiveChat(prev => prev ? { ...prev, title: updatedTitle } : null);
      }
      setRenamingId(null);
      setRenameTitle('');
    } catch (err: any) {
      setToastError(err.message || 'Failed to rename chat');
    } finally {
      setSavingRename(false);
    }
  };

  const stopGeneration = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setSending(false);
    }
  };

  const handleFileSelected = useCallback(async (file: File | undefined | null) => {
    if (!file) return;
    setToastError(null);

    const isImage = ACCEPTED_IMAGE_TYPES.includes(file.type);
    const isVideo = ACCEPTED_VIDEO_TYPES.includes(file.type);

    if (!isImage && !isVideo) {
      setToastError('Unsupported file type. Please use JPG, PNG, WEBP, HEIC images or MP4, WEBM, MOV videos.');
      return;
    }

    const maxBytes = isImage ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
    if (file.size > maxBytes) {
      setToastError(
        isImage
          ? `Image is too large (max ${formatBytes(MAX_IMAGE_BYTES)}).`
          : `Video is too large (max ${formatBytes(MAX_VIDEO_BYTES)}). Try a shorter clip.`
      );
      return;
    }

    setAttachmentLoading(true);
    try {
      const base64Data = await fileToBase64(file);
      const previewUrl = URL.createObjectURL(file);
      createdBlobUrls.current.push(previewUrl);
      setPendingAttachment({
        type: isImage ? 'image' : 'video',
        mimeType: file.type,
        fileName: file.name,
        data: base64Data,
        previewUrl,
        sizeBytes: file.size,
      });
    } catch {
      setToastError('Failed to read file. Please try again.');
    } finally {
      setAttachmentLoading(false);
    }
  }, []);

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelected(e.target.files?.[0]);
    e.target.value = '';
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    if (!e.dataTransfer.types.includes('Files')) return;
    dragCounterRef.current += 1;
    setIsDraggingFile(true);
  };
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDraggingFile(false);
    }
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDraggingFile(false);
    handleFileSelected(e.dataTransfer.files?.[0]);
  };

  const startRateLimitCountdown = (limitType: 'rpm' | 'rpd', seconds: number) => {
    setRateLimitType(limitType);
    setRateLimitCountdown(seconds);
    if (rateLimitTimerRef.current) clearInterval(rateLimitTimerRef.current);
    rateLimitTimerRef.current = setInterval(() => {
      setRateLimitCountdown(prev => {
        if (prev <= 1) {
          if (rateLimitTimerRef.current) clearInterval(rateLimitTimerRef.current);
          rateLimitTimerRef.current = null;
          setRateLimitType(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const sendMessage = async (overrideText?: string, fromIndex?: number) => {
    const text = (overrideText ?? input).trim();
    const attachment = fromIndex === undefined ? pendingAttachment : null;

    if (!text && !attachment) return;
    if (sending) return;
    if (rateLimitCountdown > 0) return;

    if (fromIndex === undefined) {
      setInput('');
      clearPendingAttachment();
      if (inputRef.current) inputRef.current.style.height = 'auto';
    }
    setToastError(null);
    setEditingIndex(null);
    setSending(true);

    const controller = new AbortController();
    setAbortController(controller);

    let targetChat = activeChat;

    if (!targetChat) {
      const defaultTitle = attachment?.type === 'image'
        ? 'Image analysis'
        : attachment?.type === 'video'
          ? 'Video analysis'
          : attachment?.type === 'audio'
            ? 'Voice message'
            : undefined;
      try {
        const createRes = await apiFetch('/api/bot/chats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: text || defaultTitle }),
        });
        if (!createRes.ok) throw new Error('Failed to create chat');
        targetChat = await createRes.json();
        setChats(prev => [targetChat!, ...prev]);
      } catch (e: any) {
        setToastError(e.message || 'Failed to create chat');
        setSending(false);
        setAbortController(null);
        return;
      }
    }

    const defaultAttachmentText = attachment?.type === 'image'
      ? '📷 Sent an image'
      : attachment?.type === 'video'
        ? '🎥 Sent a video'
        : attachment?.type === 'audio'
          ? '🎤 Sent a voice message'
          : '';

    const tempUserMsg: BotMessage = {
      _id: 'temp-user-' + Date.now(),
      role: 'user',
      text: text || defaultAttachmentText,
      attachments: attachment ? [{
        type: attachment.type,
        mimeType: attachment.mimeType,
        fileName: attachment.fileName,
        thumbnailB64: attachment.previewUrl,
      }] : undefined,
      createdAt: new Date().toISOString(),
    };
    const tempBotMsg: BotMessage = {
      _id: 'temp-bot-' + Date.now(),
      role: 'model',
      text: '',
      createdAt: new Date().toISOString(),
    };

    // Restores the pre-truncation view if the resend never reaches the server.
    const messagesBeforeSend = activeChat?.messages;

    // With fromIndex the server truncates its history too, so the local view
    // must drop everything from that turn onward before appending the new one.
    setActiveChat(prev => {
      if (prev) {
        const base = fromIndex === undefined ? prev.messages : prev.messages.slice(0, fromIndex);
        return { ...prev, messages: [...base, tempUserMsg] };
      }
      return { ...targetChat!, messages: [tempUserMsg] };
    });

    try {
      const res = await apiFetch(`/api/bot/chats/${targetChat!._id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
        body: JSON.stringify({
          text,
          attachments: attachment ? [{
            mimeType: attachment.mimeType,
            data: attachment.data,
            fileName: attachment.fileName,
          }] : undefined,
          ...(fromIndex === undefined ? {} : { fromIndex }),
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errData = await res.json();

        if (res.status === 429 && errData.retryAfter) {
          setInput(text);
          if (attachment) setPendingAttachment(attachment);
          setActiveChat(prev => {
            if (!prev || prev._id !== targetChat!._id) return prev;
            if (messagesBeforeSend) return { ...prev, messages: messagesBeforeSend };
            return { ...prev, messages: prev.messages.filter(m => m._id !== tempUserMsg._id) };
          });
          startRateLimitCountdown(errData.limitType === 'rpd' ? 'rpd' : 'rpm', errData.retryAfter as number);
          setSending(false);
          setAbortController(null);
          return;
        }

        if (res.status === 400 && errData.error?.includes('maximum')) {
          setToastError(errData.error);
          if (messagesBeforeSend) {
            setActiveChat(prev => (prev && prev._id === targetChat!._id)
              ? { ...prev, messages: messagesBeforeSend }
              : prev);
          }
          setSending(false);
          setAbortController(null);
          return;
        }

        throw new Error(errData.error || 'Failed');
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let currentBotText = '';
      let botMsgAdded = false;
      let buffer = '';

      if (reader) {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          let boundary = buffer.indexOf('\n\n');

          while (boundary !== -1) {
            const chunk = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);

            if (chunk.startsWith('data: ')) {
              const dataStr = chunk.slice(6);
              if (dataStr.trim()) {
                try {
                  const data = JSON.parse(dataStr);

                  if (data.type === 'chunk' && data.text) {
                    currentBotText += data.text;
                    if (!botMsgAdded) {
                      botMsgAdded = true;
                      setActiveChat(prev => {
                        if (!prev || prev._id !== targetChat!._id) return prev;
                        return { ...prev, messages: [...prev.messages, { ...tempBotMsg, text: currentBotText }] };
                      });
                    } else {
                      setActiveChat(prev => {
                        if (!prev || prev._id !== targetChat!._id) return prev;
                        const newMsgs = [...prev.messages];
                        const lastIndex = newMsgs.length - 1;
                        if (lastIndex >= 0 && newMsgs[lastIndex].role === 'model') {
                          newMsgs[lastIndex] = { ...newMsgs[lastIndex], text: currentBotText };
                        }
                        return { ...prev, messages: newMsgs };
                      });
                    }
                  } else if (data.type === 'init') {
                    if (data.modelName) setModelName(data.modelName);
                    setActiveChat(prev => {
                      if (!prev || prev._id !== targetChat!._id) return prev;
                      const newMsgs = [...prev.messages];
                      const idx = newMsgs.findIndex(m => m._id === tempUserMsg._id);
                      if (idx !== -1 && data.userMessage) {
                        const serverMsg = data.userMessage;
                        const serverHasThumb = !!serverMsg.attachments?.[0]?.thumbnailB64;
                        const localThumb = newMsgs[idx].attachments?.[0]?.thumbnailB64;
                        if (!serverHasThumb && localThumb) {
                          serverMsg.attachments = newMsgs[idx].attachments;
                        }
                        newMsgs[idx] = serverMsg;
                      }
                      return { ...prev, messages: newMsgs };
                    });
                  } else if (data.type === 'done') {
                    if (!botMsgAdded) {
                      botMsgAdded = true;
                      setActiveChat(prev => (prev && prev._id === targetChat!._id)
                        ? { ...prev, messages: [...prev.messages, data.botMessage] }
                        : prev);
                    } else {
                      setActiveChat(prev => {
                        if (!prev || prev._id !== targetChat!._id) return prev;
                        const newMsgs = [...prev.messages];
                        const lastIndex = newMsgs.length - 1;
                        if (lastIndex >= 0 && newMsgs[lastIndex].role === 'model' && data.botMessage) {
                          newMsgs[lastIndex] = data.botMessage;
                        }
                        return { ...prev, title: data.chatTitle || prev.title, messages: newMsgs };
                      });
                    }
                    if (data.chatTitle) {
                      setChats(prev => prev.map(c => c._id === targetChat!._id ? { ...c, title: data.chatTitle } : c));
                    }
                    if (data.model) setModelName(data.model);
                  }
                } catch {
                  // wait for the completion chunk
                }
              }
            }
            boundary = buffer.indexOf('\n\n');
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setActiveChat(prev => {
          if (!prev || prev._id !== targetChat!._id) return prev;
          const newMsgs = [...prev.messages];
          const errorText = '\n\n**⚠️ Error:** ' + (err.message || 'Connection lost.');
          const lastIndex = newMsgs.length - 1;
          if (lastIndex >= 0 && newMsgs[lastIndex].role === 'model' && newMsgs[lastIndex]._id === tempBotMsg._id) {
            newMsgs[lastIndex] = { ...newMsgs[lastIndex], text: newMsgs[lastIndex].text + errorText };
          } else {
            newMsgs.push({ ...tempBotMsg, text: errorText });
          }
          return { ...prev, messages: newMsgs };
        });
      }
    } finally {
      setSending(false);
      setAbortController(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleSubmitEdit = (index: number, text: string) => {
    sendMessage(text, index);
  };

  const handleCopyAll = async () => {
    if (!activeChat) return;
    try {
      await navigator.clipboard.writeText(conversationToPlainText(activeChat));
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 1800);
    } catch {
      setToastError('Could not copy the conversation.');
    }
    setShareMenuOpen(false);
  };

  const handleExportMarkdown = () => {
    if (!activeChat) return;
    downloadMarkdown(activeChat, modelName);
    setShareMenuOpen(false);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const greeting = currentUser?.name || currentUser?.username || 'there';

  return (
    <div className="flex h-screen bg-background overflow-hidden relative">
      <div className="ambient-glow"><div className="ambient-glow-inner" /></div>

      <div className="relative z-[101]">
        <SideBar currentUser={currentUser || undefined} isMobileDrawerOpen={false} onCloseMobileDrawer={() => {}} />
      </div>

      <AnimatePresence>
        {mobileSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[102] bg-black/60 md:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      <BotSidebar
        chats={chats}
        activeChatId={activeChat?._id || null}
        modelName={modelName}
        loadingChats={loadingChats}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={toggleSidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        onOpenChat={openChat}
        onCreateChat={createChat}
        onDeleteChat={deleteChat}
        onTogglePin={togglePinChat}
        deletingId={deletingId}
        pinningId={pinningId}
        openMenuId={openChatMenuId}
        onOpenMenuChange={setOpenChatMenuId}
        menuRef={chatMenuRef}
        renamingId={renamingId}
        renameTitle={renameTitle}
        onRenameTitleChange={setRenameTitle}
        onStartRename={startRename}
        onCancelRename={cancelRename}
        onSubmitRename={handleRename}
        savingRename={savingRename}
      />

      <main
        className="flex-1 flex flex-col min-w-0 relative z-10"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <AnimatePresence>
          {isDraggingFile && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-40 bg-chat-accent/10 backdrop-blur-sm border-4 border-dashed border-chat-accent rounded-2xl m-3 flex items-center justify-center pointer-events-none"
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: [0.95, 1.03, 0.95] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                className="flex flex-col items-center gap-3 text-chat-accent"
              >
                <div className="w-16 h-16 rounded-2xl bg-chat-accent/20 flex items-center justify-center">
                  <Paperclip className="w-8 h-8" />
                </div>
                <p className="font-bold text-lg">Drop image or video to analyze</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <header className="shrink-0 h-16 border-b border-chat-border flex items-center px-4 md:px-6 gap-3 bg-chat-glass backdrop-blur-xl">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open chat list"
            className="md:hidden p-2.5 rounded-xl text-chat-text-secondary hover:text-chat-text-primary hover:bg-chat-hover transition-colors"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-chat-accent to-purple-600 flex items-center justify-center shadow-md shrink-0">
            <Sparkles className="w-4 h-4 text-white" />
          </div>

          {activeChat ? (
            <div className="flex-1 min-w-0">
              <p className="font-bold text-chat-text-primary truncate text-sm flex items-center gap-1.5">
                {activeChat.pinned && <Pin className="w-3.5 h-3.5 text-chat-accent fill-chat-accent/20 shrink-0" />}
                <span className="truncate">{activeChat.title}</span>
              </p>
              <p className="text-[11px] text-chat-text-tertiary">
                {activeChat.messages.length} message{activeChat.messages.length !== 1 ? 's' : ''} · {modelName}
              </p>
            </div>
          ) : (
            <div className="flex-1 min-w-0">
              <span className="font-bold text-chat-text-primary text-sm">New conversation</span>
              <p className="text-[11px] text-chat-text-tertiary">{modelName}</p>
            </div>
          )}

          {activeChat && activeChat.messages.length > 0 && (
            <div className="relative shrink-0" ref={shareMenuRef}>
              <motion.button
                onClick={() => setShareMenuOpen(v => !v)}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
                title="Share or export this conversation"
                aria-label="Share or export this conversation"
                className="p-2.5 rounded-xl text-chat-text-secondary hover:text-chat-text-primary hover:bg-chat-hover transition-colors"
              >
                {copiedAll ? <Check className="w-4 h-4 text-emerald-400" /> : <Download className="w-4 h-4" />}
              </motion.button>

              <AnimatePresence>
                {shareMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-12 z-50 w-52 bg-chat-bg-primary border border-chat-border rounded-xl shadow-2xl overflow-hidden"
                  >
                    <button
                      onClick={handleExportMarkdown}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-chat-text-primary hover:bg-chat-hover transition-colors"
                    >
                      <Download className="w-4 h-4 text-chat-text-tertiary shrink-0" />
                      Download Markdown
                    </button>
                    <div className="h-px bg-chat-border mx-2" />
                    <button
                      onClick={handleCopyAll}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-chat-text-primary hover:bg-chat-hover transition-colors"
                    >
                      <Copy className="w-4 h-4 text-chat-text-tertiary shrink-0" />
                      Copy whole chat
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </header>

        <AnimatePresence>
          {rateLimitCountdown > 0 && (
            <motion.div
              key="rate-limit-toast"
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="absolute top-16 left-1/2 -translate-x-1/2 z-50 max-w-[92%] w-auto"
            >
              <div className="relative overflow-hidden rounded-2xl shadow-2xl border border-amber-500/20">
                <div className="absolute inset-0 bg-gradient-to-r from-amber-600/95 via-orange-500/95 to-amber-600/95" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.1),transparent_70%)]" />

                <motion.div
                  className="absolute bottom-0 left-0 h-[3px] bg-white/40 rounded-full"
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: rateLimitCountdown, ease: 'linear' }}
                />

                <div className="relative flex items-center gap-3 px-5 py-3">
                  <div className="relative shrink-0">
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      className="absolute inset-0 bg-white/20 rounded-full blur-sm"
                    />
                    {rateLimitType === 'rpd' ? (
                      <Zap className="w-5 h-5 text-white relative" />
                    ) : (
                      <Clock className="w-5 h-5 text-white relative" />
                    )}
                  </div>

                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-white text-sm font-semibold leading-tight">
                      {rateLimitType === 'rpd' ? 'Daily limit reached' : 'Slow down — rate limit hit'}
                    </span>
                    <span className="text-white/75 text-xs leading-tight">
                      {rateLimitType === 'rpd'
                        ? `Your daily quota resets in ${rateLimitCountdown >= 3600
                            ? `${Math.floor(rateLimitCountdown / 3600)}h ${Math.floor((rateLimitCountdown % 3600) / 60)}m`
                            : rateLimitCountdown >= 60
                              ? `${Math.floor(rateLimitCountdown / 60)}m ${rateLimitCountdown % 60}s`
                              : `${rateLimitCountdown}s`
                          }`
                        : `You can send again in ${rateLimitCountdown}s`}
                    </span>
                  </div>

                  <div className="shrink-0 ml-auto">
                    <div className="bg-white/20 backdrop-blur-sm rounded-xl px-3 py-1.5 text-white font-mono text-sm font-bold tabular-nums">
                      {rateLimitCountdown >= 3600
                        ? `${Math.floor(rateLimitCountdown / 3600)}:${String(Math.floor((rateLimitCountdown % 3600) / 60)).padStart(2, '0')}:${String(rateLimitCountdown % 60).padStart(2, '0')}`
                        : rateLimitCountdown >= 60
                          ? `${Math.floor(rateLimitCountdown / 60)}:${String(rateLimitCountdown % 60).padStart(2, '0')}`
                          : `0:${String(rateLimitCountdown).padStart(2, '0')}`}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setRateLimitCountdown(0);
                      setRateLimitType(null);
                      if (rateLimitTimerRef.current) {
                        clearInterval(rateLimitTimerRef.current);
                        rateLimitTimerRef.current = null;
                      }
                    }}
                    aria-label="Dismiss rate limit notice"
                    className="shrink-0 hover:bg-white/20 rounded-full p-1 transition-colors"
                  >
                    <X className="w-3.5 h-3.5 text-white/80" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {(toastError || recorder.micPermissionError) && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-red-500/90 text-white px-5 py-2.5 rounded-2xl text-sm font-medium shadow-lg flex items-center gap-2 backdrop-blur-sm max-w-[90%]"
              style={{ top: rateLimitCountdown > 0 ? '7.5rem' : undefined }}
            >
              <FileWarning className="w-4 h-4 shrink-0" />
              <span>{toastError || recorder.micPermissionError}</span>
              <button
                onClick={() => { setToastError(null); recorder.setMicPermissionError(null); }}
                aria-label="Dismiss"
                className="ml-1 hover:bg-white/20 rounded-full p-1 transition-colors shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <BotMessageList
          activeChat={activeChat}
          currentUser={currentUser}
          greeting={greeting}
          loadingMessages={loadingMessages}
          sending={sending}
          containerRef={messagesContainerRef}
          endRef={messagesEndRef}
          showScrollDown={showScrollDown}
          onScrollToBottom={scrollToBottom}
          onPickSuggestion={text => sendMessage(text)}
          editingIndex={editingIndex}
          onStartEdit={setEditingIndex}
          onCancelEdit={() => setEditingIndex(null)}
          onSubmitEdit={handleSubmitEdit}
          onPreviewMedia={(url, type) => { setPreviewImage(url); setPreviewMediaType(type); }}
        />

        <BotComposer
          input={input}
          onInputChange={setInput}
          onSend={() => sendMessage()}
          onStopGeneration={stopGeneration}
          sending={sending}
          rateLimited={rateLimitCountdown > 0}
          modelName={modelName}
          inputRef={inputRef}
          fileInputRef={fileInputRef}
          onFileInputChange={onFileInputChange}
          pendingAttachment={pendingAttachment}
          attachmentLoading={attachmentLoading}
          onClearAttachment={clearPendingAttachment}
          isComposerFocused={isComposerFocused}
          onFocusChange={setIsComposerFocused}
          recorder={recorder}
        />
      </main>

      <AnimatePresence>
        {recorder.showDeviceMenu && recorder.deviceMenuPos && (
          <MicDeviceMenu
            position={recorder.deviceMenuPos}
            devices={recorder.audioDevices}
            selectedDeviceId={recorder.selectedDeviceId}
            onSelect={recorder.selectDevice}
            menuRef={recorder.deviceMenuRef}
          />
        )}
      </AnimatePresence>

      <ImagePreviewModal
        imageUrl={previewImage}
        mediaType={previewMediaType}
        onClose={() => setPreviewImage(null)}
      />
    </div>
  );
}
