export type ExtractionSource =
  | "jsonld"
  | "readability"
  | "regex_fallback"
  | "text"
  | "image"
  | "structured_skip_llm"
  | "cache";

export type ImportTelemetryPayload = {
  phase: "parseRecipe";
  mode: "url" | "text" | "image";
  urlHash?: string;
  extractionSource?: ExtractionSource;
  htmlBytes?: number;
  promptChars?: number;
  approxPromptTokens?: number;
  model?: string;
  llmSkipped?: boolean;
  cacheHit?: boolean;
  providerHttpStatus?: number;
  latencyMs: number;
  outcome: "success" | "error";
  error?: string;
};

export function approxTokensFromChars(chars: number): number {
  return Math.max(0, Math.ceil(chars / 4));
}

/** Structured JSON log line for server observability. */
export function logImportEvent(payload: ImportTelemetryPayload): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...payload });
  if (payload.outcome === "error") console.warn(`[import] ${line}`);
  else console.info(`[import] ${line}`);
}
