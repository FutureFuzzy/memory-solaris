import { useRef, useState, useMemo, useCallback } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { Trash2, X, Heart, Frown, Link as LinkIcon, Unlink } from 'lucide-react';
import { cosineSimilarity } from '../utils/similarity';
import type { Memory, MemoryCluster } from '../types';

const BASE_RADIUS = 3.5;
const RADIUS_STEP = 0.9;

function getNodePosition(
  mem: Memory,
  memIndex: number,
  memTotal: number,
  clusterCenter: THREE.Vector3,
): THREE.Vector3 {
  const now = Date.now();
  const daysAgo = (now - mem.createdAt) / (1000 * 60 * 60 * 24);
  const radius = BASE_RADIUS + Math.log2(1 + daysAgo) * RADIUS_STEP;
  const angle = memTotal > 1 ? (memIndex / memTotal) * Math.PI * 2 : 0;
  return new THREE.Vector3(
    clusterCenter.x + Math.cos(angle) * radius, 0,
    clusterCenter.z + Math.sin(angle) * radius,
  );
}

const SENTIMENT_WARM = '#fbbf24';
const SENTIMENT_COOL = '#60a5fa';
const SENTIMENT_NEUTRAL = '#d4d4d8';

function sentimentGlowColor(sentiment: number): string {
  if (sentiment > 0.15) return SENTIMENT_WARM;
  if (sentiment < -0.15) return SENTIMENT_COOL;
  return SENTIMENT_NEUTRAL;
}

function sentimentGlowIntensity(sentiment: number): number {
  return 0.15 + Math.abs(sentiment) * 0.35;
}

function computeClusterPositions(
  clusters: MemoryCluster[],
  memories: Memory[],
): Map<string, THREE.Vector3> {
  const positions = new Map<string, THREE.Vector3>();
  if (clusters.length === 0) return positions;
  const n = clusters.length;
  if (n === 1) { positions.set(clusters[0].id, new THREE.Vector3(0, 0, 0)); return positions; }

  const simMatrix = new Map<string, Map<string, number>>();
  for (const c1 of clusters) {
    const row = new Map<string, number>();
    for (const c2 of clusters) {
      if (c1.id === c2.id) { row.set(c2.id, 1); continue; }
      const mems1 = memories.filter(m => m.clusterId === c1.id && !!m.embedding && m.embedding.length > 0);
      const mems2 = memories.filter(m => m.clusterId === c2.id && !!m.embedding && m.embedding.length > 0);
      if (mems1.length === 0 || mems2.length === 0) { row.set(c2.id, 0); continue; }
      let total = 0, count = 0;
      for (const m1 of mems1) { for (const m2 of mems2) { total += cosineSimilarity(m1.embedding!, m2.embedding!); count++; } }
      row.set(c2.id, total / count);
    }
    simMatrix.set(c1.id, row);
  }

  clusters.forEach((c, i) => {
    const angle = (i / n) * Math.PI * 2;
    positions.set(c.id, new THREE.Vector3(Math.cos(angle) * 10, 0, Math.sin(angle) * 10));
  });

  for (let iter = 0; iter < 50; iter++) {
    const forces = new Map<string, THREE.Vector3>();
    clusters.forEach(c => forces.set(c.id, new THREE.Vector3()));
    for (const c1 of clusters) {
      const p1 = positions.get(c1.id)!;
      for (const c2 of clusters) {
        if (c1.id === c2.id) continue;
        const p2 = positions.get(c2.id)!;
        const dir = new THREE.Vector3().subVectors(p1, p2);
        const dist = Math.max(dir.length(), 0.1);
        dir.normalize();
        const sim = simMatrix.get(c1.id)!.get(c2.id)!;
        forces.get(c1.id)!.addScaledVector(dir, -sim * 0.35 + 70 / (dist * dist));
      }
    }
    for (const c of clusters) {
      const f = forces.get(c.id)!; f.multiplyScalar(0.12);
      positions.get(c.id)!.add(f);
    }
  }
  return positions;
}

