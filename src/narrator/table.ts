// Per-event sentence builders for everything except the collapsed
// attack/damage flow (handled in index.ts). Wording is ported from the
// engine's transcript formatter, with plain names (the console color-
// codes by kind instead of using markdown bold) and the first-mention
// class/species enrichment. Unmapped, non-silent types fall back to a
// humanized label so a newly added engine event still surfaces.

import type { Event, CampaignState, ResolvedContent } from 'dnd-srd-engine';
import { humanLabel } from '@/ui/inspector/event-row';
import type { NarrationKind } from './types';
import {
  characterName,
  firstMention,
  spellName,
  conditionName,
  summarizeDamage,
  hpChangeLabel,
  ordinal,
  tagCharacterPhrase,
  tagValue,
} from './resolve';

export interface NarrationContext {
  readonly before: CampaignState;
  readonly after: CampaignState;
  readonly content: ResolvedContent;
  readonly mentioned: Set<string>;
}

export interface NarrationFragment {
  readonly text: string;
  readonly kind: NarrationKind;
}

// Bookkeeping / setup events that would only add noise to a battle log.
// Still fully visible in the event inspector.
const SILENT = new Set<string>([
  'ItemAcquired',
  'DamageRolled',
  'ActionEconomyConsumed',
  'SpellSlotConsumed',
  'PactSlotConsumed',
  'PactSlotsRegained',
  'FreeCastUsed',
  'TurnEnded',
  'RoundEnded',
  'EncounterCreated',
  'WeaponLoaded',
  'OpportunityAvailable',
  'TriggerFired',
  'HPMaxBonusChanged',
  'ResourceSpent',
  'ResourceRestored',
  'ItemEquipped',
  'ItemUnequipped',
  'ItemAttuned',
  'ItemUnattuned',
  'ItemBuffApplied',
  'ItemBuffRemoved',
  'SteadyAimConsumed',
  'WeaponMasteryActivated',
  'HeroPointGranted',
  // The choice prompt is noise; ChoiceResolved (handled in narrate) and
  // SubclassChosen carry the readable detail.
  'ChoiceRequired',
]);

export const isSilent = (type: string): boolean => SILENT.has(type);

const joinNames = (state: CampaignState, ids: ReadonlyArray<string>): string =>
  ids.length === 0 ? 'no one' : ids.map((id) => characterName(state, id)).join(', ');

