import 'dotenv/config';

/**
 * Central place for all environment configuration.
 * Values come from `.env` (server-side only — never exposed to the browser).
 */
export const config = {
  /** Port the API server listens on. */
  port: Number(process.env.PORT ?? 3001),

  /** AI provider: 'ollama' (local, default) or 'openai' (OpenAI-compatible API). */
  aiProvider: (process.env.AI_PROVIDER ?? 'ollama') as 'ollama' | 'openai',

  /** Model used by the chosen provider. */
  aiModel: process.env.AI_MODEL ?? 'qwen2.5:7b',

  /** Only used when aiProvider === 'openai'. */
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  openaiBaseUrl: process.env.OPENAI_BASE_URL ?? '',

  /** Local Ollama server (OpenAI-compatible endpoint). */
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/v1',

  /** Where the Learning Bank JSON file is stored. */
  dataDir: process.env.DATA_DIR ?? 'data',
};
