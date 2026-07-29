'use client';

import { useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';

export default function CodeBlock({ children, className, ...props }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLElement>(null);

  const language = className?.replace('hljs language-', '').replace('language-', '') || '';

  const handleCopy = async () => {
    const text = codeRef.current?.textContent || '';
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div className="relative group/code">
      {language && (
        <div className="absolute top-0 left-0 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-chat-text-tertiary bg-white/5 rounded-br-lg rounded-tl-lg z-10">
          {language}
        </div>
      )}
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-chat-text-tertiary hover:text-chat-text-primary transition-all opacity-0 group-hover/code:opacity-100 z-10"
        title="Copy code"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
      <code ref={codeRef} className={className} {...props}>
        {children}
      </code>
    </div>
  );
}
