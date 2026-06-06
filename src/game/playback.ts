import type { LiveStore } from '@/engine/live-store';
import { STEP_DELAY_MS } from '@/constants/timing';

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// Walk the live store's view cursor to the committed tail one event at a
// time, pausing between steps so each event animates (movement tweens,
// attack lunges, hurt flashes) exactly as a forward replay step does. The
// turn loop awaits this after committing an action, before the next one.
export const playToTail = async (store: LiveStore, stepMs: number = STEP_DELAY_MS): Promise<void> => {
  while (!store.viewAtTail) {
    store.stepForward();
    await wait(stepMs);
  }
};
