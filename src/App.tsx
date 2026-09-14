import React, { useCallback, useEffect, useRef, useState, type PointerEvent, type SyntheticEvent } from "react";
import { CONTROL_CLASS, createRoomKey } from "./constants/call";
import { useCall } from "./hooks/useCall";

function Brand() {
  return <div className="text-xl font-bold tracking-[-.04em]"><span className="mr-1.5 text-[21px] text-[#cae17e]">✦</span>callio</div>;
}

function Waiting({ title, message }: { title: string; message: string }) {
  return <div className="absolute inset-0 flex flex-col items-center justify-center text-[#c8d0c8]"><span className="h-3 w-3 rounded-full bg-[#c9e181] shadow-[0_0_0_9px_rgba(201,225,129,.1)]" /><h2 className="mb-1 mt-5.5 text-lg font-medium">{title}</h2><p className="text-[13px] text-[#778078]">{message}</p></div>;
}

function VideoLabel({ children }: { children: string }) {
  return <span className="absolute bottom-3 left-4 rounded bg-black/60 px-2 py-1.5 font-mono text-[11px] text-[#d8e1d5]">{children}</span>;
}

function Icon({ name }: { name: "mic" | "mic-off" | "camera" | "camera-off" | "flip" | "leave" }) {
  const paths = {
    mic: <><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8" /></>,
    "mic-off": <><path d="m3 3 18 18M9 5v7a3 3 0 0 0 5 2.2M15 9V5a3 3 0 0 0-5-2.2M5 10v2a7 7 0 0 0 11.2 5.6M12 19v3M8 22h8" /></>,
    camera: <><path d="m16 7 5-3v16l-5-3M3 6h13v12H3z" /></>,
    "camera-off": <><path d="m3 3 18 18M16 7l5-3v16l-5-3M3 6h7M3 18h13V9" /></>,
    flip: <><path d="M20 7h-7l2.5-2.5M4 17h7l-2.5 2.5M17 4.5A7 7 0 0 1 20 10M7 19.5A7 7 0 0 1 4 14" /></>,
    leave: <><path d="M10 17l5-5-5-5M15 12H3M21 19V5a2 2 0 0 0-2-2h-5M14 21h5a2 2 0 0 0 2-2" /></>,
  };
  return <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">{paths[name]}</svg>;
}

function DraggablePreview({
  attachVideo,
  visible,
  aspectRatio,
  onMetadata,
  orientationKey,
}: {
  attachVideo: (element: HTMLVideoElement | null) => void;
  visible: boolean;
  aspectRatio: number;
  onMetadata: (event: SyntheticEvent<HTMLVideoElement>) => void;
  orientationKey: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const dragRef = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);

  // Reset position to default (bottom-right) when orientation changes
  useEffect(() => {
    setPosition({ x: null, y: null });
  }, [orientationKey]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const container = containerRef.current;
    const preview = event.currentTarget;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const previewRect = preview.getBoundingClientRect();
    const x = previewRect.left - containerRect.left;
    const y = previewRect.top - containerRect.top;
    setPosition({ x, y });
    dragRef.current = { x, y, startX: event.clientX, startY: event.clientY };
  };
  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const container = containerRef.current;
    const preview = event.currentTarget;
    if (!drag || !container) return;
    const containerRect = container.getBoundingClientRect();
    const previewRect = preview.getBoundingClientRect();
    const maxX = Math.max(0, containerRect.width - previewRect.width);
    const maxY = Math.max(0, containerRect.height - previewRect.height);
    setPosition({
      x: Math.min(maxX, Math.max(0, drag.x + event.clientX - drag.startX)),
      y: Math.min(maxY, Math.max(0, drag.y + event.clientY - drag.startY)),
    });
  };

  if (!visible) return null;

  // Dynamic sizing: keep the inset a reasonable size regardless of orientation.
  // For landscape (aspectRatio >= 1): fixed width, height derived.
  // For portrait (aspectRatio < 1): fixed height, width derived.
  const isPortrait = aspectRatio < 1;
  const maxDimension = 160; // px — the "long" side of the inset
  const smallMaxDimension = 130; // for small screens
  const insetStyle: React.CSSProperties = {
    aspectRatio,
    ...(isPortrait
      ? { height: maxDimension, width: maxDimension * aspectRatio }
      : { width: maxDimension, height: maxDimension / aspectRatio }),
    left: position.x === null ? undefined : position.x,
    top: position.y === null ? undefined : position.y,
    right: position.x === null ? undefined : "auto",
    bottom: position.y === null ? undefined : "auto",
  };
  const smallInsetStyle: React.CSSProperties = isPortrait
    ? { height: smallMaxDimension, width: smallMaxDimension * aspectRatio }
    : { width: smallMaxDimension, height: smallMaxDimension / aspectRatio };

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0 z-20">
      <div
        className="pointer-events-auto absolute bottom-5 right-5 touch-none cursor-grab overflow-hidden rounded-xl border-2 border-white/70 bg-[#171c19] shadow-2xl active:cursor-grabbing max-sm:bottom-4 max-sm:right-4"
        style={Object.assign({}, insetStyle, window.innerWidth < 640 ? smallInsetStyle : {})}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={() => { dragRef.current = null; }}
      >
        <video className="h-full w-full object-contain transform-[scaleX(-1)]" ref={attachVideo} onLoadedMetadata={onMetadata} onResize={onMetadata} autoPlay muted playsInline />
        <VideoLabel>You</VideoLabel>
      </div>
    </div>
  );
}

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    if (!message) return;

    const timeout = window.setTimeout(() => {
      onDismiss();
    }, 4000);

    return () => window.clearTimeout(timeout);
  }, [message, onDismiss]);

  if (!message) return null;
  return (
    <div className="fixed right-5 top-5 z-50 flex max-w-sm items-start gap-3 rounded-lg border border-[#8e5045] bg-[#2b1917] px-4 py-3 text-sm text-[#ffd0c5] shadow-2xl shadow-black/30" role="alert">
      <span className="mt-0.5 text-[#f0a08f]">!</span>
      <span className="flex-1">{message}</span>
      <button className="text-lg leading-none text-[#f0a08f] hover:text-white" onClick={onDismiss} aria-label="Dismiss notification">×</button>
    </div>
  );
}

