import React, { useRef, useEffect } from "react";
import { Mic, Smile } from "lucide-react";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";
import { Message } from "../../types/chat";
import MessageStatusIcon from "./MessageStatusIcon";
import AudioPlayer from "./AudioPlayer";
import LinkPreview from "./LinkPreview";
import HighlightText from "./HighlightText";
import { Socket } from "socket.io-client";

interface MessageItemProps {
  message: Message;
  currentUserId: string;
  searchQuery: string;
  isOwn: boolean;
  showDate: boolean;
  dateLabel?: string;
  onReply: (message: Message) => void;
  onEdit: (message: Message) => void;
  onDelete: (messageId: string) => void;
  onReaction: (emojiData: EmojiClickData, messageId: string) => void;
  onRemoveReaction: (messageId: string, emoji: string) => void;
  scrollToBottom: () => void;
  showEmojiPicker: string | null;
  setShowEmojiPicker: (id: string | null) => void;
  socket: Socket | null;
  chatId: string;
}

const MessageItem = ({
  message,
  currentUserId,
  searchQuery,
  isOwn,
  showDate,
  dateLabel,
  onReply,
  onEdit,
  onDelete,
  onReaction,
  onRemoveReaction,
  scrollToBottom,
  showEmojiPicker,
  setShowEmojiPicker,
  socket,
  chatId,
}: MessageItemProps) => {
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
  }, [setShowEmojiPicker]);

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const handleReplyClick = () => {
    const replyElement = document.getElementById(`message-${message.replyTo?._id}`);
    if (replyElement) {
      replyElement.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      replyElement.classList.add("ring-2", "ring-blue-500");
      setTimeout(() => {
        replyElement.classList.remove("ring-2", "ring-blue-500");
      }, 2000);
    }
  };

  return (
    <div key={message._id}>
      {showDate && dateLabel && (
        <div className="flex justify-center sticky top-0 z-10 mb-4 pt-2">
          <span className="px-3 py-1 text-xs font-semibold text-slate-500 bg-white/80 dark:bg-slate-900/80 backdrop-blur rounded-full shadow-sm border border-slate-100 dark:border-slate-800">
            {dateLabel}
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
                  onClick={handleReplyClick}
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
                <>
                  <HighlightText
                    text={message.text}
                    highlight={searchQuery}
                  />
                  {(() => {
                    const urlRegex = /(https?:\/\/[^\s]+)/g;
                    const matches = message.text.match(urlRegex);
                    if (matches && matches.length > 0) {
                      return <LinkPreview url={matches[0]} />;
                    }
                    return null;
                  })()}
                </>
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
                               onRemoveReaction(message._id, emoji);
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
                    onReaction(emojiData, message._id)
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
                  onClick={() => onReply(message)}
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
                        onClick={() => onEdit(message)}
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
                      onClick={() => onDelete(message._id)}
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
};

export default MessageItem;
