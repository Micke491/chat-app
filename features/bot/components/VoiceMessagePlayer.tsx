'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { formatDuration } from '../utils';

export default function VoiceMessagePlayer({ src, isUser }: { src: string; isUser: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => {
      setCurrentTime(audio.currentTime);
      if (audio.duration && isFinite(audio.duration)) {
        setProgress(audio.currentTime / audio.duration);
      }
    };
    const onLoaded = () => {
      if (audio.duration && isFinite(audio.duration)) setDuration(audio.duration);
    };
    const onEnd = () => {
      setPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    };
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('durationchange', onLoaded);
    audio.addEventListener('ended', onEnd);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('durationchange', onLoaded);
      audio.removeEventListener('ended', onEnd);
    };
  }, [src]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().catch(() => {});
      setPlaying(true);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
    setProgress(ratio);
  };

  const barCount = 24;
  const bars = useMemo(() => {
    let seed = 0;
    for (let i = 0; i < src.length; i++) seed = (seed * 31 + src.charCodeAt(i)) % 997;
    const arr: number[] = [];
    for (let i = 0; i < barCount; i++) {
      seed = (seed * 9301 + 49297) % 233280;
      const rand = seed / 233280;
      arr.push(0.25 + rand * 0.75);
    }
    return arr;
  }, [src]);

  return (
    <div className={`flex items-center gap-2.5 px-3 py-2.5 rounded-2xl min-w-[220px] max-w-[280px] ${isUser ? 'bg-chat-accent/10 border border-chat-accent/25 text-chat-text-primary' : 'bg-chat-bg-secondary text-chat-text-primary'}`}>
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
      <button
        onClick={togglePlay}
        className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors bg-chat-accent/15 hover:bg-chat-accent/25 text-chat-accent"
        title={playing ? 'Pause' : 'Play'}
      >
        {playing ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <div onClick={handleSeek} className="flex items-center gap-[2px] h-6 cursor-pointer">
          {bars.map((h, i) => {
            const barProgress = i / barCount;
            const isFilled = barProgress <= progress;
            return (
              <span
                key={i}
                className={`flex-1 rounded-full transition-colors ${isFilled ? 'bg-chat-accent' : 'bg-chat-text-tertiary/30'}`}
                style={{ height: `${Math.max(15, h * 100)}%` }}
              />
            );
          })}
        </div>
        <span className="text-[10px] mt-1 inline-block text-chat-text-tertiary">
          {formatDuration(playing || currentTime > 0 ? currentTime : duration)}
        </span>
      </div>
    </div>
  );
}
