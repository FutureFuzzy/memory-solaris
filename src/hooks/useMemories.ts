import { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../db/memory-db';
import { cosineSimilarity, SIMILARITY_THRESHOLD, CLUSTER_PALETTE, truncateLabel } from '../utils/similarity';
import type { Memory, ChatMessage, ApiConfig, MemoryCluster } from '../types';

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const MEMORY_PROMPT = `你是记忆提取助手。在回复用户时，你需要同时从对话中提取关于用户的持久事实。

回复格式要求：
1. 先给用户正常的回复内容
2. 在回复末尾，用 JSON 数组格式输出提取到的事实（如果没有新事实，输出空数组）
3. JSON 数组格式如下，必须严格遵循：

[EXTRACTED_MEMORIES]
[
  {"fact": "用户喜欢猫", "confidence": 0.9, "sentiment": 0.8},
  {"fact": "用户对猫毛过敏", "confidence": 0.7, "sentiment": -0.6}
]
[/EXTRACTED_MEMORIES]

规则：
- fact: 一句话事实描述
- confidence: 0-1 之间的置信度
- sentiment: -1 到 1 之间的情感值，正值表示积极/喜欢，负值表示消极/不喜欢
- 只提取关于用户本人的持久事实，不要提取临时信息
- 如果对话中没有新的事实，输出空数组 []
- 如果提取到的事实与已有事实矛盾，仍然提取出来`;

const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const DEEPSEEK_API = 'https://api.deepseek.com/v1/chat/completions';

function cleanContent(raw: string): string {
  return raw.replace(/\[EXTRACTED_MEMORIES\][\s\S]*?\[\/EXTRACTED_MEMORIES\]/g, '').trim();
}

function extractMemoriesFromReply(raw: string): Omit<Memory, 'id' | 'createdAt' | 'accessCount' | 'relatedIds' | 'clusterId'>[] {
  const match = raw.match(/\[EXTRACTED_MEMORIES\]\n([\s\S]*?)\n\[\/EXTRACTED_MEMORIES\]/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[1]);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item: Record<string, unknown>) => typeof item.fact === 'string')
      .map((item: Record<string, unknown>) => ({
        fact: String(item.fact),
        confidence: Math.min(1, Math.max(0, Number(item.confidence) || 0.5)),
        sentiment: Math.min(1, Math.max(-1, Number(item.sentiment) || 0)),
      }));
  } catch {
    return [];
  }
}

async function deleteClusterIfEmpty(clusterId: string) {
  const count = await db.memories.where('clusterId').equals(clusterId).count();
  if (count === 0) {
    await db.clusters.delete(clusterId);
  }
}

async function tryClusterMemory(memId: string): Promise<boolean> {
  const mem = await db.memories.get(memId);
  if (!mem || !mem.embedding || mem.embedding.length === 0) return false;
  const embedding = mem.embedding;
  const sourceClusterId = mem.clusterId;

  const clusters = await db.clusters.toArray();
  const otherClusters = clusters.filter(c => c.id !== sourceClusterId);
  if (otherClusters.length === 0) return false;

  const dim = embedding.length;
  let bestCluster = otherClusters[0];
  let bestSim = 0;

  for (const c of otherClusters) {
    const members = await db.memories
      .where('clusterId').equals(c.id)
      .filter(m => !!m.embedding && m.embedding.length > 0)
      .toArray();
    if (members.length === 0) continue;

    const centroid = new Array(dim).fill(0);
    for (const m of members) {
      for (let i = 0; i < dim; i++) centroid[i] += m.embedding![i];
    }
    for (let i = 0; i < dim; i++) centroid[i] /= members.length;

    const sim = cosineSimilarity(embedding, centroid);
    if (sim > bestSim) { bestSim = sim; bestCluster = c; }
  }

  if (bestSim > SIMILARITY_THRESHOLD) {
    await db.memories.update(memId, { clusterId: bestCluster.id });
    await deleteClusterIfEmpty(sourceClusterId);
    return true;
  }

  return false;
}

