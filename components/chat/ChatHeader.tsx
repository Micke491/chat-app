import React from "react";
import { Search, X } from "lucide-react";

interface ChatHeaderProps {
  recipientUsername?: string;
  recipientAvatar?: string;
  onClose?: () => void;
  showSearch: boolean;
  setShowSearch: (show: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

const ChatHeader = ({
  recipientUsername,
  recipientAvatar,
  onClose,
  showSearch,
  setShowSearch,
  searchQuery,
  setSearchQuery,
}: ChatHeaderProps) => {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shrink-0 z-10">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <button
          onClick={onClose}
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
        {!showSearch ? (
          <>
            <div className="flex items-center justify-center w-11 h-11 text-lg font-bold text-white rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 shadow-sm overflow-hidden shrink-0">
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
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white leading-tight truncate">
                {recipientUsername || "Chat"}
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Active now
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center bg-slate-100 dark:bg-slate-800 rounded-full px-4 py-1.5 animate-in slide-in-from-right-4 duration-300">
            <Search className="w-4 h-4 text-slate-400 mr-2" />
            <input
              autoFocus
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search messages..."
              className="flex-1 bg-transparent border-none outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-500"
            />
            <button
              onClick={() => {
                setShowSearch(false);
                setSearchQuery("");
              }}
              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {!showSearch && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSearch(true)}
            className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            title="Search"
          >
            <Search className="w-5 h-5" />
          </button>
        </div>
      )}
    </header>
  );
};

export default ChatHeader;
