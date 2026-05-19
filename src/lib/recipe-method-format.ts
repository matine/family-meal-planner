/** Line starts with a step number (1. 2) Step 3 — not inline amounts like "2.5 cups". */
const NUMBERED_STEP_LINE = /^\d+[\.\)]\s+\S/;
const STEP_LABEL_LINE = /^step\s+\d+/i;

export function hasNumberedMethodSteps(method: string): boolean {
  const lines = method
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return false;

  const numbered = lines.filter((l) => NUMBERED_STEP_LINE.test(l) || STEP_LABEL_LINE.test(l));
  if (numbered.length >= 2) return true;
  if (numbered.length === 1 && (/^1[\.\)]\s/.test(lines[0]!) || STEP_LABEL_LINE.test(lines[0]!)))
    return true;
  return false;
}

function splitLongParagraph(text: string): string[] {
  const parts = text
    .split(/(?<=[.!?])\s+(?=[A-Z\d"'])/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 1 ? parts : [text];
}

function splitMethodIntoSteps(method: string): string[] {
  const trimmed = method.replace(/\r\n/g, "\n").trim();
  if (!trimmed) return [];

  const byParagraph = trimmed.split(/\n\s*\n+/).map((s) => s.trim()).filter(Boolean);
  if (byParagraph.length > 1) return byParagraph;

  const byLine = trimmed.split(/\n/).map((s) => s.trim()).filter(Boolean);
  if (byLine.length > 1) return byLine;

  return splitLongParagraph(trimmed);
}

/**
 * Number imported method steps as `1. …` with a single newline between steps (no blank lines).
 * Leaves numbering when already present; collapses extra blank lines between steps.
 */
export function formatImportedRecipeMethod(method: string): string {
  const trimmed = method.replace(/\r\n/g, "\n").trim();
  if (!trimmed) return "";
  if (hasNumberedMethodSteps(trimmed)) {
    return trimmed.replace(/\n{2,}/g, "\n");
  }

  const steps = splitMethodIntoSteps(trimmed);
  if (!steps.length) return "";
  return steps.map((step, i) => `${i + 1}. ${step}`).join("\n");
}

/** Lines for display (one visual block per step / paragraph). */
export function methodDisplayLines(method: string): string[] {
  return method
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export type MethodDisplayLine =
  | { type: "numbered"; label: string; body: string }
  | { type: "plain"; text: string };

/** Split a display line into a step label and body for grid layout. */
export function parseMethodDisplayLine(line: string): MethodDisplayLine {
  const stepMatch = line.match(/^step\s+(\d+)\s*([:.])?\s*(.*)$/i);
  if (stepMatch) {
    const punct = stepMatch[2] ?? ":";
    return {
      type: "numbered",
      label: `Step ${stepMatch[1]}${punct}`,
      body: stepMatch[3] ?? "",
    };
  }

  const numMatch = line.match(/^(\d+)([\.\)])\s+(.*)$/);
  if (numMatch) {
    return {
      type: "numbered",
      label: `${numMatch[1]}${numMatch[2]}`,
      body: numMatch[3] ?? "",
    };
  }

  return { type: "plain", text: line };
}
