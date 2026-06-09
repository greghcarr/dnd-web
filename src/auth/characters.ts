// The signed-in player's dndbnb characters, for the duel menu's picker. dndbnb
// stores each character's full engine `Character` as the row `payload` (built
// via CharacterSchema in dndbnb), so we resolve species / subclass / class
// names from the same engine content dndbnb uses and format a one-line label
// like "Legolas, Level 4 Elf Champion Fighter". Empty in guest mode (no session).

import type { ResolvedContent } from 'dnd-srd-engine';
import { supabase } from './supabase';

export interface DuelCharacterOption {
  readonly id: string;
  readonly label: string;
}

// The dndbnb `characters` row fields we read. `payload` is the engine Character.
interface CharacterRow {
  readonly id: string;
  readonly name: string;
  readonly payload: unknown;
  readonly primary_class_id: string | null;
  readonly species_id: string | null;
}

// The slice of the engine Character payload the label needs.
interface ClassEntry {
  readonly classId?: string;
  readonly level?: number;
  readonly subclassId?: string;
}
interface CharacterPayload {
  readonly name?: string;
  readonly speciesId?: string;
  readonly classes?: ReadonlyArray<ClassEntry>;
}

const titleize = (id: string): string => id.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const formatLabel = (row: CharacterRow, content: ResolvedContent): string => {
  const payload = (row.payload ?? {}) as CharacterPayload;
  const classEntries = payload.classes ?? [];
  const totalLevel = classEntries.reduce((sum, c) => sum + (c.level ?? 0), 0) || 1;
  // Most-advanced class drives the subclass + class name (matches the token /
  // tooltip "primary class" rule); the row column is the fallback.
  const primary = classEntries.reduce<ClassEntry | undefined>(
    (best, c) => (best && (best.level ?? 0) >= (c.level ?? 0) ? best : c),
    undefined,
  );
  const speciesId = payload.speciesId ?? row.species_id ?? undefined;
  const classId = primary?.classId ?? row.primary_class_id ?? undefined;
  const speciesName = speciesId ? content.species.get(speciesId)?.name ?? titleize(speciesId) : undefined;
  const subclassName = primary?.subclassId ? content.subclasses.get(primary.subclassId)?.name : undefined;
  const className = classId ? content.classes.get(classId)?.name ?? titleize(classId) : undefined;
  const descriptor = [speciesName, subclassName, className].filter(Boolean).join(' ');
  const name = (payload.name ?? row.name ?? 'Character').trim();
  return `${name}, Level ${totalLevel} ${descriptor}`.trim();
};

export const fetchDuelCharacters = async (content: ResolvedContent): Promise<DuelCharacterOption[]> => {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return [];
  const { data, error } = await supabase
    .from('characters')
    .select('id, name, payload, primary_class_id, species_id, sort_order')
    .eq('owner_id', userId)
    .order('sort_order');
  if (error || !data) return [];
  return (data as CharacterRow[]).map((row) => ({ id: row.id, label: formatLabel(row, content) }));
};