// Returns the narration fragment for a non-combat event, or undefined to
// skip it. TurnStarted and the attack/damage collapse are handled by the
// caller and never reach here.
export const formatEvent = (
  event: Event,
  ctx: NarrationContext,
): NarrationFragment | undefined => {
  const { before, after, content, mentioned } = ctx;
  const e = event;
  switch (e.type) {
    case 'CharacterCreated': {
      const c = e.snapshot;
      if (c.kind === 'creature' || c.kind === 'npc') {
        return { text: `${c.name} appears (${c.hp.current}/${c.hp.max} HP).`, kind: 'info' };
      }
      const cls = c.classes
        .map((x) => `Level ${x.level} ${content.classes.get(x.classId)?.name ?? x.classId}`)
        .join(' / ');
      const phrase = tagCharacterPhrase(c.classes[0]?.classId ?? '', `${c.name} the ${cls}`);
      return { text: `${phrase} enters the arena (${c.hp.current}/${c.hp.max} HP).`, kind: 'info' };
    }
    case 'EncounterStarted':
      return { text: 'The battle begins.', kind: 'turn' };
    case 'EncounterEnded':
      return { text: `The battle ends: ${e.outcome}.`, kind: 'turn' };
    case 'InitiativeRolled': {
      const order = [...e.rolls]
        .sort((a, b) => b.total - a.total)
        .map((r) => `${characterName(before, r.combatantId)} (${r.total})`);
      return { text: `Initiative: ${order.join(', ')}.`, kind: 'info' };
    }
    case 'SpellCastDeclared': {
      const caster = firstMention(before, content, e.characterId, mentioned);
      const slot = e.slotLevel === 0 ? '' : ` (${ordinal(e.slotLevel)}-level)`;
      const targets = joinNames(before, e.targetIds);
      return { text: `${caster} casts ${tagValue(spellName(content, e.spellId))}${slot} at ${targets}.`, kind: 'spell' };
    }
    case 'SaveRolled': {
      const who = firstMention(before, content, e.targetId, mentioned);
      const verdict = e.success ? 'success' : 'failure';
      return { text: `${who} rolls a ${e.ability} save: ${e.total} vs DC ${e.dc}, ${tagValue(verdict)}.`, kind: 'save' };
    }
    case 'AbilityCheckRolled': {
      const who = firstMention(before, content, e.characterId, mentioned);
      const label = e.skill ?? `${e.ability} check`;
      const outcome =
        e.dc !== undefined ? ` vs DC ${e.dc}, ${tagValue(e.success === true ? 'success' : 'failure')}` : '';
      return { text: `${who} makes a ${label} check: ${e.total}${outcome}.`, kind: 'save' };
    }
    case 'ConditionApplied': {
      const who = firstMention(before, content, e.targetId, mentioned);
      const level = e.level !== undefined ? ` (level ${e.level})` : '';
      return { text: `${who} is now ${tagValue(conditionName(content, e.conditionId))}${level}.`, kind: 'condition' };
    }
    case 'ConditionRemoved': {
      const who = firstMention(before, content, e.targetId, mentioned);
      return { text: `${who} is no longer ${tagValue(conditionName(content, e.conditionId))}.`, kind: 'condition' };
    }
    case 'ExhaustionChanged': {
      const who = characterName(before, e.targetId);
      return { text: `${who}'s exhaustion is now ${tagValue(`level ${e.toLevel}`)}.`, kind: 'condition' };
    }
    case 'Healed': {
      const who = firstMention(before, content, e.targetId, mentioned);
      const hp = hpChangeLabel(before.characters[e.targetId]?.hp.current, after.characters[e.targetId]?.hp.current);
      return { text: `${who} is healed ${tagValue(`${e.amount} HP`)}.${hp}`, kind: 'heal' };
    }
    case 'TempHPGranted': {
      const who = firstMention(before, content, e.targetId, mentioned);
      return { text: `${who} gains ${tagValue(`${e.amount} temporary HP`)}.`, kind: 'heal' };
    }
    case 'DamageApplied': {
      // Non-attack damage (spells, traps). Attack damage is collapsed
      // into the hit line by the caller and never reaches here.
      const who = characterName(before, e.targetId);
      const { total, types } = summarizeDamage(e.components);
      const source =
        e.sourceCharacterId !== undefined
          ? ` from ${characterName(before, e.sourceCharacterId)}`
          : e.source !== undefined
            ? ` from ${e.source}`
            : '';
      const hp = hpChangeLabel(before.characters[e.targetId]?.hp.current, after.characters[e.targetId]?.hp.current);
      return { text: `${who} takes ${tagValue(`${total} ${types} damage`)}${source}.${hp}`, kind: 'damage' };
    }
    case 'CreatureDestroyed': {
      const who = characterName(before, e.targetId);
      const by = e.sourceCharacterId !== undefined ? ` by ${characterName(before, e.sourceCharacterId)}` : '';
      return { text: `${who} falls${by}.`, kind: 'death' };
    }
    case 'DeathSaveRolled': {
      const who = characterName(before, e.targetId);
      const verdict = e.critical ? 'critical success' : e.success ? 'success' : 'failure';
      return { text: `${who} rolls a death save: ${tagValue(verdict)}.`, kind: 'death' };
    }
    case 'Stabilized':
      return { text: `${characterName(before, e.targetId)} is stabilized.`, kind: 'death' };
    case 'ConcentrationStarted':
      return { text: `${characterName(before, e.casterId)} begins concentrating on ${tagValue(spellName(content, e.spellId))}.`, kind: 'spell' };
    case 'ConcentrationBroken':
      return { text: `${characterName(before, e.casterId)} loses concentration (${e.reason}).`, kind: 'spell' };
    case 'Dashed':
      return { text: `${characterName(before, e.combatantId)} dashes.`, kind: 'info' };
    case 'Disengaged':
      return { text: `${characterName(before, e.combatantId)} disengages.`, kind: 'info' };
    case 'RecklessAttackActivated':
      return { text: `${characterName(before, e.combatantId)} attacks recklessly.`, kind: 'info' };
    case 'ItemConsumed': {
      const who = firstMention(before, content, e.characterId, mentioned);
      const item = content.items.get(e.definitionId)?.name ?? e.definitionId;
      const onOther = e.targetId !== e.characterId ? ` on ${characterName(before, e.targetId)}` : '';
      return { text: `${who} uses ${tagValue(item)}${onOther}.`, kind: 'heal' };
    }
    case 'ItemUsed': {
      const who = firstMention(before, content, e.characterId, mentioned);
      const item = content.items.get(e.definitionId)?.name ?? e.definitionId;
      return { text: `${who} uses ${item}.`, kind: 'info' };
    }
    case 'ShortRestStarted':
      return { text: `${joinNames(before, e.participantIds)} take a short rest.`, kind: 'rest' };
    case 'LongRestStarted':
      return { text: `${joinNames(before, e.participantIds)} take a long rest.`, kind: 'rest' };
    case 'ShortRestEnded':
    case 'LongRestEnded':
      return { text: 'The rest ends.', kind: 'rest' };
    case 'LevelUpResolved': {
      const who = characterName(before, e.characterId);
      const className = content.classes.get(e.classId)?.name ?? e.classId;
      return { text: `${who} reaches ${className} level ${e.newClassLevel}.`, kind: 'info' };
    }
    case 'SubclassChosen': {
      const who = characterName(before, e.characterId);
      const subclass = content.subclasses.get(e.subclassId)?.name ?? e.subclassId;
      return { text: `${who} chooses the ${subclass} subclass.`, kind: 'info' };
    }
    default:
      return { text: `${humanLabel(e.type)}.`, kind: 'info' };
  }
};
