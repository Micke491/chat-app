"use client";

import { useEffect, useState, ReactNode, MouseEvent } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useSessionCheck } from "@/features/auth/hooks/useSessionCheck";
import { Logo } from "@/components/ui/Logo";
import {
  MessageSquare,
  Video,
  Image as ImageIcon,
  Lock,
  Users,
  Palette,
  Github,
  ArrowRight,
  Zap,
  Shield,
  Activity,
  CheckCircle2,
  Smartphone,
  Monitor,
  Globe,
  Sparkles,
  KeyRound,
  ChevronDown,
  Download,
  ShieldCheck,
  Loader2,
} from "lucide-react";

const APK_URL = "/download";

const INSTALL_STEPS = [
  {
    title: "Download the APK",
    body: "Tap the button above to download vokitoki.apk.",
  },
  {
    title: "Allow the install",
    body: 'Open the downloaded file. If Android asks, allow installs from this source ("Install unknown apps") for your browser or Files app.',
  },
  {
    title: "Install & open",
    body: "Tap Install, then Open. Sign in with your VokiToki account and you're ready to go.",
  },
];

function DownloadApkButton() {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (isDownloading) {
      e.preventDefault();
      return;
    }
    setIsDownloading(true);
    setTimeout(() => setIsDownloading(false), 5000);
  };

  return (
    <a
      href={APK_URL}
      download="vokitoki.apk"
      onClick={handleClick}
      aria-disabled={isDownloading}
      className={`inline-flex items-center justify-center gap-2.5 rounded-xl bg-blue-600 px-7 py-3.5 text-base font-bold text-white shadow-[0_0_40px_-10px_rgba(37,99,235,0.6)] transition-all hover:-translate-y-0.5 hover:bg-blue-500 ${
        isDownloading ? "pointer-events-none opacity-70" : ""
      }`}
    >
      {isDownloading ? (
        <>
          <Loader2 size={20} className="animate-spin" /> Downloading…
        </>
      ) : (
        <>
          <Download size={20} /> Download for Android
        </>
      )}
    </a>
  );
}

function useIsMobileDevice() {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  useEffect(() => {
    const ua = navigator.userAgent;
    const mobileUA =
      /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    // iPadOS reports as Macintosh but has multi-touch
    const iPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
    setIsMobile(mobileUA || iPadOS);
  }, []);
  return isMobile;
}

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0 },
};

function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "0px 0px -80px 0px" }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

const DEMO_MESSAGES = [
  { me: false, name: "Lena", text: "Hey! Are we still on for the call tonight?" },
  { me: true, name: "You", text: "Yep, starting the video room now" },
  { me: false, name: "Lena", text: "Perfect, sending you the photos meanwhile" },
  { me: true, name: "You", text: "Got them instantly. This app is fast" },
];

