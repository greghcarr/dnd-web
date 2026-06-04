import './styles/app.css';
import Phaser from 'phaser';
import { APP_VERSION } from '@/constants/app';
import { RIGHT_COL_PX, TRANSPORT_TOP_PX } from '@/constants/layout';
import { GROUND_BASE_COLOR, cssHex } from '@/constants/colors';

// Phase 0 entry point: stand up the DOM shell + a full-screen Phaser
// canvas to verify the toolchain (Vite + TypeScript + Phaser + the
// engine-source alias). Later phases replace the placeholder scene with
// the arena and wire the replay store into the DOM panels.

const applyLayoutVars = (): void => {
  const root = document.documentElement;
  root.style.setProperty('--right-col', `${RIGHT_COL_PX}px`);
  root.style.setProperty('--transport-top', `${TRANSPORT_TOP_PX}px`);
};

const setVersionBadge = (): void => {
  const badge = document.getElementById('version-badge');
  if (badge) badge.textContent = `dnd-web v${APP_VERSION}`;
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

applyLayoutVars();
setVersionBadge();
bootGame();
