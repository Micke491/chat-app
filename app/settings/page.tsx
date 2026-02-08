'use client';

import { useState, useEffect } from 'react';
import SideBar from '@/components/ui/sideBar';

interface User {
  _id: string;
  username: string;
  email: string;
  name?: string;
  avatar?: string;
}

export default function SettingsPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [notifications, setNotifications] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchCurrentUser();
    loadSettings();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch('/api/users/current_user', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) throw new Error('Not authenticated');
      const data = await response.json();
      setCurrentUser(data.user);
      setDisplayName(data.user.name || '');
      setAvatarUrl(data.user.avatar || '');
    } catch (error) {
      console.error('Error fetching user:', error);
      window.location.href = '/login';
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = () => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' || 'light';
    const savedNotifications = localStorage.getItem('notifications') !== 'false';
    const savedSound = localStorage.getItem('soundEnabled') !== 'false';

    setTheme(savedTheme);
    setNotifications(savedNotifications);
    setSoundEnabled(savedSound);
    applyTheme(savedTheme);
  };

  const applyTheme = (selectedTheme: 'light' | 'dark') => {
    document.documentElement.classList.toggle('dark', selectedTheme === 'dark');
    localStorage.setItem('theme', selectedTheme);
  };

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    applyTheme(newTheme);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/users/current_user', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          name: displayName,
          avatar: avatarUrl,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      const data = await response.json();
      setCurrentUser(data.user);
      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Failed to save profile changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/users/profile/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload image');
      }

      const data = await response.json();
      setAvatarUrl(data.url);
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      alert(error.message || 'Failed to upload profile picture.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const response = await fetch('/api/users/current_user', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete account');
      }

      localStorage.removeItem('token');
      localStorage.removeItem('theme');
      localStorage.removeItem('notifications');
      localStorage.removeItem('soundEnabled');
      window.location.href = '/auth-pages/login';
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('Failed to delete account. Please try again.');
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-950">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white dark:bg-slate-950 overflow-hidden">
      <SideBar currentUser={currentUser || undefined} />
      
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <header className="px-6 py-10 md:px-10 border-b border-slate-200 dark:border-slate-800">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Settings</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage your account and preferences</p>
        </header>

        <div className="max-w-3xl p-6 md:p-10 space-y-12">
          
          {/* Profile Section */}
          <section className="space-y-6">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Profile</h2>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
              <div className="relative w-24 h-24 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-3xl font-bold text-white shadow-xl overflow-hidden">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  currentUser?.username?.charAt(0).toUpperCase() || 'U'
                )}
                {uploading && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input
                  type="file"
                  id="avatar-upload"
                  className="hidden"
                  accept="image/*"
                  onChange={handleAvatarChange}
                />
                <button 
                  onClick={() => document.getElementById('avatar-upload')?.click()}
                  disabled={uploading}
                  className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  {uploading ? 'Uploading...' : 'Change Avatar'}
                </button>
                <p className="text-xs text-slate-400">Recommended: Square image, max 10MB</p>
              </div>
            </div>

            <div className="grid gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Username</label>
                <input 
                  type="text" 
                  value={currentUser?.username || ''} 
                  disabled 
                  className="w-full p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 cursor-not-allowed"
                />
                <p className="text-xs text-slate-400">Username cannot be changed</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
                <input 
                  type="email" 
                  value={currentUser?.email || ''} 
                  disabled 
                  className="w-full p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 cursor-not-allowed"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Display Name</label>
                <input 
                  type="text" 
                  placeholder="Enter display name" 
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                />
              </div>
            </div>

            <button 
              onClick={handleSaveProfile}
              disabled={saving}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-medium transition-all shadow-lg shadow-blue-500/20 active:scale-95"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </section>

          {/* Appearance Section */}
          <section className="space-y-6">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Appearance</h2>
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => handleThemeChange('light')}
                className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all ${theme === 'light' ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'}`}
              >
                <svg className={`w-6 h-6 ${theme === 'light' ? 'text-blue-600' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                </svg>
                <span className={`text-sm font-medium ${theme === 'light' ? 'text-blue-700 dark:text-blue-400' : 'text-slate-500'}`}>Light</span>
              </button>

              <button 
                onClick={() => handleThemeChange('dark')}
                className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all ${theme === 'dark' ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'}`}
              >
                <svg className={`w-6 h-6 ${theme === 'dark' ? 'text-blue-600' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
                <span className={`text-sm font-medium ${theme === 'dark' ? 'text-blue-700 dark:text-blue-400' : 'text-slate-500'}`}>Dark</span>
              </button>
            </div>
          </section>

          {/* Notifications Section */}
          <section className="space-y-6">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Notifications</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl">
                <div>
                  <p className="font-medium text-slate-900 dark:text-white text-sm">Push Notifications</p>
                  <p className="text-xs text-slate-500">Receive alerts for new messages</p>
                </div>
                <button 
                  onClick={() => setNotifications(!notifications)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notifications ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notifications ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl">
                <div>
                  <p className="font-medium text-slate-900 dark:text-white text-sm">Sound Effects</p>
                  <p className="text-xs text-slate-500">Play audio on notification</p>
                </div>
                <button 
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${soundEnabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${soundEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>
          </section>

          {/* Danger Zone */}
          <section className="pt-8 border-t border-slate-200 dark:border-slate-800 space-y-4">
            <h2 className="text-xl font-semibold text-red-600">Danger Zone</h2>
            <div className="p-4 border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="font-medium text-red-700 dark:text-red-400 text-sm">Delete Account</p>
                <p className="text-xs text-red-500/80">Permanently remove all your data and chats</p>
              </div>
              <button 
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-lg shadow-red-500/20"
              >
                Delete Account
              </button>
            </div>
          </section>

        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete Account?</h3>
                <p className="text-sm text-slate-500">This action cannot be undone</p>
              </div>
            </div>
            
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              Are you sure you want to permanently delete your account? All of your data, messages, and settings will be permanently removed.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-colors shadow-lg shadow-red-500/20 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}