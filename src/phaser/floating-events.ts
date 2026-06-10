import type { CampaignState, Event, ResolvedContent } from 'dnd-srd-engine';
import { CLASS_COLORS } from '@/constants/colors';

// Maps a combat event to floating "combat text" entries: which combatant the
// text appears above, and the verbose label as a sequence of segments. Most
// segments are plain (rendered in the info colour); a character-name segment
// carries that character's class colour so names read in their class colour,
// e.g. "Aria missed a hit with Longsword against Bran (12 vs. 16 AC).". Each
// label reads as a proper sentence, ended with a period. Bookkeeping events
// (encounter setup, journals, bastions, etc.) map to nothing. The arena calls
// this for each event it steps over and shows the entries via
// TokenView.addFloatingText.

// A run of floating text. `color` (a 0xRRGGBB class colour) tints a name; plain
// runs leave it undefined so the renderer uses the line's info/error colour.
export interface FloatingSegment {
  readonly text: string;
  readonly color?: number;
}

export interface FloatingEntry {
  readonly subjectId: string;
  readonly segments: ReadonlyArray<FloatingSegment>;
}

const humanize = (id: string): string => {
  const words = id.replace(/[-_]/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const nameOf = (state: CampaignState, id: string): string =>
  state.characters[id]?.name ?? `<${id.slice(0, 4)}>`;

// A character's signature class colour (most-advanced class for multiclass), or
// undefined for the classless (monsters in the replay viewers), which then read
// in the default info colour.
const classColorOf = (state: CampaignState, id: string): number | undefined => {
  const character = state.characters[id];
  if (!character || character.classes.length === 0) return undefined;
  const primary = character.classes.reduce((a, b) => (b.level > a.level ? b : a));
  return CLASS_COLORS[primary.classId];
};

const plain = (text: string): FloatingSegment => ({ text });
const nameSeg = (state: CampaignState, id: string): FloatingSegment => ({
  text: nameOf(state, id),
  color: classColorOf(state, id),
});

// The weapon backing an attack, or undefined when the attack carries a
// synthetic weapon id (spell / innate attacks): the "with <weapon>" clause is
// then dropped.
const weaponNameOf = (state: CampaignState, content: ResolvedContent, id: string): string | undefined => {
  const instance = state.itemInstances[id];
  if (!instance) return undefined;
  return instance.customName ?? content.items.get(instance.definitionId)?.name ?? instance.definitionId;
};

const conditionName = (content: ResolvedContent, id: string): string =>
  content.conditions.get(id)?.name ?? humanize(id);

const spellNameOf = (content: ResolvedContent, id: string): string =>
  content.spells.get(id)?.name ?? humanize(id);

// Info popups read as proper sentences, so every label ends with a period. The
// per-event segments below are written without a trailing period (including
// "moved 20 ft", not "ft.") and this adds the single terminating one.
export const floatingEventEntries = (
  event: Event,
  state: CampaignState,
  content: ResolvedContent,
): FloatingEntry[] =>
  entriesForEvent(event, state, content).map((entry) => ({
    ...entry,
    segments: [...entry.segments, plain('.')],
  }));

const entriesForEvent = (
  event: Event,
  state: CampaignState,
  content: ResolvedContent,
): FloatingEntry[] => {
  switch (event.type) {
    case 'AttackRolled': {
      const attacker = nameSeg(state, event.attackerId);
      const target = nameSeg(state, event.targetId);
      const weapon = weaponNameOf(state, content, event.weaponInstanceId);
      const withWeapon = weapon ? ` with ${weapon}` : '';
      const roll = `(${event.total} vs. ${event.targetAC} AC)`;
      const segments: FloatingSegment[] = event.critical
        ? [attacker, plain(' critically hit '), target, plain(`${withWeapon} ${roll}`)]
        : event.hit
          ? [attacker, plain(' hit '), target, plain(`${withWeapon} ${roll}`)]
          : [attacker, plain(` missed a hit${withWeapon} against `), target, plain(` ${roll}`)];
      return [{ subjectId: event.attackerId, segments }];
    }
    case 'DamageApplied': {
      let total = 0;
      const types = new Set<string>();
      for (const component of event.components) {
        total += component.amount;
        types.add(component.type);
      }
      if (total <= 0) return [];
      const segments: FloatingSegment[] = [
        nameSeg(state, event.targetId),
        plain(` took ${total} ${[...types].join(' + ')} damage`),
      ];
      if (event.sourceCharacterId) segments.push(plain(' from '), nameSeg(state, event.sourceCharacterId));
      return [{ subjectId: event.targetId, segments }];
    }
    case 'Healed':
      return event.amount > 0
        ? [{ subjectId: event.targetId, segments: [nameSeg(state, event.targetId), plain(` regained ${event.amount} HP`)] }]
        : [];
    case 'SaveRolled': {
      const outcome = event.success ? 'passed' : 'failed';
      return [
        {
          subjectId: event.targetId,
          segments: [nameSeg(state, event.targetId), plain(` ${outcome} a ${event.ability} save (${event.total} vs. DC ${event.dc})`)],
        },
      ];
    }
    case 'AbilityCheckRolled': {
      const kind = event.skill ? humanize(event.skill) : event.ability;
      const versus = event.dc === undefined ? '' : ` vs. DC ${event.dc}`;
      return [
        {
          subjectId: event.characterId,
          segments: [nameSeg(state, event.characterId), plain(` made a ${kind} check (${event.total}${versus})`)],
        },
      ];
    }
    case 'DeathSaveRolled':
      return [
        {
          subjectId: event.targetId,
          segments: [nameSeg(state, event.targetId), plain(` ${event.success ? 'succeeded on' : 'failed'} a death save`)],
        },
      ];
    case 'ConditionApplied': {
      const segments: FloatingSegment[] = [nameSeg(state, event.targetId), plain(` is now ${conditionName(content, event.conditionId)}`)];
      if (event.sourceCharacterId) segments.push(plain(' (from '), nameSeg(state, event.sourceCharacterId), plain(')'));
      return [{ subjectId: event.targetId, segments }];
    }
    case 'ConditionRemoved':
      return [
        {
          subjectId: event.targetId,
          segments: [nameSeg(state, event.targetId), plain(` is no longer ${conditionName(content, event.conditionId)}`)],
        },
      ];
    case 'CombatantMoved':
      return [{ subjectId: event.combatantId, segments: [nameSeg(state, event.combatantId), plain(` moved ${Math.round(event.feetTraveled)} ft`)] }];
    case 'Dashed':
      return [{ subjectId: event.combatantId, segments: [nameSeg(state, event.combatantId), plain(' dashed')] }];
    case 'Disengaged':
      return [{ subjectId: event.combatantId, segments: [nameSeg(state, event.combatantId), plain(' disengaged')] }];
    case 'SpellCastDeclared': {
      const targets = event.targetIds.filter((id) => id !== event.characterId);
      const segments: FloatingSegment[] = [nameSeg(state, event.characterId), plain(` cast ${spellNameOf(content, event.spellId)}`)];
      if (targets.length === 1) segments.push(plain(' at '), nameSeg(state, targets[0]!));
      else if (targets.length > 1) segments.push(plain(` at ${targets.length} targets`));
      return [{ subjectId: event.characterId, segments }];
    }
    case 'InitiativeRolled':
      return event.rolls.map((roll) => ({
        subjectId: roll.combatantId,
        segments: [nameSeg(state, roll.combatantId), plain(` rolled initiative ${roll.total}`)],
      }));
    case 'ItemAcquired':
      return event.characterId === undefined
        ? []
        : [
            {
              subjectId: event.characterId,
              segments: [
                nameSeg(state, event.characterId),
                plain(` acquired ${content.items.get(event.instance.definitionId)?.name ?? humanize(event.instance.definitionId)}`),
              ],
            },
          ];
    default:
      return [];
  }
};
