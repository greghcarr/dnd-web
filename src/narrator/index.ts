// Turns a full event log into human-readable narration lines, computed
// once per session. The attack flow (AttackRolled -> DamageRolled ->
// DamageApplied) collapses into a single weapon-aware line attributed to
// the DamageApplied index, so the line lights up only when damage lands.
// Misses attribute to the AttackRolled. Everything else delegates to the
// curated table; bookkeeping events are silenced.

import { apply, emptyCampaignState, type Event, type CampaignState, type ResolvedContent } from 'dnd-srd-engine';
import type { NarrationLine } from './types';
import {
  characterName,
  firstMention,
  weaponLabel,
  summarizeDamage,
  hpChangeLabel,
  optionName,
  tagValue,
} from './resolve';
import { formatEvent, isSilent } from './table';

type DamageAppliedEvent = Extract<Event, { type: 'DamageApplied' }>;

export const narrate = (
  events: ReadonlyArray<Event>,
  content: ResolvedContent,
  winner: string | null = null,
): NarrationLine[] => {
  // Precompute the state before and after each event so name and HP
  // lookups are exact at the moment the event fired.
  const before: CampaignState[] = new Array(events.length);
  const after: CampaignState[] = new Array(events.length);
  let state = emptyCampaignState();
  for (let i = 0; i < events.length; i++) {
    before[i] = state;
    state = apply(state, events[i]!);
    after[i] = state;
  }

  // The DamageApplied that resolves an attack: the next one on the same
  // target before the turn or the next attack moves on.
  const nextDamageApplied = (start: number, targetId: string): number | undefined => {
    for (let j = start + 1; j < events.length; j++) {
      const ev = events[j]!;
      if (
        ev.type === 'AttackRolled' ||
        ev.type === 'TurnStarted' ||
        ev.type === 'TurnEnded' ||
        ev.type === 'RoundEnded'
      ) {
        return undefined;
      }
      if (ev.type === 'DamageApplied' && ev.targetId === targetId) return j;
    }
    return undefined;
  };

  const lines: NarrationLine[] = [];
  const consumed = new Set<number>();
  const mentioned = new Set<string>();

  for (let i = 0; i < events.length; i++) {
    if (consumed.has(i)) continue;
    const e = events[i]!;

    if (e.type === 'TurnStarted') {
      mentioned.clear();
      lines.push({
        eventIndex: i,
        text: `Round ${e.round}: ${characterName(before[i]!, e.combatantId)}'s turn.`,
        kind: 'turn',
      });
      continue;
    }

    if (e.type === 'AttackRolled') {
      const attacker = firstMention(before[i]!, content, e.attackerId, mentioned);
      const targetName = characterName(before[i]!, e.targetId);
      const weapon = weaponLabel(before[i]!, content, e.weaponInstanceId);
      const withWeapon = weapon !== undefined ? ` with ${weapon}` : '';
      if (!e.hit) {
        lines.push({
          eventIndex: i,
          text: `${attacker} attacks ${targetName}${withWeapon} but misses.`,
          kind: 'miss',
        });
        consumed.add(i);
        continue;
      }
      const j = nextDamageApplied(i, e.targetId);
      if (j === undefined) {
        lines.push({ eventIndex: i, text: `${attacker} hits ${targetName}${withWeapon}.`, kind: 'hit' });
        consumed.add(i);
        continue;
      }
      const { total, types } = summarizeDamage((events[j] as DamageAppliedEvent).components);
      const crit = e.critical ? 'Critical hit! ' : '';
      const hp = hpChangeLabel(before[j]!.characters[e.targetId]?.hp.current, after[j]!.characters[e.targetId]?.hp.current);
      lines.push({
        eventIndex: j,
        attackEventIndex: i,
        text: `${crit}${attacker} hits ${targetName} for ${tagValue(`${total} ${types}`)}${withWeapon}.${hp}`,
        kind: 'hit',
      });
      consumed.add(i);
      consumed.add(j);
      for (let k = i + 1; k < j; k++) {
        if (events[k]!.type === 'DamageRolled') consumed.add(k);
      }
      continue;
    }

    if (e.type === 'ChoiceResolved') {
      // A subclass choice is reported by the following SubclassChosen line;
      // skip the duplicate. Any other choice shows its resolved options.
      const next = events[i + 1];
      if (!(next?.type === 'SubclassChosen' && next.characterId === e.characterId)) {
        const names = e.selectedOptionIds.map((id) => optionName(content, id)).join(', ');
        lines.push({
          eventIndex: i,
          text: `${characterName(before[i]!, e.characterId)} chooses ${names}.`,
          kind: 'info',
        });
      }
      continue;
    }

    if (isSilent(e.type)) continue;

    const fragment = formatEvent(e, { before: before[i]!, after: after[i]!, content, mentioned });
    if (fragment) lines.push({ eventIndex: i, text: fragment.text, kind: fragment.kind });
  }

  lines.sort((a, b) => a.eventIndex - b.eventIndex);

  // The fuzz log has no EncounterEnded event, so synthesize a closing line
  // from the result. Attributed to the last event so it appears only once
  // the cursor reaches the end; appended after the sort so it renders last.
  if (events.length > 0) {
    const finalState = after[events.length - 1]!;
    const text =
      winner !== null
        ? `The battle ends. ${characterName(finalState, winner)} is victorious.`
        : 'The battle ends in a draw.';
    lines.push({ eventIndex: events.length - 1, text, kind: 'turn' });
  }

  return lines;
};