/* ---- Planet ---- */

function Planet({
  memory, memIndex, memTotal, clusterColor, clusterCenter,
  isSelected, isLinkTarget, positionOverride,
  onPointerDown, onPointerUp,
}: {
  memory: Memory; memIndex: number; memTotal: number;
  clusterColor: string; clusterCenter: THREE.Vector3;
  isSelected: boolean; isLinkTarget: boolean;
  positionOverride?: THREE.Vector3;
  onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
  onPointerUp: (e: ThreeEvent<PointerEvent>) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const targetPos = useMemo(() => getNodePosition(memory, memIndex, memTotal, clusterCenter), [memory, memIndex, memTotal, clusterCenter]);
  const currentPos = useRef(targetPos.clone());
  const size = 0.22 + memory.confidence * 0.6;
  const glowC = sentimentGlowColor(memory.sentiment);
  const glowI = sentimentGlowIntensity(memory.sentiment);

  useFrame(() => {
    if (!meshRef.current || !glowRef.current) return;
    const dest = positionOverride || targetPos;
    currentPos.current.lerp(dest, positionOverride ? 0.5 : 0.06);
    meshRef.current.position.copy(currentPos.current);
    glowRef.current.position.copy(currentPos.current);

    const scl = isSelected ? 1.4 : isLinkTarget ? 1.2 : 1;
    meshRef.current.scale.setScalar(size * scl);
    glowRef.current.scale.setScalar(size * 2.5 * scl);

    (glowRef.current.material as THREE.MeshBasicMaterial).opacity =
      isLinkTarget ? 0.7 : isSelected ? 0.45 : glowI * 0.5 + Math.sin(Date.now() * 0.002 + memIndex) * 0.04;
    if (ringRef.current) ringRef.current.position.copy(currentPos.current);
  });

  return (
    <group>
      <mesh ref={meshRef} onPointerDown={onPointerDown} onPointerUp={onPointerUp}
        onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { document.body.style.cursor = 'default'; }}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial
          color={isLinkTarget ? '#fbbf24' : clusterColor}
          emissive={isLinkTarget ? '#f59e0b' : undefined}
          emissiveIntensity={isLinkTarget ? 0.5 : 0}
          roughness={0.35} metalness={0.5}
        />
      </mesh>
      <mesh ref={glowRef}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial color={isLinkTarget ? '#fbbf24' : glowC} transparent opacity={0.2} depthWrite={false} />
      </mesh>
      {isLinkTarget && (
        <mesh ref={ringRef}>
          <ringGeometry args={[1.4, 1.55, 32]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.7} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

/* ---- Star, Rings, Lines ---- */

function ClusterStar({ position, color }: { position: THREE.Vector3; color: string }) {
  const ref = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const s = 0.85 + Math.sin(Date.now() * 0.001 + position.x) * 0.04;
    if (ref.current) ref.current.scale.setScalar(s);
    if (glowRef.current) {
      glowRef.current.scale.setScalar(s * 3);
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity = 0.12 + Math.sin(Date.now() * 0.0015) * 0.04;
    }
  });
  return (
    <group position={position}>
      <mesh ref={ref}><sphereGeometry args={[1, 32, 32]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.0} /></mesh>
      <mesh ref={glowRef}><sphereGeometry args={[1, 16, 16]} /><meshBasicMaterial color={color} transparent opacity={0.12} depthWrite={false} /></mesh>
    </group>
  );
}

function OrbitRings({ center, count }: { center: THREE.Vector3; count: number }) {
  const rings = useMemo(() => {
    const items: number[] = [];
    for (let i = 0; i <= count + 2; i++) items.push(BASE_RADIUS + i * RADIUS_STEP);
    return items;
  }, [count]);
  return (
    <group position={[center.x, 0, center.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh>
        {rings.map((r, i) => (<ringGeometry key={i} args={[r - 0.012, r + 0.012, 128]} />))}
        <meshBasicMaterial color="#2a2a3e" transparent opacity={0.22} />
      </mesh>
    </group>
  );
}

function GravitationLines({ memories, clusterPositions }: { memories: Memory[]; clusterPositions: Map<string, THREE.Vector3> }) {
  const memMap = useMemo(() => {
    const mm = new Map<string, { mem: Memory; idx: number }>();
    const cm = new Map<string, Memory[]>();
    for (const mem of memories) { const l = cm.get(mem.clusterId) || []; l.push(mem); cm.set(mem.clusterId, l); }
    for (const [, mems] of cm) { mems.sort((a, b) => a.createdAt - b.createdAt); mems.forEach((m, i) => mm.set(m.id, { mem: m, idx: i })); }
    return mm;
  }, [memories]);

  const lines = useMemo(() => {
    const segs: { start: THREE.Vector3; end: THREE.Vector3; cross: boolean }[] = [];
    const cm = new Map<string, Memory[]>();
    for (const mem of memories) { const l = cm.get(mem.clusterId) || []; l.push(mem); cm.set(mem.clusterId, l); }
    for (const mem of memories) {
      for (const rid of mem.relatedIds) {
        if (mem.id >= rid) continue;
        const si = memMap.get(mem.id), ti = memMap.get(rid);
        if (!si || !ti) continue;
        const sc = clusterPositions.get(mem.clusterId), tc = clusterPositions.get(ti.mem.clusterId);
        if (!sc || !tc) continue;
        const sm = cm.get(mem.clusterId) || [], tm = cm.get(ti.mem.clusterId) || [];
        segs.push({ start: getNodePosition(mem, si.idx, sm.length, sc), end: getNodePosition(ti.mem, ti.idx, tm.length, tc), cross: mem.clusterId !== ti.mem.clusterId });
      }
    }
    return segs;
  }, [memories, memMap, clusterPositions]);

  if (lines.length === 0) return null;
  return <>{lines.map(({ start, end, cross }, i) => {
    const color = cross ? '#fbbf24' : '#818cf8';
    const op = cross ? 0.35 : 0.2;
    return <LinkLine key={i} start={start} end={end} color={color} baseOpacity={op} />;
  })}</>;
}

function LinkLine({ start, end, color, baseOpacity }: { start: THREE.Vector3; end: THREE.Vector3; color: string; baseOpacity: number }) {
  const line = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
    return new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: baseOpacity }));
  }, [start, end, color, baseOpacity]);
  useFrame(() => { (line.material as THREE.LineBasicMaterial).opacity = baseOpacity + Math.sin(Date.now() * 0.001) * 0.04; });
  return <primitive object={line} />;
}

