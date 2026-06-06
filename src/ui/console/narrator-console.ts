// Narrator console: the human-readable battle log. Renders the session's
// precomputed narration lines whose event index is below the cursor, so
// stepping the transport reveals the story one beat at a time. Follows
// the tail like the inspector.

import type { SnapshotSource, ReplaySnapshot } from '@/engine/snapshot-source';
import type { Session } from '@/state/session';
import type { NarrationLine } from '@/narrator/types';
import { splitNarration } from '@/narrator/resolve';
import { classTextColor } from '@/constants/class-colors';
import { collapseToggleHtml, makeCollapsible } from '@/ui/collapsible';

const FOLLOW_TAIL_TOLERANCE_PX = 64;

export interface NarratorConsole {
  readonly unmount: () => void;
}

const createRow = (line: NarrationLine): HTMLLIElement => {
  const li = document.createElement('li');
  li.className = `narration-row narration-${line.kind}`;
  // Names render in their class color (WoW-style); salient values (spell
  // name, damage, gained HP) render in the line's kind color via the
  // .narration-value rule; everything else stays regular. Built as DOM
  // nodes (not innerHTML) so text is never interpreted as markup.
  for (const segment of splitNarration(line.text)) {
    if (segment.role === 'plain') {
      li.appendChild(document.createTextNode(segment.text));
      continue;
    }
    const span = document.createElement('span');
    if (segment.role === 'name') {
      span.className = 'narration-name';
      span.style.color = classTextColor(segment.classId);
    } else {
      span.className = 'narration-value';
    }
    span.textContent = segment.text;
    li.appendChild(span);
  }
  if (line.attackEventIndex !== undefined) li.dataset.attackIndex = String(line.attackEventIndex);
  return li;
};

// Number of lines visible at the cursor. Lines are sorted by eventIndex,
// so we can stop at the first one not yet reached.
const visibleCount = (narration: ReadonlyArray<NarrationLine>, cursor: number): number => {
  let count = 0;
  for (const line of narration) {
    if (line.eventIndex < cursor) count++;
    else break;
  }
  return count;
};

export const mountNarratorConsole = (root: HTMLElement, store: SnapshotSource): NarratorConsole => {
  root.innerHTML = `
    <div class="panel-header">${collapseToggleHtml('Battle log')}</div>
    <div class="panel-scroll narrator-scroll">
      <ol class="narration-list" aria-label="Battle narration"></ol>
    </div>
  `;
  const list = root.querySelector<HTMLOListElement>('.narration-list');
  const scroller = root.querySelector<HTMLDivElement>('.narrator-scroll');
  const toggle = root.querySelector<HTMLButtonElement>('.panel-collapse');
  if (!list || !scroller || !toggle) throw new Error('narrator-console: failed to mount template');
  makeCollapsible(root, toggle);

  let lastSession: Session | undefined;
  let renderedCount = 0;
  let followTail = true;

  scroller.addEventListener(
    'scroll',
    () => {
      followTail =
        scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < FOLLOW_TAIL_TOLERANCE_PX;
    },
    { passive: true },
  );

  const onSnapshot = (snapshot: ReplaySnapshot): void => {
    if (snapshot.session !== lastSession) {
      lastSession = snapshot.session;
      list.replaceChildren();
      renderedCount = 0;
      followTail = true;
    }
    const narration = snapshot.session.narration;
    const target = visibleCount(narration, snapshot.cursor);

    if (target > renderedCount) {
      const frag = document.createDocumentFragment();
      for (let i = renderedCount; i < target; i++) frag.appendChild(createRow(narration[i]!));
      list.appendChild(frag);
    } else if (target < renderedCount) {
      const frag = document.createDocumentFragment();
      for (let i = 0; i < target; i++) frag.appendChild(createRow(narration[i]!));
      list.replaceChildren(frag);
    }
    renderedCount = target;

    if (followTail) scroller.scrollTop = scroller.scrollHeight;
  };

  const unsubscribe = store.subscribe(onSnapshot);

  return {
    unmount: () => {
      unsubscribe();
      root.replaceChildren();
    },
  };
};
