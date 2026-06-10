// Event inspector panel: the raw event stream for the current replay
// slice (events 0..cursor), color-coded by category, each row expandable
// to full JSON. Only the most recent MAX_VISIBLE rows are kept in the
// DOM; older events sit behind a single "show earlier" affordance.
// Ported from the engine demo, adapted to subscribe to the ReplayStore.

import type { Event } from 'dnd-srd-engine';
import type { SnapshotSource, ReplaySnapshot } from '@/engine/snapshot-source';
import type { Session } from '@/state/session';
import { collapseToggleHtml, makeCollapsible } from '@/ui/collapsible';
import { createEventRow } from './event-row';

const MAX_VISIBLE = 200;
const FOLLOW_TAIL_TOLERANCE_PX = 64;

export interface EventInspector {
  readonly unmount: () => void;
}

export const mountEventInspector = (root: HTMLElement, store: SnapshotSource): EventInspector => {
  root.innerHTML = `
    <div class="panel-header">${collapseToggleHtml('Event log')}<span class="inspector-meta"></span></div>
    <div class="panel-scroll inspector-scroll">
      <button type="button" class="show-earlier" hidden></button>
      <ol class="event-list" aria-label="Event log"></ol>
    </div>
  `;
  const meta = root.querySelector<HTMLSpanElement>('.inspector-meta');
  const list = root.querySelector<HTMLOListElement>('.event-list');
  const scroller = root.querySelector<HTMLDivElement>('.inspector-scroll');
  const showEarlier = root.querySelector<HTMLButtonElement>('.show-earlier');
  const toggle = root.querySelector<HTMLButtonElement>('.panel-collapse');
  if (!meta || !list || !scroller || !showEarlier || !toggle) {
    throw new Error('event-inspector: failed to mount template');
  }
  makeCollapsible(root, toggle);

  let showAll = false;
  let lastRenderedFirstIndex = -1;
  let lastRenderedCount = 0;
  let lastSession: Session | undefined;
  let followTail = true;
  let latest = store.getSnapshot();

  scroller.addEventListener(
    'scroll',
    () => {
      followTail =
        scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < FOLLOW_TAIL_TOLERANCE_PX;
    },
    { passive: true },
  );

  const renderFullRange = (events: ReadonlyArray<Event>, firstIndex: number): void => {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < events.length; i++) {
      frag.appendChild(createEventRow(events[i]!, firstIndex + i));
    }
    list.replaceChildren(frag);
    lastRenderedFirstIndex = firstIndex;
    lastRenderedCount = events.length;
  };

  const render = (events: ReadonlyArray<Event>): void => {
    const firstIndex = showAll ? 0 : Math.max(0, events.length - MAX_VISIBLE);
    const hidden = firstIndex;

    showEarlier.hidden = hidden === 0;
    showEarlier.textContent = `Show ${hidden} earlier event${hidden === 1 ? '' : 's'}`;

    // Fast path: appending newcomers to the same window we last rendered.
    const canAppend =
      lastRenderedFirstIndex === firstIndex &&
      events.length >= lastRenderedFirstIndex + lastRenderedCount;
    if (canAppend) {
      for (let i = lastRenderedFirstIndex + lastRenderedCount; i < events.length; i++) {
        list.appendChild(createEventRow(events[i]!, i));
      }
      lastRenderedCount = events.length - lastRenderedFirstIndex;
    } else {
      renderFullRange(events.slice(firstIndex), firstIndex);
    }

    if (followTail) scroller.scrollTop = scroller.scrollHeight;
  };

  const onSnapshot = (snapshot: ReplaySnapshot): void => {
    if (snapshot.session !== lastSession) {
      lastSession = snapshot.session;
      showAll = false;
      lastRenderedFirstIndex = -1;
      lastRenderedCount = 0;
      followTail = true;
    }
    latest = snapshot;
    meta.textContent = `step ${snapshot.cursor} of ${snapshot.totalEvents}`;
    render(snapshot.campaign.events);
  };

  showEarlier.addEventListener('pointerdown', () => {
    showAll = true;
    render(latest.campaign.events);
  });

  const unsubscribe = store.subscribe(onSnapshot);

  return {
    unmount: () => {
      unsubscribe();
      root.replaceChildren();
    },
  };
};
