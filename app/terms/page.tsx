'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';

const sections = [
  ['1. Acceptance of Terms', 'By creating an account or using VokiToki, you agree to these Terms and our Privacy Policy. If you do not agree, do not use the service.'],
  ['2. Operator', 'VokiToki is an independent, personal project operated by Nikola Micić, based in Serbia.'],
  ['3. Eligibility and Account Security', 'You must provide accurate account information and keep your credentials confidential. You are responsible for activity on your account. Do not create an account if you are below the minimum age required by the laws that apply to you.'],
  ['4. Acceptable Use', 'You must not use VokiToki to harass, threaten, abuse, impersonate, exploit, or harm others; send spam or unauthorized advertising; share illegal, infringing, or harmful material; evade a restriction; or interfere with the security or operation of the service.'],
  ['5. Moderation and Enforcement', 'We may investigate reports and remove content, limit features, mute, suspend, or permanently terminate an account that violates these Terms or creates a safety or security risk. We may act immediately for serious violations. Read our Moderation Policy for more detail.'],
  ['6. Your Content', 'You keep ownership of content you submit. You give VokiToki the limited permission needed to host, process, transmit, display, and store that content to operate and improve the service, enforce these Terms, and keep users safe. You must have the rights needed to share your content.'],
  ['7. AI Assistant', 'The AI Assistant is an optional feature that generates responses using a third-party model (Google Gemini). Its output is produced automatically, is not reviewed by a human, and may be inaccurate, incomplete, outdated, biased, or entirely fabricated — including content that looks confident, cites sources, or appears authoritative. It is provided for general information and convenience only. It is not professional advice, and you must not rely on it for medical, legal, financial, tax, safety, security, employment, or any other decision where being wrong could cause harm or loss. Always verify anything important with a qualified professional or an authoritative source before acting on it. You are solely responsible for how you use AI output, for any content you generate with it, and for any consequences of relying on it. Do not submit sensitive, confidential, or third-party personal information to the AI Assistant. AI answers do not come from us, are not our statements, opinions, or recommendations, and are not endorsed or verified by us. The feature may be rate-limited, changed, or withdrawn at any time.'],
  ['8. Availability and Changes', 'This is a personal project run without a dedicated support team. Features may change, be suspended, or be discontinued at any time. We may update these Terms; material changes will be announced through the service. Continuing to use VokiToki after the effective date means you accept the updated Terms.'],
  ['9. Disclaimers and Liability', 'VokiToki is provided “as is” and “as available”, without warranties of any kind, express or implied, including any implied warranties of merchantability, fitness for a particular purpose, non-infringement, or accuracy. To the extent permitted by law, we do not guarantee uninterrupted, error-free, or completely secure service, and we specifically make no warranty that AI Assistant output is accurate, reliable, complete, current, or fit for any purpose. To the fullest extent permitted by law, we are not liable for any indirect, incidental, special, consequential, exemplary, or punitive damages, nor for any loss of profits, data, goodwill, business, or opportunity, arising from or relating to your use of VokiToki or your reliance on AI Assistant output — including any decision, action, or omission based on it — even if we were advised of the possibility. Nothing in these Terms excludes or limits liability for fraud, death or personal injury caused by negligence, or any other liability that cannot legally be excluded or limited, and nothing limits rights that cannot legally be limited. Where liability cannot be excluded, it is limited to the minimum permitted by law.'],
  ['10. Governing Law', 'These Terms are governed by the laws of Serbia, without regard to conflict-of-law principles.'],
];

export default function TermsPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-[#09090b] px-4 py-12 font-sans text-zinc-100">
      <div className="mx-auto max-w-3xl">
        <button onClick={() => router.back()} className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-zinc-400 transition-colors hover:text-white">
          <ArrowLeft size={16} /> Back
        </button>
        <article className="rounded-[2.5rem] border border-zinc-800 bg-[#09090b]/80 p-8 shadow-2xl backdrop-blur-2xl md:p-12">
          <header className="mb-8 flex items-center gap-4 border-b border-zinc-800 pb-8">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-600/10"><FileText className="h-6 w-6 text-blue-500" /></div>
            <div><h1 className="text-3xl font-black tracking-tight">Terms of Service</h1><p className="mt-1 text-zinc-400">Last updated: July 30, 2026</p></div>
          </header>
          <div className="space-y-8 text-sm leading-relaxed text-zinc-300 md:text-base">
            {sections.map(([title, body]) => <section key={title}><h2 className="mb-3 text-xl font-bold text-zinc-100">{title}</h2><p>{body}</p></section>)}
            <p className="text-zinc-400">See the <Link href="/privacy" className="text-blue-400 hover:underline">Privacy Policy</Link> and <Link href="/moderation" className="text-blue-400 hover:underline">Moderation Policy</Link>.</p>
          </div>
        </article>
      </div>
    </main>
  );
}