/* ---- Scene ---- */

const LINK_DISTANCE = 2.8;

function Scene({
  memories, clusters, onSelect, onLink,
}: {
  memories: Memory[]; clusters: MemoryCluster[];
  onSelect: (id: string | null) => void;
  onLink: (source: string, target: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [linkTargetId, setLinkTargetId] = useState<string | null>(null);
  const dragPos = useRef(new THREE.Vector3());
  const { camera, raycaster, pointer } = useThree();
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);

  const clusterPositions = useMemo(() => computeClusterPositions(clusters, memories), [clusters, memories]);
  const clusterMems = useMemo(() => {
    const m = new Map<string, Memory[]>();
    for (const mem of memories) { const l = m.get(mem.clusterId) || []; l.push(mem); m.set(mem.clusterId, l); }
    return m;
  }, [memories]);

  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>, id: string) => {
    e.stopPropagation(); setSelectedId(id); onSelect(id); setDragId(id);
    (e.target as HTMLElement)?.setPointerCapture(e.pointerId);
  }, [onSelect]);

  const handlePointerUp = useCallback((e: ThreeEvent<PointerEvent>, id: string) => {
    e.stopPropagation();
    if (linkTargetId && linkTargetId !== id) {
      onLink(id, linkTargetId);
    }
    setDragId(null); setLinkTargetId(null);
  }, [linkTargetId, onLink]);

  useFrame(() => {
    if (dragId) {
      raycaster.setFromCamera(pointer, camera);
      const target = new THREE.Vector3();
      raycaster.ray.intersectPlane(plane, target);
      if (target) dragPos.current.copy(target);
    }
    // Detect link target
    let closestId: string | null = null;
    let closestDist = Infinity;
    if (dragId) {
      for (const { id: cid, position } of clusters.map(c => ({ id: c.id, position: clusterPositions.get(c.id) }))) {
        if (!position) continue;
        const mems = clusterMems.get(cid) || [];
        for (let i = 0; i < mems.length; i++) {
          const m = mems[i];
          if (m.id === dragId) continue;
          const mp = getNodePosition(m, i, mems.length, position);
          const d = dragPos.current.distanceTo(mp);
          if (d < LINK_DISTANCE && d < closestDist) { closestDist = d; closestId = m.id; }
        }
      }
    }
    setLinkTargetId(closestId);
  });

  return (
    <>
      <ambientLight intensity={0.35} />
      <pointLight position={[0, 15, 0]} intensity={1.5} color="#fff" />
      <pointLight position={[0, -10, 0]} intensity={0.2} color="#6366f1" />
      <GravitationLines memories={memories} clusterPositions={clusterPositions} />
      {dragId && linkTargetId && (
        <LinkLine start={dragPos.current} end={getNodePosition(
          memories.find(m => m.id === linkTargetId)!,
          (clusterMems.get(memories.find(m => m.id === linkTargetId)!.clusterId) || []).findIndex(m => m.id === linkTargetId),
          clusterMems.get(memories.find(m => m.id === linkTargetId)!.clusterId)?.length || 1,
          clusterPositions.get(memories.find(m => m.id === linkTargetId)!.clusterId) || new THREE.Vector3(),
        )} color="#fbbf24" baseOpacity={0.5} />)}
      {clusters.map((cluster) => {
        const center = clusterPositions.get(cluster.id);
        if (!center) return null;
        const mems = clusterMems.get(cluster.id) || [];
        return (
          <group key={cluster.id}>
            <ClusterStar position={center} color={cluster.color} />
            <OrbitRings center={center} count={mems.length} />
            {mems.map((mem, memIndex) => (
              <Planet key={mem.id} memory={mem} memIndex={memIndex} memTotal={mems.length}
                clusterColor={cluster.color} clusterCenter={center}
                isSelected={selectedId === mem.id}
                isLinkTarget={linkTargetId === mem.id}
                positionOverride={dragId === mem.id ? dragPos.current : undefined}
                onPointerDown={(e) => handlePointerDown(e, mem.id)}
                onPointerUp={(e) => handlePointerUp(e, mem.id)} />
            ))}
          </group>
        );
      })}
    </>
  );
}

