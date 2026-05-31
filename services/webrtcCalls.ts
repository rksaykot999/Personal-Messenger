/**
 * webrtcCalls.ts
 * ─────────────────────────────────────────────────────────────
 * Web ও Native (Android/iOS) উভয়ের জন্য WebRTC calling service।
 * 
 * Web এ     → Browser-native RTCPeerConnection ব্যবহার করে।
 * Native এ  → react-native-webrtc ব্যবহার করে।
 * ─────────────────────────────────────────────────────────────
 */

import { db } from '@/services/firebase';
import {
  addDoc,
  collection,
  doc,
  DocumentReference,
  getDoc,
  onSnapshot,
  updateDoc,
} from 'firebase/firestore';
import { Platform } from 'react-native';
import { Audio } from 'expo-av';

// ─── STUN Servers (Google Free STUN) ─────────────────────────
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

// ─── Types ───────────────────────────────────────────────────
export type CallType = 'voice' | 'video';

export type ActiveSession = {
  pc: any; // RTCPeerConnection (web or native)
  localStream: any | null; // MediaStream
  remoteStream: any | null; // MediaStream
  remoteAudio?: HTMLAudioElement; // শুধু Web এ
  unsubscribes: Array<() => void>;
};

// ─── Global active session ───────────────────────────────────
let activeSession: ActiveSession | null = null;

// ─── Exported stream references (UI এর জন্য) ─────────────────
export let localMediaStream: any = null;
export let remoteMediaStream: any = null;

// ─── Stream update callback (CallScreen এ live update এর জন্য) ─
let onStreamsUpdate: ((local: any, remote: any) => void) | null = null;

export function setOnStreamsUpdate(cb: ((local: any, remote: any) => void) | null) {
  onStreamsUpdate = cb;
}

// ─── Platform Check ──────────────────────────────────────────
export function isWebRTCSupported(): boolean {
  if (Platform.OS === 'web') {
    return (
      typeof window !== 'undefined' &&
      typeof RTCPeerConnection !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia
    );
  }
  // Native এ react-native-webrtc available কিনা check
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { RTCPeerConnection: NativeRTC } = require('react-native-webrtc');
    return !!NativeRTC;
  } catch {
    return false;
  }
}

// ─── Cleanup Session ─────────────────────────────────────────
export function cleanupSession() {
  if (!activeSession) return;

  activeSession.unsubscribes.forEach((unsub) => unsub());
  activeSession.localStream?.getTracks?.().forEach((track: any) => track.stop());

  // Web এ audio element remove করা
  if (Platform.OS === 'web' && activeSession.remoteAudio) {
    activeSession.remoteAudio.remove();
  }

  activeSession.pc?.close();
  activeSession = null;
  localMediaStream = null;
  remoteMediaStream = null;
  onStreamsUpdate?.(null, null);
}

// ─── Get Media Stream (Internal helper) ─────────────────────
async function getUserMediaStream(type: CallType): Promise<any> {
  if (Platform.OS === 'web') {
    // Browser API
    return navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === 'video',
    });
  } else {
    // react-native-webrtc
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { mediaDevices } = require('react-native-webrtc');
    return mediaDevices.getUserMedia({
      audio: true,
      video: type === 'video'
        ? { facingMode: 'user', width: 640, height: 480 }
        : false,
    });
  }
}

// ─── Create RTCPeerConnection ─────────────────────────────────
function createRTCPeerConnection(): any {
  if (Platform.OS === 'web') {
    return new RTCPeerConnection(ICE_SERVERS);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { RTCPeerConnection: NativePeerConnection } = require('react-native-webrtc');
    return new NativePeerConnection(ICE_SERVERS);
  }
}

// ─── Create ICE Candidate ────────────────────────────────────
function createIceCandidate(data: any): any {
  if (Platform.OS === 'web') {
    return new RTCIceCandidate(data);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { RTCIceCandidate: NativeIce } = require('react-native-webrtc');
    return new NativeIce(data);
  }
}

