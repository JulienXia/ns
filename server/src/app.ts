import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { createAnalyzeRouter } from './routes/analyze';
import { createEntriesRouter } from './routes/entries';
import { AnalysisService } from './ai/analysisService';
import { createProvider } from './ai/provider';
import { config } from './config';
import {
  JsonFileLearningBankRepository,
  type BankEntry,
  type LearningBankRepository,
} from './storage/learningBankRepository';
import { JsonFileStore } from './storage/jsonFileStore';

/**
 * App dependencies. Tests can inject fakes so they never touch the real
 * AI provider or the real data file.
 */
export interface AppDeps {
  analysisService: AnalysisService;
  learningBank: LearningBankRepository;
}

/**
 * Builds the Express application (without listening) so that tests
 * can exercise it with supertest, and index.ts can start it.
 */
export function createApp(deps?: Partial<AppDeps>): express.Express {
  const analysisService = deps?.analysisService ?? new AnalysisService(createProvider(config));
  // The Learning Bank JSON file always lives under server/data/, no matter
  // which directory the process was started from (unless DATA_DIR is set).
  const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const dataDir = config.dataDir
    ? path.resolve(config.dataDir)
    : path.join(serverRoot, 'data');
  const learningBank =
    deps?.learningBank ??
    new JsonFileLearningBankRepository(
      new JsonFileStore<BankEntry[]>(path.join(dataDir, 'entries.json'), []),
    );

  const app = express();

  app.use(express.json({ limit: '256kb' }));

  // Health check used by scripts and to verify the server is up.
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'nativesense-api',
      time: new Date().toISOString(),
    });
  });

  // POST /api/analyze — naturalness analysis.
  app.use('/api', createAnalyzeRouter(analysisService));

  // /api/entries — Learning Bank CRUD + search.
  app.use('/api', createEntriesRouter(learningBank));

  return app;
}
