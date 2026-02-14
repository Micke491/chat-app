import React from "react";

interface HighlightTextProps {
  text: string;
  highlight: string;
}

const HighlightText = ({ text, highlight }: HighlightTextProps) => {
  if (!highlight.trim()) {
    return <p className="whitespace-pre-wrap break-words">{text}</p>;
  }

  const parts = text.split(new RegExp(`(${highlight})`, "gi"));

  return (
    <p className="whitespace-pre-wrap break-words">
      {parts.map((part, i) =>
        part.toLowerCase() === highlight.toLowerCase() ? (
          <mark
            key={i}
            className="bg-yellow-300 dark:bg-yellow-600/50 text-slate-900 dark:text-white rounded-sm px-0.5"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </p>
  );
};

export default HighlightText;