// ─── Create Session Description ──────────────────────────────
function createSessionDescription(data: any): any {
  if (Platform.OS === 'web') {
    return new RTCSessionDescription(data);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { RTCSessionDescription: NativeSDP } = require('react-native-webrtc');
    return new NativeSDP(data);
  }
}

// ─── Core: PeerConnection তৈরি ───────────────────────────────
async function createPeerConnection(
  callRef: DocumentReference,
  localCandidates: 'callerCandidates' | 'receiverCandidates',
  remoteCandidates: 'callerCandidates' | 'receiverCandidates',
  type: CallType,
) {
  cleanupSession();

  const pc = createRTCPeerConnection();
  const localStream = await getUserMediaStream(type);

  localMediaStream = localStream;

  // Local tracks যোগ করা
  localStream.getTracks().forEach((track: any) => {
    pc.addTrack(track, localStream);
  });

  // Remote stream ধরার জন্য
  let remoteStream: any = null;

  if (Platform.OS === 'web') {
    // Web: remoteAudio element তৈরি
    const remoteAudio = document.createElement('audio');
    remoteAudio.id = 'remote-audio-webrtc';
    remoteAudio.autoplay = true;
    remoteAudio.muted = false;
    remoteAudio.volume = 1.0;
    (remoteAudio as any).playsInline = true;
    remoteAudio.style.display = 'none';
    document.body.appendChild(remoteAudio);

    pc.ontrack = (event: RTCTrackEvent) => {
      if (event.streams?.[0]) {
        remoteAudio.srcObject = event.streams[0];
        remoteStream = event.streams[0];
        remoteMediaStream = remoteStream;
        onStreamsUpdate?.(localStream, remoteStream);
        remoteAudio.play().catch((err: Error) => {
          console.warn('Remote audio play error:', err);
        });
      }
    };

    activeSession = {
      pc,
      localStream,
      remoteStream: null,
      remoteAudio,
      unsubscribes: [],
    };
  } else {
    // Native (react-native-webrtc)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { MediaStream } = require('react-native-webrtc');
    remoteStream = new MediaStream();
    remoteMediaStream = remoteStream;

    pc.ontrack = (event: any) => {
      console.log('[WebRTC] ontrack:', event.track.kind);
      event.streams[0]?.getTracks().forEach((track: any) => {
        remoteStream.addTrack(track);
      });
      remoteMediaStream = remoteStream;
      onStreamsUpdate?.(localStream, remoteStream);
    };

    activeSession = {
      pc,
      localStream,
      remoteStream,
      unsubscribes: [],
    };
  }

  onStreamsUpdate?.(localStream, remoteMediaStream);

  // ICE Candidate পাঠানো
  pc.onicecandidate = async (event: any) => {
    const candidate = event.candidate;
    if (!candidate) return;
    try {
      await addDoc(collection(callRef, localCandidates), candidate.toJSON());
    } catch (err) {
      console.warn('[WebRTC] ICE candidate send error:', err);
    }
  };

  // Remote ICE candidates শোনা
  const processedIds = new Set<string>();
  let pendingCandidates: any[] = [];

  const unsubCandidates = onSnapshot(
    collection(callRef, remoteCandidates),
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type !== 'added' || processedIds.has(change.doc.id)) return;
        processedIds.add(change.doc.id);
        const candidateData = change.doc.data();

        if (pc.remoteDescription && pc.remoteDescription.type) {
          const candidate = createIceCandidate(candidateData);
          pc.addIceCandidate(candidate).catch((err: Error) => {
            console.warn('[WebRTC] addIceCandidate error:', err);
          });
        } else {
          pendingCandidates.push(candidateData);
        }
      });
    },
  );

  (pc as any).processPendingCandidates = () => {
    pendingCandidates.forEach(data => {
      const candidate = createIceCandidate(data);
      pc.addIceCandidate(candidate).catch((err: Error) => {
        console.warn('[WebRTC] addIceCandidate (delayed) error:', err);
      });
    });
    pendingCandidates = [];
  };

  activeSession!.unsubscribes.push(unsubCandidates);

  return pc;
}