function ChatDemo() {
  const [shown, setShown] = useState(0);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    if (shown < DEMO_MESSAGES.length) {
      setTyping(true);
      t = setTimeout(() => {
        setTyping(false);
        setShown((c) => c + 1);
      }, 1200);
    } else {
      t = setTimeout(() => setShown(0), 4000);
    }
    return () => clearTimeout(t);
  }, [shown]);

  const nextIsMe = shown < DEMO_MESSAGES.length && DEMO_MESSAGES[shown].me;

  return (
    <div className="relative w-full rounded-2xl border border-white/10 bg-[#0a0a0c]/90 backdrop-blur-xl shadow-2xl shadow-blue-950/40 overflow-hidden">
      {/* Window chrome */}
      <div className="h-11 border-b border-white/10 flex items-center px-4 bg-white/[0.03]">
        <div className="flex gap-2">
          <div className="w-3 h-3 rounded-full bg-zinc-700" />
          <div className="w-3 h-3 rounded-full bg-zinc-700" />
          <div className="w-3 h-3 rounded-full bg-zinc-700" />
        </div>
        <div className="mx-auto flex items-center gap-2 bg-white/5 px-4 py-1 rounded-md text-[11px] text-zinc-500 font-mono tracking-wider">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
          </span>
          vokitoki — Lena
        </div>
      </div>

      {/* Conversation */}
      <div className="h-[340px] flex flex-col justify-end gap-3 p-5 overflow-hidden">
        <AnimatePresence>
          {DEMO_MESSAGES.slice(0, shown).map((m, i) => (
            <motion.div
              key={`${i}-${m.text}`}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className={`max-w-[75%] ${m.me ? "self-end" : "self-start"}`}
            >
              <div
                className={`px-4 py-2.5 text-sm leading-relaxed rounded-2xl ${
                  m.me
                    ? "bg-blue-600 text-white rounded-br-sm"
                    : "bg-white/5 border border-white/10 text-zinc-300 rounded-bl-sm"
                }`}
              >
                {m.text}
              </div>
            </motion.div>
          ))}
          {typing && (
            <motion.div
              key="typing"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`flex gap-1.5 px-4 py-3 rounded-2xl w-fit ${
                nextIsMe
                  ? "self-end bg-blue-600/30"
                  : "self-start bg-white/5 border border-white/10"
              }`}
            >
              {[0, 1, 2].map((d) => (
                <motion.span
                  key={d}
                  className="w-1.5 h-1.5 rounded-full bg-zinc-400"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: d * 0.2 }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input bar */}
        <div className="mt-2 h-12 bg-white/5 border border-white/10 rounded-xl flex items-center px-4 gap-3 shrink-0">
          <div className="h-2.5 bg-white/15 rounded w-36" />
          <div className="ml-auto w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <ArrowRight size={14} className="text-white" />
          </div>
        </div>
      </div>
    </div>
  );
}

function AuroraBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <div className="absolute inset-0 bg-grid-pattern" />
      <motion.div
        className="absolute top-[-15%] left-[-5%] w-[550px] h-[550px] rounded-full bg-blue-600/15 blur-[140px]"
        animate={{ x: [0, 60, -30, 0], y: [0, 40, 80, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-[30%] right-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-600/12 blur-[140px]"
        animate={{ x: [0, -70, 30, 0], y: [0, -50, 30, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[-20%] left-[30%] w-[450px] h-[450px] rounded-full bg-blue-500/10 blur-[130px]"
        animate={{ x: [0, 50, -50, 0] }}
        transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

const FEATURES = [
  {
    icon: MessageSquare,
    title: "Instant Messaging",
    desc: "Messages are delivered in real time over persistent WebSocket connections with read receipts, replies, pinning and full message history.",
  },
  {
    icon: Video,
    title: "Voice & Video Calls",
    desc: "Peer-to-peer WebRTC calls with crystal-clear audio and HD video. Your call streams travel directly between participants whenever possible.",
  },
  {
    icon: ImageIcon,
    title: "File & Media Sharing",
    desc: "Share images, videos and documents with automatic optimization and compression, so media loads fast on any connection.",
  },
  {
    icon: Users,
    title: "Group Conversations",
    desc: "Create group chats with admin controls, member management and pinned messages — for friends, teams or whole communities.",
  },
  {
    icon: Sparkles,
    title: "Built-in AI Assistant",
    desc: "Chat with an integrated AI bot right inside the app, ask questions, draft messages or get quick answers without leaving a conversation.",
  },
  {
    icon: Palette,
    title: "Light & Dark Themes",
    desc: "A polished interface that adapts to your preference, with carefully tuned light and dark modes and smooth transitions between them.",
  },
];

const SECURITY_POINTS = [
  {
    icon: KeyRound,
    title: "Two-Factor Authentication",
    desc: "Protect your account with optional 2FA, a second verification step whenever you sign in from a new device.",
  },
  {
    icon: Shield,
    title: "Secure Sessions",
    desc: "Strict JWT-based sessions with automatic expiry, keep your account safe even on shared computers.",
  },
  {
    icon: Lock,
    title: "Protected Infrastructure",
    desc: "Encrypted transport (TLS) for all traffic, automated threat blocking and rate limiting against abuse.",
  },
];

const STEPS = [
  {
    title: "Create your account",
    desc: "Sign up with your email in under a minute. Verify your address, optionally enable 2FA, and you're in.",
  },
  {
    title: "Find your people",
    desc: "Search for friends by username, send contact requests and build your network — or create a group right away.",
  },
  {
    title: "Start talking",
    desc: "Send messages, share files and jump into voice or video calls. Everything happens in real time.",
  },
];

const FAQS = [
  {
    q: "Is VokiToki free to use?",
    a: "Yes. VokiToki is completely free — messaging, group chats, file sharing and voice/video calls are all included at no cost. The project is also open source under the MIT license.",
  },
  {
    q: "Can I use VokiToki on my phone?",
    a: "The web platform is built exclusively for desktop and laptop computers. On phones and tablets you'll use the dedicated mobile app instead — open vokitoki.com on your Android phone to get the direct download.",
  },
  {
    q: "How do voice and video calls work?",
    a: "Calls use WebRTC, the same technology behind major video platforms. Audio and video streams connect peer-to-peer whenever possible, which keeps latency low and quality high.",
  },
  {
    q: "Which browsers are supported?",
    a: "Any modern desktop browser works, Chrome, Edge, Firefox and Safari. For the best calling experience we recommend a Chromium-based browser.",
  },
  {
    q: "How is my account protected?",
    a: "All traffic is encrypted in transit, sessions use strict JWT tokens with automatic expiry, and you can enable two-factor authentication for an extra layer of protection on new devices.",
  },
];

const STATS = [
  { value: "<50ms", label: "Message Latency" },
  { value: "P2P", label: "WebRTC Calls" },
  { value: "2FA", label: "Account Security" },
  { value: "100%", label: "Free & Open Source" },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="glass-panel rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left cursor-pointer group"
      >
        <span className="text-base font-semibold text-white group-hover:text-blue-300 transition-colors">
          {q}
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.3 }}
          className="text-zinc-500 shrink-0"
        >
          <ChevronDown size={20} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="px-6 pb-5 text-sm text-zinc-400 leading-relaxed">
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MobileGate() {
  return (
    <main className="relative min-h-screen bg-[#050505] text-zinc-100 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute left-1/2 top-[-10%] h-[420px] w-[620px] -translate-x-1/2 rounded-full bg-blue-600/20 blur-[130px]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-center">
          <Logo />
        </div>

        {/* Hero */}
        <div className="flex flex-1 flex-col justify-center py-14">
          <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-semibold uppercase tracking-widest text-blue-300">
            <Smartphone size={14} /> Android app
          </div>

          <h1 className="text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl">
            Get VokiToki
            <br />
            on your phone
          </h1>
          <p className="mt-4 max-w-lg text-lg leading-relaxed text-zinc-400">
            The web platform works exclusively on desktop and laptop
            computers. Download the app directly, no app store required. It
            connects to the same VokiToki account you use on the web.
          </p>

          {/* Download button */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <DownloadApkButton />
            <span className="text-sm text-zinc-500">
              .apk &middot; Android only
            </span>
          </div>

          {/* Highlights */}
          <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3">
            <span className="inline-flex items-center gap-2 text-sm text-zinc-400">
              <MessageSquare size={16} className="text-blue-400" /> Real-time chat
            </span>
            <span className="inline-flex items-center gap-2 text-sm text-zinc-400">
              <Video size={16} className="text-blue-400" /> Voice &amp; video calls
            </span>
            <span className="inline-flex items-center gap-2 text-sm text-zinc-400">
              <ShieldCheck size={16} className="text-blue-400" /> Same account as web
            </span>
          </div>
        </div>

        {/* Install steps */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm sm:p-8">
          <h2 className="mb-5 text-lg font-bold tracking-tight text-white">
            How to install
          </h2>
          <ol className="space-y-5">
            {INSTALL_STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-blue-500/30 bg-blue-600/15 text-sm font-bold text-blue-300">
                  {i + 1}
                </span>
                <div>
                  <p className="font-semibold text-zinc-100">{step.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-6 border-t border-white/10 pt-4 text-xs leading-relaxed text-zinc-500">
            Your phone may warn that the app is from an unknown source because
            it&apos;s installed outside the Play Store. That&apos;s expected
            for a direct download. iPhone is not supported for direct
            install.
          </p>
        </div>

        <a
          href="https://github.com/Micke491/chat-app"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 flex items-center justify-center gap-1.5 text-xs text-zinc-600 transition-colors hover:text-zinc-400"
        >
          <Github size={13} /> Open source on GitHub
        </a>
      </div>
    </main>
  );
}

export default function LandingPage() {
  const { checking } = useSessionCheck();
  const isMobile = useIsMobileDevice();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (checking || isMobile === null) {
    return <div className="min-h-screen bg-[#050505]" />;
  }

  if (isMobile) {
    return <MobileGate />;
  }

  return (
    <>
      <style>{`
        @keyframes marquee { 0% { transform: translateX(0%); } 100% { transform: translateX(-50%); } }
        .animate-marquee { animation: marquee 38s linear infinite; }

        .bg-grid-pattern {
          background-size: 48px 48px;
          background-image:
            linear-gradient(to right, rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.025) 1px, transparent 1px);
          mask-image: linear-gradient(to bottom, black 30%, transparent 90%);
        }

        .glass-panel {
          background: rgba(15, 15, 17, 0.6);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        html { scroll-behavior: smooth; }
      `}</style>

      <div className="font-sans bg-[#050505] text-zinc-100 min-h-screen relative selection:bg-blue-500/30 selection:text-blue-200">
        <AuroraBackground />

        {/* ---------------- Navigation ---------------- */}
        <nav
          className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-300 ${
            scrolled
              ? "bg-[#050505]/80 backdrop-blur-xl border-b border-white/5"
              : "bg-transparent"
          }`}
        >
          <div className="max-w-7xl mx-auto h-20 px-8 flex items-center justify-between">
            <a href="#" className="no-underline">
              <Logo />
            </a>

            <div className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
              {[
                ["Features", "#features"],
                ["How it works", "#how-it-works"],
                ["Security", "#security"],
                ["FAQ", "#faq"],
              ].map(([label, href]) => (
                <a
                  key={href}
                  href={href}
                  className="text-sm font-medium text-zinc-400 hover:text-white transition-colors"
                >
                  {label}
                </a>
              ))}
            </div>

            <div className="flex items-center gap-5">
              <Link
                href="/auth-pages/login"
                className="text-sm font-medium text-zinc-400 hover:text-white transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/auth-pages/register"
                className="bg-white text-black px-6 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 hover:bg-zinc-200 transition-colors"
              >
                Get Started <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </nav>

        {/* ---------------- Hero ---------------- */}
        <section className="relative z-10 pt-40 pb-24 px-8">
          <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <motion.div
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="inline-flex items-center gap-2 glass-panel text-zinc-300 text-xs font-medium px-4 py-2 rounded-full mb-8"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                </span>
                All systems operational free & open source
              </motion.div>

              <motion.h1
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="text-5xl xl:text-6xl font-black leading-[1.05] tracking-tight text-white mb-6"
              >
                Talk, call and share.
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
                  All in one place.
                </span>
              </motion.h1>

              <motion.p
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="text-zinc-400 text-lg leading-relaxed mb-10 max-w-xl"
              >
                VokiToki brings real-time messaging, peer-to-peer voice and
                video calls, and effortless file sharing into a single secure
                platform, free forever, no ads, open source.
              </motion.p>

              <motion.div
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-center gap-4"
              >
                <Link
                  href="/auth-pages/register"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl text-base font-bold flex items-center gap-2 transition-colors shadow-lg shadow-blue-950/50"
                >
                  Create Free Account <ArrowRight size={18} />
                </Link>
                <a
                  href="https://github.com/Micke491/chat-app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="glass-panel text-white px-8 py-4 rounded-xl text-base font-medium flex items-center gap-2 hover:bg-white/10 transition-colors"
                >
                  <Github size={18} /> View Source
                </a>
              </motion.div>

              <motion.div
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                transition={{ duration: 0.7, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-center gap-6 mt-10 text-xs text-zinc-500 font-medium"
              >
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-blue-500" /> No credit card
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-blue-500" /> Setup in 1 minute
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-blue-500" /> MIT licensed
                </span>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.9, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <ChatDemo />
            </motion.div>
          </div>
        </section>

        {/* ---------------- Marquee ---------------- */}
        <div className="relative z-20 py-4 bg-zinc-900/60 border-y border-zinc-800 overflow-hidden flex items-center backdrop-blur-sm">
          <div className="flex w-max animate-marquee items-center">
            {[...Array(4)].map((_, idx) => (
              <div
                key={idx}
                className="flex gap-14 items-center px-7 text-xs font-bold text-zinc-500 uppercase tracking-widest whitespace-nowrap"
              >
                <span className="flex items-center gap-2">
                  <Zap size={15} /> Real-Time Messaging
                </span>
                <span>•</span>
                <span className="flex items-center gap-2">
                  <Video size={15} /> P2P Video Calls
                </span>
                <span>•</span>
                <span className="flex items-center gap-2">
                  <Shield size={15} /> 2FA Security
                </span>
                <span>•</span>
                <span className="flex items-center gap-2">
                  <Activity size={15} /> WebRTC Powered
                </span>
                <span>•</span>
                <span className="flex items-center gap-2">
                  <Sparkles size={15} /> AI Assistant
                </span>
                <span>•</span>
              </div>
            ))}
          </div>
        </div>

        {/* ---------------- Stats ---------------- */}
        <section className="relative z-10 py-24">
          <div className="max-w-6xl mx-auto px-8">
            <div className="grid grid-cols-4 gap-12 text-center">
              {STATS.map((s, idx) => (
                <Reveal key={s.label} delay={idx * 0.1}>
                  <div className="text-5xl font-black text-white tracking-tight mb-2">
                    {s.value}
                  </div>
                  <div className="text-xs text-zinc-500 font-bold uppercase tracking-widest">
                    {s.label}
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- Features ---------------- */}
        <section
          id="features"
          className="relative z-10 px-8 py-28 max-w-7xl mx-auto border-t border-white/5 scroll-mt-20"
        >
          <Reveal className="text-center mb-20">
            <h2 className="text-4xl xl:text-5xl font-black leading-tight mb-4 text-white tracking-tight">
              Everything you need to stay connected
            </h2>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
              One platform for conversations of every kind — from a quick
              message to a full video call with your whole group.
            </p>
          </Reveal>

          <div className="grid grid-cols-3 gap-7">
            {FEATURES.map((f, idx) => (
              <Reveal key={f.title} delay={(idx % 3) * 0.1}>
                <div className="h-full glass-panel rounded-2xl p-8 group transition-all duration-300 hover:bg-white/[0.05] hover:-translate-y-1 hover:border-blue-500/30">
                  <div className="mb-6 inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white/5 border border-white/10 text-blue-400 group-hover:bg-blue-600/15 group-hover:border-blue-500/30 transition-colors">
                    <f.icon size={22} />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-3 tracking-tight">
                    {f.title}
                  </h3>
                  <p className="text-zinc-400 leading-relaxed text-sm">
                    {f.desc}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ---------------- How it works ---------------- */}
        <section
          id="how-it-works"
          className="relative z-10 px-8 py-28 bg-zinc-950/50 border-y border-white/5 scroll-mt-20"
        >
          <div className="max-w-6xl mx-auto">
            <Reveal className="text-center mb-20">
              <h2 className="text-4xl font-black text-white mb-4 tracking-tight">
                Up and running in three steps
              </h2>
              <p className="text-zinc-400 text-lg">
                No downloads, no configuration, just open your browser.
              </p>
            </Reveal>

            <div className="grid grid-cols-3 gap-8">
              {STEPS.map((step, idx) => (
                <Reveal key={step.title} delay={idx * 0.15}>
                  <div className="relative glass-panel rounded-2xl p-8 h-full">
                    <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-blue-500/40 to-blue-500/5 mb-4">
                      {String(idx + 1).padStart(2, "0")}
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">
                      {step.title}
                    </h3>
                    <p className="text-zinc-400 leading-relaxed text-sm">
                      {step.desc}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- Security ---------------- */}
        <section
          id="security"
          className="relative z-10 px-8 py-28 max-w-7xl mx-auto scroll-mt-20"
        >
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <Reveal>
              <div className="inline-flex items-center gap-2 text-blue-400 text-sm font-bold uppercase tracking-widest mb-4">
                <Shield size={16} /> Security first
              </div>
              <h2 className="text-4xl font-black text-white mb-6 tracking-tight leading-tight">
                Your conversations,
                <br /> properly protected
              </h2>
              <p className="text-zinc-400 text-lg leading-relaxed mb-8 max-w-lg">
                Security isn&apos;t an afterthought. Every layer of VokiToki —
                from sign-in to calls, is built with protection in mind, and
                because the code is open source, anyone can verify it.
              </p>
              <a
                href="https://github.com/Micke491/chat-app"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 font-semibold text-sm transition-colors"
              >
                Inspect the code yourself <ArrowRight size={15} />
              </a>
            </Reveal>

            <div className="flex flex-col gap-5">
              {SECURITY_POINTS.map((p, idx) => (
                <Reveal key={p.title} delay={idx * 0.12}>
                  <div className="glass-panel rounded-2xl p-6 flex gap-5 items-start hover:border-blue-500/30 transition-colors">
                    <div className="shrink-0 w-11 h-11 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                      <p.icon size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white mb-1.5">
                        {p.title}
                      </h3>
                      <p className="text-zinc-400 text-sm leading-relaxed">
                        {p.desc}
                      </p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- Platforms ---------------- */}
        <section className="relative z-10 px-8 py-28 bg-zinc-950/50 border-y border-white/5">
          <div className="max-w-6xl mx-auto">
            <Reveal className="text-center mb-16">
              <h2 className="text-4xl font-black text-white mb-4 tracking-tight">
                Available where you work
              </h2>
              <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
                The web platform is designed for desktop computers. Phone and
                tablet users get a dedicated mobile app,
              </p>
            </Reveal>

            <div className="grid grid-cols-3 gap-7">
              <Reveal>
                <div className="glass-panel rounded-2xl p-8 h-full border-blue-500/30 relative overflow-hidden">
                  <div className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-widest bg-blue-600 text-white px-3 py-1 rounded-full">
                    Available now
                  </div>
                  <Globe size={28} className="text-blue-400 mb-5" />
                  <h3 className="text-lg font-bold text-white mb-2">
                    Web — Desktop &amp; Laptop
                  </h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">
                    The full VokiToki experience in any modern browser. No
                    installation needed just sign in and start talking.
                  </p>
                </div>
              </Reveal>
              <Reveal delay={0.1}>
                <div className="glass-panel rounded-2xl p-8 h-full relative overflow-hidden">
                  <div className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-widest bg-blue-600 text-white px-3 py-1 rounded-full">
                    Available now
                  </div>
                  <Smartphone size={28} className="text-blue-400 mb-5" />
                  <h3 className="text-lg font-bold text-white mb-2">
                    Mobile App
                  </h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">
                    A native-feeling app for Android phones and tablets.
                    Open VokiToki on your phone to get the download.
                  </p>
                </div>
              </Reveal>
              <Reveal delay={0.2}>
                <div className="glass-panel rounded-2xl p-8 h-full relative overflow-hidden">
                  <div className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-widest bg-zinc-800 text-zinc-400 px-3 py-1 rounded-full">
                    Coming soon
                  </div>
                  <Monitor size={28} className="text-blue-400 mb-5" />
                  <h3 className="text-lg font-bold text-white mb-2">
                    Desktop Client
                  </h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">
                    A standalone desktop application with system notifications
                    and deeper OS integration is on the roadmap.
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ---------------- FAQ ---------------- */}
        <section
          id="faq"
          className="relative z-10 px-8 py-28 max-w-3xl mx-auto scroll-mt-20"
        >
          <Reveal className="text-center mb-14">
            <h2 className="text-4xl font-black text-white mb-4 tracking-tight">
              Frequently asked questions
            </h2>
            <p className="text-zinc-400 text-lg">
              Everything you might want to know before getting started.
            </p>
          </Reveal>
          <div className="flex flex-col gap-4">
            {FAQS.map((f, idx) => (
              <Reveal key={f.q} delay={idx * 0.07}>
                <FaqItem q={f.q} a={f.a} />
              </Reveal>
            ))}
          </div>
        </section>

        {/* ---------------- Final CTA ---------------- */}
        <section className="relative z-10 px-8 py-32 text-center overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />
          <Reveal className="relative max-w-3xl mx-auto glass-panel rounded-[2rem] p-16 shadow-2xl">
            <h2 className="text-5xl font-black mb-6 text-white tracking-tight">
              Ready to start talking?
            </h2>
            <p className="text-zinc-400 max-w-xl mx-auto mb-10 text-lg">
              Create your free account and be chatting in under a minute. No
              credit card, no ads just great communication.
            </p>
            <div className="flex gap-4 justify-center items-center">
              <Link
                href="/auth-pages/register"
                className="bg-blue-600 text-white px-8 py-4 rounded-xl text-base font-bold shadow-lg shadow-blue-950/50 hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                Get Started Free <ArrowRight size={18} />
              </Link>
              <Link
                href="/auth-pages/login"
                className="glass-panel text-white px-8 py-4 rounded-xl text-base font-medium hover:bg-white/10 transition-colors"
              >
                Sign In
              </Link>
            </div>
          </Reveal>
        </section>

        {/* ---------------- Footer ---------------- */}
        <footer className="relative z-10 border-t border-zinc-900 bg-[#050505]">
          <div className="px-8 py-16 max-w-7xl mx-auto">
            <div className="grid grid-cols-4 gap-12 mb-12">
              <div className="col-span-1">
                <Logo className="mb-4" />
                <p className="text-sm text-zinc-500 leading-relaxed max-w-xs">
                  Free, open-source communication for everyone. Messaging,
                  calls and file sharing — all in one place.
                </p>
              </div>
              <div>
                <h4 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">
                  Product
                </h4>
                <div className="flex flex-col gap-3">
                  <a href="#features" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">Features</a>
                  <a href="#security" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">Security</a>
                  <a href="#faq" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">FAQ</a>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">
                  Account
                </h4>
                <div className="flex flex-col gap-3">
                  <Link href="/auth-pages/register" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">Create Account</Link>
                  <Link href="/auth-pages/login" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">Sign In</Link>
                  <Link href="/help" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">Help Center</Link>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">
                  Legal & More
                </h4>
                <div className="flex flex-col gap-3">
                  <Link href="/terms" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">Terms of Service</Link>
                  <Link href="/privacy" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">Privacy Policy</Link>
                  <Link href="/moderation" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">Moderation Policy</Link>
                  <a
                    href="https://github.com/Micke491/chat-app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1.5"
                  >
                    <Github size={13} /> GitHub
                  </a>
                </div>
              </div>
            </div>
            <div className="pt-8 border-t border-zinc-900 flex items-center justify-between">
              <span className="text-xs text-zinc-600 font-medium">
                © 2026 VokiToki. All rights reserved.
              </span>
              <span className="text-xs text-zinc-600 font-medium">
                MIT Licensed · Open Source
              </span>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
