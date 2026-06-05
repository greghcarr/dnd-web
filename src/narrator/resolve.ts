// ID-to-name resolution for the narrator. Ported from the engine's
// canonical transcript formatter (dnd-srd-engine/tests/transcript.ts) so
// names, weapons, spells, and conditions read exactly as the engine
// intends. classSpeciesLabel / firstMention add the "Aria the Barbarian
// Human" enrichment the plain transcript does not carry.

import type { CampaignState, ResolvedContent } from 'dnd-srd-engine';

// Character-name runs are wrapped with these private-use markers so the
// battle log can color each name in its class color without the curated
// sentence builders having to thread color through every template. The
// markers never occur in real text; only splitTaggedNames interprets them
// (everywhere else they ride along inertly). Format:
//   OPEN <classId> SEP <display text> CLOSE
const NAME_OPEN = String.fromCharCode(0xe000);
const NAME_SEP = String.fromCharCode(0xe001);
const NAME_CLOSE = String.fromCharCode(0xe002);
// Field sentinel marking a "value" run (spell name, damage, gained HP):
// the renderer colors these in the line's event-kind color rather than a
// class color. Distinct from any class id, which are lowercase slugs.
const VALUE_REF = String.fromCharCode(0xe003);
const NAME_PATTERN = new RegExp(
  `${NAME_OPEN}([^${NAME_SEP}]*)${NAME_SEP}([^${NAME_CLOSE}]*)${NAME_CLOSE}`,
  'g',
);

const tagName = (classId: string, text: string): string =>
  `${NAME_OPEN}${classId}${NAME_SEP}${text}${NAME_CLOSE}`;

// Wrap a salient value (spell name, damage, gained HP) so the battle log
// shows it in the line's kind color while verbs and connectives stay
// regular.
export const tagValue = (text: string): string =>
  `${NAME_OPEN}${VALUE_REF}${NAME_SEP}${text}${NAME_CLOSE}`;

const classOf = (state: CampaignState, id: string): string =>
  state.characters[id]?.classes[0]?.classId ?? '';

export const characterName = (state: CampaignState, id: string): string =>
  tagName(classOf(state, id), state.characters[id]?.name ?? `<${id.slice(0, 8)}>`);

export const classSpeciesLabel = (
  state: CampaignState,
  content: ResolvedContent,
  id: string,
): string => {
  const ch = state.characters[id];
  if (!ch) return characterName(state, id);
  const enrollment = ch.classes[0];
  const className = enrollment ? content.classes.get(enrollment.classId)?.name : undefined;
  const speciesName = content.species.get(ch.speciesId)?.name;
  const bits = [className, speciesName].filter((b): b is string => Boolean(b));
  const label = bits.length > 0 ? `${ch.name} the ${bits.join(' ')}` : ch.name;
  return tagName(enrollment?.classId ?? '', label);
};

// A renderable run of narration: plain connective text, a character name
// (colored by class), or a salient value (colored by the line's kind).
export type NarrationSegment =
  | { readonly role: 'plain'; readonly text: string }
  | { readonly role: 'name'; readonly text: string; readonly classId: string }
  | { readonly role: 'value'; readonly text: string };

// Split a tagged narration string into renderable segments. Value runs and
// class-tagged names become their own segments; untagged text and
// empty-class names (e.g. creatures) fold into plain runs.
export const splitNarration = (text: string): NarrationSegment[] => {
  const segments: NarrationSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(NAME_PATTERN)) {
    const start = match.index!;
    if (start > last) segments.push({ role: 'plain', text: text.slice(last, start) });
    const field = match[1] ?? '';
    const runText = match[2]!;
    if (field === VALUE_REF) segments.push({ role: 'value', text: runText });
    else if (field) segments.push({ role: 'name', text: runText, classId: field });
    else segments.push({ role: 'plain', text: runText });
    last = start + match[0].length;
  }
  if (last < text.length) segments.push({ role: 'plain', text: text.slice(last) });
  return segments;
};

// The name+descriptor phrase used by CharacterCreated, tagged so the whole
// "Bran the Level 1 Wizard" reads in the wizard color.
export const tagCharacterPhrase = (classId: string, phrase: string): string =>
  tagName(classId, phrase);

// First reference to a character within a turn gets the enriched label;
// later references in the same turn use the bare name. The caller resets
// `mentioned` on each TurnStarted.
export const firstMention = (
  state: CampaignState,
  content: ResolvedContent,
  id: string,
  mentioned: Set<string>,
): string => {
  if (mentioned.has(id)) return characterName(state, id);
  mentioned.add(id);
  return classSpeciesLabel(state, content, id);
};

export const itemName = (state: CampaignState, content: ResolvedContent, id: string): string => {
  const inst = state.itemInstances[id];
  if (!inst) return id;
  return inst.customName ?? content.items.get(inst.definitionId)?.name ?? inst.definitionId;
};

// The weapon backing an attack, or undefined when there is no real item
// instance (spell and innate attacks carry a synthetic weapon id). The
// caller omits the "with <weapon>" clause in that case, since the spell
// was already announced by its cast line.
export const weaponLabel = (
  state: CampaignState,
  content: ResolvedContent,
  id: string,
): string | undefined => {
  const inst = state.itemInstances[id];
  if (!inst) return undefined;
  return inst.customName ?? content.items.get(inst.definitionId)?.name ?? inst.definitionId;
};

export const spellName = (content: ResolvedContent, id: string): string =>
  content.spells.get(id)?.name ?? id;

export const conditionName = (content: ResolvedContent, id: string): string =>
  content.conditions.get(id)?.name ?? id;

const titleizeSlug = (slug: string): string =>
  slug
    .split('-')
    .map((part) => (part.length > 0 ? part[0]!.toUpperCase() + part.slice(1) : part))
    .join(' ');

// Resolve a choice option id (subclass / feat / spell / ...) to a readable
// name, falling back to a title-cased slug.
export const optionName = (content: ResolvedContent, id: string): string =>
  content.subclasses.get(id)?.name ??
  content.feats.get(id)?.name ??
  content.spells.get(id)?.name ??
  titleizeSlug(id);

const displayHp = (value: number): number => Math.max(0, value);

// " (HP 9 to 1)" when the value changed, else "". Avoids dashes.
export const hpChangeLabel = (before: number | undefined, after: number | undefined): string => {
  if (before === undefined || after === undefined) return '';
  const a = displayHp(before);
  const b = displayHp(after);
  return a === b ? '' : ` (HP ${a} to ${b})`;
};

export const targetHpAfter = (state: CampaignState, id: string): number | undefined => {
  const hp = state.characters[id]?.hp.current;
  return hp === undefined ? undefined : displayHp(hp);
};

interface DamageComponent {
  readonly amount: number;
  readonly type: string;
}

// Total + a readable type label. Multiple types join with " + ".
export const summarizeDamage = (
  components: ReadonlyArray<DamageComponent>,
): { total: number; types: string } => {
  let total = 0;
  const types = new Set<string>();
  for (const c of components) {
    total += c.amount;
    types.add(c.type);
  }
  return { total, types: [...types].join(' + ') };
};

export const ordinal = (n: number): string => {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${suffixes[(v - 20) % 10] ?? suffixes[v] ?? suffixes[0]}`;
};