export function useMemories() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [config, setConfig] = useState<ApiConfig | null>(null);
  const [clusters, setClusters] = useState<MemoryCluster[]>([]);
  const workerRef = useRef<Worker | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);

  useEffect(() => {
    const init = async () => {
      const [mems, cls, cfg] = await Promise.all([
        db.memories.toArray(),
        db.clusters.toArray(),
        db.config.toArray(),
      ]);
      setMemories(mems);
      setClusters(cls);
      if (cfg.length > 0) setConfig(cfg[0]);

      const worker = new Worker(new URL('../workers/embedding.worker.ts', import.meta.url), { type: 'module' });
      workerRef.current = worker;
      worker.onmessage = async (e: MessageEvent<{ id: string; embedding: number[]; error: string | null }>) => {
        if (!e.data.error) {
          await db.memories.update(e.data.id, { embedding: e.data.embedding });
          const changed = await tryClusterMemory(e.data.id);
          if (changed) {
            const [allMems, allClusters] = await Promise.all([
              db.memories.toArray(),
              db.clusters.toArray(),
            ]);
            setMemories(allMems);
            setClusters(allClusters);
          }
        }
      };
    };
    init();
    return () => workerRef.current?.terminate();
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!config?.apiKey) return;
    setIsLoading(true);

    const current = messagesRef.current;
    const pending: ChatMessage[] = [...current, { role: 'user', content }];
    messagesRef.current = pending;
    setMessages(pending);

    try {
      let rawReply = '';
      if (config.provider === 'gemini') {
        const res = await fetch(`${GEMINI_API}?key=${config.apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: MEMORY_PROMPT }] },
            contents: pending.map(m => ({
              role: m.role === 'user' ? 'user' : 'model',
              parts: [{ text: m.content }],
            })),
            generationConfig: { maxOutputTokens: 2048 },
          }),
        });
        const data = await res.json();
        rawReply = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } else {
        const res = await fetch(DEEPSEEK_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
          body: JSON.stringify({
            model: config.model || 'deepseek-chat',
            messages: [
              { role: 'system', content: MEMORY_PROMPT },
              ...pending.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })),
            ],
            max_tokens: 2048,
          }),
        });
        const data = await res.json();
        rawReply = data.choices?.[0]?.message?.content || '';
      }

      if (!rawReply) rawReply = '抱歉，AI 没有返回内容，请重试。';

      const displayContent = cleanContent(rawReply);
      const completed: ChatMessage[] = [...pending, { role: 'model', content: displayContent }];
      messagesRef.current = completed;
      setMessages(completed);
      setIsLoading(false);

      const extracted = extractMemoriesFromReply(rawReply);
      if (extracted.length > 0) {
        const existingClusters = await db.clusters.toArray();
        const clusterId = uid();
        const color = CLUSTER_PALETTE[existingClusters.length % CLUSTER_PALETTE.length];
        await db.clusters.add({ id: clusterId, label: truncateLabel(extracted[0].fact), color, createdAt: Date.now() });

        const now = Date.now();
        const newMemories: Memory[] = extracted.map((m, i) => ({
          ...m,
          id: uid(),
          createdAt: now + i * 100,
          accessCount: 0,
          relatedIds: [],
          clusterId,
        }));
        await db.memories.bulkAdd(newMemories);

        const [all, allClusters] = await Promise.all([
          db.memories.toArray(),
          db.clusters.toArray(),
        ]);
        setMemories(all);
        setClusters(allClusters);

        for (const mem of newMemories) {
          workerRef.current?.postMessage({ text: mem.fact, id: mem.id });
        }
      }
    } catch (err) {
      const completed: ChatMessage[] = [...pending, { role: 'model', content: `请求失败：${err instanceof Error ? err.message : String(err)}` }];
      messagesRef.current = completed;
      setMessages(completed);
      setIsLoading(false);
    }
  }, [config]);

  const deleteMemory = useCallback(async (id: string) => {
    const mem = await db.memories.get(id);
    if (!mem) return;
    const clusterId = mem.clusterId;
    await db.memories.delete(id);
    await deleteClusterIfEmpty(clusterId);

    const [all, allClusters] = await Promise.all([
      db.memories.toArray(),
      db.clusters.toArray(),
    ]);
    setMemories(all);
    setClusters(allClusters);
  }, []);

  const updateConfig = useCallback(async (newConfig: ApiConfig) => {
    await db.config.clear();
    await db.config.add(newConfig);
    setConfig(newConfig);
  }, []);

  const addMemoryLink = useCallback(async (sourceId: string, targetId: string) => {
    const source = await db.memories.get(sourceId);
    const target = await db.memories.get(targetId);
    if (!source || !target) return;
    const updatedSource = !source.relatedIds.includes(targetId)
      ? [...source.relatedIds, targetId]
      : source.relatedIds;
    const updatedTarget = !target.relatedIds.includes(sourceId)
      ? [...target.relatedIds, sourceId]
      : target.relatedIds;
    if (!source.relatedIds.includes(targetId)) {
      await db.memories.update(sourceId, { relatedIds: updatedSource });
      await db.memories.update(targetId, { relatedIds: updatedTarget });
      const all = await db.memories.toArray();
      setMemories(all);
    }
  }, []);

  const removeMemoryLink = useCallback(async (sourceId: string, targetId: string) => {
    const source = await db.memories.get(sourceId);
    const target = await db.memories.get(targetId);
    if (!source || !target) return;
    await db.memories.update(sourceId, { relatedIds: source.relatedIds.filter(id => id !== targetId) });
    await db.memories.update(targetId, { relatedIds: target.relatedIds.filter(id => id !== sourceId) });
    const all = await db.memories.toArray();
    setMemories(all);
  }, []);

  const moveMemoryToCluster = useCallback(async (memId: string, newClusterId: string) => {
    const mem = await db.memories.get(memId);
    if (!mem || mem.clusterId === newClusterId) return;
    const oldClusterId = mem.clusterId;
    await db.memories.update(memId, { clusterId: newClusterId });
    await deleteClusterIfEmpty(oldClusterId);
    const [all, allClusters] = await Promise.all([db.memories.toArray(), db.clusters.toArray()]);
    setMemories(all);
    setClusters(allClusters);
  }, []);

  return {
    memories,
    messages,
    isLoading,
    config,
    clusters,
    sendMessage,
    deleteMemory,
    updateConfig,
    addMemoryLink,
    removeMemoryLink,
    moveMemoryToCluster,
  };
}
