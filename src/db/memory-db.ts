import Dexie, { type Table } from 'dexie';
import type { Memory, ApiConfig, MemoryCluster } from '../types';

export class MemoryDB extends Dexie {
  memories!: Table<Memory>;
  config!: Table<ApiConfig>;
  clusters!: Table<MemoryCluster>;

  constructor() {
    super('MemorySolarisDB');
    this.version(1).stores({
      memories: 'id, createdAt, confidence, sentiment',
      config: '++id',
    });
    this.version(2).stores({
      memories: 'id, createdAt, confidence, sentiment, clusterId',
      config: '++id',
      clusters: 'id',
    }).upgrade(async (tx) => {
      await tx.table('memories').toCollection().modify((m) => {
        if (!m.clusterId) m.clusterId = 'default';
      });
      const existing = await tx.table('clusters').get('default');
      if (!existing) {
        await tx.table('clusters').add({
          id: 'default',
          label: '默认主题',
          color: '#fbbf24',
          createdAt: Date.now(),
        });
      }
    });
  }
}

export const db = new MemoryDB();
