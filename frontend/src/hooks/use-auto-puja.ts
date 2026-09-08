import { useCallback, useEffect, useRef, useState } from 'react';

import { sleep } from '../lib/virtual-puja';
import type { PujaAudio } from './use-puja-audio';
import { useVirtualPuja } from './use-virtual-puja';

const TOTAL_MS = 18000;

/**
 * The one-tap "Automatic Pooja" — a scripted, cancellable sequence:
 * shankh → bell → flower shower → aarti → dhoop → second shower → settle.
 */
export function useAutoPuja(audio: PujaAudio, reduceMotion: boolean) {
  const running = useVirtualPuja((s) => s.auto === 'running');
  const [progress, setProgress] = useState(0);
  const cancelled = useRef(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTick = useCallback(() => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    cancelled.current = true;
    clearTick();
    const s = useVirtualPuja.getState();
    s.setAuto('idle');
    s.resetOfferings();
    audio.stopEffects();
    setProgress(0);
  }, [audio, clearTick]);

  const start = useCallback(async () => {
    const s = useVirtualPuja.getState();
    if (s.auto === 'running') return;
    cancelled.current = false;
    s.resetOfferings();
    s.setAuto('running');
    setProgress(0);

    const alive = () => !cancelled.current;
    const started = Date.now();
    clearTick();
    timer.current = setInterval(() => {
      setProgress(Math.min(1, (Date.now() - started) / TOTAL_MS));
    }, 120);

    try {
      audio.playConch();
      s.pingRipple();
      await sleep(900);
      if (alive()) s.setRinging(true);
      await sleep(1400);
      if (alive() && !reduceMotion) s.burstPetals();
      await sleep(900);
      if (alive()) {
        s.setAartiOn(true);
        audio.startAarti();
        audio.playChime();
      }
      await sleep(5500);
      if (alive()) s.setDhoopOn(true);
      await sleep(4000);
      if (alive() && !reduceMotion) s.burstPetals();
      await sleep(3400);
      if (alive()) s.setAartiOn(false);
      await sleep(1600);
    } finally {
      clearTick();
      if (alive()) {
        const done = useVirtualPuja.getState();
        done.setRinging(false);
        done.setDhoopOn(false);
        done.setAuto('idle');
        audio.stopEffects();
        setProgress(0);
      }
    }
  }, [audio, reduceMotion, clearTick]);

  useEffect(() => () => stop(), [stop]);

  return { running, progress, start, stop };
}
