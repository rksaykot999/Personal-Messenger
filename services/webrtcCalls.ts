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
  remoteAudio.id = 'remote-audio-' + Date.now();
  remoteAudio.autoplay = true;
  remoteAudio.controls = false;
  remoteAudio.muted = false;
  remoteAudio.volume = 1.0;
  (remoteAudio as any).playsInline = true;
  remoteAudio.setAttribute('playsinline', '');
  remoteAudio.style.display = 'none';
  remoteAudio.style.visibility = 'hidden';
  document.body.appendChild(remoteAudio);

  pc.ontrack = (event) => {
    console.log('Remote track received:', event.track.kind);
    if (event.streams && event.streams.length > 0) {
      remoteAudio.srcObject = event.streams[0];
      
      const playPromise = remoteAudio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log('Remote audio playing successfully');
          })
          .catch((error) => {
            console.error('Failed to play remote audio:', error);
            // Try with user gesture if needed
            if (error.name === 'NotAllowedError') {
              console.warn('Autoplay policy blocked. Attempting delayed play...');
              setTimeout(() => {
                remoteAudio.play().catch((e) => console.error('Delayed play failed:', e));
              }, 1000);
            }
          });
      }
    }
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
