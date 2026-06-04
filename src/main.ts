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
import { ReplayStore } from '@/engine/replay-store';

// Composition root. Phase 1 stands up the engine bridge + replay store
// and reports the loaded battle in the status line; later phases mount
// the DOM panels and the arena scene against the store.

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
  const session = bridge.startBattle(DEFAULT_CONFIG);
  const store = new ReplayStore(session);
  const snapshot = store.getSnapshot();

  const winnerName =
    session.result.winner !== null
      ? session.fullCampaign.state.characters[session.result.winner]?.name ?? '(unknown)'
      : '(draw)';

  setStatus(
    `seed ${DEFAULT_CONFIG.seed} · ${snapshot.totalEvents} events · ` +
      `${session.result.rounds} rounds · winner ${winnerName} · cursor ${snapshot.cursor}`,
  );
};

boot();
