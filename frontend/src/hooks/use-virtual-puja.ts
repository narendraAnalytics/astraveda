import { create } from 'zustand';

import { DEFAULT_TEMPLE_ID } from '../lib/virtual-puja';

type AutoState = 'idle' | 'running';

type VirtualPujaStore = {
  templeId: string;
  ringing: boolean;
  aartiOn: boolean;
  dhoopOn: boolean;
  naivedyaOn: boolean;
  muted: boolean;
  auto: AutoState;
  /** Bumped each time a flower shower should spawn. */
  petalTick: number;
  /** Bumped each time the shrine should ripple (conch / shankh). */
  rippleTick: number;

  setTemple: (id: string) => void;
  toggleRinging: () => void;
  toggleAarti: () => void;
  toggleDhoop: () => void;
  offerNaivedya: () => void;
  toggleMute: () => void;

  setRinging: (v: boolean) => void;
  setAartiOn: (v: boolean) => void;
  setDhoopOn: (v: boolean) => void;
  setAuto: (v: AutoState) => void;
  burstPetals: () => void;
  pingRipple: () => void;
  resetOfferings: () => void;
};

export const useVirtualPuja = create<VirtualPujaStore>((set) => ({
  templeId: DEFAULT_TEMPLE_ID,
  ringing: false,
  aartiOn: false,
  dhoopOn: false,
  naivedyaOn: false,
  muted: false,
  auto: 'idle',
  petalTick: 0,
  rippleTick: 0,

  setTemple: (templeId) => set({ templeId }),
  toggleRinging: () => set((s) => ({ ringing: !s.ringing })),
  toggleAarti: () => set((s) => ({ aartiOn: !s.aartiOn })),
  toggleDhoop: () => set((s) => ({ dhoopOn: !s.dhoopOn })),
  offerNaivedya: () => set({ naivedyaOn: true }),
  toggleMute: () => set((s) => ({ muted: !s.muted })),

  setRinging: (ringing) => set({ ringing }),
  setAartiOn: (aartiOn) => set({ aartiOn }),
  setDhoopOn: (dhoopOn) => set({ dhoopOn }),
  setAuto: (auto) => set({ auto }),
  burstPetals: () => set((s) => ({ petalTick: s.petalTick + 1 })),
  pingRipple: () => set((s) => ({ rippleTick: s.rippleTick + 1 })),
  resetOfferings: () =>
    set({ ringing: false, aartiOn: false, dhoopOn: false, naivedyaOn: false }),
}));
