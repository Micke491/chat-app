'use client';

import { useCallback, useEffect, useState } from 'react';
import { Gavel } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '@/lib/api';
import { getAuthToken } from '@/lib/storage';

function formatRemaining(until: Date): string {
  const ms = until.getTime() - Date.now();
  if (ms <= 0) return 'a moment';
  const minutes = Math.ceil(ms / 60000);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.ceil(hours / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}

export default function RestrictionBanner() {
  const [until, setUntil] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    if (!getAuthToken()) {
      setUntil(null);
      return;
    }
    try {
      const response = await apiFetch('/api/users/current_user');
      if (!response.ok) return;
      const data = await response.json();
      const raw = data?.user?.timeoutUntil;
      const parsed = raw ? new Date(raw) : null;
      setUntil(parsed && parsed.getTime() > Date.now() ? parsed : null);
    } catch {
      // Offline or cold server: keep whatever we last knew.
    }
  }, []);

  useEffect(() => {
    refresh();

    const onRestricted = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.timeoutUntil) setUntil(new Date(detail.timeoutUntil));
      else refresh();
    };

    window.addEventListener('account-restricted', onRestricted);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener('account-restricted', onRestricted);
      window.removeEventListener('focus', refresh);
    };
  }, [refresh]);

  useEffect(() => {
    if (!until) return;
    const ms = until.getTime() - Date.now();
    const timer = setTimeout(() => setUntil(null), Math.max(ms, 0) + 1000);
    return () => clearTimeout(timer);
  }, [until]);

  return (
    <AnimatePresence>
      {until && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[99998] max-w-[92vw] px-4 py-2.5 bg-red-500/10 border border-red-500/30 backdrop-blur-xl rounded-full shadow-xl flex items-center gap-2 text-red-500"
        >
          <Gavel className="w-4 h-4 shrink-0" />
          <span className="text-xs font-bold tracking-tight select-none">
            Your account is restricted for {formatRemaining(until)}. You cannot send messages or post
            stories.
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
