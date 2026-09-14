export type View = "lobby" | "call";
export type Role = "offerer" | "answerer";

export type SignalMessage = {
  type: string;
  room_key?: string;
  display_name?: string;
  participants?: number;
  peer_name?: string;
  role?: Role;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};
