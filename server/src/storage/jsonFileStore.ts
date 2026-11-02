import { promises as fs } from 'fs';
import path from 'path';

/**
 * Minimal atomic JSON file storage.
 * Writes go to a temp file first, then are renamed over the real file,
 * so a crash mid-write can never corrupt the stored data.
 */
export class JsonFileStore<T> {
  constructor(
    private readonly filePath: string,
    private readonly defaultValue: T,
  ) {}

  async read(): Promise<T> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      return JSON.parse(raw) as T;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return this.defaultValue;
      }
      throw err;
    }
  }

  async write(value: T): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const tmpPath = `${this.filePath}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(value, null, 2), 'utf8');
    await fs.rename(tmpPath, this.filePath);
  }
}
