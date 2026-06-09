// Error formatting for Supabase calls, ported from dndbnb. Supabase's
// Auth/Postgrest errors are not always Error subclasses after the network
// layer; they come back as plain objects with message/details/hint/code, so a
// naive String(err) yields "[object Object]". This pulls a readable message
// from every shape we've seen and logs the raw error for debugging.

export const errorMessage = (err: unknown): string => {
  console.error(err);

  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;

  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof e.message === 'string') parts.push(e.message);
    if (typeof e.hint === 'string' && e.hint) parts.push(`hint: ${e.hint}`);
    if (typeof e.details === 'string' && e.details) parts.push(`details: ${e.details}`);
    if (typeof e.code === 'string' && e.code && parts.length === 0) parts.push(`code: ${e.code}`);
    if (parts.length > 0) return parts.join(' | ');
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }

  return String(err);
};