function App() {
  const call = useCall();
  const [name, setName] = useState("");
  const [joinKey, setJoinKey] = useState("");
  const [copied, setCopied] = useState(false);
  const [localAspectRatio, setLocalAspectRatio] = useState(16 / 9);
  const [orientationKey, setOrientationKey] = useState(0);
  const localVideoElRef = useRef<HTMLVideoElement | null>(null);

  const attachLocalVideo = useCallback((element: HTMLVideoElement | null) => {
    localVideoElRef.current = element;
    call.attachLocalVideo(element);
  }, [call]);

  const attachRemoteVideo = useCallback((element: HTMLVideoElement | null) => {
    call.attachRemoteVideo(element);
  }, [call]);

  // Listen for orientation/resize changes to update aspect ratios and reset inset position
  useEffect(() => {
    const handleOrientationChange = () => {
      setOrientationKey((k) => k + 1);
      // Re-read local video dimensions after a brief delay for the new orientation to settle
      requestAnimationFrame(() => {
        const localEl = localVideoElRef.current;
        if (localEl && localEl.videoWidth && localEl.videoHeight) {
          setLocalAspectRatio(localEl.videoWidth / localEl.videoHeight);
        }
      });
    };

    // Use screen.orientation API where available, fall back to resize
    const orientationApi = window.screen?.orientation;
    if (orientationApi) {
      orientationApi.addEventListener("change", handleOrientationChange);
    }
    window.addEventListener("resize", handleOrientationChange);

    return () => {
      if (orientationApi) {
        orientationApi.removeEventListener("change", handleOrientationChange);
      }
      window.removeEventListener("resize", handleOrientationChange);
    };
  }, []);

  const validateAndConnect = (key: string, action: "create" | "join") => {
    const displayName = name.trim();
    if (!displayName) {
      call.setError("Enter your name first.");
      return;
    }
    if (key.length < 4) {
      call.setError("Enter a valid room code.");
      return;
    }
    void call.connect(key, displayName, action);
  };

  const createRoom = () => validateAndConnect(createRoomKey(), "create");
  const joinRoom = () => validateAndConnect(joinKey.trim().toUpperCase(), "join");
  const copyRoom = async () => {
    await navigator.clipboard.writeText(call.roomKey);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  if (call.view === "call") {
    return (
      <main className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[#0e1110] text-[#f5f1eb]">
        <Toast message={call.error} onDismiss={() => call.setError("")} />
        <header className="flex h-22 items-center justify-between border-b border-white/7 px-[3vw] max-sm:h-17.5"><Brand /><div className="flex items-center gap-3 font-mono text-[11px] text-[#79847b]"><span className="max-sm:hidden">Room</span><strong className="tracking-[.15em] text-[#dbe7c7]">{call.roomKey}</strong><button className={CONTROL_CLASS} onClick={copyRoom}>{copied ? "Copied" : "Copy code"}</button></div><span className="text-xs text-[#68736b] max-sm:hidden">{call.status}</span></header>
        <section className="relative mx-[3vw] my-5 min-h-0 flex-1 flex items-center justify-center overflow-hidden rounded-2xl border border-[#263029] bg-[#101412] max-sm:mx-3 max-sm:my-3">
          <video className={`h-full w-full object-contain ${call.isRemoteCameraOn ? "" : "hidden"}`} ref={attachRemoteVideo} autoPlay playsInline />
          {!call.peerName && <Waiting title="Waiting for someone to join" message="Share your call code with someone to start." />}
          {call.peerName && !call.hasRemoteVideo && <Waiting title={`Connecting to ${call.peerName}`} message="Getting the call ready..." />}
          {call.hasRemoteVideo && call.isRemoteCameraOn && <VideoLabel>{call.peerName || "Your guest"}</VideoLabel>}
          {!call.isRemoteCameraOn && call.peerName && <div className="absolute inset-0 flex flex-col items-center justify-center gap-4"><div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#c9e181] text-4xl font-semibold text-[#192018]">{call.peerName.charAt(0).toUpperCase()}</div><span className="text-base text-[#d5ddd5]">{call.peerName}</span></div>}
          <DraggablePreview attachVideo={attachLocalVideo} visible={!call.isCameraOff} aspectRatio={localAspectRatio} onMetadata={(event) => setLocalAspectRatio(event.currentTarget.videoWidth / event.currentTarget.videoHeight || 16 / 9)} orientationKey={orientationKey} />
        </section>
        <footer className="relative flex min-h-19.5 shrink-0 items-center justify-center border-t border-[#252d28] px-[3vw] font-mono text-[11px] text-[#89948b] max-sm:min-h-20 max-sm:px-3 max-sm:py-3"><div className="absolute left-[3vw] max-sm:hidden"><span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-[#c9e181]" />{call.status}</div><div className="flex items-center gap-3"><button aria-label={call.isMuted ? "Unmute microphone" : "Mute microphone"} title={call.isMuted ? "Unmute microphone" : "Mute microphone"} className={`flex h-12 w-12 items-center justify-center rounded-full ${call.isMuted ? "bg-[#c9e181] text-[#192018]" : "bg-[#1b211e] text-[#d5ddd5]"} border border-[#39453b]`} onClick={call.toggleMute}><Icon name={call.isMuted ? "mic-off" : "mic"} /></button><button aria-label={call.isCameraOff ? "Turn camera on" : "Turn camera off"} title={call.isCameraOff ? "Turn camera on" : "Turn camera off"} className={`flex h-12 w-12 items-center justify-center rounded-full ${call.isCameraOff ? "bg-[#c9e181] text-[#192018]" : "bg-[#1b211e] text-[#d5ddd5]"} border border-[#39453b]`} onClick={() => void call.toggleCamera()}><Icon name={call.isCameraOff ? "camera-off" : "camera"} /></button><button aria-label="Switch camera" title="Switch camera" className="hidden h-12 w-12 items-center justify-center rounded-full border border-[#39453b] bg-[#1b211e] text-[#d5ddd5] disabled:cursor-not-allowed disabled:opacity-40 max-sm:flex" onClick={() => void call.switchCamera()} disabled={call.isCameraOff}><Icon name="flip" /></button><button aria-label="Leave call" title="Leave call" className="flex h-12 w-12 items-center justify-center rounded-full border border-[#7d463c] bg-[#4a211d] text-[#ffb7a8]" onClick={call.leaveCall}><Icon name="leave" /></button></div><div className="absolute right-[3vw] font-mono text-[10px] text-[#58645b] max-sm:hidden">🔒 Secure call</div></footer>
      </main>
    );
  }

  return (
    <main className="relative h-screen overflow-hidden bg-[#111313] text-[#f5f1eb]">
      <div className="pointer-events-none absolute -right-40 -top-44 h-155 w-155 rounded-full bg-[radial-gradient(circle,rgba(82,116,94,.2),transparent_68%)]" />
      <Toast message={call.error} onDismiss={() => call.setError("")} />
      <header className="relative z-10 flex h-18 items-center justify-between border-b border-white/7 px-[6vw] max-sm:h-15.5">
        <Brand />
        <span className="text-[13px] text-[#858d87] max-sm:hidden">Clear video calls, no account needed</span>
      </header>
      <section className="relative z-10 mx-auto grid h-[calc(100vh-112px)] w-[min(980px,88vw)] grid-cols-[1fr_390px] items-center gap-14 py-8 max-lg:flex max-lg:flex-col max-lg:justify-center max-lg:gap-6 max-sm:h-[calc(100vh-92px)] max-sm:w-[88vw] max-sm:gap-4 max-sm:py-2">
        <div className="max-lg:text-center">
          <div className="mb-5 flex items-center gap-2 text-sm text-[#afbdac] max-lg:justify-center max-sm:mb-2"><span className="h-2 w-2 rounded-full bg-[#c9e181]" />Ready to talk?</div>
          <h1 className="max-w-xl text-[clamp(48px,6.5vw,82px)] font-semibold leading-[.94] tracking-[-.075em] max-lg:max-w-none max-sm:text-[42px]">Call someone<br /><em className="font-display font-medium tracking-[-.06em] text-[#c9e181]">you care about.</em></h1>
          <p className="mt-5 max-w-md text-[15px] leading-6 text-[#9da39d] max-lg:mx-auto max-sm:mt-2 max-sm:max-w-xs max-sm:text-[13px] max-sm:leading-5">Start a private video call in seconds, or enter a code to join a call someone shared with you.</p>
          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#778078] max-lg:justify-center max-sm:hidden"><span>✓ No sign-up</span><span>✓ Free to use</span><span>✓ Private by design</span></div>
        </div>
        <div className="w-full rounded-2xl border border-[#303934] bg-[#191e1b]/90 p-5 shadow-2xl shadow-black/20 backdrop-blur-sm max-lg:max-w-97.5 max-sm:p-4">
          <h2 className="text-xl font-semibold">Start a call</h2>
          <p className="mt-1 text-sm text-[#778078]">First, tell us your name.</p>
          <label className="mb-2 mt-5 block text-xs font-medium text-[#9da39d]" htmlFor="name">Your name</label>
          <input id="name" className="w-full rounded-lg border border-[#303934] bg-[#111513] px-4 py-3.5 outline-none placeholder:text-[#69736b] focus:border-[#a7c776] focus:ring-4 focus:ring-[#a7c776]/10" value={name} onChange={(event) => setName(event.target.value)} placeholder="Enter your name" maxLength={40} />
          <button className="mt-4 flex w-full items-center gap-3 rounded-lg bg-[#c9e181] px-4 py-3.5 text-left font-medium text-[#152018] transition hover:-translate-y-0.5 hover:bg-[#d7ed95]" onClick={createRoom}><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#aec568] text-lg">＋</span><span className="flex-1">Start a new call</span><b>→</b></button>
          <div className="my-5 flex items-center gap-3 text-center text-xs text-[#667069]"><span className="h-px flex-1 bg-[#29302c]" />or<span className="h-px flex-1 bg-[#29302c]" /></div>
          <div className="flex gap-2 max-sm:flex-col"><input className="min-w-0 flex-1 rounded-lg border border-[#303934] bg-[#111513] px-4 py-3.5 uppercase tracking-[.12em] outline-none placeholder:normal-case placeholder:tracking-normal focus:border-[#a7c776]" value={joinKey} onChange={(event) => setJoinKey(event.target.value.toUpperCase())} onKeyDown={(event) => event.key === "Enter" && joinRoom()} placeholder="Call code" maxLength={6} /><button className="rounded-lg border border-[#3e4940] px-4 py-3.5 text-sm text-[#d3d9d0] transition hover:border-[#c9e181] hover:text-[#c9e181] max-sm:py-3.5" onClick={joinRoom}>Join call</button></div>
        </div>
      </section>
      <footer className="absolute bottom-5 left-[6vw] right-[6vw] flex justify-between text-xs text-[#545e57] max-sm:bottom-2 max-sm:text-[10px]"><span>© 2026 callio</span><span>Works in your browser</span></footer>
    </main>
  );
}

export default App;
