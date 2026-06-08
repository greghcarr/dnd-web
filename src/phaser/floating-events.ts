import type { Event, ResolvedContent } from 'dnd-srd-engine';

// Maps a combat event to floating "combat text" entries: which combatant the
// text appears above, and the short label. Bookkeeping events (encounter
// setup, journals, bastions, etc.) map to nothing, so only meaningful combat
// happenings surface above heads. The arena calls this for each event it
// steps over and shows the entries via TokenView.addFloatingText.

export interface FloatingEntry {
  readonly subjectId: string;
  readonly label: string;
}

const humanize = (id: string): string => {
  const words = id.replace(/[-_]/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const conditionName = (content: ResolvedContent, id: string): string =>
  content.conditions.get(id)?.name ?? humanize(id);

export const floatingEventEntries = (event: Event, content: ResolvedContent): FloatingEntry[] => {
  switch (event.type) {
    case 'AttackRolled':
      return [
        {
          subjectId: event.attackerId,
          label: event.critical
            ? `Critical hit! (${event.total})`
            : event.hit
              ? `Hit (${event.total})`
              : `Miss (${event.total})`,
        },
      ];
    case 'DamageApplied': {
      const total = event.components.reduce((sum, component) => sum + component.amount, 0);
      return total > 0 ? [{ subjectId: event.targetId, label: `-${total} HP` }] : [];
    }
    case 'Healed':
      return event.amount > 0 ? [{ subjectId: event.targetId, label: `+${event.amount} HP` }] : [];
    case 'SaveRolled':
      return [{ subjectId: event.targetId, label: `Save ${event.total} ${event.success ? 'pass' : 'fail'}` }];
    case 'AbilityCheckRolled':
      return [{ subjectId: event.characterId, label: `Check ${event.total}` }];
    case 'DeathSaveRolled':
      return [{ subjectId: event.targetId, label: `Death save: ${event.success ? 'success' : 'fail'}` }];
    case 'ConditionApplied':
      return [{ subjectId: event.targetId, label: conditionName(content, event.conditionId) }];
    case 'ConditionRemoved':
      return [{ subjectId: event.targetId, label: `${conditionName(content, event.conditionId)} ended` }];
    case 'CombatantMoved':
      return [{ subjectId: event.combatantId, label: `Moved ${Math.round(event.feetTraveled)} ft` }];
    case 'Dashed':
      return [{ subjectId: event.combatantId, label: 'Dash' }];
    case 'Disengaged':
      return [{ subjectId: event.combatantId, label: 'Disengage' }];
    case 'SpellCastDeclared':
      return [
        {
          subjectId: event.characterId,
          label: `Casts ${content.spells.get(event.spellId)?.name ?? humanize(event.spellId)}`,
        },
      ];
    case 'InitiativeRolled':
      return event.rolls.map((roll) => ({ subjectId: roll.combatantId, label: `Initiative ${roll.total}` }));
    case 'ItemAcquired':
      return event.characterId === undefined
        ? []
        : [
            {
              subjectId: event.characterId,
              label: `Got ${content.items.get(event.instance.definitionId)?.name ?? humanize(event.instance.definitionId)}`,
            },
          ];
    default:
      return [];
  }
};
