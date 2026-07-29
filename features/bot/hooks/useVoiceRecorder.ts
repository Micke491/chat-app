'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_AUDIO_BYTES, MAX_RECORDING_SECONDS, formatBytes, pickRecorderMimeType } from '../utils';

interface UseVoiceRecorderOptions {
  /** Receives the finished recording so it can be sent to the model as real audio. */
  onRecording: (blob: Blob, durationSec: number) => void;
  onError: (message: string) => void;
  disabled: () => boolean;
}

export function useVoiceRecorder({ onRecording, onError, disabled }: UseVoiceRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [micPermissionError, setMicPermissionError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStartRef = useRef<number>(0);
  const recordingCancelledRef = useRef(false);

  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [showDeviceMenu, setShowDeviceMenu] = useState(false);
  const [deviceMenuPos, setDeviceMenuPos] = useState<{ bottom: number; left: number; width: number } | null>(null);
  const micWrapperRef = useRef<HTMLDivElement>(null);
  const deviceMenuRef = useRef<HTMLDivElement>(null);

  const finishRecordingRef = useRef<() => void>(() => {});

  const stopRecordingStream = useCallback(() => {
    recordingStreamRef.current?.getTracks().forEach(t => t.stop());
    recordingStreamRef.current = null;
  }, []);

  const loadAudioDevices = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioDevices(devices.filter(d => d.kind === 'audioinput'));
    } catch {
      setAudioDevices([]);
    }
  }, []);

  useEffect(() => {
    const md = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
    if (!md?.enumerateDevices) return;

    const refresh = () => {
      md.enumerateDevices()
        .then(devices => setAudioDevices(devices.filter(d => d.kind === 'audioinput')))
        .catch(() => setAudioDevices([]));
    };

    refresh();
    md.addEventListener?.('devicechange', refresh);
    return () => md.removeEventListener?.('devicechange', refresh);
  }, []);

  useEffect(() => {
    return () => {
      stopRecordingStream();
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, [stopRecordingStream]);

  useEffect(() => {
    if (!showDeviceMenu) return;

    const MENU_WIDTH = 272;

    const updatePosition = () => {
      const rect = micWrapperRef.current?.getBoundingClientRect();
      if (!rect) return;
      const left = Math.min(
        Math.max(8, rect.right - MENU_WIDTH),
        window.innerWidth - MENU_WIDTH - 8
      );
      setDeviceMenuPos({ bottom: window.innerHeight - rect.top + 10, left, width: MENU_WIDTH });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    const handleClickOutside = (e: MouseEvent) => {
      if (
        deviceMenuRef.current?.contains(e.target as Node) ||
        micWrapperRef.current?.contains(e.target as Node)
      ) return;
      setShowDeviceMenu(false);
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowDeviceMenu(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showDeviceMenu]);

  const startRecording = useCallback(async () => {
    setMicPermissionError(null);
    setShowDeviceMenu(false);

    if (disabled()) return;

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setMicPermissionError('Voice recording is not supported in this browser.');
      return;
    }

    try {
      const audioConstraints: MediaTrackConstraints | boolean = selectedDeviceId
        ? { deviceId: { exact: selectedDeviceId } }
        : true;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      recordingStreamRef.current = stream;

      loadAudioDevices();

      const mimeType = pickRecorderMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];
      recordingCancelledRef.current = false;

      recorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stopRecordingStream();
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }

        const wasCancelled = recordingCancelledRef.current;
        const elapsed = Math.max(0, (Date.now() - recordingStartRef.current) / 1000);
        const usedMimeType = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(recordedChunksRef.current, { type: usedMimeType });
        recordedChunksRef.current = [];
        setIsRecording(false);
        setRecordingSeconds(0);

        if (wasCancelled) return;

        if (blob.size === 0) {
          onError('Recording was empty. Please try again.');
        } else if (blob.size > MAX_AUDIO_BYTES) {
          onError(`Voice message is too large (max ${formatBytes(MAX_AUDIO_BYTES)}). Try a shorter recording.`);
        } else if (elapsed < 0.6) {
          onError('Recording was too short.');
        } else {
          onRecording(blob, elapsed);
        }
      };

      recordingStartRef.current = Date.now();
      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(prev => {
          const next = prev + 1;
          if (next >= MAX_RECORDING_SECONDS) finishRecordingRef.current();
          return next;
        });
      }, 1000);
    } catch (err: any) {
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setMicPermissionError('Microphone access was denied. Please allow microphone access to record a voice message.');
      } else if (err?.name === 'OverconstrainedError' || err?.name === 'NotFoundError') {
        setMicPermissionError('Selected microphone is no longer available. Please choose another one.');
        setSelectedDeviceId(null);
      } else {
        setMicPermissionError('Could not access your microphone. Please try again.');
      }
      stopRecordingStream();
    }
  }, [disabled, selectedDeviceId, loadAudioDevices, onError, onRecording, stopRecordingStream]);

  const finishRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recordingCancelledRef.current = false;
      recorder.stop();
    }
  }, []);

  useEffect(() => {
    finishRecordingRef.current = finishRecording;
  }, [finishRecording]);

  const cancelRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    recordingCancelledRef.current = true;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    } else {
      stopRecordingStream();
      setIsRecording(false);
      setRecordingSeconds(0);
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }, [stopRecordingStream]);

  const toggleDeviceMenu = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled() || isRecording) return;
    loadAudioDevices();
    setShowDeviceMenu(v => !v);
  }, [disabled, isRecording, loadAudioDevices]);

  const selectDevice = useCallback((deviceId: string) => {
    setSelectedDeviceId(deviceId);
    setShowDeviceMenu(false);
  }, []);

  return {
    isRecording, recordingSeconds,
    micPermissionError, setMicPermissionError,
    startRecording, finishRecording, cancelRecording,
    audioDevices, selectedDeviceId, showDeviceMenu, deviceMenuPos,
    micWrapperRef, deviceMenuRef, toggleDeviceMenu, selectDevice,
  };
}
