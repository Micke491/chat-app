'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import SideBar from '@/features/sidebar/components/Sidebar';
import {
  ArrowLeft, Loader2, CheckCircle, AlertTriangle,
  User as UserIcon, Shield, Bell, Palette, Sparkles, LifeBuoy
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AccountSettingsTab from '@/features/settings/components/AccountSettingsTab';
import PrivacySettingsTab from '@/features/settings/components/PrivacySettingsTab';
import NotificationSettingsTab from '@/features/settings/components/NotificationSettingsTab';
import AppearanceSettingsTab from '@/features/settings/components/AppearanceSettingsTab';
import DangerZoneTab from '@/features/settings/components/DangerZoneTab';
import AISettingsTab, { BotPersona } from '@/features/settings/components/AISettingsTab';
import SupportAndLegalTab from '@/features/settings/components/SupportAndLegalTab';

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
  notificationPrefs?: {
    directMessages?: boolean;
    groupMessages?: boolean;
    calls?: boolean;
    chatRequests?: boolean;
  };
}

type TabType = 'account' | 'privacy' | 'notifications' | 'appearance' | 'ai' | 'support' | 'danger';

export default function SettingsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('account');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const response = await apiFetch(`/api/users/current_user`);
      if (!response.ok) throw new Error('Not authenticated');
      const data = await response.json();
      setCurrentUser(data.user);
      const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' || 'dark';
      const userTheme = data.user.theme === 'system' ? savedTheme : (data.user.theme || savedTheme);
      document.documentElement.setAttribute('data-theme', userTheme);
    } catch (error) {
      console.error('Error fetching user:', error);
      router.push('/auth-pages/login');
    } finally {
      setLoading(false);
    }
  };

  const handleUserUpdate = (updatedUser: User) => {
    setCurrentUser(updatedUser);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden">
        <div className="ambient-glow">
          <div className="ambient-glow-inner" />
        </div>
        <Loader2 className="w-10 h-10 text-chat-accent animate-spin relative z-10" />
      </div>
    );
  }

  const TABS = [
    { id: 'account', label: 'Account Settings', icon: UserIcon, danger: false },
    { id: 'privacy', label: 'Privacy & Security', icon: Shield, danger: false },
    { id: 'notifications', label: 'Notifications', icon: Bell, danger: false },
    { id: 'appearance', label: 'Appearance', icon: Palette, danger: false },
    { id: 'ai', label: 'AI Assistant', icon: Sparkles, danger: false },
    { id: 'support', label: 'Support & Legal', icon: LifeBuoy, danger: false },
    { id: 'danger', label: 'Danger Zone', icon: AlertTriangle, danger: true },
  ] as const;

  return (
    <div className="flex h-screen bg-background overflow-hidden relative selection:bg-chat-accent/30">
      <div className="ambient-glow">
        <div className="ambient-glow-inner" />
      </div>

      <div className="relative z-[100]">
        <SideBar
          currentUser={currentUser || undefined}
          isMobileDrawerOpen={false}
          onCloseMobileDrawer={() => {}}
        />
      </div>

      {/* Toast Notification */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-2xl shadow-2xl border flex items-center gap-3 backdrop-blur-xl"
            style={{
              backgroundColor: feedback.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              borderColor: feedback.type === 'success' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              color: feedback.type === 'success' ? '#22c55e' : '#ef4444'
            }}
          >
            {feedback.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            <span className="font-bold tracking-tight">{feedback.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col overflow-hidden relative z-10 w-full">
        {/* Header */}
        <header className="px-10 py-8 w-full max-w-6xl mx-auto border-b border-chat-border/50 shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/chat')}
              className="p-3 bg-chat-bg-secondary hover:bg-chat-hover border border-chat-border rounded-2xl text-chat-text-primary transition-all hover:scale-105"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-3xl font-black text-chat-text-primary tracking-tight">Settings</h1>
              <p className="text-chat-text-secondary font-medium mt-1">Manage your preferences and account</p>
            </div>
          </div>
        </header>

        <div className="flex-1 w-full max-w-6xl mx-auto flex flex-col md:flex-row gap-4 md:gap-8 px-4 md:px-10 pt-6 pb-12 overflow-hidden">
          {/* Settings Sub-Sidebar Menu */}
          <aside className="w-full md:w-64 shrink-0 flex md:flex-col gap-2 overflow-x-auto md:overflow-x-visible scrollbar-none pb-2 md:pb-0 z-20">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`flex items-center gap-3 px-5 py-4 rounded-2xl font-bold transition-all whitespace-nowrap md:w-full ${
                    isActive
                      ? tab.danger
                        ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                        : 'bg-chat-accent text-white shadow-lg shadow-chat-accent/20'
                      : 'text-chat-text-secondary hover:bg-chat-bg-secondary hover:text-chat-text-primary border border-transparent'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {tab.label}
                </button>
              );
            })}
          </aside>

          {/* Main Settings Content Area */}
          <main className="flex-1 max-w-3xl overflow-y-auto pr-2 pb-6 scrollbar-thin">
            <AnimatePresence mode="wait">
              {currentUser && (
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="bg-chat-glass backdrop-blur-2xl rounded-[2.5rem] shadow-2xl border border-chat-border p-10"
                >
                  {activeTab === 'account' && (
                    <AccountSettingsTab
                      currentUser={currentUser}
                      onUserUpdate={handleUserUpdate}
                      setFeedback={setFeedback}
                    />
                  )}
                  {activeTab === 'privacy' && (
                    <PrivacySettingsTab
                      currentUser={currentUser}
                      onUserUpdate={handleUserUpdate}
                      setFeedback={setFeedback}
                    />
                  )}
                  {activeTab === 'notifications' && (
                    <NotificationSettingsTab
                      currentUser={currentUser}
                      onUserUpdate={handleUserUpdate}
                      setFeedback={setFeedback}
                    />
                  )}
                  {activeTab === 'appearance' && (
                    <AppearanceSettingsTab
                      currentUser={currentUser}
                      onUserUpdate={handleUserUpdate}
                      setFeedback={setFeedback}
                    />
                  )}
                  {activeTab === 'ai' && (
                    <AISettingsTab
                      currentUser={currentUser}
                      onUserUpdate={handleUserUpdate}
                      setFeedback={setFeedback}
                    />
                  )}
                  {activeTab === 'support' && <SupportAndLegalTab />}
                  {activeTab === 'danger' && (
                    <DangerZoneTab setFeedback={setFeedback} />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </main>
        </div>
      </div>
    </div>
  );
}
