import { Platform } from 'react-native';
import {
  addDoc,
  collection,
  doc,
  DocumentReference,
  getDoc,
  onSnapshot,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/services/firebase';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

type ActiveSession = {
  pc: RTCPeerConnection;
  localStream?: MediaStream;
  remoteAudio?: HTMLAudioElement;
  unsubscribes: Array<() => void>;
};

let activeSession: ActiveSession | null = null;

export function isWebRTCSupported() {
  return (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    typeof RTCPeerConnection !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

function ensureWebRTC() {
  if (!isWebRTCSupported()) {
    throw new Error('WebRTC calls are supported on web browsers only in this build. Native Expo needs react-native-webrtc and a development build.');
  }
}

function cleanupSession() {
  if (!activeSession) return;

  activeSession.unsubscribes.forEach((unsubscribe) => unsubscribe());
  activeSession.localStream?.getTracks().forEach((track) => track.stop());
  activeSession.remoteAudio?.remove();
  activeSession.pc.close();
  activeSession = null;
}

async function createPeerConnection(
  callRef: DocumentReference,
  localCandidateCollection: 'callerCandidates' | 'receiverCandidates',
  remoteCandidateCollection: 'callerCandidates' | 'receiverCandidates',
  type: 'voice' | 'video',
) {
  ensureWebRTC();
  cleanupSession();

  const pc = new RTCPeerConnection(ICE_SERVERS);
  const localStream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: type === 'video',
  });

  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

  const remoteAudio = document.createElement('audio');
  remoteAudio.autoplay = true;
  (remoteAudio as any).playsInline = true;
  document.body.appendChild(remoteAudio);

  const remoteStream = new MediaStream();
  pc.ontrack = (event) => {
    event.streams[0]?.getTracks().forEach((track) => remoteStream.addTrack(track));
    remoteAudio.srcObject = remoteStream;
    remoteAudio.play().catch(() => {});
  };

  pc.onicecandidate = async (event) => {
    if (!event.candidate) return;
    await addDoc(collection(callRef, localCandidateCollection), event.candidate.toJSON());
  };

  const processedCandidates = new Set<string>();
  const unsubscribeCandidates = onSnapshot(collection(callRef, remoteCandidateCollection), (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type !== 'added' || processedCandidates.has(change.doc.id)) return;
      processedCandidates.add(change.doc.id);
      pc.addIceCandidate(new RTCIceCandidate(change.doc.data())).catch((error) => {
        console.warn('Could not add ICE candidate:', error);
      });
    });
  });

  activeSession = {
    pc,
    localStream,
    remoteAudio,
    unsubscribes: [unsubscribeCandidates],
  };

  return pc;
}

export async function startOutgoingWebRTCCall(callRef: DocumentReference, type: 'voice' | 'video') {
  const pc = await createPeerConnection(callRef, 'callerCandidates', 'receiverCandidates', type);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  await updateDoc(callRef, {
    webRTC: true,
    offer: {
      type: offer.type,
      sdp: offer.sdp,
    },
  });

  const unsubscribeAnswer = onSnapshot(callRef, async (snapshot) => {
    const call = snapshot.data();
    if (!call?.answer || pc.currentRemoteDescription) return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(call.answer));
    } catch (error) {
      console.warn('Could not set remote answer:', error);
    }
  });

  activeSession?.unsubscribes.push(unsubscribeAnswer);
}

export async function acceptIncomingWebRTCCall(callId: string, type: 'voice' | 'video') {
  const callRef = doc(db, 'calls', callId);
  const callSnap = await getDoc(callRef);
  const call = callSnap.data();

  if (!call?.offer) {
    throw new Error('The caller has not prepared a WebRTC offer yet. Please try again.');
  }

  const pc = await createPeerConnection(callRef, 'receiverCandidates', 'callerCandidates', type);
  await pc.setRemoteDescription(new RTCSessionDescription(call.offer));

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  await updateDoc(callRef, {
    status: 'accepted',
    answer: {
      type: answer.type,
      sdp: answer.sdp,
    },
  });
}

export function endActiveWebRTCCall() {
  cleanupSession();
}