/* ---- SolarSystem wrapper ---- */

export function SolarSystem({
  memories, clusters, onDelete, onLink, onUnlink, onMoveToCluster,
}: {
  memories: Memory[]; clusters: MemoryCluster[];
  onDelete: (id: string) => void;
  onLink?: (source: string, target: string) => void;
  onUnlink?: (source: string, target: string) => void;
  onMoveToCluster?: (memId: string, clusterId: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = memories.find((m) => m.id === selectedId);
  const selectedCluster = clusters.find(c => c.id === selected?.clusterId);
  const linkedMems = useMemo(() =>
    memories.filter(m => selected?.relatedIds.includes(m.id) || m.relatedIds.includes(selected?.id || '')),
    [memories, selected]);

  return (
    <div className="relative h-full w-full">
      <Canvas camera={{ position: [0, 22, 22], fov: 50, near: 0.1, far: 300 }}
        onPointerMissed={() => setSelectedId(null)} style={{ background: '#0a0a0f' }}>
        <Scene memories={memories} clusters={clusters} onSelect={setSelectedId} onLink={(s, t) => onLink?.(s, t)} />
      </Canvas>

      {selected && (
        <div className="absolute bottom-4 left-4 z-10 w-80 max-h-[75vh] overflow-y-auto rounded-xl border border-border bg-bg-panel/95 p-4 shadow-2xl backdrop-blur-sm">
          <div className="mb-3 flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full" style={{ background: selectedCluster?.color || '#fbbf24' }} />
              <span className="text-sm font-medium text-text-primary">记忆详情</span>
            </div>
            <button onClick={() => setSelectedId(null)} className="text-text-secondary hover:text-text-primary"><X size={16} /></button>
          </div>

          <p className="mb-3 text-sm leading-relaxed text-text-primary">{selected.fact}</p>

          <div className="mb-3 grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-lg bg-bg-secondary px-2.5 py-2">
              <div className="mb-0.5 text-text-secondary">置信度</div>
              <div className="font-medium text-text-primary">{Math.round(selected.confidence * 100)}%</div>
            </div>
            <div className="rounded-lg bg-bg-secondary px-2.5 py-2">
              <div className="mb-0.5 text-text-secondary">情感</div>
              <div className="flex items-center gap-1 font-medium">
                {selected.sentiment > 0.2 ? <><Heart size={11} className="text-positive" /><span className="text-positive">积极</span></>
                  : selected.sentiment < -0.2 ? <><Frown size={11} className="text-negative" /><span className="text-negative">消极</span></>
                  : <span className="text-neutral">中性</span>}
              </div>
            </div>
            <div className="rounded-lg bg-bg-secondary px-2.5 py-2">
              <div className="mb-0.5 text-text-secondary">星系</div>
              <select
                value={selected.clusterId}
                onChange={(e) => { onMoveToCluster?.(selected.id, e.target.value); setSelectedId(null); }}
                className="w-full bg-transparent text-xs text-text-primary font-medium border-0 outline-0 cursor-pointer truncate"
                title="切换星系"
              >
                {clusters.map(c => (
                  <option key={c.id} value={c.id} className="bg-bg-panel">
                    {c.label || `#${c.id.slice(0, 4)}`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {linkedMems.length > 0 && (
            <div className="mb-3">
              <div className="mb-1.5 flex items-center gap-1 text-xs text-text-secondary"><LinkIcon size={12} /> 已关联 ({linkedMems.length})</div>
              <div className="space-y-1">
                {linkedMems.map(lm => (
                  <div key={lm.id} className="flex items-center gap-1.5 rounded-lg bg-bg-secondary/50 px-2.5 py-1.5 text-xs">
                    <span className="flex-1 text-text-primary truncate">{lm.fact}</span>
                    <button onClick={() => onUnlink?.(selected.id, lm.id)}
                      className="text-text-secondary/60 hover:text-red-400 transition-colors shrink-0" title="取消关联">
                      <Unlink size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={() => { onDelete(selected.id); setSelectedId(null); }}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-900/50 bg-red-900/20 py-2 text-sm text-red-400 hover:bg-red-900/30 transition-colors">
            <Trash2 size={14} />删除记忆
          </button>
        </div>
      )}

      <div className="absolute top-4 left-4 z-10 rounded-lg border border-border bg-bg-panel/90 px-3 py-2 text-xs backdrop-blur-sm max-w-[220px]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {clusters.map((c) => (
            <div key={c.id} className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
              <span className="text-text-secondary">{c.label || `主题`}</span>
            </div>
          ))}
        </div>
        <div className="mt-1.5 text-text-secondary/60">
          光晕暖=积极 冷=消极<br />距离=语义关联度<br />拖拽A到B=关联
        </div>
      </div>
    </div>
  );
}
