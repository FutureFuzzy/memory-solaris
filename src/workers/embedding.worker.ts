import { pipeline } from '@xenova/transformers';

let extractor: Awaited<ReturnType<typeof pipeline>> | null = null;

async function init() {
  if (!extractor) {
    extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
}

self.onmessage = async (e: MessageEvent<{ text: string; id: string }>) => {
  try {
    await init();
    const output = await (extractor as any)!(e.data.text, { pooling: 'mean', normalize: true });
    const embedding = Array.from((output as any).data as Float32Array);
    self.postMessage({ id: e.data.id, embedding, error: null });
  } catch (err) {
    self.postMessage({ id: e.data.id, embedding: null, error: err instanceof Error ? err.message : String(err) });
  }
};
