// Formatter for a single event row in the inspector. Categorizes for
// color-coding, produces a one-line preview, and renders the full JSON
// payload in a collapsed <details>. Ported from the engine demo
// (dnd-srd-engine/web/ui/event-row.ts).

import type { Event } from 'dnd-srd-engine';

export type EventCategory = 'resolution' | 'encounter' | 'state-change';

const RESOLUTION_TYPES = new Set<Event['type']>([
  'AttackRolled',
  'DamageRolled',
  'SaveRolled',
  'AbilityCheckRolled',
  'DeathSaveRolled',
  'InitiativeRolled',
  'HitDieSpent',
]);

const ENCOUNTER_TYPES = new Set<Event['type']>([
  'EncounterCreated',
  'EncounterStarted',
  'EncounterEnded',
  'TurnStarted',
  'TurnEnded',
  'RoundEnded',
]);

export const categorize = (event: Event): EventCategory => {
  if (RESOLUTION_TYPES.has(event.type)) return 'resolution';
  if (ENCOUNTER_TYPES.has(event.type)) return 'encounter';
  return 'state-change';
};

// Human label per event type. Falls back to a CamelCase split for
// unmapped types so a newly added engine event still reads as English
// ("WeaponLoaded" -> "Weapon loaded") without a forced sync update.
const HUMAN_LABELS: Partial<Record<string, string>> = {
  AttackRolled: 'Attack roll',
  DamageRolled: 'Damage roll',
  DamageApplied: 'Damage applied',
  SaveRolled: 'Saving throw',
  AbilityCheckRolled: 'Ability check',
  DeathSaveRolled: 'Death save',
  InitiativeRolled: 'Initiative',
  HitDieSpent: 'Hit die spent',
  TurnStarted: 'Turn started',
  TurnEnded: 'Turn ended',
  RoundEnded: 'Round ended',
  EncounterCreated: 'Encounter created',
  EncounterStarted: 'Encounter started',
  EncounterEnded: 'Encounter ended',
  ConditionApplied: 'Condition applied',
  ConditionRemoved: 'Condition removed',
  ActionEconomyConsumed: 'Action used',
  CombatantMoved: 'Move',
  CombatantPlaced: 'Placed',
  SpellCastDeclared: 'Spell cast',
  SpellSlotConsumed: 'Slot consumed',
  PactSlotConsumed: 'Pact slot consumed',
  FreeCastUsed: 'Free cast',
  ConcentrationStarted: 'Concentration started',
  ConcentrationBroken: 'Concentration broken',
  CharacterCreated: 'Character joined',
  CreatureDestroyed: 'Creature destroyed',
  ItemAcquired: 'Item acquired',
  ItemEquipped: 'Item equipped',
  ItemUnequipped: 'Item unequipped',
  ItemConsumed: 'Item consumed',
  ResourceSpent: 'Resource spent',
  ResourceRestored: 'Resource restored',
  Healed: 'Healed',
  TempHPGranted: 'Temp HP granted',
  ShortRestStarted: 'Short rest started',
  ShortRestEnded: 'Short rest ended',
  LongRestStarted: 'Long rest started',
  LongRestEnded: 'Long rest ended',
  OpportunityAvailable: 'Opportunity attack offered',
  ChoiceRequired: 'Choice required',
  ChoiceResolved: 'Choice resolved',
  LevelUpResolved: 'Level up',
};

const splitCamelCase = (s: string): string => {
  const spaced = s.replace(/([a-z])([A-Z])/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
};

export const humanLabel = (type: string): string => HUMAN_LABELS[type] ?? splitCamelCase(type);

// One-line "what happened" preview. Truthy-only: omit undefined fields.
const previewFor = (event: Event): string => {
  const e = event as Record<string, unknown> & { type: string };
  const parts: string[] = [];
  const push = (label: string, value: unknown): void => {
    if (value === undefined || value === null || value === '') return;
    parts.push(`${label}=${typeof value === 'string' ? value : JSON.stringify(value)}`);
  };
  switch (e.type) {
    case 'AttackRolled':
      push('total', e.total);
      push('AC', e.targetAC);
      push('hit', e.hit);
      push('d20', e.d20);
      push('used', e.used);
      break;
    case 'DamageRolled':
      push('total', e.total);
      push('rolls', e.rolls);
      break;
    case 'DamageApplied':
      push('amount', e.amount);
      push('target', e.targetId);
      break;
    case 'Healed':
      push('amount', e.amount);
      break;
    case 'ConditionApplied':
    case 'ConditionRemoved':
      push('cond', e.conditionId);
      break;
    case 'ActionEconomyConsumed':
      push('kind', e.kind);
      break;
    case 'CombatantMoved':
      push('to', e.toPosition);
      push('feet', e.feetTraveled);
      break;
    case 'TurnStarted':
    case 'TurnEnded':
      push('combatant', e.combatantId);
      break;
    case 'InitiativeRolled':
      push('rolls', e.rolls);
      break;
    case 'ItemAcquired': {
      const instance = e.instance as { id?: string; definitionId?: string } | undefined;
      push('def', instance?.definitionId);
      push('instance', instance?.id);
      break;
    }
    case 'SpellCastDeclared':
      push('spell', e.spellId);
      break;
    case 'CharacterCreated': {
      const snapshot = e.snapshot as { name?: string } | undefined;
      push('name', snapshot?.name);
      break;
    }
    default:
      break;
  }
  return parts.join('  ');
};

export const createEventRow = (event: Event, index: number): HTMLLIElement => {
  const li = document.createElement('li');
  const category = categorize(event);
  li.className = `event-row event-${category}`;
  li.innerHTML = `
    <div class="event-line">
      <span class="event-index"></span>
      <span class="event-type"></span>
      <span class="event-preview"></span>
    </div>
    <details>
      <summary>payload</summary>
      <pre class="event-payload"></pre>
    </details>
  `;
  li.querySelector('.event-index')!.textContent = `#${index}`;
  const typeEl = li.querySelector<HTMLElement>('.event-type')!;
  typeEl.textContent = humanLabel(event.type);
  typeEl.title = event.type;
  li.querySelector('.event-preview')!.textContent = previewFor(event);
  li.querySelector('.event-payload')!.textContent = JSON.stringify(event, null, 2);
  return li;
};
