'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

interface SideBarProps {
  currentUser?: {
    _id: string;
    username: string;
    email: string;
  };
}

export default function SideBar({ currentUser }: SideBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/auth-pages/login');
  };

  const isActive = (path: string) => pathname?.startsWith(path);

  return (
    <aside className="sticky top-0 h-screen w-[72px] md:w-[280px] bg-gradient-to-b from-white via-blue-50 to-indigo-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-700">
      
      {/* Sidebar Header */}
      <div className="p-4 md:p-5 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="shrink-0 w-10 h-10 md:w-8 md:h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
              <path d="M16 8L8 16L16 24M16 8L24 16L16 24" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="hidden md:block text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 tracking-tight">
            ChatApp
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 md:p-4 space-y-1">
        <button 
          onClick={() => router.push('/chat')}
          className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all group ${
            isActive('/chat') 
            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30' 
            : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <svg className="shrink-0 w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          <span className="hidden md:block font-medium">Messages</span>
        </button>

        <button 
          onClick={() => router.push('/settings')}
          className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all group ${
            isActive('/settings') 
            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30' 
            : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <svg className="shrink-0 w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="hidden md:block font-medium">Settings</span>
        </button>
      </nav>

      {/* Footer / Profile Section */}
      <div className="p-3 md:p-4 border-t border-slate-200 dark:border-slate-800">
        <div className="relative">
          <button 
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
          >
            <div className="shrink-0 w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-inner">
              {currentUser?.username?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="hidden md:flex flex-1 flex-col items-start min-w-0">
              <span className="text-sm font-semibold text-slate-900 dark:text-white truncate w-full text-left">
                {currentUser?.username || 'User'}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 truncate w-full text-left">
                {currentUser?.email || 'No email provided'}
              </span>
            </div>
            <svg className={`hidden md:block w-4 h-4 text-slate-400 transition-transform ${showProfileMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Profile Popover Menu */}
          {showProfileMenu && (
            <div className="absolute bottom-full left-0 w-48 mb-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-in slide-in-from-bottom-2 duration-200">
              <button 
                onClick={() => { router.push('/settings'); setShowProfileMenu(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Settings
              </button>
              <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}