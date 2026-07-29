'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  AudioLines, Check, ChevronDown, Loader2, Mic, Paperclip, Send, Square, Trash, Type, X,
} from 'lucide-react';
import { PendingAttachment } from '../types';
import { ACCEPT_ATTR, formatBytes, formatDuration } from '../utils';

function RecordingWaveform() {
  const bars = 32;
  return (
    <div className="flex-1 flex items-center gap-[3px] h-7 overflow-hidden px-1">
      {[...Array(bars)].map((_, i) => (
        <motion.span
          key={i}
          className="flex-1 rounded-full bg-gradient-to-t from-red-500 to-rose-400 min-w-[2px]"
          animate={{
            height: [
              `${18 + ((i * 29) % 55)}%`,
              `${30 + ((i * 53) % 70)}%`,
              `${18 + ((i * 29) % 55)}%`,
            ],
          }}
          transition={{
            duration: 0.55 + (i % 6) * 0.07,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.02,
          }}
        />
      ))}
    </div>
  );
}

export function MicDeviceMenu({
  position, devices, selectedDeviceId, onSelect, menuRef,
}: {
  position: { bottom: number; left: number; width: number };
  devices: MediaDeviceInfo[];
  selectedDeviceId: string | null;
  onSelect: (deviceId: string) => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.97 }}
      transition={{ duration: 0.15 }}
      style={{ position: 'fixed', bottom: position.bottom, left: position.left, width: position.width }}
      className="z-[9999] bg-chat-bg-secondary border border-chat-border rounded-2xl shadow-2xl py-2 max-h-64 overflow-y-auto"
    >
      <p className="px-3.5 py-2 text-[10px] font-bold uppercase tracking-widest text-chat-text-tertiary">
        Microphone
      </p>
      {devices.length === 0 ? (
        <p className="px-3.5 py-2.5 text-xs text-chat-text-tertiary leading-relaxed">
          No microphones found yet. Record once to grant permission, then reopen this list.
        </p>
      ) : (
        devices.map((d, i) => {
          const isSelected = selectedDeviceId ? d.deviceId === selectedDeviceId : i === 0;
          return (
            <button
              key={d.deviceId || i}
              onClick={() => onSelect(d.deviceId)}
              className={`w-full text-left px-3.5 py-2.5 text-xs flex items-center gap-2.5 transition-colors ${
                isSelected
                  ? 'bg-chat-accent/10 text-chat-accent font-medium'
                  : 'text-chat-text-secondary hover:bg-chat-hover hover:text-chat-text-primary'
              }`}
            >
              <Mic className="w-4 h-4 shrink-0" />
              <span className="truncate flex-1">{d.label || `Microphone ${i + 1}`}</span>
              {isSelected && <Check className="w-4 h-4 shrink-0" />}
            </button>
          );
        })
      )}
    </motion.div>
  );
}

interface BotComposerProps {
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onStopGeneration: () => void;
  sending: boolean;
  rateLimited: boolean;
  modelName: string;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  pendingAttachment: PendingAttachment | null;
  attachmentLoading: boolean;
  onClearAttachment: () => void;
  isComposerFocused: boolean;
  onFocusChange: (focused: boolean) => void;
  recorder: {
    isRecording: boolean;
    recordingSeconds: number;
    startRecording: () => void;
    finishRecording: () => void;
    cancelRecording: () => void;
    sttTranscript: string;
    sttInterim: string;
    sttSupported: boolean;
    showDeviceMenu: boolean;
    micWrapperRef: React.RefObject<HTMLDivElement | null>;
    toggleDeviceMenu: (e: React.MouseEvent) => void;
  };
}

