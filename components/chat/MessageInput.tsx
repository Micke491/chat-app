import React from "react";
import { Mic, Send, Trash2 } from "lucide-react";
import { Message } from "../../types/chat";

interface MessageInputProps {
  newMessage: string;
  setNewMessage: (msg: string) => void;
  replyingTo: Message | null;
  setReplyingTo: (msg: Message | null) => void;
  editingMessage: Message | null;
  setEditingMessage: (msg: Message | null) => void;
  sending: boolean;
  uploading: boolean;
  isRecording: boolean;
  recordingDuration: number;
  handleSend: (e: React.FormEvent) => void;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  startRecording: () => void;
  stopRecording: () => void;
  cancelRecording: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  formatRecordingTime: (seconds: number) => string;
}

const MessageInput = ({
  newMessage,
  setNewMessage,
  replyingTo,
  setReplyingTo,
  editingMessage,
  setEditingMessage,
  sending,
  uploading,
  isRecording,
  recordingDuration,
  handleSend,
  handleFileUpload,
  handleKeyDown,
  startRecording,
  stopRecording,
  cancelRecording,
  fileInputRef,
  inputRef,
  formatRecordingTime,
}: MessageInputProps) => {
  return (
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
  );
};

export default MessageInput;
