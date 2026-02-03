'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';

interface Chat {
  _id: string;
  participants: Array<{
    _id: string;
    username: string;
    email: string;
  }>;
  lastMessage?: {
    text: string;
    createdAt: string;
  };
  updatedAt: string;
  unreadCount?: number;
}

interface ChatListProps {
  currentUserId?: string;
  onChatSelect?: (chatId: string) => void;
  selectedChatId?: string;
}

export default function ChatList({ currentUserId, onChatSelect, selectedChatId }: ChatListProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    fetchChats();
  }, []);

  // Socket initialization and event listening
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !currentUserId) return;

    let socket = socketRef.current;

    if (!socket) {
      // Initialize socket
      socket = io(process.env.NEXT_PUBLIC_SITE_URL!, {
        path: '/api/socket/server',
        auth: { token },
        addTrailingSlash: false,
      });
      socketRef.current = socket;
    }

    if (!socket.connected) {
      socket.connect();
    }

    socket.on('connect', () => {
       console.log("ChatList socket connected, joining notifications");
       socket.emit('join-notifications');
    });

    if (socket.connected) {
       socket.emit('join-notifications');
    }
    
    socket.on('chat-update', (data: { chatId: string, lastMessage: any, unreadCount: number }) => {
      setChats(prevChats => {
        const otherChats = prevChats.filter(c => c._id !== data.chatId);
        const existingChat = prevChats.find(c => c._id === data.chatId);
        const isCurrentChat = data.chatId === selectedChatId;
        const newUnreadCount = isCurrentChat 
          ? 0 
          : (existingChat ? (existingChat.unreadCount || 0) + 1 : 1);

        const updatedChat: Chat = {
          ...(existingChat || {}),
          _id: data.chatId,
          updatedAt: new Date().toISOString(),
          lastMessage: {
             text: data.lastMessage.text,
             createdAt: data.lastMessage.createdAt
          },
          participants: existingChat?.participants || [], 
          unreadCount: newUnreadCount
        };

        if (!existingChat) {
             fetchChats();
             return prevChats; 
        }

        return [updatedChat, ...otherChats];
      });
    });

    return () => {
      socket?.off('chat-update');
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [currentUserId, selectedChatId]); 
  
  const fetchChats = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/chats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch chats');
      }

      const data = await response.json();
      setChats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load chats');
    } finally {
      setLoading(false);
    }
  };

  const handleChatClick = (chatId: string) => {
    setChats(prev => prev.map(c => 
      c._id === chatId ? { ...c, unreadCount: 0 } : c
    ));

    if (onChatSelect) {
      onChatSelect(chatId);
    } else {
      router.push(`/chat/${chatId}`);
    }
  };

  const getOtherParticipant = (chat: Chat) => {
    return chat.participants.find(p => p._id !== currentUserId);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <div className="w-10 h-10 mb-4 border-[3px] border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
        <p>Loading conversations...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <p className="mb-3 text-red-500">{error}</p>
        <button 
          onClick={fetchChats}
          className="px-5 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-white/80 via-blue-50/60 to-indigo-100/40 dark:from-slate-950/80 dark:via-slate-900/60 dark:to-slate-800/40 border-r border-gray-200 transition-colors duration-700">
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900">Messages</h2>
      </div>
      
      {/* List Items */}
      <div className="flex-1 overflow-y-auto">
        {chats.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-5 py-16 text-center text-gray-500">
            <svg className="w-16 h-16 mb-5 opacity-40 text-gray-400" viewBox="0 0 64 64" fill="none">
              <path d="M32 8C18.745 8 8 17.969 8 30c0 4.5 1.5 8.7 4 12.2V56l12.8-6.4c2.4.6 4.8 1 7.2 1 13.255 0 24-9.969 24-22S45.255 8 32 8z" stroke="currentColor" strokeWidth="2"/>
            </svg>
            <p className="mb-5 text-base">No conversations yet</p>
            <button 
              className="px-6 py-2.5 font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              onClick={() => router.push('/chat')}
            >
              Start a chat
            </button>
          </div>
        ) : (
          chats.map(chat => {
            const otherUser = getOtherParticipant(chat);
            const isSelected = selectedChatId === chat._id;
            const isUnread = (chat.unreadCount || 0) > 0;
            
            return (
              <div 
                key={chat._id}
                onClick={() => handleChatClick(chat._id)}
                className={`
                  flex gap-3 px-5 py-3 border-b border-gray-100 cursor-pointer transition-colors
                  hover:bg-gray-50
                  ${isSelected ? 'bg-blue-50 border-l-[3px] border-l-blue-600' : 'border-l-[3px] border-l-transparent'}
                `}
              >
                {/* Avatar */}
                <div className="relative flex items-center justify-center flex-shrink-0 w-12 h-12 text-lg font-semibold text-white rounded-full bg-gradient-to-br from-blue-500 to-blue-600">
                  {otherUser?.username?.charAt(0).toUpperCase() || '?'}
                  {isUnread && (
                    <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 border-2 border-white rounded-full"></span>
                  )}
                </div>
                
                {/* Chat Info */}
                <div className="flex flex-col flex-1 min-w-0 gap-1">
                  <div className="flex items-center justify-between">
                    <span className={`text-[15px] truncate ${isUnread ? 'font-bold text-black dark:text-white' : 'font-semibold text-gray-900'}`}>
                      {otherUser?.username || 'Unknown'}
                    </span>
                    <span className={`text-xs whitespace-nowrap ml-2 ${isUnread ? 'font-bold text-blue-600' : 'text-gray-500'}`}>
                      {chat.lastMessage ? formatTime(chat.lastMessage.createdAt) : formatTime(chat.updatedAt)}
                    </span>
                  </div>
                  <p className={`text-sm truncate ${isUnread ? 'font-bold text-gray-900 dark:text-gray-100' : 'text-gray-500'}`}>
                    {chat.lastMessage?.text || 'No messages yet'}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}