// ─── Caller: Call শুরু করা ───────────────────────────────────
export async function startOutgoingWebRTCCall(
  callRef: DocumentReference,
  type: CallType,
) {
  const pc = await createPeerConnection(
    callRef,
    'callerCandidates',
    'receiverCandidates',
    type,
  );

  const offer = await pc.createOffer({
    offerToReceiveAudio: true,
    offerToReceiveVideo: type === 'video',
  });
  await pc.setLocalDescription(offer);

  await updateDoc(callRef, {
    webRTC: true,
    offer: { type: offer.type, sdp: offer.sdp },
  });

  // Receiver এর answer শোনা
  const unsubAnswer = onSnapshot(callRef, async (snapshot) => {
    const call = snapshot.data();
    if (!call?.answer || pc.currentRemoteDescription) return;
    try {
      await pc.setRemoteDescription(createSessionDescription(call.answer));
      console.log('[WebRTC] Remote answer set successfully');
      if (typeof (pc as any).processPendingCandidates === 'function') {
        (pc as any).processPendingCandidates();
      }
    } catch (err) {
      console.warn('[WebRTC] setRemoteDescription (answer) error:', err);
    }
  });

  activeSession?.unsubscribes.push(unsubAnswer);
}

// ─── Receiver: Call গ্রহণ করা ───────────────────────────────
export async function acceptIncomingWebRTCCall(callId: string, type: CallType) {
  const callRef = doc(db, 'calls', callId);
  const callSnap = await getDoc(callRef);
  const call = callSnap.data();

  if (!call?.offer) {
    throw new Error('Caller এর offer এখনো আসেনি। একটু পর আবার চেষ্টা করুন।');
  }

  const pc = await createPeerConnection(
    callRef,
    'receiverCandidates',
    'callerCandidates',
    type,
  );

  await pc.setRemoteDescription(createSessionDescription(call.offer));
  if (typeof (pc as any).processPendingCandidates === 'function') {
    (pc as any).processPendingCandidates();
  }

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  await updateDoc(callRef, {
    status: 'accepted',
    answer: { type: answer.type, sdp: answer.sdp },
  });

  console.log('[WebRTC] Call accepted, answer sent');
}

// ─── Call শেষ করা ────────────────────────────────────────────
export function endActiveWebRTCCall() {
  cleanupSession();
}

// ─── Mute/Unmute মাইক্রোফোন ──────────────────────────────────
export function setMicrophoneMuted(muted: boolean) {
  if (!activeSession?.localStream) return;
  activeSession.localStream.getAudioTracks().forEach((track: any) => {
    track.enabled = !muted;
  });
}

// ─── Camera On/Off (Video call) ───────────────────────────────
export function setCameraEnabled(enabled: boolean) {
  if (!activeSession?.localStream) return;
  activeSession.localStream.getVideoTracks().forEach((track: any) => {
    track.enabled = enabled;
  });
}

// ─── Camera ফ্লিপ করা (Front/Back) ──────────────────────────
export async function flipCamera() {
  if (Platform.OS === 'web') return; // Web এ কাজ করে না
  if (!activeSession?.localStream) return;

  const videoTrack = activeSession.localStream
    .getVideoTracks()
    .find((t: any) => t.kind === 'video');

  if (videoTrack && typeof videoTrack._switchCamera === 'function') {
    videoTrack._switchCamera();
  }
}

// ─── Local/Remote stream পাওয়া ───────────────────────────────
export function getLocalStream(): any {
  return activeSession?.localStream || null;
}

export function getRemoteStream(): any {
  return activeSession?.remoteStream || null;
}

// ─── Audio Routing (expo-av) ─────────────────────────────────
export async function setSpeakerphoneOn(speakerOn: boolean) {
  if (Platform.OS === 'web') return;
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      playThroughEarpieceAndroid: !speakerOn,
    });
  } catch (err) {
    console.warn('[WebRTC] Audio routing error:', err);
  }
}
