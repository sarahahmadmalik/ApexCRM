/**
 * Minimal OpenRouter client (OpenAI-compatible chat completions with tool calling).
 * Server only: the key never reaches the browser.
 *
 *   OPENROUTER_KEY   required
 *   OPENROUTER_MODEL optional, defaults to DEFAULT_MODEL
 */
// Haiku: several times faster than Sonnet and plenty for lookups, summaries and form-filling.
export const DEFAULT_MODEL = "anthropic/claude-haiku-5.5";

export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type ToolSpec = {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
};

export class AiError extends Error {}

export function aiConfigured() {
  return !!process.env.OPENROUTER_KEY;
}

export async function chatCompletion({
  messages,
  tools,
  json = false,
  maxTokens = 1500,
  temperature = 0.2,
}: {
  messages: ChatMessage[];
  tools?: ToolSpec[];
  /** Ask for a single JSON object (used by the briefing). */
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
}) {
  const key = process.env.OPENROUTER_KEY;
  if (!key) throw new AiError("The AI assistant isn't configured. Add OPENROUTER_KEY to the environment.");

  let res: Response;
  try {
    res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(50_000),
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "X-Title": "Dua Dev Internal Tool",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
        messages,
        temperature,
        max_tokens: maxTokens,
        ...(tools?.length ? { tools, tool_choice: "auto" } : {}),
        ...(json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
  } catch {
    throw new AiError("Couldn't reach the AI service (timed out). Please try again.");
  }

  if (!res.ok) {
    if (res.status === 401) throw new AiError("The OpenRouter key was rejected. Check OPENROUTER_KEY.");
    if (res.status === 402)
      throw new AiError("The OpenRouter account is out of credits. Add credits at openrouter.ai/credits, or set OPENROUTER_MODEL to a free model.");
    if (res.status === 429) throw new AiError("The AI service is rate-limited right now. Try again in a moment.");
    throw new AiError(`The AI service returned an error (${res.status}).`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[];
    error?: { message?: string };
  };
  const message = data.choices?.[0]?.message;
  if (!message) throw new AiError(data.error?.message ?? "The AI service returned an empty response.");
  return { content: message.content ?? "", toolCalls: message.tool_calls ?? [] };
}

/** Pulls the first JSON object out of a model reply (tolerates ```json fences and stray prose). */
export function parseJsonObject<T>(text: string): T {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) throw new AiError("The AI reply wasn't in the expected format. Try again.");
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  } catch {
    throw new AiError("The AI reply wasn't in the expected format. Try again.");
  }
}
