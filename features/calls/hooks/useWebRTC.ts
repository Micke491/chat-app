"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { wsClient } from "@/lib/ws-client";
import { apiFetch } from "@/lib/api";

export interface CallParticipant {
  sid: string;
  userId: string;
  username: string;
  avatar?: string;
  stream: MediaStream | null;
  screenStream: MediaStream | null;
  micEnabled: boolean;
  camEnabled: boolean;
  isSpeaking: boolean;
}

export interface MediaDeviceOption {
  deviceId: string;
  label: string;
}

interface PeerRecord {
  sid: string;
  userId: string;
  username: string;
  avatar?: string;
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  isSettingRemoteAnswerPending: boolean;
  pendingCandidates: RTCIceCandidateInit[];
  remoteStreams: Map<string, MediaStream>;
  cameraStreamId: string | null;
  screenStreamId: string | null;
  micEnabled: boolean;
  camEnabled: boolean;
  isSpeaking: boolean;
  speakingHold: number;
  audioSender: RTCRtpSender | null;
  camSender: RTCRtpSender | null;
  screenSender: RTCRtpSender | null;
}

interface SignalMessage {
  kind: "join" | "welcome" | "offer" | "answer" | "candidate" | "state" | "leave";
  sid: string;
  to?: string;
  from?: string;
  username?: string;
  avatar?: string;
  micEnabled?: boolean;
  camEnabled?: boolean;
  cameraStreamId?: string | null;
  screenStreamId?: string | null;
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

interface AnalyserEntry {
  source: MediaStreamAudioSourceNode;
  analyser: AnalyserNode;
  data: Uint8Array<ArrayBuffer>;
  trackId: string;
}

const FALLBACK_ICE: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

const SPEAKING_THRESHOLD = 0.02;
// Ticks of silence (200ms each) before the speaking indicator turns off.
const SPEAKING_RELEASE_TICKS = 2;

function makeSid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

interface UseWebRTCOptions {
  callId: string;
  currentUser: { _id: string; username: string; avatar?: string };
  withVideo: boolean;
}

export function useWebRTC({ callId, currentUser, withVideo }: UseWebRTCOptions) {
  const sidRef = useRef<string>(makeSid());
  const peersRef = useRef<Map<string, PeerRecord>>(new Map());
  const iceServersRef = useRef<RTCIceServer[]>(FALLBACK_ICE);

  // Stable containers so the announced stream IDs never change, even when
  // tracks are swapped (device switch) or re-acquired (camera/screen toggles).
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);

