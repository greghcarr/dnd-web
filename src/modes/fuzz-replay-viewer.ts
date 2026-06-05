// The fuzz replay viewer mode: config bar, transport, event inspector,
// and narrator console, all bound to the shared replay store.

import { mountConfigBar } from '@/ui/inspector/config-bar';
import { mountTransportBar } from '@/ui/transport/transport-bar';
import { mountEventInspector } from '@/ui/inspector/event-inspector';
import { mountNarratorConsole } from '@/ui/console/narrator-console';
import type { Mode, ModeContext } from './mode';

const PANELS_HTML = `
  <section id="config-bar" class="panel"></section>
  <div id="transport" class="panel" aria-label="Playback controls"></div>
  <section id="event-inspector" class="panel" aria-label="Event log"></section>
  <section id="narrator-console" class="panel" aria-label="Battle narration"></section>
`;

const requireChild = (root: HTMLElement, selector: string): HTMLElement => {
  const el = root.querySelector<HTMLElement>(selector);
  if (!el) throw new Error(`fuzz-replay-viewer: missing ${selector}`);
  return el;
};

export const fuzzReplayViewerMode: Mode = {
  mount(ctx: ModeContext): () => void {
    ctx.content.innerHTML = PANELS_HTML;
    const config = mountConfigBar(requireChild(ctx.content, '#config-bar'), ctx.getConfig(), ctx.runBattle);
    const transport = mountTransportBar(requireChild(ctx.content, '#transport'), ctx.store);
    const inspector = mountEventInspector(requireChild(ctx.content, '#event-inspector'), ctx.store);
    const narrator = mountNarratorConsole(requireChild(ctx.content, '#narrator-console'), ctx.store);
    return () => {
      config.unmount();
      transport.unmount();
      inspector.unmount();
      narrator.unmount();
      ctx.content.replaceChildren();
    };
  },
};
