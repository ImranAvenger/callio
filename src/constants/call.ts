const turnUrls = import.meta.env.VITE_TURN_URLS
  ?.split(",")
  .map((url: string) => url.trim())
  .filter(Boolean);

export const ICE_SERVERS: RTCConfiguration["iceServers"] = [
  { urls: "stun:stun.l.google.com:19302" },
  // ...(turnUrls?.length && import.meta.env.VITE_TURN_USERNAME && import.meta.env.VITE_TURN_CREDENTIAL
  //   ? [{
  //       urls: turnUrls,
  //       username: import.meta.env.VITE_TURN_USERNAME,
  //       credential: import.meta.env.VITE_TURN_CREDENTIAL,
  //     }]
  //   : []),
];

export const SIGNALING_URL = "wss://api.imranlab.tech/v1/call/ws";

export const INPUT_CLASS =
  "w-full rounded-md border border-[#303934] bg-[#1a1e1c] px-4 py-3.5 text-[#f5f1eb] outline-none placeholder:text-[#69736b] focus:border-[#a7c776] focus:ring-4 focus:ring-[#a7c776]/10";

export const CONTROL_CLASS =
  "rounded-md border border-[#303b32] bg-[#1b211e] px-3.5 py-2.5 text-[11px] text-[#c5cec5] transition hover:border-[#c9e181]";

export function createRoomKey() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}
