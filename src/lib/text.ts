// Display helper: canonical names are stored lowercased; show as Sentence case.
export function cap(s: string | null | undefined): string {
  if (!s) return "";
  const t = s.trim();
  if (!t) return "";
  return t.charAt(0).toUpperCase() + t.slice(1);
}
