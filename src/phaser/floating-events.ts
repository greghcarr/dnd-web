import type { CampaignState, Event, ResolvedContent } from 'dnd-srd-engine';

// Maps a combat event to floating "combat text" entries: which combatant the
// text appears above, and a verbose label naming the characters (and weapon,
// spell, dice) involved, e.g. "Aria missed a hit with Longsword against Bran
// (12 vs. 16 AC)". Bookkeeping events (encounter setup, journals, bastions,
// etc.) map to nothing, so only meaningful combat happenings surface above
// heads. The arena calls this for each event it steps over and shows the
// entries via TokenView.addFloatingText.

export interface FloatingEntry {
  readonly subjectId: string;
  readonly label: string;
}

const humanize = (id: string): string => {
  const words = id.replace(/[-_]/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const nameOf = (state: CampaignState, id: string): string =>
  state.characters[id]?.name ?? `<${id.slice(0, 4)}>`;

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

// Info popups read as proper sentences, so every label ends with a period.
// The per-event labels below are written without a trailing period (including
// "moved 20 ft", not "ft.") and this adds the single terminating one.
export const floatingEventEntries = (
  event: Event,
  state: CampaignState,
  content: ResolvedContent,
): FloatingEntry[] =>
  entriesForEvent(event, state, content).map((entry) => ({ ...entry, label: `${entry.label}.` }));

const entriesForEvent = (
  event: Event,
  state: CampaignState,
  content: ResolvedContent,
): FloatingEntry[] => {
  switch (event.type) {
    case 'AttackRolled': {
      const attacker = nameOf(state, event.attackerId);
      const target = nameOf(state, event.targetId);
      const weapon = weaponNameOf(state, content, event.weaponInstanceId);
      const withWeapon = weapon ? ` with ${weapon}` : '';
      const roll = `(${event.total} vs. ${event.targetAC} AC)`;
      const label = event.critical
        ? `${attacker} critically hit ${target}${withWeapon} ${roll}`
        : event.hit
          ? `${attacker} hit ${target}${withWeapon} ${roll}`
          : `${attacker} missed a hit${withWeapon} against ${target} ${roll}`;
      return [{ subjectId: event.attackerId, label }];
    }
    case 'DamageApplied': {
      let total = 0;
      const types = new Set<string>();
      for (const component of event.components) {
        total += component.amount;
        types.add(component.type);
      }
      if (total <= 0) return [];
      const target = nameOf(state, event.targetId);
      const from = event.sourceCharacterId ? ` from ${nameOf(state, event.sourceCharacterId)}` : '';
      return [{ subjectId: event.targetId, label: `${target} took ${total} ${[...types].join(' + ')} damage${from}` }];
    }
    case 'Healed':
      return event.amount > 0
        ? [{ subjectId: event.targetId, label: `${nameOf(state, event.targetId)} regained ${event.amount} HP` }]
        : [];
    case 'SaveRolled': {
      const target = nameOf(state, event.targetId);
      const outcome = event.success ? 'passed' : 'failed';
      return [
        { subjectId: event.targetId, label: `${target} ${outcome} a ${event.ability} save (${event.total} vs. DC ${event.dc})` },
      ];
    }
    case 'AbilityCheckRolled': {
      const who = nameOf(state, event.characterId);
      const kind = event.skill ? humanize(event.skill) : event.ability;
      const versus = event.dc === undefined ? '' : ` vs. DC ${event.dc}`;
      return [{ subjectId: event.characterId, label: `${who} made a ${kind} check (${event.total}${versus})` }];
    }
    case 'DeathSaveRolled': {
      const target = nameOf(state, event.targetId);
      return [{ subjectId: event.targetId, label: `${target} ${event.success ? 'succeeded on' : 'failed'} a death save` }];
    }
    case 'ConditionApplied': {
      const target = nameOf(state, event.targetId);
      const from = event.sourceCharacterId ? ` (from ${nameOf(state, event.sourceCharacterId)})` : '';
      return [{ subjectId: event.targetId, label: `${target} is now ${conditionName(content, event.conditionId)}${from}` }];
    }
    case 'ConditionRemoved':
      return [
        { subjectId: event.targetId, label: `${nameOf(state, event.targetId)} is no longer ${conditionName(content, event.conditionId)}` },
      ];
    case 'CombatantMoved':
      return [{ subjectId: event.combatantId, label: `${nameOf(state, event.combatantId)} moved ${Math.round(event.feetTraveled)} ft` }];
    case 'Dashed':
      return [{ subjectId: event.combatantId, label: `${nameOf(state, event.combatantId)} dashed` }];
    case 'Disengaged':
      return [{ subjectId: event.combatantId, label: `${nameOf(state, event.combatantId)} disengaged` }];
    case 'SpellCastDeclared': {
      const caster = nameOf(state, event.characterId);
      const targets = event.targetIds.filter((id) => id !== event.characterId);
      const at =
        targets.length === 1
          ? ` at ${nameOf(state, targets[0]!)}`
          : targets.length > 1
            ? ` at ${targets.length} targets`
            : '';
      return [{ subjectId: event.characterId, label: `${caster} cast ${spellNameOf(content, event.spellId)}${at}` }];
    }
    case 'InitiativeRolled':
      return event.rolls.map((roll) => ({
        subjectId: roll.combatantId,
        label: `${nameOf(state, roll.combatantId)} rolled initiative ${roll.total}`,
      }));
    case 'ItemAcquired':
      return event.characterId === undefined
        ? []
        : [
            {
              subjectId: event.characterId,
              label: `${nameOf(state, event.characterId)} acquired ${content.items.get(event.instance.definitionId)?.name ?? humanize(event.instance.definitionId)}`,
            },
          ];
    default:
      return [];
  }
};
