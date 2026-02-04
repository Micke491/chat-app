interface MessageStatusIconProps {
  status: 'sent' | 'delivered' | 'seen';
  className?: string;
}

export default function MessageStatusIcon({ status, className = "" }: MessageStatusIconProps) {
  if (status === 'seen') {
    return (
      <svg className={`w-4 h-4 text-blue-500 ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 6L7 17l-5-5" />
        <path d="M22 10l-7.5 7.5L13 16" />
      </svg>
    );
  }

  if (status === 'delivered') {
    return (
      <svg className={`w-4 h-4 text-slate-400 ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 6L7 17l-5-5" />
        <path d="M22 10l-7.5 7.5L13 16" />
      </svg>
    );
  }

  return (
    <svg className={`w-4 h-4 text-slate-400 ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
