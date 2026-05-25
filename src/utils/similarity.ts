export const CLUSTER_PALETTE = [
  '#f59e0b', '#10b981', '#6366f1', '#ec4899',
  '#06b6d4', '#f97316', '#8b5cf6', '#14b8a6',
];

export const SIMILARITY_THRESHOLD = 0.45;

export function truncateLabel(fact: string): string {
  return fact.length > 12 ? fact.slice(0, 12) + '…' : fact;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
