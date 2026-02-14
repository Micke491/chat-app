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
import { EmojiClickData } from "emoji-picker-react";
import { Message, ChatWindowProps } from "../../types/chat";
import ChatHeader from "./ChatHeader";
import MessageItem from "./MessageItem";
import MessageInput from "./MessageInput";

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
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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

  const handleMessageChange = (val: string) => {
    setNewMessage(val);

    if (socket && val.trim() && !editingMessage) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

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
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500">
        <div className="w-10 h-10 mb-4 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-sm font-medium">Loading messages...</p>
      </div>
    );
  }

  const filteredMessages = searchQuery.trim()
    ? messages.filter((m) =>
        m.text?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : messages;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950">
      <ChatHeader
        recipientUsername={recipientUsername}
        recipientAvatar={recipientAvatar}
        onClose={() => (onClose ? onClose() : router.push("/chat"))}
        showSearch={showSearch}
        setShowSearch={setShowSearch}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

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

        {filteredMessages.map((message, index) => {
          const isOwn = message.sender._id === currentUserId;
          const showDate =
            index === 0 ||
            new Date(message.createdAt).toDateString() !==
              new Date(filteredMessages[index - 1].createdAt).toDateString();

          return (
            <MessageItem
              key={message._id}
              message={message}
              currentUserId={currentUserId}
              searchQuery={searchQuery}
              isOwn={isOwn}
              showDate={showDate}
              dateLabel={formatDate(message.createdAt)}
              onReply={startReply}
              onEdit={startEdit}
              onDelete={handleDelete}
              onReaction={handleReaction}
              onRemoveReaction={removeReaction}
              scrollToBottom={scrollToBottom}
              showEmojiPicker={showEmojiPicker}
              setShowEmojiPicker={setShowEmojiPicker}
              socket={socket}
              chatId={chatId}
            />
          );
        })}
        <div ref={messagesEndRef} />

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

      <MessageInput
        newMessage={newMessage}
        setNewMessage={handleMessageChange}
        replyingTo={replyingTo}
        setReplyingTo={setReplyingTo}
        editingMessage={editingMessage}
        setEditingMessage={setEditingMessage}
        sending={sending}
        uploading={uploading}
        isRecording={isRecording}
        recordingDuration={recordingDuration}
        handleSend={handleSend}
        handleFileUpload={handleFileUpload}
        handleKeyDown={handleKeyDown}
        startRecording={startRecording}
        stopRecording={stopRecording}
        cancelRecording={cancelRecording}
        fileInputRef={fileInputRef}
        inputRef={inputRef}
        formatRecordingTime={formatRecordingTime}
      />
    </div>
  );
}
