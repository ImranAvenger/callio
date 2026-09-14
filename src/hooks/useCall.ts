import { useCallback, useEffect, useRef, useState } from "react";
import { ICE_SERVERS, SIGNALING_URL } from "../constants/call";
import type { Role, SignalMessage, View } from "../types/call";

export function useCall() {
  const [view, setView] = useState<View>("lobby");
  const [roomKey, setRoomKey] = useState("");
  const [peerName, setPeerName] = useState("");
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [status, setStatus] = useState("Ready when you are");
  const [error, setError] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const videoSenderRef = useRef<RTCRtpSender | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);

  const attachLocalVideo = useCallback((element: HTMLVideoElement | null) => {
    localVideoRef.current = element;
    if (element && localStreamRef.current) element.srcObject = localStreamRef.current;
  }, []);

  const attachRemoteVideo = useCallback((element: HTMLVideoElement | null) => {
    remoteVideoRef.current = element;
    if (element && remoteStreamRef.current) element.srcObject = remoteStreamRef.current;
  }, []);

  const send = useCallback((message: object) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  }, []);

  const leaveCall = useCallback(() => {
    socketRef.current?.close();
    peerRef.current?.close();
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    socketRef.current = null;
    peerRef.current = null;
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    videoSenderRef.current = null;
    pendingCandidatesRef.current = [];
    setView("lobby");
    setRoomKey("");
    setPeerName("");
    setHasRemoteVideo(false);
    setStatus("Ready when you are");
    setIsMuted(false);
    setIsCameraOff(false);
  }, []);

  useEffect(() => () => leaveCall(), [leaveCall]);

  const startOffer = useCallback(async () => {
    const peer = peerRef.current;
    if (!peer) return;
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    send({ type: "offer", offer });
  }, [send]);

  const flushCandidates = async (peer: RTCPeerConnection) => {
    for (const candidate of pendingCandidatesRef.current) {
      await peer.addIceCandidate(candidate);
    }
    pendingCandidatesRef.current = [];
  };

  const handleSignal = useCallback(async (message: SignalMessage, peer: RTCPeerConnection) => {
    if (message.type === "joined") {
      setStatus(message.participants === 2 ? "Connecting..." : "Waiting for your guest...");
      setView("call");
      return;
    }
    if (message.type === "room_ready" && message.role) {
      setPeerName(message.peer_name || "Guest");
      setStatus("Connecting...");
      if (message.role === ("offerer" satisfies Role)) await startOffer();
      return;
    }
    if (message.type === "offer" && message.offer) {
      await peer.setRemoteDescription(message.offer);
      await flushCandidates(peer);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      send({ type: "answer", answer });
      return;
    }
    if (message.type === "answer" && message.answer) {
      await peer.setRemoteDescription(message.answer);
      await flushCandidates(peer);
      return;
    }
    if (message.type === "ice" && message.candidate) {
      if (peer.remoteDescription) await peer.addIceCandidate(message.candidate);
      else pendingCandidatesRef.current.push(message.candidate);
      return;
    }
    if (message.type === "room_full") {
      setError("This room is already full.");
      leaveCall();
      return;
    }
    if (message.type === "room_not_found") {
      setError("Room not found. Ask the host to create it first.");
      leaveCall();
      return;
    }
    if (message.type === "room_exists") {
      setError("That room already exists. Join it instead.");
      leaveCall();
      return;
    }
    if (message.type === "invalid_room") {
      setError("The room code is invalid.");
      leaveCall();
      return;
    }
    if (message.type === "invalid_name") {
      setError("The display name is invalid.");
      leaveCall();
    }
  }, [leaveCall, send, startOffer]);

  const connect = useCallback(async (key: string, displayName: string, action: "create" | "join") => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const socket = new WebSocket(SIGNALING_URL);
      const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      localStreamRef.current = stream;
      socketRef.current = socket;
      peerRef.current = peer;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      stream.getTracks().forEach((track) => {
        const sender = peer.addTrack(track, stream);
        if (track.kind === "video") videoSenderRef.current = sender;
      });
      peer.ontrack = (event) => {
        setHasRemoteVideo(true);
        remoteStreamRef.current = event.streams[0];
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
      };
      peer.onicecandidate = (event) => {
        if (event.candidate) send({ type: "ice", candidate: event.candidate.toJSON() });
      };
      peer.onconnectionstatechange = () => {
        if (peer.connectionState === "connected") setStatus("Connected");
        if (peer.connectionState === "disconnected") setStatus("Connection interrupted");
        if (peer.connectionState === "failed") {
          setError("A direct connection could not be established. Configure a TURN server for different networks.");
          setStatus("Connection failed");
        }
      };
      socket.onopen = () => {
        send({ type: action, room_key: key, display_name: displayName });
        setStatus("Waiting for your guest...");
      };
      socket.onmessage = (event) => {
        void handleSignal(JSON.parse(event.data) as SignalMessage, peer);
      };
      socket.onerror = () => setError("Could not connect to the call server.");
      socket.onclose = () => {
        if (peer.connectionState !== "connected") setStatus("Disconnected");
      };
      setRoomKey(key);
    } catch (err) {
      setError(err instanceof DOMException && err.name === "NotAllowedError"
        ? "Camera and microphone permission are required to join."
        : "Could not start the call. Check your camera and server connection.");
    }
  }, [handleSignal, send]);

  const toggleMute = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setIsMuted(!track.enabled);
  };

  const toggleCamera = async () => {
    const stream = localStreamRef.current;
    const sender = videoSenderRef.current;
    if (!stream || !sender) return;

    if (!isCameraOff) {
      const track = stream.getVideoTracks()[0];
      if (!track) return;
      await sender.replaceTrack(null);
      track.stop();
      stream.removeTrack(track);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      setIsCameraOff(true);
      return;
    }

    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
      const track = cameraStream.getVideoTracks()[0];
      await sender.replaceTrack(track);
      stream.addTrack(track);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      setIsCameraOff(false);
    } catch {
      setError("Could not turn the camera back on. Check your camera permissions.");
    }
  };

  return {
    view, roomKey, peerName, hasRemoteVideo, status, error, isMuted, isCameraOff,
    attachLocalVideo, attachRemoteVideo, connect, leaveCall, toggleMute, toggleCamera,
    setError,
  };
}
