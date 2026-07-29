'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Shield } from 'lucide-react';

const sections = [
  ['1. Who We Are', 'VokiToki is a personal project operated by Nikola Micić, based in Serbia. This is not a commercial company; there is no dedicated support or privacy contact address at this time.'],
  ['2. Information We Collect', 'We collect account and profile information such as username, email address, password hash, display name, bio, avatar, links, location and gender if you choose to provide them. We also process messages, media, stories, reactions, read receipts, device/session information, notification tokens, reports, and service logs needed to operate and secure VokiToki.'],
  ['3. How We Use Information', 'We use information to provide messaging, profiles, stories, calls, notifications, account security, moderation, abuse prevention, and service improvement.'],
  ['4. Service Providers and Sharing', 'We use MongoDB for application data, Cloudinary for media storage, Firebase Cloud Messaging for notifications, Brevo for transactional email, Google STUN/TURN services where configured for call connectivity, Giphy for GIF search, and Google Gemini for the optional AI Assistant. These providers may process data only as needed to provide their services. We may also disclose information when required by law or to protect users, the public, or our rights.'],
  ['5. AI Assistant', 'When you use the optional AI Assistant, your prompts and any files you choose to send to it are transmitted to Google Gemini to generate a response, and are processed under Google’s own terms and privacy policy in addition to ours. Do not send sensitive, confidential, or third-party personal information to the AI Assistant unless you understand and accept this processing. Your AI conversations are stored in your account so you can revisit them, and you can delete any AI chat at any time. AI responses are generated automatically without human review and may be inaccurate, incomplete, or fabricated; they are not professional advice and must not be relied on for important decisions. See the AI Assistant section of the Terms of Service for the full disclaimer and limits on liability.'],
  ['6. Calls and Location', 'Voice and video calls use WebRTC and are designed to connect participants directly where possible. Call setup signaling passes through our service and connectivity may use STUN or TURN services. We do not intentionally record call audio or video. If you choose to add location to your profile, the app requests location permission and uses it for that profile feature.'],
  ['7. Retention and Account Deletion', 'We retain personal data only for as long as needed for the purposes described here. When you delete an account, the account record is deleted; messages or media already delivered to other users may remain in their conversations, and limited information may be retained where necessary for security, abuse investigations, backups, legal obligations, or legal claims.'],
  ['8. Your Rights', 'Depending on where you live, you may have rights to request access, correction, deletion, restriction, objection, or portability of your personal data. As this is a personal project without a dedicated contact channel today, these requests can currently only be handled through in-app account and content controls.'],
  ['9. International Transfers and Security', 'Our providers may process information in countries other than yours. We use reasonable technical and organizational safeguards, including access controls and password hashing, but no online service can guarantee absolute security.'],
  ['10. Children and Changes', 'VokiToki is not intended for users below the minimum age required by applicable law. We may update this Policy and will update the date above.'],
];

export default function PrivacyPage() {
  const router = useRouter();
  return <main className="min-h-screen bg-[#09090b] px-4 py-12 font-sans text-zinc-100"><div className="mx-auto max-w-3xl">
    <button onClick={() => router.back()} className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-zinc-400 transition-colors hover:text-white"><ArrowLeft size={16} /> Back</button>
    <article className="rounded-[2.5rem] border border-zinc-800 bg-[#09090b]/80 p-8 shadow-2xl backdrop-blur-2xl md:p-12"><header className="mb-8 flex items-center gap-4 border-b border-zinc-800 pb-8"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-600/10"><Shield className="h-6 w-6 text-indigo-500" /></div><div><h1 className="text-3xl font-black tracking-tight">Privacy Policy</h1><p className="mt-1 text-zinc-400">Last updated: July 30, 2026</p></div></header>
      <div className="space-y-8 text-sm leading-relaxed text-zinc-300 md:text-base">{sections.map(([title, body]) => <section key={title}><h2 className="mb-3 text-xl font-bold text-zinc-100">{title}</h2><p>{body}</p></section>)}</div>
    </article></div></main>;
}
