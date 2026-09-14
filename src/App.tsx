import { useEffect, useState } from "react";
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
  const attachLocalVideo = (element: HTMLVideoElement | null) => call.attachLocalVideo(element);
  const attachRemoteVideo = (element: HTMLVideoElement | null) => call.attachRemoteVideo(element);

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
      <main className="min-h-screen bg-[#0e1110] text-[#f5f1eb]">
        <Toast message={call.error} onDismiss={() => call.setError("")} />
        <header className="flex h-22 items-center justify-between border-b border-white/7 px-[3vw] max-sm:h-17.5"><Brand /><div className="flex items-center gap-3 font-mono text-[11px] text-[#79847b]"><span className="max-sm:hidden">Room</span><strong className="tracking-[.15em] text-[#dbe7c7]">{call.roomKey}</strong><button className={CONTROL_CLASS} onClick={copyRoom}>{copied ? "Copied" : "Copy code"}</button></div><button className="rounded border border-[#5b3933] bg-[#1a201c] px-3 py-2 text-[11px] text-[#e3a090]" onClick={call.leaveCall}>Leave call</button></header>
        <section className="grid h-[calc(100vh-166px)] min-h-125 grid-cols-[minmax(0,1fr)_230px] gap-4 px-[3vw] py-6 max-sm:h-[calc(100vh-210px)] max-sm:min-h-95 max-sm:grid-cols-1 max-sm:px-[4vw]"><div className="relative overflow-hidden rounded-[10px] border border-[#263029] bg-[#171c19]"><video className="h-full w-full object-cover transform-[scaleX(-1)]" ref={attachRemoteVideo} autoPlay playsInline />{!call.peerName && <Waiting title="Waiting for someone to join" message="Share your room code to start the conversation." />}{call.peerName && !call.hasRemoteVideo && <Waiting title={`Connecting to ${call.peerName}`} message="Setting up a secure connection..." />}<VideoLabel>{call.peerName || "Your guest"}</VideoLabel></div><div className="relative h-43.75 self-end overflow-hidden rounded-[10px] border border-[#263029] bg-[#171c19] max-sm:absolute max-sm:right-7.5 max-sm:top-23.75 max-sm:z-20 max-sm:h-40 max-sm:w-30"><video className="h-full w-full object-cover transform-[scaleX(-1)]" ref={attachLocalVideo} autoPlay muted playsInline /><VideoLabel>You</VideoLabel></div></section>
        <footer className="flex min-h-19.5 items-center justify-between border-t border-[#252d28] px-[3vw] font-mono text-[11px] text-[#89948b] max-sm:flex-wrap max-sm:gap-3 max-sm:px-[4vw] max-sm:py-3"><div><span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-[#c9e181]" />{call.status}</div><div className="flex gap-2"><button className={call.isMuted ? `${CONTROL_CLASS} bg-[#c9e181] text-[#192018]` : CONTROL_CLASS} onClick={call.toggleMute}>{call.isMuted ? "Mic off" : "Mute"}</button><button className={call.isCameraOff ? `${CONTROL_CLASS} bg-[#c9e181] text-[#192018]` : CONTROL_CLASS} onClick={() => void call.toggleCamera()}>{call.isCameraOff ? "Camera off" : "Camera"}</button></div><div className="font-mono text-[10px] text-[#58645b] max-sm:hidden">🔒 End-to-end connection</div></footer>
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
