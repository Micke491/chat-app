'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Sparkles, Code2, Trophy, User2, Check } from 'lucide-react';
import { motion } from 'framer-motion';

export type BotPersona = 'default' | 'coding' | 'coach' | 'sarcastic';

interface User {
  _id: string;
  username: string;
  email: string;
  name?: string;
  bio?: string;
  avatar?: string;
  gender?: string;
  location?: string;
  links?: { label: string; url: string }[];
  readReceipts: boolean;
  twoFactorEnabled: boolean;
  theme: 'light' | 'dark' | 'system';
  defaultWallpaper?: string;
  autoPlayGifs?: boolean;
  autoPlayVoice?: boolean;
  botPersona?: BotPersona;
}

interface AISettingsTabProps {
  currentUser: User;
  onUserUpdate: (user: User) => void;
  setFeedback: (feedback: { type: 'success' | 'error'; message: string } | null) => void;
}

const PERSONAS = [
  {
    id: 'default' as BotPersona,
    label: 'Friendly Assistant',
    description: 'Helpful, clear, and concise. Great for general questions and everyday tasks.',
    icon: User2,
    gradient: 'from-indigo-500 to-purple-600',
    glow: 'shadow-indigo-500/20',
  },
  {
    id: 'coding' as BotPersona,
    label: 'Expert Engineer',
    description: 'Speaks in code. Best practices, clean solutions, and technical depth.',
    icon: Code2,
    gradient: 'from-cyan-500 to-blue-600',
    glow: 'shadow-cyan-500/20',
  },
  {
    id: 'coach' as BotPersona,
    label: 'Life Coach',
    description: 'Motivating, goal-oriented, and uplifting. Push yourself further.',
    icon: Trophy,
    gradient: 'from-amber-500 to-orange-600',
    glow: 'shadow-amber-500/20',
  },
  {
    id: 'sarcastic' as BotPersona,
    label: 'Sarcastic Wit',
    description: 'Playfully mocking but always helpful. Banter included at no extra charge.',
    icon: Sparkles,
    gradient: 'from-pink-500 to-rose-600',
    glow: 'shadow-pink-500/20',
  },
];

export default function AISettingsTab({ currentUser, onUserUpdate, setFeedback }: AISettingsTabProps) {
  const [selected, setSelected] = useState<BotPersona>(currentUser.botPersona || 'default');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiFetch('/api/users/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botPersona: selected }),
      });
      if (!res.ok) throw new Error('Failed to save');
      const data = await res.json();
      onUserUpdate(data.user);
      setFeedback({ type: 'success', message: 'AI persona updated!' });
    } catch {
      setFeedback({ type: 'error', message: 'Failed to update AI persona.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-2xl bg-gradient-to-br from-chat-accent to-purple-600 shadow-lg shadow-chat-accent/30">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-chat-text-primary tracking-tight">AI Assistant</h2>
          <p className="text-chat-text-secondary text-sm mt-0.5">
            Choose the personality of your AI companion
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {PERSONAS.map((persona) => {
          const Icon = persona.icon;
          const isSelected = selected === persona.id;
          return (
            <motion.button
              key={persona.id}
              onClick={() => setSelected(persona.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`relative text-left p-5 rounded-3xl border-2 transition-all duration-200 ${
                isSelected
                  ? 'border-chat-accent bg-chat-accent/10 shadow-xl ' + persona.glow
                  : 'border-chat-border bg-chat-bg-secondary hover:border-chat-accent/40'
              }`}
            >
              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-4 right-4 w-6 h-6 rounded-full bg-chat-accent flex items-center justify-center shadow-lg"
                >
                  <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                </motion.div>
              )}

              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${persona.gradient} flex items-center justify-center mb-4 shadow-lg`}>
                <Icon className="w-6 h-6 text-white" />
              </div>

              <p className="font-bold text-chat-text-primary text-base">{persona.label}</p>
              <p className="text-chat-text-secondary text-sm mt-1 leading-relaxed">{persona.description}</p>
            </motion.button>
          );
        })}
      </div>

      <div className="flex gap-3 p-4 rounded-2xl bg-chat-accent/5 border border-chat-accent/20">
        <Sparkles className="w-5 h-5 text-chat-accent shrink-0 mt-0.5" />
        <p className="text-chat-text-secondary text-sm leading-relaxed">
          Your selected persona applies to all new and existing AI chats. You can change it at any time.
        </p>
      </div>

      <div className="flex justify-end">
        <motion.button
          onClick={handleSave}
          disabled={saving || selected === (currentUser.botPersona || 'default')}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-chat-accent to-purple-600 text-white font-bold shadow-lg shadow-chat-accent/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {saving ? 'Saving…' : 'Save Persona'}
        </motion.button>
      </div>
    </div>
  );
}