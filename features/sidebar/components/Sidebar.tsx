"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Logo } from "@/components/ui/Logo";

interface SideBarProps {
  currentUser?: {
    _id: string;
    username: string;
    email: string;
    avatar?: string;
  };
  isMobileDrawerOpen?: boolean;
  onCloseMobileDrawer?: () => void;
  isHidden?: boolean;
}

import { removeAuthToken } from "@/lib/storage";

export default function SideBar({
  currentUser,
  isMobileDrawerOpen,
  onCloseMobileDrawer,
  isHidden,
}: SideBarProps) {
  if (isHidden) return null;
  const pathname = usePathname();
  const router = useRouter();
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const handleLogout = () => {
    removeAuthToken();
    router.push("/auth-pages/login");
  };

  const isActive = (path: string) => pathname?.startsWith(path);

  const navItems = [
    {
      label: "Messages",
      path: "/chat",
      icon: (
        <svg
          className="shrink-0 w-6 h-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
          />
        </svg>
      ),
    },
    {
      label: "AI Assistant",
      path: "/bot",
      icon: <Sparkles className="shrink-0 w-6 h-6" />,
    },
    {
      label: "Profile",
      path: "/profile",
      icon: (
        <svg
          className="shrink-0 w-6 h-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      ),
    },
    {
      label: "Settings",
      path: "/settings",
      icon: (
        <svg
          className="shrink-0 w-6 h-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      ),
    },
  ];

  return (
    <>
      {/* Sidebar (Always Desktop View) */}
      <aside
        className={`
          sticky top-0 left-0 h-screen z-[101] bg-chat-glass backdrop-blur-xl border-r border-chat-border flex flex-col transition-all duration-300
          w-[280px]
        `}
      >
        {/* Sidebar Header */}
        <div className="p-5 border-b border-chat-border flex items-center justify-between">
          <Logo iconClassName="w-9 h-9" textClassName="text-xl text-chat-text-primary" />
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => {
                router.push(item.path);
              }}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all group ${
                isActive(item.path)
                  ? "bg-chat-accent text-white shadow-md shadow-chat-accent/30 font-bold"
                  : "text-chat-text-secondary hover:bg-chat-hover hover:text-chat-text-primary"
              }`}
            >
              <div
                className={
                  isActive(item.path) ? "text-white" : "text-chat-accent"
                }
              >
                {item.icon}
              </div>
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Profile Section */}
        <div className="p-4 border-t border-chat-border pb-safe mb-0">
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-chat-hover transition-colors"
            >
              <div className="shrink-0 w-10 h-10 rounded-full bg-gradient-to-tr from-chat-accent to-chat-accent-secondary flex items-center justify-center text-white font-bold shadow-inner overflow-hidden">
                {currentUser?.avatar ? (
                  <img
                    src={currentUser.avatar}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  currentUser?.username?.charAt(0).toUpperCase() || "U"
                )}
              </div>
              <div className="flex flex-1 flex-col items-start min-w-0">
                <span className="text-sm font-semibold text-chat-text-primary truncate w-full text-left">
                  {currentUser?.username || "User"}
                </span>
              </div>
              <svg
                className={`w-4 h-4 text-chat-text-tertiary transition-transform ${showProfileMenu ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {/* Profile Popover Menu */}
            {showProfileMenu && (
              <div className="absolute bottom-full left-0 w-full mb-3 bg-chat-glass backdrop-blur-2xl border border-chat-border rounded-2xl shadow-xl overflow-hidden animate-in slide-in-from-bottom-2 duration-200 z-[110]">
                <button
                  onClick={() => {
                    router.push("/profile");
                    setShowProfileMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-chat-text-secondary hover:bg-chat-hover transition-colors"
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
                      strokeWidth="2"
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  My Profile
                </button>
                <div className="h-px bg-chat-border mx-2" />
                <button
                  onClick={() => {
                    router.push("/settings");
                    setShowProfileMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-chat-text-secondary hover:bg-chat-hover transition-colors"
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
                      strokeWidth="2"
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  Settings
                </button>

                <div className="h-px bg-chat-border mx-2" />
                <button
                  onClick={() => {
                    router.push("/help");
                    setShowProfileMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-chat-text-secondary hover:bg-chat-hover transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    Help & Support
                </button>

                <div className="h-px bg-chat-border mx-2" />
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-500/10 transition-colors font-bold"
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
                      strokeWidth="2"
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