export default function BotComposer({
  input, onInputChange, onSend, onStopGeneration,
  sending, rateLimited, modelName,
  inputRef, fileInputRef, onFileInputChange,
  pendingAttachment, attachmentLoading, onClearAttachment,
  isComposerFocused, onFocusChange, recorder,
}: BotComposerProps) {
  const {
    isRecording, recordingSeconds, startRecording, finishRecording, cancelRecording,
    sttTranscript, sttInterim, sttSupported, showDeviceMenu, micWrapperRef, toggleDeviceMenu,
  } = recorder;

  const hasContent = !!input.trim() || !!pendingAttachment;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="shrink-0 pointer-events-none absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-chat-bg-primary via-chat-bg-primary/90 to-transparent pt-10">
      <div className="pointer-events-auto max-w-3xl mx-auto px-4 md:px-6 pb-3 md:pb-4">
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_ATTR}
          onChange={onFileInputChange}
          className="hidden"
        />

        <motion.div
          animate={{
            borderColor: isRecording
              ? 'rgba(239,68,68,0.45)'
              : isComposerFocused
                ? 'var(--color-chat-accent, #6d5dfc)'
                : 'var(--color-chat-border)',
            boxShadow: isRecording
              ? '0 12px 40px -12px rgba(239,68,68,0.35)'
              : isComposerFocused
                ? '0 12px 40px -12px rgba(124,58,237,0.45)'
                : '0 10px 30px -14px rgba(0,0,0,0.55)',
          }}
          transition={{ duration: 0.25 }}
          className="relative flex flex-col gap-0 bg-chat-bg-secondary/95 backdrop-blur-xl border rounded-[30px] overflow-hidden"
        >
          <AnimatePresence>
            {(pendingAttachment || attachmentLoading) && !isRecording && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="overflow-hidden px-3 pt-3"
              >
                {pendingAttachment?.type === 'audio' ? (
                  <motion.div
                    initial={{ scale: 0.92 }}
                    animate={{ scale: 1 }}
                    className="inline-flex items-center gap-2.5 bg-chat-bg-primary border border-chat-border rounded-2xl p-2 pr-3 max-w-full"
                  >
                    <div className="relative w-10 h-10 rounded-lg bg-chat-accent/15 text-chat-accent flex items-center justify-center shrink-0">
                      <AudioLines className="w-5 h-5" />
                      {input.trim() && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm" title="Transcribed to text">
                          <Type className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-chat-text-primary flex items-center gap-1.5">
                        Voice message
                        {input.trim() && (
                          <span className="text-[9px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full uppercase tracking-wide">Transcribed</span>
                        )}
                      </p>
                      <p className="text-[10px] text-chat-text-tertiary">
                        {pendingAttachment.durationSec ? formatDuration(pendingAttachment.durationSec) : ''} · {formatBytes(pendingAttachment.sizeBytes)}{input.trim() ? ' · edit text below' : ' · ready to send'}
                      </p>
                    </div>
                    <button
                      onClick={onClearAttachment}
                      aria-label="Remove voice message"
                      title="Remove voice message"
                      className="ml-1 p-1.5 rounded-lg hover:bg-red-500/10 text-chat-text-tertiary hover:text-red-400 transition-colors shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ scale: 0.92 }}
                    animate={{ scale: 1 }}
                    className="inline-flex items-center gap-2.5 bg-chat-bg-primary border border-chat-border rounded-2xl p-2 pr-3 max-w-full"
                  >
                    {attachmentLoading ? (
                      <div className="w-12 h-12 rounded-lg bg-chat-hover flex items-center justify-center shrink-0">
                        <Loader2 className="w-4 h-4 animate-spin text-chat-text-tertiary" />
                      </div>
                    ) : pendingAttachment?.type === 'image' ? (
                      <img src={pendingAttachment.previewUrl} alt="Preview" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                    ) : (
                      <video src={pendingAttachment?.previewUrl} className="w-12 h-12 rounded-lg object-cover shrink-0" muted playsInline />
                    )}
                    {pendingAttachment && (
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-chat-text-primary truncate max-w-[180px]">{pendingAttachment.fileName}</p>
                        <p className="text-[10px] text-chat-text-tertiary">{formatBytes(pendingAttachment.sizeBytes)} · ready to send</p>
                      </div>
                    )}
                    {pendingAttachment && !attachmentLoading && (
                      <button
                        onClick={onClearAttachment}
                        aria-label="Remove attachment"
                        title="Remove attachment"
                        className="ml-1 p-1.5 rounded-lg hover:bg-red-500/10 text-chat-text-tertiary hover:text-red-400 transition-colors shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-1.5 items-end px-2.5 py-2.5">
            <AnimatePresence mode="wait" initial={false}>
              {isRecording ? (
                <motion.div
                  key="recording-row"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-1 flex-col gap-1.5 py-1"
                >
                  <div className="flex items-center gap-2">
                    <motion.button
                      onClick={cancelRecording}
                      whileHover={{ scale: 1.06 }}
                      whileTap={{ scale: 0.94 }}
                      title="Cancel recording"
                      aria-label="Cancel recording"
                      className="shrink-0 w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-colors"
                    >
                      <Trash className="w-4 h-4" />
                    </motion.button>

                    <div className="flex-1 flex items-center gap-2 min-w-0">
                      <motion.span
                        className="w-2 h-2 rounded-full bg-red-500 shrink-0"
                        animate={{ opacity: [1, 0.25, 1], scale: [1, 0.85, 1] }}
                        transition={{ duration: 1.1, repeat: Infinity }}
                      />
                      <span className="text-sm font-semibold text-chat-text-primary tabular-nums shrink-0">
                        {formatDuration(recordingSeconds)}
                      </span>
                      <RecordingWaveform />
                    </div>

                    <motion.button
                      onClick={finishRecording}
                      whileHover={{ scale: 1.06 }}
                      whileTap={{ scale: 0.94 }}
                      animate={{
                        boxShadow: [
                          '0 0 0px 0px rgba(124,58,237,0.4)',
                          '0 0 0px 8px rgba(124,58,237,0.0)',
                        ],
                      }}
                      transition={{ boxShadow: { duration: 1.4, repeat: Infinity } }}
                      title="Finish recording"
                      aria-label="Finish recording"
                      className="shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-chat-accent to-purple-600 flex items-center justify-center text-white shadow-md"
                    >
                      <Check className="w-4 h-4" />
                    </motion.button>
                  </div>

                  {sttSupported && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="flex items-start gap-2 px-1 pb-0.5"
                    >
                      <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                        <Type className="w-3 h-3 text-chat-accent" />
                        <span className="text-[10px] font-semibold text-chat-accent uppercase tracking-wider">Live</span>
                      </div>
                      <p className="text-xs text-chat-text-secondary leading-relaxed flex-1 min-w-0 line-clamp-2 break-words">
                        {(sttTranscript + sttInterim) || (
                          <span className="text-chat-text-tertiary italic">Listening for speech...</span>
                        )}
                        {(sttTranscript || sttInterim) && (
                          <motion.span
                            className="inline-block w-[2px] h-3 bg-chat-accent ml-0.5 align-middle"
                            animate={{ opacity: [1, 0, 1] }}
                            transition={{ duration: 0.8, repeat: Infinity }}
                          />
                        )}
                      </p>
                    </motion.div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="composer-row"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-1 gap-1 items-end"
                >
                  <motion.button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending || attachmentLoading || rateLimited}
                    whileHover={{ scale: 1.06, rotate: -8 }}
                    whileTap={{ scale: 0.94 }}
                    title="Attach an image or video"
                    aria-label="Attach an image or video"
                    className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-chat-text-tertiary hover:text-chat-accent hover:bg-chat-accent/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <Paperclip className="w-5 h-5" />
                  </motion.button>

                  <div className="flex-1 relative">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={e => onInputChange(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onFocus={() => onFocusChange(true)}
                      onBlur={() => onFocusChange(false)}
                      placeholder={
                        pendingAttachment?.type === 'audio'
                          ? 'Add a note about this voice message (optional)...'
                          : pendingAttachment
                            ? 'Ask something about this file (optional)...'
                            : 'Message VokiToki AI...'
                      }
                      rows={1}
                      disabled={sending || rateLimited}
                      className="w-full resize-none bg-transparent border-none px-2 py-3 pr-10 text-sm text-chat-text-primary placeholder:text-chat-text-tertiary focus:outline-none focus:ring-0 transition-all overflow-y-auto"
                      style={{ minHeight: '48px', maxHeight: '180px' }}
                      onInput={e => {
                        const el = e.currentTarget;
                        el.style.height = 'auto';
                        el.style.height = el.scrollHeight + 'px';
                      }}
                    />
                    <AnimatePresence>
                      {input.length > 100 && (
                        <motion.span
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className={`absolute bottom-2.5 right-0 text-[10px] font-medium ${input.length > 7500 ? 'text-red-400' : 'text-chat-text-tertiary'}`}
                        >
                          {input.length.toLocaleString()}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>

                  {sending ? (
                    <motion.button
                      key="stop"
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.6, opacity: 0 }}
                      onClick={onStopGeneration}
                      whileHover={{ scale: 1.06 }}
                      whileTap={{ scale: 0.94 }}
                      title="Stop generation"
                      aria-label="Stop generation"
                      className="shrink-0 w-12 h-12 rounded-full bg-red-500/90 hover:bg-red-500 flex items-center justify-center text-white shadow-md shadow-red-500/20 transition-colors"
                    >
                      <Square className="w-4 h-4 fill-current" />
                    </motion.button>
                  ) : !hasContent ? (
                    <motion.div
                      key="mic"
                      ref={micWrapperRef}
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.6, opacity: 0 }}
                      className="shrink-0 flex items-center"
                    >
                      <motion.button
                        onClick={startRecording}
                        disabled={attachmentLoading}
                        whileHover={{ scale: 1.06 }}
                        whileTap={{ scale: 0.94 }}
                        title="Record a voice message"
                        aria-label="Record a voice message"
                        className="w-12 h-12 rounded-full flex items-center justify-center text-chat-text-tertiary hover:text-chat-accent hover:bg-chat-accent/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <Mic className="w-5 h-5" />
                      </motion.button>

                      <motion.button
                        onClick={toggleDeviceMenu}
                        disabled={attachmentLoading}
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.94 }}
                        title="Choose microphone"
                        aria-label="Choose microphone"
                        className="group/chev w-7 h-12 -ml-1 flex items-center justify-center rounded-full text-chat-text-tertiary hover:text-chat-accent hover:bg-chat-accent/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <motion.span
                          animate={showDeviceMenu ? { rotate: 180 } : { rotate: 0 }}
                          transition={{ duration: 0.18 }}
                          className="flex items-center justify-center"
                        >
                          <ChevronDown className="w-3.5 h-3.5 transition-transform group-hover/chev:translate-y-0.5" />
                        </motion.span>
                      </motion.button>
                    </motion.div>
                  ) : (
                    <motion.button
                      key="send"
                      initial={{ scale: 0.6, opacity: 0, rotate: -45 }}
                      animate={{ scale: 1, opacity: 1, rotate: 0 }}
                      exit={{ scale: 0.6, opacity: 0 }}
                      onClick={onSend}
                      disabled={!hasContent || rateLimited}
                      whileHover={{ scale: 1.06 }}
                      whileTap={{ scale: 0.92 }}
                      title="Send message"
                      aria-label="Send message"
                      className="shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-chat-accent to-purple-600 flex items-center justify-center text-white shadow-md shadow-chat-accent/25 disabled:opacity-40 disabled:cursor-not-allowed transition-shadow"
                    >
                      <Send className="w-5 h-5" />
                    </motion.button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        <p className="text-center text-chat-text-tertiary text-[11px] mt-2 font-medium">
          VokiToki AI · Powered by {modelName} · AI can make mistakes — verify important information
        </p>
      </div>
    </div>
  );
}