  const micEnabledRef = useRef(false);
  const camEnabledRef = useRef(false);
  const screenSharingRef = useRef(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analysersRef = useRef<Map<string, AnalyserEntry>>(new Map());
  const speakingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const localSpeakingHoldRef = useRef(0);
  const localSpeakingRef = useRef(false);

  const [participants, setParticipants] = useState<CallParticipant[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);
  const [micEnabled, setMicEnabled] = useState(false);
  const [camEnabled, setCamEnabled] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [localSpeaking, setLocalSpeaking] = useState(false);
  const [ready, setReady] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const [micDevices, setMicDevices] = useState<MediaDeviceOption[]>([]);
  const [camDevices, setCamDevices] = useState<MediaDeviceOption[]>([]);
  const [activeMicId, setActiveMicId] = useState<string>("");
  const [activeCamId, setActiveCamId] = useState<string>("");

  const channelName = `call-${callId}`;

  const sendSignal = useCallback(
    (msg: Omit<SignalMessage, "sid">) => {
      wsClient?.send({
        action: "signal",
        channel: channelName,
        data: { ...msg, sid: sidRef.current },
      });
    },
    [channelName]
  );

  const identityPayload = useCallback(
    () => ({
      username: currentUser.username,
      avatar: currentUser.avatar,
      micEnabled: micEnabledRef.current,
      camEnabled: camEnabledRef.current,
      cameraStreamId: localStreamRef.current ? localStreamRef.current.id : null,
      screenStreamId: screenSharingRef.current && screenStreamRef.current ? screenStreamRef.current.id : null,
    }),
    [currentUser.username, currentUser.avatar]
  );

  const syncPeers = useCallback(() => {
    const list: CallParticipant[] = [];
    peersRef.current.forEach((peer) => {
      let stream: MediaStream | null = null;
      let screenStream: MediaStream | null = null;

      if (peer.cameraStreamId) {
        stream = peer.remoteStreams.get(peer.cameraStreamId) || null;
      }
      if (peer.screenStreamId) {
        screenStream = peer.remoteStreams.get(peer.screenStreamId) || null;
      }
      if (!stream) {
        // Fallback: any received stream that is not the announced screen share.
        for (const s of peer.remoteStreams.values()) {
          if (s.id !== peer.screenStreamId) {
            stream = s;
            break;
          }
        }
      }

      list.push({
        sid: peer.sid,
        userId: peer.userId,
        username: peer.username,
        avatar: peer.avatar,
        stream,
        screenStream,
        micEnabled: peer.micEnabled,
        camEnabled: peer.camEnabled,
        isSpeaking: peer.isSpeaking,
      });
    });
    setParticipants(list);
  }, []);

  const broadcastState = useCallback(() => {
    sendSignal({ kind: "state", ...identityPayload() });
  }, [sendSignal, identityPayload]);

  // ---------------------------------------------------------------------------
  // Speaking detection via Web Audio analysers on each audio stream.
  // ---------------------------------------------------------------------------

  const ensureAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return null;
      audioCtxRef.current = new Ctx();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume().catch(() => {});
    }
    return audioCtxRef.current;
  }, []);

  const attachAnalyser = useCallback(
    (key: string, stream: MediaStream | null) => {
      // Keyed by audio track id: swapping the mic device produces a new track
      // inside the same container stream, which needs a fresh analyser.
      const audioTrack = stream?.getAudioTracks()[0];
      const existing = analysersRef.current.get(key);
      if (existing && (!audioTrack || existing.trackId !== audioTrack.id)) {
        try {
          existing.source.disconnect();
        } catch {}
        analysersRef.current.delete(key);
      }
      if (!stream || !audioTrack) return;
      if (analysersRef.current.has(key)) return;

      const ctx = ensureAudioContext();
      if (!ctx) return;

      try {
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        analysersRef.current.set(key, {
          source,
          analyser,
          data: new Uint8Array(analyser.fftSize),
          trackId: audioTrack.id,
        });
      } catch (err) {
        console.warn("Could not create audio analyser:", err);
      }
    },
    [ensureAudioContext]
  );

  const measureLevel = (entry: AnalyserEntry) => {
    entry.analyser.getByteTimeDomainData(entry.data);
    let sum = 0;
    for (let i = 0; i < entry.data.length; i++) {
      const v = (entry.data[i] - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / entry.data.length);
  };

  // ---------------------------------------------------------------------------
  // Peer connection management (mesh: one RTCPeerConnection per remote session)
  // ---------------------------------------------------------------------------

  const applyPeerInfo = useCallback((peer: PeerRecord, msg: SignalMessage) => {
    if (msg.username) peer.username = msg.username;
    if (msg.avatar !== undefined) peer.avatar = msg.avatar;
    if (msg.micEnabled !== undefined) peer.micEnabled = msg.micEnabled;
    if (msg.camEnabled !== undefined) peer.camEnabled = msg.camEnabled;
    if (msg.cameraStreamId !== undefined) peer.cameraStreamId = msg.cameraStreamId;
    if (msg.screenStreamId !== undefined) peer.screenStreamId = msg.screenStreamId;
  }, []);

  const destroyPeer = useCallback(
    (sid: string) => {
      const peer = peersRef.current.get(sid);
      if (!peer) return;
      try {
        peer.pc.onnegotiationneeded = null;
        peer.pc.onicecandidate = null;
        peer.pc.ontrack = null;
        peer.pc.oniceconnectionstatechange = null;
        peer.pc.close();
      } catch {}
      const analyser = analysersRef.current.get(sid);
      if (analyser) {
        try {
          analyser.source.disconnect();
        } catch {}
        analysersRef.current.delete(sid);
      }
      peersRef.current.delete(sid);
      syncPeers();
    },
    [syncPeers]
  );

  const createPeer = useCallback(
    (msg: SignalMessage): PeerRecord => {
      const theirSid = msg.sid;
      // A repeated join for a known session means the other side rebuilt its
      // connection — rebuild ours too so both start from a clean state.
      if (peersRef.current.has(theirSid)) {
        destroyPeer(theirSid);
      }

      const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });

      const peer: PeerRecord = {
        sid: theirSid,
        userId: msg.from || "",
        username: msg.username || "User",
        avatar: msg.avatar,
        pc,
        // Exactly one side of each pair is "polite" (yields on offer glare).
        polite: sidRef.current < theirSid,
        makingOffer: false,
        ignoreOffer: false,
        isSettingRemoteAnswerPending: false,
        pendingCandidates: [],
        remoteStreams: new Map(),
        cameraStreamId: msg.cameraStreamId ?? null,
        screenStreamId: msg.screenStreamId ?? null,
        micEnabled: msg.micEnabled ?? true,
        camEnabled: msg.camEnabled ?? false,
        isSpeaking: false,
        speakingHold: 0,
        audioSender: null,
        camSender: null,
        screenSender: null,
      };

      pc.onnegotiationneeded = async () => {
        // Spec only fires this in "stable", but guard against older engines
        // delivering a stale event mid-negotiation.
        if (pc.signalingState !== "stable") return;
        try {
          peer.makingOffer = true;
          await pc.setLocalDescription();
          if (pc.localDescription) {
            sendSignal({
              kind: pc.localDescription.type === "answer" ? "answer" : "offer",
              to: theirSid,
              description: pc.localDescription.toJSON ? pc.localDescription.toJSON() : pc.localDescription,
              ...identityPayload(),
            });
          }
        } catch (err) {
          console.error("Negotiation failed:", err);
        } finally {
          peer.makingOffer = false;
        }
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          sendSignal({ kind: "candidate", to: theirSid, candidate: e.candidate.toJSON() });
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === "failed") {
          pc.restartIce();
        }
      };

      pc.ontrack = (e) => {
        e.streams.forEach((stream) => {
          if (!peer.remoteStreams.has(stream.id)) {
            peer.remoteStreams.set(stream.id, stream);
            stream.onremovetrack = () => {
              if (stream.getTracks().length === 0) {
                peer.remoteStreams.delete(stream.id);
              }
              syncPeers();
            };
          }
        });
        e.track.onunmute = () => syncPeers();
        syncPeers();
      };

      // Publish whatever local media we currently have. This fires
      // onnegotiationneeded on both sides; perfect negotiation resolves glare.
      const local = localStreamRef.current;
      if (local) {
        const audio = local.getAudioTracks()[0];
        const video = local.getVideoTracks()[0];
        if (audio) peer.audioSender = pc.addTrack(audio, local);
        if (video) peer.camSender = pc.addTrack(video, local);
      }
      if (screenSharingRef.current && screenTrackRef.current && screenStreamRef.current) {
        peer.screenSender = pc.addTrack(screenTrackRef.current, screenStreamRef.current);
      }

      peersRef.current.set(theirSid, peer);
      syncPeers();
      return peer;
    },
    [destroyPeer, sendSignal, syncPeers, identityPayload]
  );

  const handleSignal = useCallback(
    async (raw: any) => {
      const msg = raw as SignalMessage;
      if (!msg || !msg.sid || msg.sid === sidRef.current) return;
      if (msg.to && msg.to !== sidRef.current) return;

      let peer = peersRef.current.get(msg.sid);

      switch (msg.kind) {
        case "join": {
          peer = createPeer(msg);
          sendSignal({ kind: "welcome", to: msg.sid, ...identityPayload() });
          break;
        }
        case "welcome": {
          if (!peer) {
            peer = createPeer(msg);
          } else {
            applyPeerInfo(peer, msg);
          }
          syncPeers();
          break;
        }
        case "state": {
          if (!peer) {
            peer = createPeer(msg);
          } else {
            applyPeerInfo(peer, msg);
          }
          syncPeers();
          break;
        }
        case "offer":
        case "answer": {
          if (!msg.description) return;
          if (!peer) {
            if (msg.kind === "answer") return;
            peer = createPeer(msg);
            sendSignal({ kind: "welcome", to: msg.sid, ...identityPayload() });
          } else if (msg.username) {
            applyPeerInfo(peer, msg);
          }

          const pc = peer.pc;
          const readyForOffer =
            !peer.makingOffer && (pc.signalingState === "stable" || peer.isSettingRemoteAnswerPending);
          const offerCollision = msg.description.type === "offer" && !readyForOffer;

          peer.ignoreOffer = !peer.polite && offerCollision;
          if (peer.ignoreOffer) return;

          try {
            peer.isSettingRemoteAnswerPending = msg.description.type === "answer";
            await pc.setRemoteDescription(msg.description);
            peer.isSettingRemoteAnswerPending = false;

            const pending = peer.pendingCandidates;
            peer.pendingCandidates = [];
            for (const cand of pending) {
              try {
                await pc.addIceCandidate(cand);
              } catch {}
            }

            if (msg.description.type === "offer") {
              await pc.setLocalDescription();
              if (pc.localDescription) {
                sendSignal({
                  kind: "answer",
                  to: msg.sid,
                  description: pc.localDescription.toJSON ? pc.localDescription.toJSON() : pc.localDescription,
                  ...identityPayload(),
                });
              }
            }
          } catch (err) {
            peer.isSettingRemoteAnswerPending = false;
            console.error("Failed to apply remote description:", err);
          }
          syncPeers();
          break;
        }
        case "candidate": {
          if (!peer || !msg.candidate) return;
          if (!peer.pc.remoteDescription) {
            peer.pendingCandidates.push(msg.candidate);
            return;
          }
          try {
            await peer.pc.addIceCandidate(msg.candidate);
          } catch (err) {
            if (!peer.ignoreOffer) {
              console.warn("Failed to add ICE candidate:", err);
            }
          }
          break;
        }
        case "leave": {
          destroyPeer(msg.sid);
          break;
        }
      }
    },
    [createPeer, destroyPeer, applyPeerInfo, sendSignal, syncPeers, identityPayload]
  );

  // ---------------------------------------------------------------------------
  // Local media controls
  // ---------------------------------------------------------------------------

  const refreshDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setMicDevices(
        devices
          .filter((d) => d.kind === "audioinput" && d.deviceId)
          .map((d) => ({ deviceId: d.deviceId, label: d.label || "" }))
      );
      setCamDevices(
        devices
          .filter((d) => d.kind === "videoinput" && d.deviceId)
          .map((d) => ({ deviceId: d.deviceId, label: d.label || "" }))
      );
    } catch {}
  }, []);

  const toggleMic = useCallback(async () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    let track = stream.getAudioTracks()[0];

    if (!track) {
      try {
        const media = await navigator.mediaDevices.getUserMedia({ audio: true });
        track = media.getAudioTracks()[0];
        stream.addTrack(track);
        peersRef.current.forEach((peer) => {
          if (peer.audioSender) peer.audioSender.replaceTrack(track);
          else peer.audioSender = peer.pc.addTrack(track, stream);
        });
        setActiveMicId(track.getSettings().deviceId || "");
        refreshDevices();
      } catch (err) {
        console.error("Microphone switch failed:", err);
        return;
      }
    } else {
      track.enabled = !track.enabled;
    }

    micEnabledRef.current = track.enabled;
    setMicEnabled(track.enabled);
    attachAnalyser("local", stream);
    broadcastState();
  }, [broadcastState, attachAnalyser, refreshDevices]);

  const toggleCamera = useCallback(async () => {
    const stream = localStreamRef.current;
    if (!stream) return;

    if (camEnabledRef.current) {
      // Fully stop the track so the camera hardware light turns off.
      const track = stream.getVideoTracks()[0];
      if (track) {
        stream.removeTrack(track);
        track.stop();
      }
      peersRef.current.forEach((peer) => {
        peer.camSender?.replaceTrack(null);
      });
      camEnabledRef.current = false;
      setCamEnabled(false);
      broadcastState();
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: activeCamId ? { deviceId: { ideal: activeCamId } } : true,
      };
      const media = await navigator.mediaDevices.getUserMedia(constraints);
      const track = media.getVideoTracks()[0];
      stream.addTrack(track);
      peersRef.current.forEach((peer) => {
        if (peer.camSender) peer.camSender.replaceTrack(track);
        else peer.camSender = peer.pc.addTrack(track, stream);
      });
      setActiveCamId(track.getSettings().deviceId || "");
      camEnabledRef.current = true;
      setCamEnabled(true);
      refreshDevices();
      broadcastState();
    } catch (err) {
      console.error("Camera switch failed:", err);
    }
  }, [activeCamId, broadcastState, refreshDevices]);

  const switchMic = useCallback(
    async (deviceId: string) => {
      const stream = localStreamRef.current;
      if (!stream) return;
      try {
        const media = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: { exact: deviceId } },
        });
        const newTrack = media.getAudioTracks()[0];
        newTrack.enabled = micEnabledRef.current;

        const old = stream.getAudioTracks()[0];
        if (old) {
          stream.removeTrack(old);
          old.stop();
        }
        stream.addTrack(newTrack);
        peersRef.current.forEach((peer) => {
          if (peer.audioSender) peer.audioSender.replaceTrack(newTrack);
          else peer.audioSender = peer.pc.addTrack(newTrack, stream);
        });
        setActiveMicId(deviceId);
        attachAnalyser("local", stream);
      } catch (err) {
        console.error("Failed to set active microphone:", err);
      }
    },
    [attachAnalyser]
  );

  const switchCam = useCallback(
    async (deviceId: string) => {
      setActiveCamId(deviceId);
      if (!camEnabledRef.current) return;
      const stream = localStreamRef.current;
      if (!stream) return;
      try {
        const media = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: deviceId } },
        });
        const newTrack = media.getVideoTracks()[0];
        const old = stream.getVideoTracks()[0];
        if (old) {
          stream.removeTrack(old);
          old.stop();
        }
        stream.addTrack(newTrack);
        peersRef.current.forEach((peer) => {
          if (peer.camSender) peer.camSender.replaceTrack(newTrack);
          else peer.camSender = peer.pc.addTrack(newTrack, stream);
        });
      } catch (err) {
        console.error("Failed to set active camera:", err);
      }
    },
    []
  );

  const stopScreenShare = useCallback(() => {
    screenTrackRef.current?.stop();
    screenTrackRef.current = null;
    peersRef.current.forEach((peer) => {
      peer.screenSender?.replaceTrack(null);
    });
    screenSharingRef.current = false;
    setScreenSharing(false);
    setLocalScreenStream(null);
    broadcastState();
  }, [broadcastState]);

  const toggleScreenShare = useCallback(async () => {
    if (screenSharingRef.current) {
      stopScreenShare();
      return;
    }
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      const track = display.getVideoTracks()[0];

      // Keep one stable container stream so the stream ID (and therefore the
      // remote mapping) survives stop/start cycles of screen sharing.
      if (!screenStreamRef.current) {
        screenStreamRef.current = new MediaStream();
      }
      screenStreamRef.current.getTracks().forEach((t) => screenStreamRef.current?.removeTrack(t));
      screenStreamRef.current.addTrack(track);
      screenTrackRef.current = track;

      track.onended = () => {
        stopScreenShare();
      };

      peersRef.current.forEach((peer) => {
        if (peer.screenSender) peer.screenSender.replaceTrack(track);
        else if (screenStreamRef.current) {
          peer.screenSender = peer.pc.addTrack(track, screenStreamRef.current);
        }
      });

      screenSharingRef.current = true;
      setScreenSharing(true);
      setLocalScreenStream(screenStreamRef.current);
      broadcastState();
    } catch (err) {
      console.error("Screen share action failed:", err);
    }
  }, [broadcastState, stopScreenShare]);

  // ---------------------------------------------------------------------------
  // Lifecycle: acquire media, join the signaling channel, mesh with peers
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;
    const channel = wsClient?.subscribe(channelName);

    const onSignal = (data: any) => {
      handleSignal(data);
    };

    const init = async () => {
      // 1. ICE configuration from our own backend (STUN + optional TURN).
      try {
        const res = await apiFetch("/api/call/ice-servers");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.iceServers) && data.iceServers.length > 0) {
            iceServersRef.current = data.iceServers;
          }
          // STUN alone only works when both peers can reach each other
          // directly. A phone on mobile data sits behind carrier-grade NAT,
          // so without a relay that call hangs on "connecting" forever.
          if (data.hasRelay === false) {
            console.warn(
              "[calls] No TURN relay configured on the backend — calls between " +
                "different networks (e.g. desktop <-> phone on mobile data) will not connect."
            );
          }
        }
      } catch {
        // Keep the fallback STUN config.
      }

      // 2. Local media. Try mic (+camera for video calls), degrade gracefully.
      const container = new MediaStream();
      localStreamRef.current = container;

      let audioTrack: MediaStreamTrack | null = null;
      let videoTrack: MediaStreamTrack | null = null;

      try {
        const media = await navigator.mediaDevices.getUserMedia(
          withVideo ? { audio: true, video: true } : { audio: true }
        );
        audioTrack = media.getAudioTracks()[0] || null;
        videoTrack = media.getVideoTracks()[0] || null;
      } catch {
        if (withVideo) {
          try {
            const media = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioTrack = media.getAudioTracks()[0] || null;
            setMediaError("Could not access the camera.");
          } catch {
            setMediaError("Could not access the microphone.");
          }
        } else {
          setMediaError("Could not access the microphone.");
        }
      }

      if (cancelled) {
        audioTrack?.stop();
        videoTrack?.stop();
        return;
      }

      if (audioTrack) {
        container.addTrack(audioTrack);
        micEnabledRef.current = true;
        setMicEnabled(true);
        setActiveMicId(audioTrack.getSettings().deviceId || "");
      }
      if (videoTrack) {
        container.addTrack(videoTrack);
        camEnabledRef.current = true;
        setCamEnabled(true);
        setActiveCamId(videoTrack.getSettings().deviceId || "");
      }

      setLocalStream(container);
      attachAnalyser("local", container);
      refreshDevices();

      // 3. Join the call: everyone already in the room answers with "welcome"
      // and a peer connection forms with each of them (mesh).
      channel?.bind("webrtc_signal", onSignal);
      sendSignal({ kind: "join", ...identityPayload() });
      setReady(true);
    };

    init();

    // Speaking detection loop for the local user and every remote peer.
    speakingTimerRef.current = setInterval(() => {
      let changed = false;

      const localEntry = analysersRef.current.get("local");
      if (localEntry) {
        const speaking = micEnabledRef.current && measureLevel(localEntry) > SPEAKING_THRESHOLD;
        if (speaking) {
          localSpeakingHoldRef.current = SPEAKING_RELEASE_TICKS;
          if (!localSpeakingRef.current) {
            localSpeakingRef.current = true;
            setLocalSpeaking(true);
          }
        } else if (localSpeakingRef.current) {
          localSpeakingHoldRef.current -= 1;
          if (localSpeakingHoldRef.current <= 0) {
            localSpeakingRef.current = false;
            setLocalSpeaking(false);
          }
        }
      }

      peersRef.current.forEach((peer) => {
        let stream: MediaStream | null = null;
        if (peer.cameraStreamId) stream = peer.remoteStreams.get(peer.cameraStreamId) || null;
        if (!stream) {
          for (const s of peer.remoteStreams.values()) {
            if (s.id !== peer.screenStreamId) {
              stream = s;
              break;
            }
          }
        }
        attachAnalyser(peer.sid, stream);

        const entry = analysersRef.current.get(peer.sid);
        if (!entry) return;
        const speaking = peer.micEnabled && measureLevel(entry) > SPEAKING_THRESHOLD;
        if (speaking) {
          peer.speakingHold = SPEAKING_RELEASE_TICKS;
          if (!peer.isSpeaking) {
            peer.isSpeaking = true;
            changed = true;
          }
        } else if (peer.isSpeaking) {
          peer.speakingHold -= 1;
          if (peer.speakingHold <= 0) {
            peer.isSpeaking = false;
            changed = true;
          }
        }
      });

      if (changed) syncPeers();
    }, 200);

    const onDeviceChange = () => refreshDevices();
    navigator.mediaDevices?.addEventListener?.("devicechange", onDeviceChange);

    const onPageHide = () => {
      sendSignal({ kind: "leave" });
      peersRef.current.forEach((peer) => {
        try {
          peer.pc.close();
        } catch {}
      });
    };
    window.addEventListener("pagehide", onPageHide);

    return () => {
      cancelled = true;
      window.removeEventListener("pagehide", onPageHide);
      navigator.mediaDevices?.removeEventListener?.("devicechange", onDeviceChange);

      if (speakingTimerRef.current) {
        clearInterval(speakingTimerRef.current);
        speakingTimerRef.current = null;
      }

      sendSignal({ kind: "leave" });
      channel?.unbind("webrtc_signal", onSignal);
      wsClient?.unsubscribe(channelName);

      peersRef.current.forEach((peer) => {
        try {
          peer.pc.close();
        } catch {}
      });
      peersRef.current.clear();

      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      screenTrackRef.current?.stop();
      screenTrackRef.current = null;
      screenStreamRef.current = null;

      analysersRef.current.forEach((entry) => {
        try {
          entry.source.disconnect();
        } catch {}
      });
      analysersRef.current.clear();
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId]);

  return {
    participants,
    localStream,
    localScreenStream,
    micEnabled,
    camEnabled,
    screenSharing,
    localSpeaking,
    ready,
    mediaError,
    micDevices,
    camDevices,
    activeMicId,
    activeCamId,
    toggleMic,
    toggleCamera,
    toggleScreenShare,
    switchMic,
    switchCam,
  };
}
