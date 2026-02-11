"use client";

import {
  useEffect,
  useState,
  useRef,
  useCallback,
  useLayoutEffect,
} from "react";
import { useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { Mic, X, Send, Trash2, Play, Pause, Square, Smile } from "lucide-react";
import MessageStatusIcon from "./MessageStatusIcon";
import AudioPlayer from "./AudioPlayer";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";

interface Message {
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

interface ChatWindowProps {
  chatId: string;
  currentUserId: string;
  recipientUsername?: string;
  recipientAvatar?: string;
  onClose?: () => void;
}

export default function ChatWindow({
  chatId,
  currentUserId,
  recipientUsername,
  recipientAvatar,
  onClose,
}: ChatWindowProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target as Node)
      ) {
        setShowEmojiPicker(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    let isMounted = true;
    let socketInstance: Socket | null = null;

    const initSocket = async () => {
      try {
        await fetch("/api/socket/io");
      } catch (e) {
        console.error("Socket init fetch failed", e);
      }

      if (!isMounted) return;

      socketInstance = io(process.env.NEXT_PUBLIC_SITE_URL || "", {
        path: "/api/socket/server",
        auth: { token },
        addTrailingSlash: false,
      });

      socketInstance.on("connect", () => {
        socketInstance?.emit("join-chat", chatId);
      });

      socketInstance.on("receive-message", (message: Message) => {
        setMessages((prev) => {
          const exists = prev.some(
            (m) => String(m._id) === String(message._id),
          );
          if (exists) return prev;

          if (message.sender._id !== currentUserId) {
            socketInstance?.emit("mark-messages-read", {
              chatId,
              messageIds: [message._id],
            });
          }

          return [...prev, message];
        });
        if (messagesContainerRef.current) {
          const { scrollTop, scrollHeight, clientHeight } =
            messagesContainerRef.current;
          const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
          if (isNearBottom) {
            setTimeout(scrollToBottom, 100);
          }
        }
      });

      socketInstance.on("message-updated", (updatedMessage: Message) => {
        setMessages((prev) =>
          prev.map((m) => (m._id === updatedMessage._id ? updatedMessage : m)),
        );
      });

      socketInstance.on("message-deleted", (data: { messageId: string }) => {
        setMessages((prev) =>
          prev.map((m) => {
            if (m._id === data.messageId) {
              return {
                ...m,
                isDeletedForEveryone: true,
                text: "This message was deleted",
                mediaUrl: undefined,
                mediaType: undefined,
              };
            }
            return m;
          }),
        );
      });

      socketInstance.on(
        "messages-read",
        (data: { messageIds: string[]; userId: string }) => {
          setMessages((prev) =>
            prev.map((m) => {
              if (data.messageIds.includes(m._id)) {
                return { ...m, status: "seen" };
              }
              return m;
            }),
          );
        },
      );

      socketInstance.on(
        "user-typing",
        (data: { username: string; userId: string }) => {
          if (data.userId !== currentUserId) {
            setTypingUsers((prev) => {
              if (!prev.includes(data.username)) {
                return [...prev, data.username];
              }
              return prev;
            });
          }
        },
      );

      socketInstance.on(
        "user-stopped-typing",
        (data: { username: string; userId: string }) => {
          setTypingUsers((prev) =>
            prev.filter((username) => username !== data.username),
          );
        },
      );

      socketInstance.on(
        "message-reaction-added",
        (data: {
          chatId: string;
          messageId: string;
          reaction: {
            userId: string;
            emoji: string;
            createdAt: string;
            user?: { username: string; avatar?: string };
          };
        }) => {
          if (data.chatId !== chatId) return;
          setMessages((prev) =>
            prev.map((m) => {
              if (m._id === data.messageId) {
                const reactions = m.reactions || [];
                if (
                  reactions.some(
                    (r) =>
                      r.userId === data.reaction.userId &&
                      r.emoji === data.reaction.emoji,
                  )
                ) {
                  return m;
                }
                return { ...m, reactions: [...reactions, data.reaction] };
              }
              return m;
            }),
          );
        },
      );

      socketInstance.on(
        "message-reaction-removed",
        (data: {
          chatId: string;
          messageId: string;
          userId: string;
          emoji: string;
        }) => {
          if (data.chatId !== chatId) return;
          setMessages((prev) =>
            prev.map((m) => {
              if (m._id === data.messageId) {
                return {
                  ...m,
                  reactions: (m.reactions || []).filter(
                    (r) =>
                      !(r.userId === data.userId && r.emoji === data.emoji),
                  ),
                };
              }
              return m;
            }),
          );
        },
      );

      setSocket(socketInstance);
    };

    initSocket();

    return () => {
      isMounted = false;
      if (socketInstance) {
        socketInstance.disconnect();
      }
    };
  }, [chatId, currentUserId]);

  useEffect(() => {
    fetchMessages();
  }, [chatId]);

  const [initialScrollDone, setInitialScrollDone] = useState(false);

  useLayoutEffect(() => {
    setInitialScrollDone(false);
  }, [chatId]);

  useLayoutEffect(() => {
    if (!loading && messages.length > 0 && !loadingMore) {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop =
          messagesContainerRef.current.scrollHeight;
        requestAnimationFrame(() => {
          if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop =
              messagesContainerRef.current.scrollHeight;
            setInitialScrollDone(true);
          }
        });
      }
    } else if (!loading && messages.length === 0) {
      setInitialScrollDone(true);
    }
  }, [loading, chatId, messages.length, loadingMore]);

  const fetchMessages = async (beforeDate?: string) => {
    try {
      if (!beforeDate) setLoading(true);
      else setLoadingMore(true);

      const url = new URL("/api/chat/message", window.location.href);
      url.searchParams.append("chatId", chatId);
      if (beforeDate) url.searchParams.append("before", beforeDate);

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed");
      const data = await response.json();

      const newMessages = data.messages || [];

      if (beforeDate) {
        setMessages((prev) => [...newMessages, ...prev]);
        if (messagesContainerRef.current) {
          const oldScrollHeight = messagesContainerRef.current.scrollHeight;
          requestAnimationFrame(() => {
            if (messagesContainerRef.current) {
              const newScrollHeight = messagesContainerRef.current.scrollHeight;
              messagesContainerRef.current.scrollTop =
                newScrollHeight - oldScrollHeight;
            }
          });
        }
      } else {
        setMessages(newMessages);
      }

      setHasMore(data.hasMore);
    } catch (error) {
      console.error("ChatWindow Error:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => {
    if (loadingMore || !hasMore || messages.length === 0) return;
    const oldestMessage = messages[0];
    fetchMessages(oldestMessage.createdAt);
  };

  const handleScroll = () => {
    if (messagesContainerRef.current) {
      const { scrollTop } = messagesContainerRef.current;
      if (scrollTop < 50 && hasMore && !loadingMore) {
        loadMore();
      }
    }
  };

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingDuration(0);
      timerIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        await sendAudioMessage(audioBlob);
        const stream = mediaRecorderRef.current?.stream;
        stream?.getTracks().forEach((track) => track.stop());
      };
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = () => {
        const stream = mediaRecorderRef.current?.stream;
        stream?.getTracks().forEach((track) => track.stop());
      };
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      setRecordingDuration(0);
    }
  };

  const sendAudioMessage = async (audioBlob: Blob) => {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", audioBlob, "voice_message.webm");

    try {
      const response = await fetch("/api/chat/media/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");
      const data = await response.json();

      if (socket) {
        socket.emit("send-new-message", {
          chatId,
          mediaUrl: data.url,
          mediaType: "audio",
          mediaPublicId: data.publicId,
          replyTo: replyingTo?._id,
        });
        setReplyingTo(null);
        scrollToBottom();
      }
    } catch (error) {
      console.error("Audio upload error:", error);
      alert("Failed to send voice message.");
    } finally {
      setUploading(false);
    }
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending || !socket) return;

    const messageText = newMessage.trim();
    setNewMessage("");
    setSending(true);

    if (isTypingRef.current) {
      socket.emit("user-stopped-typing", {
        chatId,
        username: recipientUsername || "You",
      });
      isTypingRef.current = false;
    }

    try {
      if (editingMessage) {
        socket.emit("edit-message", {
          chatId,
          messageId: editingMessage._id,
          newText: messageText,
        });
        setEditingMessage(null);
      } else {
        socket.emit("send-new-message", {
          chatId,
          text: messageText,
          replyTo: replyingTo?._id,
        });
        setReplyingTo(null);
        scrollToBottom();
      }
    } catch (error) {
      setNewMessage(messageText);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert("File is too large. Maximum size is 10MB.");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/chat/media/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const data = await response.json();

      if (socket) {
        socket.emit("send-new-message", {
          chatId,
          mediaUrl: data.url,
          mediaType: data.mediaType,
          mediaPublicId: data.publicId,
          replyTo: replyingTo?._id,
        });
        setReplyingTo(null);
        scrollToBottom();
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to upload file.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
    if (e.key === "Escape") {
      setReplyingTo(null);
      setEditingMessage(null);
      setNewMessage("");
    }
  };

  const handleDelete = (messageId: string) => {
    if (!socket || !confirm("Delete this message for everyone?")) return;
    socket.emit("delete-message", { chatId, messageId });
  };

  const startEdit = (message: Message) => {
    setEditingMessage(message);
    setReplyingTo(null);
    setNewMessage(message.text);
    inputRef.current?.focus();
  };

  const startReply = (message: Message) => {
    setReplyingTo(message);
    setEditingMessage(null);
    inputRef.current?.focus();
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return "Today";
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleReaction = (emojiData: EmojiClickData, messageId: string) => {
    if (!socket) return;
    socket.emit("add-reaction", {
      chatId,
      messageId,
      emoji: emojiData.emoji,
    });
    setShowEmojiPicker(null);
  };

  const removeReaction = (messageId: string, emoji: string) => {
    if (!socket) return;
    socket.emit("remove-reaction", {
      chatId,
      messageId,
      emoji,
    });
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
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => (onClose ? onClose() : router.push("/chat"))}
            className="flex items-center justify-center w-9 h-9 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors md:hidden"
            aria-label="Back to chats"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
            >
              <path
                d="M12 4L6 10L12 16"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <div className="flex items-center justify-center w-11 h-11 text-lg font-bold text-white rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 shadow-sm overflow-hidden">
            {recipientAvatar ? (
              <img
                src={recipientAvatar}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              recipientUsername?.charAt(0).toUpperCase() || "?"
            )}
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white leading-tight">
              {recipientUsername || "Chat"}
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Active now
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Messages Area */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className={`flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth transition-opacity duration-200 ${initialScrollDone ? "opacity-100" : "opacity-0"}`}
      >
        {loadingMore && (
          <div className="flex justify-center py-2">
            <div className="w-6 h-6 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
          </div>
        )}

        {messages.map((message, index) => {
          const isOwn = message.sender._id === currentUserId;
          const showDate =
            index === 0 ||
            new Date(message.createdAt).toDateString() !==
              new Date(messages[index - 1].createdAt).toDateString();

          return (
            <div key={message._id}>
              {showDate && (
                <div className="flex justify-center sticky top-0 z-10 mb-4 pt-2">
                  <span className="px-3 py-1 text-xs font-semibold text-slate-500 bg-white/80 dark:bg-slate-900/80 backdrop-blur rounded-full shadow-sm border border-slate-100 dark:border-slate-800">
                    {formatDate(message.createdAt)}
                  </span>
                </div>
              )}

              <div
                id={`message-${message._id}`}
                className={`group flex flex-col ${isOwn ? "items-end" : "items-start"} mb-2 transition-all duration-300`}
              >
                {/* Reply Context */}
                {message.replyTo && !message.isDeletedForEveryone && (
                  <div
                    className={`
                          flex items-center gap-2 mb-1 text-xs text-slate-500 
                          ${isOwn ? "mr-2 flex-row-reverse" : "ml-12"}
                          opacity-70 hover:opacity-100 transition-opacity cursor-pointer
                      `}
                  >
                    <div className="w-1 h-3 bg-slate-300 rounded-full"></div>
                    <span>Replying to {message.replyTo.sender.username}</span>
                  </div>
                )}

                <div
                  className={`flex items-end gap-2 max-w-[85%] md:max-w-[70%] ${isOwn ? "flex-row-reverse" : "flex-row"}`}
                >
                  {/* Avatar (Partner) */}
                  {!isOwn && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300 select-none overflow-hidden">
                      {message.sender.avatar ? (
                        <img
                          src={message.sender.avatar}
                          alt="Avatar"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        message.sender.username.charAt(0).toUpperCase()
                      )}
                    </div>
                  )}

                  {/* Bubble */}
                  <div className="relative group/bubble">
                    <div
                      className={`px-4 py-2.5 rounded-2xl text-[15px] leading-relaxed shadow-sm relative
                            ${
                              isOwn
                                ? "bg-blue-600 text-white rounded-br-none"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-none"
                            }
                            ${message.isDeletedForEveryone ? "italic opacity-60" : ""}
                        `}
                    >
                      {!message.isDeletedForEveryone && message.replyTo && (
                        <div
                          onClick={() => {
                            const replyElement = document.getElementById(
                              `message-${message.replyTo?._id}`,
                            );
                            if (replyElement) {
                              replyElement.scrollIntoView({
                                behavior: "smooth",
                                block: "center",
                              });
                              replyElement.classList.add(
                                "ring-2",
                                "ring-blue-500",
                              );
                              setTimeout(() => {
                                replyElement.classList.remove(
                                  "ring-2",
                                  "ring-blue-500",
                                );
                              }, 2000);
                            }
                          }}
                          className={`
                                    flex mb-2 p-2 rounded text-xs border-l-2 opacity-90 cursor-pointer hover:opacity-100 transition-opacity
                                    ${
                                      isOwn
                                        ? "bg-blue-700/50 border-blue-300 hover:bg-blue-700/60"
                                        : "bg-slate-200 dark:bg-slate-700 border-slate-400 hover:bg-slate-300 dark:hover:bg-slate-600"
                                    }
                                `}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold mb-0.5 opacity-75">
                              {message.replyTo.sender.username}
                            </p>
                            <p className="line-clamp-1 truncate">
                              {message.replyTo.text ||
                                (message.replyTo.mediaUrl
                                  ? message.replyTo.mediaType === "video"
                                    ? "Video"
                                    : message.replyTo.mediaType === "audio"
                                      ? "Voice record"
                                      : "Photo"
                                  : "")}
                            </p>
                          </div>
                          {message.replyTo.mediaUrl && (
                            <div className="flex-shrink-0 w-12 h-12 rounded overflow-hidden border border-white/20 ml-2">
                              {message.replyTo.mediaType === "video" ? (
                                <div className="w-full h-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center">
                                  <svg
                                    className="w-6 h-6 text-slate-500 dark:text-slate-300"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                    <path
                                      fillRule="evenodd"
                                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                </div>
                              ) : message.replyTo.mediaType === "audio" ? (
                                <div className="w-full h-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center">
                                  <Mic className="w-6 h-6 text-slate-500 dark:text-slate-300" />
                                </div>
                              ) : (
                                <img
                                  src={message.replyTo.mediaUrl}
                                  className="w-full h-full object-cover"
                                  alt="Reply preview"
                                />
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {message.mediaUrl && !message.isDeletedForEveryone && (
                        <div className="mb-2 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 max-w-[320px] bg-slate-100 dark:bg-slate-800 relative group">
                          {message.mediaType === "video" ? (
                            <div className="relative">
                              <video
                                src={message.mediaUrl}
                                controls
                                controlsList="noremoteplayback"
                                disablePictureInPicture
                                className="w-full max-h-[320px] object-contain"
                                onLoadedData={scrollToBottom}
                              />
                            </div>
                          ) : message.mediaType === "audio" ? (
                            <AudioPlayer src={message.mediaUrl!} />
                          ) : (
                            <>
                              <img
                                src={message.mediaUrl}
                                alt="Shared media"
                                className="w-full max-h-[320px] object-cover cursor-pointer hover:opacity-95 transition-opacity"
                                onClick={() =>
                                  window.open(message.mediaUrl, "_blank")
                                }
                                onLoad={scrollToBottom}
                              />
                              <a
                                href={message.mediaUrl}
                                download
                                className="absolute top-2 right-2 p-2 bg-black/60 hover:bg-black/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Download"
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                  />
                                </svg>
                              </a>
                            </>
                          )}
                        </div>
                      )}

                      {message.text && (
                        <p className="whitespace-pre-wrap break-words">
                          {message.text}
                        </p>
                      )}
                    </div>

                    {/* Reactions Display (Stacked) */}
                    {message.reactions && message.reactions.length > 0 && !message.isDeletedForEveryone && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className={`absolute -bottom-6 ${
                          isOwn ? "right-0" : "left-0"
                        } flex items-center z-10 cursor-pointer group/reactions`}
                      >
                        <div className={`
                          flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 
                          rounded-full px-1.5 py-0.5 shadow-sm hover:shadow-md transition-all duration-200 gap-1
                          ${isOwn ? "flex-row-reverse" : "flex-row"}
                        `}>
                          <div className="flex -space-x-1.5">
                            {Array.from(new Set(message.reactions.map((r) => r.emoji)))
                              .slice(0, 3) // Show first 3 distinct emojis
                              .map((emoji, idx) => (
                                <span 
                                  key={emoji} 
                                  className="text-[13px] bg-white dark:bg-slate-800 rounded-full ring-1 ring-slate-100 dark:ring-slate-700"
                                  style={{ zIndex: 10 - idx }}
                                >
                                  {emoji}
                                </span>
                              ))}
                          </div>
                          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 px-0.5">
                            {message.reactions.length}
                          </span>
                        </div>
                        
                        {/* Hover Details Tooltip (with bridge to prevent closing) */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 hidden group-hover/reactions:flex flex-col pb-3 z-50 pointer-events-auto">
                           <div className="bg-slate-900 text-white p-2 rounded-lg text-[10px] whitespace-nowrap shadow-xl border border-slate-700 animate-in fade-in zoom-in duration-200">
                             {Array.from(new Set(message.reactions.map(r => r.emoji))).map(emoji => {
                               const userReacted = message.reactions!.some(r => r.userId === currentUserId && r.emoji === emoji);
                               return (
                                 <div 
                                   key={emoji} 
                                   className={`flex items-center gap-2 p-1.5 rounded cursor-pointer transition-colors ${userReacted ? "hover:bg-red-500/20 text-blue-400" : "hover:bg-white/10"}`}
                                   onClick={(e) => {
                                     e.stopPropagation();
                                     if (userReacted) {
                                       removeReaction(message._id, emoji);
                                     } else {
                                       if (!socket) return;
                                       socket.emit("add-reaction", {
                                         chatId,
                                         messageId: message._id,
                                         emoji,
                                       });
                                     }
                                   }}
                                 >
                                   <span>{emoji}</span>
                                   <span className="opacity-70">{message.reactions!.filter(r => r.emoji === emoji).length}</span>
                                   {userReacted && <span className="text-[8px] opacity-50 ml-1">(click to remove)</span>}
                                 </div>
                               );
                             })}
                           </div>
                        </div>
                      </div>
                    )}

                    {/* Emoji Picker Popover */}
                    {showEmojiPicker === message._id && (
                      <div
                        ref={emojiPickerRef}
                        onClick={(e) => e.stopPropagation()}
                        className={`
                          fixed z-[9999] shadow-2xl rounded-xl
                          ${isOwn 
                            ? "right-4 sm:right-auto sm:translate-x-0" 
                            : "left-4 sm:left-auto sm:translate-x-0"
                          }
                          bottom-20 sm:bottom-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2
                        `}
                      >
                        <EmojiPicker
                          onEmojiClick={(emojiData) =>
                            handleReaction(emojiData, message._id)
                          }
                          theme={Theme.AUTO}
                          skinTonesDisabled
                          searchDisabled
                          width={320}
                          height={400}
                        />
                      </div>
                    )}

                    {/* Message Actions Menu */}
                    {!message.isDeletedForEveryone && (
                      <div
                        className={`
                          absolute top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover/bubble:opacity-100 transition-opacity p-1 bg-white dark:bg-slate-900 rounded-lg shadow-md border border-slate-100 dark:border-slate-800 z-10
                          ${isOwn ? "-left-[120px]" : "-right-[120px]"}
                        `}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowEmojiPicker(
                              showEmojiPicker === message._id ? null : message._id
                            );
                          }}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 hover:text-yellow-500 dark:hover:text-yellow-400 transition-colors"
                          title="React"
                        >
                          <Smile className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => startReply(message)}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500"
                          title="Reply"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                            />
                          </svg>
                        </button>
                        {isOwn && (
                          <>
                            {message.text && (
                              <button
                                onClick={() => startEdit(message)}
                                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500"
                                title="Edit"
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                                  />
                                </svg>
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(message._id)}
                              className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded text-red-500"
                              title="Delete"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Metadata */}
                <div
                  className={`flex items-center gap-1 mt-1 text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider
                    ${isOwn ? "mr-0 justify-end" : "ml-10 justify-start"}
                `}
                >
                  {message.isEdited && !message.isDeletedForEveryone && (
                    <span className="italic mr-1">edited</span>
                  )}
                  <span>{formatTime(message.createdAt)}</span>
                  {isOwn && !message.isDeletedForEveryone && (
                    <MessageStatusIcon
                      status={message.status}
                      className="ml-1"
                    />
                  )}
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
              <span
                className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                style={{ animationDelay: "0ms" }}
              />
              <span
                className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                style={{ animationDelay: "300ms" }}
              />
            </div>
            <span className="font-medium text-xs">
              {typingUsers.length === 1
                ? `${typingUsers[0]} is typing...`
                : `${typingUsers.length} people are typing...`}
            </span>
          </div>
        )}
      </div>

      {/* Input Form */}
      <footer className="p-4 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 shrink-0">
        {(replyingTo || editingMessage) && (
          <div className="max-w-4xl mx-auto mb-2 flex items-center justify-between px-4 py-2 bg-slate-100 dark:bg-slate-900 rounded-lg border-l-4 border-blue-500">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex flex-col text-sm flex-1 min-w-0">
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  {editingMessage
                    ? "Editing Message"
                    : `Replying to ${replyingTo?.sender.username}`}
                </span>
                <span className="text-slate-600 dark:text-slate-400 line-clamp-1 text-xs truncate">
                  {editingMessage
                    ? editingMessage.text
                    : replyingTo?.text ||
                      (replyingTo?.mediaUrl
                        ? replyingTo.mediaType === "video"
                          ? "Video"
                          : replyingTo.mediaType === "audio"
                            ? "Voice record"
                            : "Photo"
                        : "")}
                </span>
              </div>
              {replyingTo?.mediaUrl && (
                <div className="flex-shrink-0 w-10 h-10 rounded overflow-hidden border border-slate-200 dark:border-slate-700">
                  {replyingTo.mediaType === "video" ? (
                    <div className="w-full h-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-slate-500"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  ) : replyingTo.mediaType === "audio" ? (
                    <div className="w-full h-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                      <Mic className="w-5 h-5 text-slate-500" />
                    </div>
                  ) : (
                    <img
                      src={replyingTo.mediaUrl}
                      className="w-full h-full object-cover"
                      alt="Reply media"
                    />
                  )}
                </div>
              )}
            </div>
            <button
              onClick={() => {
                setReplyingTo(null);
                setEditingMessage(null);
                setNewMessage("");
              }}
              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full flex-shrink-0 ml-2"
            >
              <svg
                className="w-4 h-4 text-slate-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        <form
          className={`max-w-4xl mx-auto flex items-center gap-3 px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-[28px] focus-within:ring-2 focus-within:ring-blue-500/20 transition-all border border-transparent focus-within:border-blue-500/30 ${
            isRecording ? "ring-2 ring-red-500/20 border-red-500/30" : ""
          }`}
          onSubmit={handleSend}
        >
          {isRecording ? (
            <div className="flex-1 flex items-center gap-4 animate-in fade-in duration-200">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
              <span className="font-mono text-slate-700 dark:text-slate-200 font-medium min-w-[50px]">
                {formatRecordingTime(recordingDuration)}
              </span>
              <div className="flex-1 text-xs text-slate-400">Recording...</div>
              <button
                type="button"
                onClick={cancelRecording}
                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full text-slate-500 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*,video/*,audio/*"
                onChange={handleFileUpload}
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 transition-all"
              >
                {uploading ? (
                  <div className="w-5 h-5 border-2 border-slate-400 border-t-blue-500 rounded-full animate-spin" />
                ) : (
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                    />
                  </svg>
                )}
              </button>

              <textarea
                ref={inputRef}
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(e.target.value);

                  if (socket && e.target.value.trim() && !editingMessage) {
                    if (typingTimeoutRef.current)
                      clearTimeout(typingTimeoutRef.current);

                    if (!isTypingRef.current) {
                      socket.emit("user-typing", {
                        chatId,
                        username: recipientUsername || "You",
                      });
                      isTypingRef.current = true;
                    }

                    typingTimeoutRef.current = setTimeout(() => {
                      if (socket) {
                        socket.emit("user-stopped-typing", {
                          chatId,
                          username: recipientUsername || "You",
                        });
                        isTypingRef.current = false;
                      }
                    }, 2000);
                  }
                }}
                onKeyDown={handleKeyDown}
                placeholder={
                  editingMessage ? "Edit your message..." : "Type a message..."
                }
                rows={1}
                disabled={sending}
                className="flex-1 max-h-32 py-2.5 bg-transparent border-none focus:ring-0 text-[15px] text-slate-900 dark:text-white placeholder-slate-400 resize-none overflow-y-auto"
              />
            </>
          )}

          {isRecording ? (
            <button
              type="button"
              onClick={stopRecording}
              className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-blue-600 text-white transition-all hover:scale-105 active:scale-95 shadow-md shadow-blue-500/20"
            >
              <Send className="w-5 h-5" />
            </button>
          ) : (
            <button
              type={newMessage.trim() || sending ? "submit" : "button"}
              onClick={
                !newMessage.trim() && !sending ? startRecording : undefined
              }
              disabled={sending && !isRecording}
              className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 ${
                newMessage.trim() || sending
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
              }`}
            >
              {sending ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : newMessage.trim() ? (
                editingMessage ? (
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  <Send className="w-5 h-5 translate-x-0.5" />
                )
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </button>
          )}
        </form>
      </footer>
    </div>
  );
}