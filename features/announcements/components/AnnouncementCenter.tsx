'use client';

import { useCallback, useEffect, useState } from 'react';
import { Megaphone, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '@/lib/api';
import { getAuthToken } from '@/lib/storage';
import Portal from '@/components/ui/Portal';

interface Announcement {
  _id: string;
  title: string;
  body: string;
  createdByUsername: string;
  sentAt?: string;
}

const POLL_INTERVAL = 60_000;

export default function AnnouncementCenter() {
  const [queue, setQueue] = useState<Announcement[]>([]);
  const [dismissing, setDismissing] = useState(false);

  const fetchAnnouncements = useCallback(async () => {
    if (!getAuthToken()) {
      setQueue([]);
      return;
    }
    try {
      const response = await apiFetch('/api/announcements');
      if (!response.ok) return;
      const data = await response.json();
      setQueue(data.announcements || []);
    } catch {
      // Server asleep or offline — the next poll will pick these up.
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();

    const interval = setInterval(fetchAnnouncements, POLL_INTERVAL);
    window.addEventListener('focus', fetchAnnouncements);
    window.addEventListener('auth-update', fetchAnnouncements);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', fetchAnnouncements);
      window.removeEventListener('auth-update', fetchAnnouncements);
    };
  }, [fetchAnnouncements]);

  const current = queue[0];

  async function dismiss() {
    if (!current) return;
    setDismissing(true);
    try {
      await apiFetch(`/api/announcements/${current._id}/read`, { method: 'POST' });
      setQueue((q) => q.slice(1));
    } catch {
      setQueue((q) => q.slice(1));
    } finally {
      setDismissing(false);
    }
  }

  return (
    <Portal>
      <AnimatePresence>
        {current && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="bg-chat-bg-primary rounded-2xl shadow-2xl w-full max-w-md pointer-events-auto overflow-hidden border border-chat-border flex flex-col">
                <div className="p-5 border-b border-chat-border flex items-start justify-between gap-3 bg-chat-bg-secondary/50">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 bg-chat-accent/10 rounded-lg shrink-0">
                      <Megaphone className="w-5 h-5 text-chat-accent" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold text-chat-text-primary truncate">
                        {current.title}
                      </h2>
                      <p className="text-xs text-chat-text-tertiary">
                        Announcement from the Vokitoki team
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={dismiss}
                    disabled={dismissing}
                    className="p-2 hover:bg-chat-hover rounded-full text-chat-text-tertiary transition-colors shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 overflow-y-auto max-h-[60vh] custom-scrollbar">
                  <p className="text-sm text-chat-text-secondary whitespace-pre-wrap leading-relaxed">
                    {current.body}
                  </p>
                </div>

                <div className="p-4 border-t border-chat-border flex items-center justify-between gap-3">
                  <span className="text-[11px] text-chat-text-tertiary">
                    {queue.length > 1 ? `${queue.length - 1} more to read` : ''}
                  </span>
                  <button
                    onClick={dismiss}
                    disabled={dismissing}
                    className="px-5 py-2.5 rounded-xl bg-chat-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    Got it
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </Portal>
  );
}
