
import { Level } from 'level';
import { getLogger } from '../logger.js';
import path from 'path';

const logger = getLogger();
const DB_PATH = process.env.DB_PATH ?? path.resolve('data', 'chain-db');

export class DatabaseService {
  private static instance: DatabaseService;
  private db: Level<string, any>;

  private constructor() {
    this.db = new Level(DB_PATH, { valueEncoding: 'json' });
    this.db.open().then(() => {
      logger.info('[Database] LevelDB connected.');
    }).catch(err => {
      logger.error('[Database] Failed to open LevelDB:', err);
    });
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  async put(key: string, value: any): Promise<void> {
    await this.db.put(key, value);
  }

  async get(key: string): Promise<any> {
    try {
      return await this.db.get(key);
    } catch (error: any) {
      if (error.code === 'LEVEL_NOT_FOUND') {
        return null;
      }
      throw error;
    }
  }

  async del(key: string): Promise<void> {
    await this.db.del(key);
  }

  async batch(ops: any[]): Promise<void> {
    await this.db.batch(ops);
  }

  async close(): Promise<void> {
    await this.db.close();
  }

  // Specific helpers for chain data
  async saveBlock(index: number, block: any): Promise<void> {
    await this.put(`block:${index}`, block);
    await this.put('chain:height', index);
  }

  async getBlock(index: number): Promise<any> {
    return await this.get(`block:${index}`);
  }

  async getChainHeight(): Promise<number> {
    const h = await this.get('chain:height');
    // Return -1 when the key doesn't exist yet (brand-new / empty DB).
    // 0 is a valid height (genesis block), so we must not conflate it with "not found".
    return h !== null && h !== undefined ? (h as number) : -1;
  }
}

export const db = DatabaseService.getInstance();
