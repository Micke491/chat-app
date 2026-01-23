"use client";

import { MessageCircle, Download, LogIn, UserPlus, Zap, Shield, Users } from 'lucide-react';
import Link from 'next/link';

export default function ChatIntro() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700">
      {/* Navigation */}
      <nav className="absolute top-0 left-0 right-0 z-10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <MessageCircle className="w-8 h-8" />
            <span className="text-2xl font-bold">ChatFlow</span>
          </div>
          <div className="flex gap-3">
            <Link href="/login">
              <button className="px-5 py-2 text-white font-medium hover:bg-white/10 rounded-lg transition-colors cursor-pointer">
                Login
              </button>
            </Link>
            <Link href="/register">
              <button className="px-5 py-2 bg-white text-purple-600 font-medium rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                Sign Up
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative min-h-screen flex items-center justify-center px-6">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-purple-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
          <div className="absolute top-1/3 right-1/4 w-72 h-72 bg-indigo-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse delay-700"></div>
          <div className="absolute bottom-1/4 left-1/3 w-72 h-72 bg-violet-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse delay-1000"></div>
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <div className="inline-block mb-6 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-white text-sm font-medium">
             The future of communication is here
        </div>
          
          <h1 className="text-6xl md:text-7xl font-bold text-white mb-6 leading-tight">
            Connect With
            <span className="block bg-gradient-to-r from-yellow-200 via-pink-200 to-purple-200 bg-clip-text text-transparent">
              Anyone, Anywhere
            </span>
          </h1>
          
          <p className="text-xl text-purple-100 mb-12 max-w-2xl mx-auto">
            Experience seamless conversations with end-to-end encryption, lightning-fast messaging, and a beautiful interface that works everywhere.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            <button className="group px-8 py-4 bg-white text-purple-600 font-semibold rounded-xl hover:bg-gray-50 transition-all transform hover:scale-105 flex items-center gap-2 shadow-2xl cursor-pointer">
              <Download className="w-5 h-5 group-hover:animate-bounce" />
              Download Now
            </button>
            <Link href="/login">
              <button className="relative px-8 py-4 bg-white/10 backdrop-blur-md text-white font-semibold rounded-xl hover:bg-white/20 transition-all transform hover:scale-105 border-2 border-white/30 hover:border-white/50 flex items-center gap-2 shadow-lg overflow-hidden group cursor-pointer">
                <div className="absolute inset-0 bg-gradient-to-r from-pink-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <LogIn className="w-5 h-5 relative z-10 group-hover:rotate-12 transition-transform" />
                <span className="relative z-10">Login</span>
              </button>
            </Link>
            <Link href="/register">
              <button className="px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold rounded-xl hover:from-pink-600 hover:to-purple-600 transition-all transform hover:scale-105 flex items-center gap-2 shadow-xl cursor-pointer">
                <UserPlus className="w-5 h-5" />
                Register Free
              </button>
            </Link>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-all">
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center mb-4 mx-auto">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-white font-semibold text-lg mb-2">Lightning Fast</h3>
              <p className="text-purple-200 text-sm">Messages delivered instantly with real-time synchronization</p>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-all">
              <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl flex items-center justify-center mb-4 mx-auto">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-white font-semibold text-lg mb-2">Secure & Private</h3>
              <p className="text-purple-200 text-sm">End-to-end encryption keeps your conversations safe</p>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-all">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl flex items-center justify-center mb-4 mx-auto">
                <Users className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-white font-semibold text-lg mb-2">Group Chats</h3>
              <p className="text-purple-200 text-sm">Create groups and collaborate with unlimited members</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}