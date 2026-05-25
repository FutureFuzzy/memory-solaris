export interface Memory {
  id: string;
  fact: string;
  confidence: number;
  sentiment: number;
  createdAt: number;
  embedding?: number[];
  accessCount: number;
  relatedIds: string[];
  clusterId: string;
}

export interface MemoryCluster {
  id: string;
  label: string;
  color: string;
  createdAt: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export type ApiProvider = 'gemini' | 'deepseek';

export interface ApiConfig {
  provider: ApiProvider;
  apiKey: string;
  model?: string;
}

export interface MemoryLink {
  source: string;
  target: string;
  strength: number;
}

export interface NodePosition {
  x: number;
  y: number;
  z: number;
}
