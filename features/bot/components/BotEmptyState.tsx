'use client';

import { motion } from 'framer-motion';
import { Code2, HelpCircle, Palette, PenLine, Phone, Shield, Sparkles } from 'lucide-react';

const SUGGESTIONS = [
  { icon: HelpCircle, text: 'What can you help me with?', color: 'from-blue-500/20 to-blue-600/10 border-blue-500/20 hover:border-blue-500/40' },
  { icon: Phone, text: 'How do I start a video call?', color: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/20 hover:border-emerald-500/40' },
  { icon: Shield, text: 'How do I enable Two-Factor Authentication?', color: 'from-amber-500/20 to-amber-600/10 border-amber-500/20 hover:border-amber-500/40' },
  { icon: Code2, text: 'Help me debug my code', color: 'from-purple-500/20 to-purple-600/10 border-purple-500/20 hover:border-purple-500/40' },
  { icon: PenLine, text: 'Help me write a professional message', color: 'from-rose-500/20 to-rose-600/10 border-rose-500/20 hover:border-rose-500/40' },
  { icon: Palette, text: 'How do I customize my chat theme?', color: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/20 hover:border-cyan-500/40' },
];

export default function BotEmptyState({ greeting, onPickSuggestion }: { greeting: string; onPickSuggestion: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 py-8">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="flex flex-col items-center gap-2 mb-10"
      >
        <div className="relative mb-2">
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            className="absolute -inset-3 rounded-full border border-dashed border-chat-accent/20"
          />
          <motion.div
            animate={{ rotate: [360, 0] }}
            transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
            className="absolute -inset-6 rounded-full border border-dashed border-purple-500/10"
          />
          <motion.div
            animate={{
              boxShadow: [
                '0 0 0px 0px rgba(124,58,237,0.0)',
                '0 0 36px 6px rgba(124,58,237,0.35)',
                '0 0 0px 0px rgba(124,58,237,0.0)',
              ],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-chat-accent via-purple-600 to-indigo-600 flex items-center justify-center relative"
          >
            <motion.div
              animate={{ rotate: [0, 8, -8, 0], scale: [1, 1.08, 1] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Sparkles className="w-8 h-8 text-white" />
            </motion.div>
          </motion.div>
        </div>
        <h2 className="text-2xl md:text-3xl font-black text-chat-text-primary tracking-tight text-center">
          Hi {greeting}
        </h2>
        <p className="text-chat-text-secondary text-sm md:text-base text-center max-w-lg">
          I&apos;m your VokiToki AI assistant. Ask me anything, upload a photo or video, or send me a voice message and I&apos;ll listen.
        </p>
        <p className="text-chat-text-tertiary text-xs text-center max-w-md mt-1 leading-relaxed">
          Answers are generated automatically and can be wrong or incomplete. This isn&apos;t professional advice — check anything important before you rely on it.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl px-2"
      >
        {SUGGESTIONS.map((s, idx) => {
          const Icon = s.icon;
          return (
            <motion.button
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + idx * 0.05 }}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onPickSuggestion(s.text)}
              className={`text-left p-4 rounded-2xl bg-gradient-to-br ${s.color} border backdrop-blur-sm transition-all group flex items-start gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent/40`}
            >
              <div className="shrink-0 mt-0.5">
                <Icon className="w-4 h-4 text-chat-text-secondary group-hover:text-chat-text-primary transition-colors" />
              </div>
              <span className="text-sm text-chat-text-secondary group-hover:text-chat-text-primary transition-colors font-medium leading-snug">
                {s.text}
              </span>
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}
