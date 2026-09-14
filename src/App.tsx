import { useState } from "react";
import { CONTROL_CLASS, createRoomKey } from "./constants/call";
import { useCall } from "./hooks/useCall";

function Brand() {
  return <div className="text-xl font-bold tracking-[-.04em]"><span className="mr-1.5 text-[21px] text-[#cae17e]">✦</span>callio</div>;
}

function Waiting({ title, message }: { title: string; message: string }) {
  return <div className="absolute inset-0 flex flex-col items-center justify-center text-[#c8d0c8]"><span className="h-3 w-3 rounded-full bg-[#c9e181] shadow-[0_0_0_9px_rgba(201,225,129,.1)]" /><h2 className="mb-1 mt-[22px] text-lg font-medium">{title}</h2><p className="text-[13px] text-[#778078]">{message}</p></div>;
}

function VideoLabel({ children }: { children: string }) {
  return <span className="absolute bottom-3 left-4 rounded bg-black/60 px-2 py-1.5 font-mono text-[11px] text-[#d8e1d5]">{children}</span>;
}

function App() {
  const call = useCall();
  const [name, setName] = useState("");
  const [joinKey, setJoinKey] = useState("");
  const [copied, setCopied] = useState(false);
  const attachLocalVideo = (element: HTMLVideoElement | null) => call.attachLocalVideo(element);
  const attachRemoteVideo = (element: HTMLVideoElement | null) => call.attachRemoteVideo(element);

  const validateAndConnect = (key: string) => {
    const displayName = name.trim();
    if (!displayName) {
      call.setError("Enter your name first.");
      return;
    }
    if (key.length < 4) {
      call.setError("Enter a valid room code.");
      return;
    }
    void call.connect(key, displayName);
  };

  const createRoom = () => validateAndConnect(createRoomKey());
  const joinRoom = () => validateAndConnect(joinKey.trim().toUpperCase());
  const copyRoom = async () => {
    await navigator.clipboard.writeText(call.roomKey);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  if (call.view === "call") {
    return (
      <main className="min-h-screen bg-[#0e1110] text-[#f5f1eb]">
        <header className="flex h-[88px] items-center justify-between border-b border-white/7 px-[3vw] max-sm:h-[70px]"><Brand /><div className="flex items-center gap-3 font-mono text-[11px] text-[#79847b]"><span className="max-sm:hidden">Room</span><strong className="tracking-[.15em] text-[#dbe7c7]">{call.roomKey}</strong><button className={CONTROL_CLASS} onClick={copyRoom}>{copied ? "Copied" : "Copy code"}</button></div><button className="rounded border border-[#5b3933] bg-[#1a201c] px-3 py-2 text-[11px] text-[#e3a090]" onClick={call.leaveCall}>Leave call</button></header>
        <section className="grid h-[calc(100vh-166px)] min-h-[500px] grid-cols-[minmax(0,1fr)_230px] gap-4 px-[3vw] py-6 max-sm:h-[calc(100vh-210px)] max-sm:min-h-[380px] max-sm:grid-cols-1 max-sm:px-[4vw]"><div className="relative overflow-hidden rounded-[10px] border border-[#263029] bg-[#171c19]"><video className="h-full w-full object-cover [transform:scaleX(-1)]" ref={attachRemoteVideo} autoPlay playsInline />{!call.peerName && <Waiting title="Waiting for someone to join" message="Share your room code to start the conversation." />}{call.peerName && !call.hasRemoteVideo && <Waiting title={`Connecting to ${call.peerName}`} message="Setting up a secure connection..." />}<VideoLabel>{call.peerName || "Your guest"}</VideoLabel></div><div className="relative h-[175px] self-end overflow-hidden rounded-[10px] border border-[#263029] bg-[#171c19] max-sm:absolute max-sm:right-[30px] max-sm:top-[95px] max-sm:z-20 max-sm:h-40 max-sm:w-[120px]"><video className="h-full w-full object-cover [transform:scaleX(-1)]" ref={attachLocalVideo} autoPlay muted playsInline /><VideoLabel>You</VideoLabel></div></section>
        <footer className="flex min-h-[78px] items-center justify-between border-t border-[#252d28] px-[3vw] font-mono text-[11px] text-[#89948b] max-sm:flex-wrap max-sm:gap-3 max-sm:px-[4vw] max-sm:py-3"><div><span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-[#c9e181]" />{call.status}</div><div className="flex gap-2"><button className={call.isMuted ? `${CONTROL_CLASS} bg-[#c9e181] text-[#192018]` : CONTROL_CLASS} onClick={call.toggleMute}>{call.isMuted ? "Mic off" : "Mute"}</button><button className={call.isCameraOff ? `${CONTROL_CLASS} bg-[#c9e181] text-[#192018]` : CONTROL_CLASS} onClick={() => void call.toggleCamera()}>{call.isCameraOff ? "Camera off" : "Camera"}</button><button className={`${CONTROL_CLASS} border-[#623d35] text-[#efaa9a]`} onClick={call.leaveCall}>End call</button></div><div className="font-mono text-[10px] text-[#58645b] max-sm:hidden">🔒 End-to-end connection</div></footer>
      </main>
    );
  }

  return <main className="min-h-screen bg-[#111313] text-[#f5f1eb]"><header className="flex h-[88px] items-center justify-between border-b border-white/7 px-[6vw] max-sm:h-[70px]"><Brand /><span className="text-[13px] text-[#858d87] max-sm:hidden">Simple calls. Better together.</span></header><section className="mx-auto mt-[11vh] w-[min(560px,88vw)] max-sm:mt-[10vh]"><div className="font-mono text-[11px] uppercase tracking-[.08em] text-[#afbdac]">● Private video calls, made easy</div><h1 className="my-6 text-[clamp(58px,8vw,100px)] font-semibold leading-[.94] tracking-[-.075em]">Be there,<br /><em className="font-display font-medium tracking-[-.06em] text-[#c9e181]">together.</em></h1><p className="mb-10 text-base leading-[1.65] text-[#9da39d]">A quiet place for the conversations that matter.<br />Create a room and invite someone in.</p><label className="mb-2 block font-mono text-[11px] uppercase tracking-[.1em] text-[#778078]" htmlFor="name">Your name</label><input id="name" className="w-full rounded-md border border-[#303934] bg-[#1a1e1c] px-4 py-3.5 outline-none focus:border-[#a7c776]" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Alex" maxLength={40} /><button className="mt-4 flex w-full items-center gap-4 rounded-md bg-[#c9e181] px-[18px] py-3.5 text-left text-[#152018]" onClick={createRoom}><span className="text-[27px]">＋</span><span className="flex-1"><strong className="block">Create a room</strong><small>Start a new private call</small></span><b>→</b></button><div className="my-5 flex items-center gap-3 font-mono text-[11px] text-[#667069]"><span className="h-px flex-1 bg-[#29302c]" />or<span className="h-px flex-1 bg-[#29302c]" /></div><div className="flex gap-2 max-sm:flex-col"><input className="flex-1 rounded-md border border-[#303934] bg-[#1a1e1c] px-4 py-3.5 uppercase tracking-[.12em] outline-none" value={joinKey} onChange={(event) => setJoinKey(event.target.value.toUpperCase())} onKeyDown={(event) => event.key === "Enter" && joinRoom()} placeholder="Enter room code" maxLength={6} /><button className="rounded-md border border-[#3e4940] px-[18px] max-sm:py-3.5" onClick={joinRoom}>Join room →</button></div>{call.error && <p className="mt-4 text-[13px] text-[#ed9e88]" role="alert">{call.error}</p>}<p className="mt-8 text-center font-mono text-[10px] text-[#657068]">No account needed <span className="px-2">•</span> Your call is peer-to-peer</p></section></main>;
}

export default App;
