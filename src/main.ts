import './styles/app.css';
import Phaser from 'phaser';
import {
  APP_VERSION,
  DEFAULT_SEED,
  DEFAULT_LEVEL,
  DEFAULT_MODE,
  DEFAULT_VS,
  DEFAULT_REST,
} from '@/constants/app';
import { RIGHT_COL_PX, TRANSPORT_TOP_PX } from '@/constants/layout';
import { GROUND_BASE_COLOR, cssHex } from '@/constants/colors';
import { EngineBridge, type BattleConfig } from '@/engine/engine-bridge';
import { ReplayStore, type ReplaySnapshot } from '@/engine/replay-store';
import { mountTransportBar } from '@/ui/transport/transport-bar';
import { mountEventInspector } from '@/ui/inspector/event-inspector';
import { mountConfigBar } from '@/ui/inspector/config-bar';

// Composition root. Owns the engine bridge + replay store and mounts the
// DOM panels (transport, inspector, config) against the store. The arena
// scene and narrator console arrive in later phases.

const applyLayoutVars = (): void => {
  const root = document.documentElement;
  root.style.setProperty('--right-col', `${RIGHT_COL_PX}px`);
  root.style.setProperty('--transport-top', `${TRANSPORT_TOP_PX}px`);
};

const setVersionBadge = (): void => {
  const badge = document.getElementById('version-badge');
  if (badge) badge.textContent = `dnd-web v${APP_VERSION}`;
};

const setStatus = (text: string): void => {
  const el = document.getElementById('status-bar');
  if (el) el.textContent = text;
};

const requireElement = (id: string): HTMLElement => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id} in index.html`);
  return el;
};

class PlaceholderScene extends Phaser.Scene {
  create(): void {
    this.cameras.main.setBackgroundColor(GROUND_BASE_COLOR);
    const label = this.add.text(0, 0, 'dnd-web — arena pending', {
      color: '#e6e8ee',
      fontFamily: 'monospace',
      fontSize: '20px',
    });
    label.setOrigin(0.5);
    const centre = (): void => {
      label.setPosition(this.scale.width / 2, this.scale.height / 2);
    };
    centre();
    this.scale.on(Phaser.Scale.Events.RESIZE, centre);
  }
}

const bootGame = (): Phaser.Game =>
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game-root',
    backgroundColor: cssHex(GROUND_BASE_COLOR),
    pixelArt: true,
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: '100%',
      height: '100%',
    },
    scene: [PlaceholderScene],
  });

const DEFAULT_CONFIG: BattleConfig = {
  seed: DEFAULT_SEED,
  mode: DEFAULT_MODE,
  vs: DEFAULT_VS,
  level: DEFAULT_LEVEL,
  rest: DEFAULT_REST,
};

const boot = (): void => {
  applyLayoutVars();
  setVersionBadge();
  bootGame();

  const bridge = new EngineBridge();
  let config: BattleConfig = { ...DEFAULT_CONFIG };
  const store = new ReplayStore(bridge.startBattle(config));

  const updateStatus = (snapshot: ReplaySnapshot): void => {
    const { session, campaign, cursor, totalEvents } = snapshot;
    const encounter = campaign.state.encounters[session.encounterId];
    const round = encounter?.round ?? '-';
    const winnerName =
      session.result.winner !== null
        ? session.fullCampaign.state.characters[session.result.winner]?.name ?? '(unknown)'
        : null;
    const outcome =
      cursor < totalEvents ? 'in progress' : winnerName !== null ? `winner ${winnerName}` : 'draw';
    setStatus(`seed ${config.seed} · round ${round} · step ${cursor}/${totalEvents} · ${outcome}`);
  };

  mountTransportBar(requireElement('transport'), store);
  mountEventInspector(requireElement('event-inspector'), store);

  const runBattle = (next: BattleConfig): void => {
    config = next;
    store.loadSession(bridge.startBattle(next));
  };
  mountConfigBar(requireElement('config-bar'), config, runBattle);

  store.subscribe(updateStatus);
};

boot();
