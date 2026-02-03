'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';

interface Message {
  _id: string;
  chatId: string;
  sender: {
    _id: string;
    username: string;
    email: string;
  };
  text: string;
  createdAt: string;
}

interface ChatWindowProps {
  chatId: string;
  currentUserId: string;
  recipientUsername?: string;
  onClose?: () => void;
}

export default function ChatWindow({ chatId, currentUserId, recipientUsername, onClose }: ChatWindowProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef<boolean>(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    let isMounted = true;
    let socketInstance: Socket | null = null;

    const initSocket = async () => {
      try {
        await fetch('/api/socket/io');
      } catch (e) {
        console.error('Socket init fetch failed', e);
      }

      if (!isMounted) return;

      socketInstance = io(process.env.NEXT_PUBLIC_SITE_URL || '', {
        path: '/api/socket/server',
        auth: { token },
        addTrailingSlash: false,
      });

      socketInstance.on('connect', () => {
        socketInstance?.emit('join-chat', chatId);
      });

      socketInstance.on('receive-message', (message: Message) => {
        console.log('Received socket message:', message);
        setMessages(prev => {
          const exists = prev.some(m => String(m._id) === String(message._id));
          if (exists) {
            console.warn('Duplicate message prevented:', message._id);
            return prev;
          }
          return [...prev, message];
        });
      });

      socketInstance.on('user-typing', (data: { username: string; userId: string }) => {
        if (data.userId !== currentUserId) {
          setTypingUsers(prev => {
            if (!prev.includes(data.username)) {
              return [...prev, data.username];
            }
            return prev;
          });
        }
      });

      socketInstance.on('user-stopped-typing', (data: { username: string; userId: string }) => {
        setTypingUsers(prev => prev.filter(username => username !== data.username));
      });

      socketInstance.on('connect_error', (err) => {
        console.error('Socket connection error:', err);
      });

      socketInstance.on('error', (err) => {
        console.error('Socket error:', err);
      });

      setSocket(socketInstance);
    };

    initSocket();

    return () => {
      isMounted = false;
      if (socketInstance) {
        socketInstance.disconnect();
      }
    };
  }, [chatId]);

  useEffect(() => {
    fetchMessages();
  }, [chatId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/chat/message?chatId=${chatId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) throw new Error('Failed');
      const data = await response.json();
      if (data.messages && Array.isArray(data.messages)) {
      setMessages(data.messages);
    } else if (data.message) {
      setMessages([data.message]);
    } else {
      setMessages([]);
    }
  } catch (error) {
    console.error("ChatWindow Error:", error);
    setMessages([]); 
  } finally {
    setLoading(false);
  }
};

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending || !socket) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    setSending(true);

    // Clear typing indicator when sending message
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (isTypingRef.current && socket) {
      socket.emit('user-stopped-typing', { 
        chatId, 
        username: recipientUsername || 'You' 
      });
      isTypingRef.current = false;
    }

    try {
      socket.emit('send-new-message', { chatId, text: messageText });
    } catch (error) {
      setNewMessage(messageText);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', { 
      hour: '2-digit', minute: '2-digit', hour12: true 
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return 'Today';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500">
        <div className="w-10 h-10 mb-4 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-sm font-medium">Loading messages...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950">
      {/* Chat Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          {/* Back Button */}
          <button
            onClick={() => onClose ? onClose() : router.push('/chat')}
            className="flex items-center justify-center w-9 h-9 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            aria-label="Back to chats"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
              <path d="M12 4L6 10L12 16" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div className="flex items-center justify-center w-11 h-11 text-lg font-bold text-white rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 shadow-sm">
            {recipientUsername?.charAt(0).toUpperCase() || '?'}
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white leading-tight">
              {recipientUsername || 'Chat'}
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-xs text-slate-500 dark:text-slate-400">Active now</span>
            </div>
          </div>
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 scroll-smooth">
        {messages.map((message, index) => {
          const isOwn = message.sender._id === currentUserId;
          const showDate = index === 0 || 
            new Date(message.createdAt).toDateString() !== new Date(messages[index - 1].createdAt).toDateString();

          return (
            <div key={message._id}>
              {showDate && (
                <div className="flex justify-center my-6">
                  <span className="px-3 py-1 text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-full">
                    {formatDate(message.createdAt)}
                  </span>
                </div>
              )}
              
              <div className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                {!isOwn && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300">
                    {message.sender.username.charAt(0).toUpperCase()}
                  </div>
                )}
                
                <div className={`flex flex-col max-w-[75%] md:max-w-[60%] ${isOwn ? 'items-end' : 'items-start'}`}>
                  <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm
                    ${isOwn 
                      ? 'bg-blue-600 text-white rounded-br-none' 
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-none'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{message.text}</p>
                  </div>
                  <span className="mt-1 px-1 text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                    {formatTime(message.createdAt)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
        
        {/* Typing Indicator */}
        {typingUsers.length > 0 && (
          <div className="px-4 py-2 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="font-medium">
              {typingUsers.length === 1 
                ? `${typingUsers[0]} is typing...`
                : typingUsers.length === 2
                ? `${typingUsers[0]} and ${typingUsers[1]} are typing...`
                : `${typingUsers[0]} and ${typingUsers.length - 1} others are typing...`
              }
            </span>
          </div>
        )}
      </div>

      {/* Input Form */}
      <footer className="p-4 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800">
        <form 
          className="max-w-4xl mx-auto flex items-end gap-3 px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-[28px] focus-within:ring-2 focus-within:ring-blue-500/20 transition-all border border-transparent focus-within:border-blue-500/30"
          onSubmit={handleSend}
        >
          <textarea
            ref={inputRef}
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              
              // Handle typing indicator
              if (socket && e.target.value.trim()) {
                // Clear existing timeout
                if (typingTimeoutRef.current) {
                  clearTimeout(typingTimeoutRef.current);
                }

                // Emit typing event if not already typing
                if (!isTypingRef.current) {
                  socket.emit('user-typing', { chatId, username: recipientUsername || 'You' });
                  isTypingRef.current = true;
                }

                // Set timeout to emit stopped typing after 2 seconds of inactivity
                typingTimeoutRef.current = setTimeout(() => {
                  if (socket) {
                    socket.emit('user-stopped-typing', { chatId, username: recipientUsername || 'You' });
                    isTypingRef.current = false;
                  }
                }, 2000);
              } else if (isTypingRef.current && socket) {
                // If input is cleared, immediately stop typing indicator
                if (typingTimeoutRef.current) {
                  clearTimeout(typingTimeoutRef.current);
                }
                socket.emit('user-stopped-typing', { chatId, username: recipientUsername || 'You' });
                isTypingRef.current = false;
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            disabled={sending}
            className="flex-1 max-h-32 py-2.5 bg-transparent border-none focus:ring-0 text-[15px] text-slate-900 dark:text-white placeholder-slate-400 resize-none overflow-y-auto"
          />
          
          <button 
            type="submit" 
            disabled={!newMessage.trim() || sending}
            className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-blue-600 text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
          >
            {sending ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5 translate-x-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            )}
          </button>
        </form>
      </footer>
    </div>
  );
}