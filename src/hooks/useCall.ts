import { useCallback, useEffect, useRef, useState } from "react";
import { ICE_SERVERS, SIGNALING_URL } from "../constants/call";
import type { Role, SignalMessage, View } from "../types/call";

function findAlternativeCamera(
  devices: MediaDeviceInfo[],
  currentDeviceId: string | undefined,
  facingMode: "user" | "environment",
) {
  const alternatives = devices.filter((device) => device.deviceId !== currentDeviceId);
  const directionLabels = facingMode === "environment"
    ? ["back", "rear", "environment"]
    : ["front", "user"];

  return alternatives.find((device) => {
    const label = device.label.toLowerCase();
    return directionLabels.some((direction) => label.includes(direction));
  }) || alternatives[0];
}

export function useCall() {
  const [view, setView] = useState<View>("lobby");
  const [roomKey, setRoomKey] = useState("");
  const [peerName, setPeerName] = useState("");
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [status, setStatus] = useState("Ready when you are");
  const [error, setError] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [isRemoteCameraOn, setIsRemoteCameraOn] = useState(true);
  const roomKeyRef = useRef("");

  const socketRef = useRef<WebSocket | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const videoSenderRef = useRef<RTCRtpSender | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const participantIdRef = useRef(
    sessionStorage.getItem("callio-participant-id") || crypto.randomUUID(),
  );
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const intentionalLeaveRef = useRef(false);
  const cameraFacingModeRef = useRef<"user" | "environment">("user");
  const roleRef = useRef<Role | null>(null);
  const socketReconnectAttemptsRef = useRef(0);
  const createPeerRef = useRef<(() => RTCPeerConnection) | null>(null);

  useEffect(() => {
    sessionStorage.setItem("callio-participant-id", participantIdRef.current);
    return () => {
      if (reconnectTimerRef.current !== null) window.clearTimeout(reconnectTimerRef.current);
    };
  }, []);

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
    intentionalLeaveRef.current = true;
    if (socketRef.current?.readyState === WebSocket.OPEN && roomKeyRef.current) {
      socketRef.current.send(JSON.stringify({ type: "leave" }));
    }
    socketRef.current?.close();
    peerRef.current?.close();
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    socketRef.current = null;
    peerRef.current = null;
    createPeerRef.current = null;
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    videoSenderRef.current = null;
    roleRef.current = null;
    pendingCandidatesRef.current = [];
    setView("lobby");
    roomKeyRef.current = "";
    setRoomKey("");
    setPeerName("");
    setHasRemoteVideo(false);
    setStatus("Ready when you are");
    setIsMuted(false);
    setIsCameraOff(false);
    setIsFrontCamera(true);
    setIsRemoteCameraOn(true);
  }, []);

  useEffect(() => () => leaveCall(), [leaveCall]);

  const startOffer = useCallback(async (iceRestart = false) => {
    let peer = peerRef.current;
    if (!peer && createPeerRef.current) {
      peer = createPeerRef.current();
    }
    if (!peer) return;
    const offer = await peer.createOffer({ iceRestart });
    await peer.setLocalDescription(offer);
    send({ type: "offer", offer });
  }, [send]);

  const flushCandidates = async (peer: RTCPeerConnection) => {
    for (const candidate of pendingCandidatesRef.current) {
      await peer.addIceCandidate(candidate);
    }
    pendingCandidatesRef.current = [];
  };

  const handleSignal = useCallback(async (message: SignalMessage) => {
    if (message.type === "joined") {
      setStatus(message.participants === 2 ? "Connecting..." : "Waiting for your guest...");
      setView("call");
      return;
    }
    if (message.type === "room_ready" && message.role) {
      roleRef.current = message.role;
      let peer = peerRef.current;
      if (!peer && createPeerRef.current) peer = createPeerRef.current();
      if (!peer) return;
      setPeerName(message.peer_name || "Guest");
      setStatus("Connecting...");
      if (message.role === ("offerer" satisfies Role)) await startOffer(true);
      return;
    }
    const peer = peerRef.current;
    if (!peer) return;
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
    if (message.type === "media_state") {
      setIsRemoteCameraOn(message.camera_enabled !== false);
      if (message.camera_enabled === false && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      } else if (message.camera_enabled !== false && remoteStreamRef.current && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
      }
      return;
    }
    if (message.type === "room_full") {
      setError("This room is already full.");
      leaveCall();
      return;
    }
    if (message.type === "peer_left") {
      peer.close();
      peerRef.current = null;
      setPeerName("");
      setHasRemoteVideo(false);
      setStatus("Waiting for someone to join...");
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      return;
    }
    if (message.type === "peer_reconnecting") {
      setStatus("Reconnecting...");
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
    intentionalLeaveRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // Start with the front camera when it is available. This also gives
        // browsers that do not report facingMode a sensible initial direction.
        video: { facingMode: { ideal: "user" } },
        audio: true,
      });
      let socket = new WebSocket(SIGNALING_URL);
      localStreamRef.current = stream;
      socketRef.current = socket;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      createPeerRef.current = () => {
        const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        peerRef.current = peer;
        // Use the current stream if a peer is recreated after a camera change.
        const activeStream = localStreamRef.current || stream;
        activeStream.getTracks().forEach((track) => {
          const sender = peer.addTrack(track, activeStream);
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
          if (peer.connectionState === "connected") {
            reconnectAttemptsRef.current = 0;
            setStatus("Connected");
          }
          if ((peer.connectionState === "disconnected" || peer.connectionState === "failed") && !intentionalLeaveRef.current) {
            if (reconnectAttemptsRef.current >= 5) {
              leaveCall();
              setError("We could not reconnect. Check your network and try joining again.");
              return;
            }
            setStatus("Reconnecting...");
            if (roleRef.current === "offerer" && reconnectTimerRef.current === null) {
              const delay = 1500 * Math.min(reconnectAttemptsRef.current + 1, 5);
              reconnectAttemptsRef.current += 1;
              reconnectTimerRef.current = window.setTimeout(() => {
                reconnectTimerRef.current = null;
                void startOffer(true);
              }, delay);
            }
          }
        };
        return peer;
      };
      createPeerRef.current();
      const configureSocket = (currentSocket: WebSocket, messageType: "create" | "join") => {
        currentSocket.onopen = () => {
          socketReconnectAttemptsRef.current = 0;
          send({
            type: messageType,
            room_key: key,
            display_name: displayName,
            participant_id: participantIdRef.current,
          });
          setStatus("Waiting for your guest...");
        };
        currentSocket.onmessage = (event) => {
          void handleSignal(JSON.parse(event.data) as SignalMessage);
        };
        currentSocket.onerror = () => setError("Could not connect to the call server.");
        currentSocket.onclose = () => {
          if (intentionalLeaveRef.current) return;
          if (socketReconnectAttemptsRef.current >= 5) {
            leaveCall();
            setError("The call server connection was lost.");
            return;
          }
          setStatus("Reconnecting...");
          socketReconnectAttemptsRef.current += 1;
          reconnectTimerRef.current = window.setTimeout(() => {
            socket = new WebSocket(SIGNALING_URL);
            socketRef.current = socket;
            configureSocket(socket, "join");
          }, 2000);
        };
      };
      configureSocket(socket, action);
      setRoomKey(key);
      roomKeyRef.current = key;
      const initialFacingMode = stream.getVideoTracks()[0]?.getSettings().facingMode;
      if (initialFacingMode === "environment" || initialFacingMode === "user") {
        cameraFacingModeRef.current = initialFacingMode;
        setIsFrontCamera(initialFacingMode === "user");
      }
    } catch (err) {
      setError(err instanceof DOMException && err.name === "NotAllowedError"
        ? "Camera and microphone permission are required to join."
        : "Could not start the call. Check your camera and server connection.");
    }
  }, [handleSignal, leaveCall, send, startOffer]);

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
      send({ type: "media_state", camera_enabled: false });
      return;
    }

    try {
      let cameraStream: MediaStream;
      try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: cameraFacingModeRef.current } },
        });
      } catch {
        cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
      }
      const track = cameraStream.getVideoTracks()[0];
      await sender.replaceTrack(track);
      stream.addTrack(track);
      const freshStream = new MediaStream(stream.getTracks());
      localStreamRef.current = freshStream;
      if (localVideoRef.current) localVideoRef.current.srcObject = freshStream;
      const actualFacingMode = track.getSettings().facingMode;
      if (actualFacingMode === "environment" || actualFacingMode === "user") {
        cameraFacingModeRef.current = actualFacingMode;
        setIsFrontCamera(actualFacingMode === "user");
      }
      setIsCameraOff(false);
      send({ type: "media_state", camera_enabled: true });
    } catch {
      setError("Could not turn the camera back on. Check your camera permissions.");
    }
  };

  const switchCamera = async () => {
    const stream = localStreamRef.current;
    const sender = videoSenderRef.current;
    const previousTrack = stream?.getVideoTracks()[0];
    if (!stream || !sender || !previousTrack || isCameraOff) return;

    const previousFacingMode = cameraFacingModeRef.current;
    const nextFacingMode = previousFacingMode === "user" ? "environment" : "user";
    const previousDeviceId = previousTrack.getSettings().deviceId;
    let videoDevices: MediaDeviceInfo[] = [];

    try {
      videoDevices = (await navigator.mediaDevices.enumerateDevices())
        .filter((device) => device.kind === "videoinput");
    } catch {
      // Some browsers expose no device inventory; facingMode remains the fallback.
    }

    const targetDevice = previousDeviceId
      ? findAlternativeCamera(videoDevices, previousDeviceId, nextFacingMode)
      : undefined;
    const targetConstraints: MediaTrackConstraints = targetDevice
      ? { deviceId: { exact: targetDevice.deviceId } }
      : { facingMode: { ideal: nextFacingMode } };
    const restoreConstraints: MediaTrackConstraints = previousDeviceId
      ? { deviceId: { exact: previousDeviceId } }
      : { facingMode: { ideal: previousFacingMode } };

    const attachTrackToLocalPreview = (track: MediaStreamTrack) => {
      stream.addTrack(track);
      const freshStream = new MediaStream(stream.getTracks());
      localStreamRef.current = freshStream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = freshStream;
        void localVideoRef.current.play().catch(() => undefined);
      }
    };

    const restorePreviousCamera = async () => {
      const restoreStream = await navigator.mediaDevices.getUserMedia({ video: restoreConstraints });
      const restoreTrack = restoreStream.getVideoTracks()[0];
      await sender.replaceTrack(restoreTrack);
      attachTrackToLocalPreview(restoreTrack);
      cameraFacingModeRef.current = previousFacingMode;
      setIsFrontCamera(previousFacingMode === "user");
    };

    try {
      // This device cannot start its rear camera while its front camera is
      // captured. Release the current source before requesting the alternative.
      await sender.replaceTrack(null);
      stream.removeTrack(previousTrack);
      previousTrack.stop();

      let nextTrack: MediaStreamTrack;
      try {
        const cameraStream = await navigator.mediaDevices.getUserMedia({ video: targetConstraints });
        nextTrack = cameraStream.getVideoTracks()[0];
      } catch (error) {
        try {
          await restorePreviousCamera();
        } catch {
          // Preserve the original acquisition error for the user-facing message.
        }
        throw error;
      }

      const actualFacingMode = nextTrack.getSettings().facingMode;
      if ((actualFacingMode === "environment" || actualFacingMode === "user")
        && actualFacingMode !== nextFacingMode) {
        nextTrack.stop();
        await restorePreviousCamera();
        setError("This browser could not switch to the other camera.");
        return;
      }

      try {
        await sender.replaceTrack(nextTrack);
      } catch (error) {
        nextTrack.stop();
        try {
          await restorePreviousCamera();
        } catch {
          // Preserve the replacement error for the user-facing message.
        }
        throw error;
      }
      attachTrackToLocalPreview(nextTrack);

      if (actualFacingMode === "environment" || actualFacingMode === "user") {
        cameraFacingModeRef.current = actualFacingMode;
        setIsFrontCamera(actualFacingMode === "user");
      } else {
        cameraFacingModeRef.current = nextFacingMode;
        setIsFrontCamera(nextFacingMode === "user");
      }
    } catch {
      setError("This device could not switch cameras.");
    }
  };

  return {
    view, roomKey, peerName, hasRemoteVideo, status, error, isMuted, isCameraOff,
    isRemoteCameraOn,
    attachLocalVideo, attachRemoteVideo, connect, leaveCall, toggleMute, toggleCamera, switchCamera,
    isFrontCamera,
    setError,
  };
}
