// Top-centre transport bar: skip-to-start, step-back, play/pause,
// step-forward, skip-to-end, plus a "step N / M" readout. Drives the
// ReplayStore cursor and reflects its snapshots. Auto-play advances one
// event every STEP_DELAY_MS. Ported behavior from the engine demo.

import type { ReplayStore, ReplaySnapshot } from '@/engine/replay-store';
import { STEP_DELAY_MS } from '@/constants/timing';

export interface TransportBar {
  readonly unmount: () => void;
}

export const mountTransportBar = (root: HTMLElement, store: ReplayStore): TransportBar => {
  root.innerHTML = `
    <button type="button" class="t-first" title="Jump to start" aria-label="Jump to start">⏮</button>
    <button type="button" class="t-prev" title="Step back" aria-label="Step back">⏪</button>
    <button type="button" class="t-play" title="Play" aria-label="Play">▶</button>
    <button type="button" class="t-next" title="Step forward" aria-label="Step forward">⏩</button>
    <button type="button" class="t-last" title="Jump to end" aria-label="Jump to end">⏭</button>
  `;
  const btnFirst = root.querySelector<HTMLButtonElement>('.t-first');
  const btnPrev = root.querySelector<HTMLButtonElement>('.t-prev');
  const btnPlay = root.querySelector<HTMLButtonElement>('.t-play');
  const btnNext = root.querySelector<HTMLButtonElement>('.t-next');
  const btnLast = root.querySelector<HTMLButtonElement>('.t-last');
  if (!btnFirst || !btnPrev || !btnPlay || !btnNext || !btnLast) {
    throw new Error('transport-bar: failed to mount template');
  }

  let latest = store.getSnapshot();
  let playTimer: ReturnType<typeof setInterval> | undefined;

  const stopPlay = (): void => {
    if (playTimer !== undefined) {
      clearInterval(playTimer);
      playTimer = undefined;
    }
  };

  const render = (): void => {
    const { cursor, totalEvents } = latest;
    const start = latest.session.openingCursor;
    btnFirst.disabled = cursor <= start;
    btnPrev.disabled = cursor <= start;
    btnNext.disabled = cursor >= totalEvents;
    btnLast.disabled = cursor >= totalEvents;
    const playing = playTimer !== undefined;
    btnPlay.textContent = playing ? '⏸' : '▶';
    btnPlay.title = playing ? 'Pause' : 'Play';
    btnPlay.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  };

  btnFirst.addEventListener('pointerdown', () => {
    stopPlay();
    store.seek(latest.session.openingCursor);
  });
  btnPrev.addEventListener('pointerdown', () => {
    stopPlay();
    store.seek(latest.cursor - 1);
  });
  btnNext.addEventListener('pointerdown', () => {
    stopPlay();
    store.seek(latest.cursor + 1);
  });
  btnLast.addEventListener('pointerdown', () => {
    stopPlay();
    store.seek(latest.totalEvents);
  });
  const togglePlay = (): void => {
    if (playTimer !== undefined) {
      stopPlay();
      render();
      return;
    }
    if (latest.cursor >= latest.totalEvents) return;
    playTimer = setInterval(() => {
      if (latest.cursor >= latest.totalEvents) {
        stopPlay();
        render();
        return;
      }
      store.seek(latest.cursor + 1);
    }, STEP_DELAY_MS);
    render();
  };
  btnPlay.addEventListener('pointerdown', togglePlay);

  // Keyboard transport: arrows step, Home/End jump, Space plays/pauses.
  // Ignored while typing in the config inputs.
  const onKey = (event: KeyboardEvent): void => {
    const target = event.target as HTMLElement | null;
    const tag = target?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    switch (event.key) {
      case 'ArrowLeft':
        stopPlay();
        store.seek(latest.cursor - 1);
        break;
      case 'ArrowRight':
        stopPlay();
        store.seek(latest.cursor + 1);
        break;
      case 'Home':
        stopPlay();
        store.seek(latest.session.openingCursor);
        break;
      case 'End':
        stopPlay();
        store.seek(latest.totalEvents);
        break;
      case ' ':
        togglePlay();
        break;
      default:
        return;
    }
    event.preventDefault();
  };
  window.addEventListener('keydown', onKey);

  // A freshly loaded scenario must always appear paused, even if playback
  // was running when the config changed.
  let lastSession = latest.session;
  const unsubscribe = store.subscribe((snapshot: ReplaySnapshot) => {
    if (snapshot.session !== lastSession) {
      lastSession = snapshot.session;
      stopPlay();
    }
    latest = snapshot;
    render();
  });

  return {
    unmount: () => {
      stopPlay();
      window.removeEventListener('keydown', onKey);
      unsubscribe();
      root.replaceChildren();
    },
  };
};
