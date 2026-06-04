import type { Campaign } from 'dnd-srd-engine';

// Resolve the encounter to visualize. During the pre-encounter slice
// (cursor near 0) there is no active encounter yet, so fall back to the
// first encounter key that the full campaign will eventually create.
// Ported from the engine demo (dnd-srd-engine/web/main.ts).
export const findEncounterId = (campaign: Campaign): string => {
  const active = campaign.state.activeEncounterId;
  if (active) return active;
  const keys = Object.keys(campaign.state.encounters);
  return keys[0] ?? '';
};
