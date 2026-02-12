"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";

interface LinkPreviewData {
  title: string | null;
  description: string | null;
  image: string | null;
  url: string;
}

interface LinkPreviewProps {
  url: string;
}

export default function LinkPreview({ url }: LinkPreviewProps) {
  const [metadata, setMetadata] = useState<LinkPreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchMetadata = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");
        const response = await fetch(`/api/url-metadata?url=${encodeURIComponent(url)}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) throw new Error("Failed to fetch metadata");
        const data = await response.json();

        if (isMounted) {
          setMetadata(data);
          setLoading(false);
        }
      } catch (err) {
        console.error("LinkPreview error:", err);
        if (isMounted) {
          setError(true);
          setLoading(false);
        }
      }
    };

    fetchMetadata();

    return () => {
      isMounted = false;
    };
  }, [url]);

  if (loading) {
    return (
      <div className="mt-2 w-full max-w-[400px] h-24 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse border border-slate-200 dark:border-slate-700" />
    );
  }

  if (error || !metadata || (!metadata.title && !metadata.description)) {
    return null;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 flex flex-col sm:flex-row w-full max-w-[400px] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group no-underline"
    >
      {metadata.image && (
        <div className="sm:w-32 h-32 sm:h-auto shrink-0 relative overflow-hidden bg-slate-200 dark:bg-slate-800">
          <img
            src={metadata.image}
            alt={metadata.title || "Preview"}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      )}
      <div className="p-3 flex flex-col justify-between flex-1 min-w-0">
        <div className="space-y-1">
          {metadata.title && (
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-1 break-words">
              {metadata.title}
            </h4>
          )}
          {metadata.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 break-words leading-relaxed">
              {metadata.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-2 overflow-hidden">
          <ExternalLink className="w-3 h-3 text-blue-500 shrink-0" />
          <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 truncate">
            {new URL(url).hostname}
          </span>
        </div>
      </div>
    </a>
  );
}
