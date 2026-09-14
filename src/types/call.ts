export type View = "lobby" | "call";
export type Role = "offerer" | "answerer";

export type SignalMessage = {
  type: string;
  participants?: number;
  peer_name?: string;
  role?: Role;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};
