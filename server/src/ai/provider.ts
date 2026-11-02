/**
 * AI provider abstraction.
 *
 * NativeSense talks to the AI through this small interface, so the AI engine
 * is swappable: Ollama (local, free, offline) is the default; any
 * OpenAI-compatible API (OpenAI, DeepSeek, Qwen, ...) works by changing a few
 * environment variables. API keys always stay on the server.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiProvider {
  readonly name: string;
  chat(messages: ChatMessage[], options?: { temperature?: number }): Promise<string>;
}

/** Thrown when the AI service itself fails (network, auth, empty response). */
export class AiProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiProviderError';
  }
}

export interface OpenAICompatibleOptions {
  baseUrl: string;
  model: string;
  apiKey?: string;
  name: string;
}

/** Speaks the OpenAI Chat Completions protocol (used by Ollama and cloud APIs). */
export class OpenAICompatibleProvider implements AiProvider {
  readonly name: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly apiKey?: string;

  constructor(opts: OpenAICompatibleOptions) {
    this.name = opts.name;
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.model = opts.model;
    this.apiKey = opts.apiKey;
  }

  async chat(messages: ChatMessage[], options?: { temperature?: number }): Promise<string> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: options?.temperature ?? 0.4,
        stream: false,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new AiProviderError(
        `AI provider returned HTTP ${res.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`,
      );
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;

    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new AiProviderError('AI provider returned an empty response.');
    }
    return content;
  }
}

export interface ProviderConfig {
  aiProvider: 'ollama' | 'openai';
  aiModel: string;
  openaiApiKey: string;
  openaiBaseUrl: string;
  ollamaBaseUrl: string;
}

export function createProvider(cfg: ProviderConfig): AiProvider {
  if (cfg.aiProvider === 'openai') {
    if (!cfg.openaiApiKey) {
      throw new AiProviderError(
        'AI_PROVIDER is "openai" but OPENAI_API_KEY is not set. Add it to your .env file.',
      );
    }
    const baseUrl = cfg.openaiBaseUrl || 'https://api.openai.com/v1';
    return new OpenAICompatibleProvider({
      baseUrl,
      model: cfg.aiModel,
      apiKey: cfg.openaiApiKey,
      name: 'openai',
    });
  }

  // Default: local Ollama — no key, no cost, works offline.
  return new OpenAICompatibleProvider({
    baseUrl: cfg.ollamaBaseUrl,
    model: cfg.aiModel,
    name: 'ollama',
  });
}
