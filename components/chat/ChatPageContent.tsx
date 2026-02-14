"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ChatList from "@/components/chat/ChatList";
import ChatWindow from "@/components/chat/ChatWindow";
import NewChatModal from "@/components/chat/NewChatModal";
import SideBar from "@/components/layout/Sidebar";

interface User {
  _id: string;
  username: string;
  email: string;
  avatar?: string;
}

interface Chat {
  _id: string;
  participants: User[];
}

interface ChatPageContentProps {
  chatId?: string;
}

export default function ChatPageContent({ chatId }: ChatPageContentProps) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (chatId) {
      fetchChatDetails(chatId);
    }
  }, [chatId]);

  const fetchCurrentUser = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }
      const response = await fetch("/api/users/current_user", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error("Not authenticated");

      const data = await response.json();
      setCurrentUser(data.user);
    } catch (error) {
      console.error("Error fetching user:", error);
      router.push("/login");
    } finally {
      setLoading(false);
    }
  };

  const fetchChatDetails = async (id: string) => {
    if (!id || id === "[chatId]") return;
    try {
      const response = await fetch(`/api/chat/${id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.error("Chat not found in database");
          router.push("/chat");
        }
        throw new Error("Failed to fetch chat");
      }

      const data = await response.json();
      setSelectedChat(data);
    } catch (error) {
      console.error("Error fetching chat details:", error);
    }
  };

  const getRecipient = () => {
    if (!selectedChat || !currentUser) return null;
    return selectedChat.participants.find((p) => p._id !== currentUser._id);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-white dark:bg-slate-950 gap-4">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-slate-500 font-medium animate-pulse">
          Loading your messages...
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-indigo-700 via-purple-700 to-blue-700 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 overflow-hidden transition-colors duration-700">
      {/* 1. Global Navigation Sidebar */}
      <SideBar currentUser={currentUser || undefined} />

      <main className="flex flex-1 overflow-hidden">
        {/* 2. Conversations List Panel */}
        <div
          className={`
          relative flex-shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/40 backdrop-blur-md
          transition-all duration-300 ease-in-out
          w-full md:w-[320px] lg:w-[360px]
          ${chatId ? "hidden md:block" : "block"}
        `}
        >
          <ChatList
            currentUserId={currentUser?._id}
            selectedChatId={chatId}
            onChatSelect={(id) => router.push(`/chat/${id}`)}
          />

          {/* Floating Action Button */}
          <button
            onClick={() => setShowNewChatModal(true)}
            className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg shadow-blue-500/40 flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-10"
            title="New Chat"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M12 5v14m-7-7h14" />
            </svg>
          </button>
        </div>

        {/* 3. Chat Window Panel */}
        <div
          className={`
          flex-1 flex flex-col min-w-0 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md
          ${!chatId ? "hidden md:flex" : "flex"}
        `}
        >
          {chatId && currentUser ? (
            <ChatWindow
              chatId={chatId}
              currentUserId={currentUser._id}
              recipientUsername={getRecipient()?.username}
              recipientAvatar={getRecipient()?.avatar}
            />
          ) : (
            /* Empty State */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in-95 duration-500">
              <div className="relative mb-8">
                <div className="absolute inset-0 bg-blue-500/10 blur-3xl rounded-full" />
                <svg
                  className="relative w-32 h-32 text-slate-200 dark:text-slate-800"
                  viewBox="0 0 120 120"
                  fill="none"
                >
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                  />
                  <path
                    d="M60 35c-15 0-27 10-27 22 0 4.5 1.5 8.7 4 12.2V83l12.8-6.4c2.4.6 4.8 1 7.2 1 15 0 27-10 27-22S75 35 60 35z"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="currentColor"
                    fillOpacity="0.05"
                  />
                  <path
                    d="M45 52h30M45 62h15"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    opacity="0.5"
                  />
                </svg>
              </div>

              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                Select a conversation
              </h2>
              <p className="text-slate-500 dark:text-slate-400 max-w-sm mb-8">
                Choose an existing chat from the list or start a fresh
                conversation with someone new.
              </p>

              <button
                onClick={() => setShowNewChatModal(true)}
                className="px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-semibold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all active:scale-95 shadow-xl shadow-slate-200 dark:shadow-none"
              >
                Start New Chat
              </button>
            </div>
          )}
        </div>
      </main>

      {/* 4. Modals */}
      <NewChatModal
        isOpen={showNewChatModal}
        onClose={() => setShowNewChatModal(false)}
      />
    </div>
  );
}
