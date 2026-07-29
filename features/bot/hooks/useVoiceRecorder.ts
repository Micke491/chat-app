'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_AUDIO_BYTES, MAX_RECORDING_SECONDS, formatBytes, pickRecorderMimeType } from '../utils';

interface UseVoiceRecorderOptions {
  onTranscript: (text: string) => void;
  onError: (message: string) => void;
  disabled: () => boolean;
}

export function useVoiceRecorder({ onTranscript, onError, disabled }: UseVoiceRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [micPermissionError, setMicPermissionError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStartRef = useRef<number>(0);
  const recordingCancelledRef = useRef(false);

  const [sttTranscript, setSttTranscript] = useState('');
  const [sttInterim, setSttInterim] = useState('');
  const [sttSupported, setSttSupported] = useState(true);
  const speechRecognitionRef = useRef<any>(null);
  const sttTranscriptRef = useRef('');

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

  const stopSpeechRecognition = useCallback(() => {
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {
        // already stopped
      }
      speechRecognitionRef.current = null;
    }
    setSttInterim('');
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
      stopSpeechRecognition();
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, [stopRecordingStream, stopSpeechRecognition]);

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

  const startSpeechRecognition = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSttSupported(false);
      return;
    }
    setSttSupported(true);
    setSttTranscript('');
    setSttInterim('');
    sttTranscriptRef.current = '';

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    // Use the browser's configured language — Chrome/Edge pick up the OS locale
    // (e.g. 'sr', 'sr-RS', 'en-US') and route to the right model.
    recognition.lang = navigator.language || 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      let sessionFinal = '';
      let interimText = '';
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) sessionFinal += result[0].transcript;
        else interimText += result[0].transcript;
      }
      if (sessionFinal) {
        sttTranscriptRef.current = (sttTranscriptRef.current + ' ' + sessionFinal).trim();
        setSttTranscript(sttTranscriptRef.current);
      }
      setSttInterim(interimText);
    };

    recognition.onerror = (event: any) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.warn('Speech recognition error:', event.error);
      }
    };

    recognition.onend = () => {
      if (!recordingCancelledRef.current && mediaRecorderRef.current?.state === 'recording') {
        try {
          recognition.start();
        } catch {
          // already restarted
        }
      }
    };

    try {
      recognition.start();
      speechRecognitionRef.current = recognition;
    } catch {
      setSttSupported(false);
    }
  }, []);

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
          const transcript = sttTranscriptRef.current.trim();
          if (transcript) {
            onTranscript(transcript);
          } else if (elapsed >= 2.0) {
            onError('Could not transcribe speech. Please try again or type your message.');
          }
        }

        setSttTranscript('');
        setSttInterim('');
        sttTranscriptRef.current = '';
      };

      recordingStartRef.current = Date.now();
      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      startSpeechRecognition();

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
  }, [disabled, selectedDeviceId, loadAudioDevices, onError, onTranscript, startSpeechRecognition, stopRecordingStream]);

  const finishRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recordingCancelledRef.current = false;
      recorder.stop();
    }
    stopSpeechRecognition();
  }, [stopSpeechRecognition]);

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
    stopSpeechRecognition();
    setSttTranscript('');
    sttTranscriptRef.current = '';
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }, [stopRecordingStream, stopSpeechRecognition]);

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
    sttTranscript, sttInterim, sttSupported,
    audioDevices, selectedDeviceId, showDeviceMenu, deviceMenuPos,
    micWrapperRef, deviceMenuRef, toggleDeviceMenu, selectDevice,
  };
}
