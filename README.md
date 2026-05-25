# 记忆星球 Memory Solaris

将 AI 对你的"记忆黑盒"变成一座可看、可摸、可改的 3D 星系。

## 产品概述

记忆星球是一个本地优先的 AI 记忆可视化工具。你与 AI 聊天，AI 自动从对话中提取关于你的持久事实，每条事实化为 3D 空间中的一颗"星球"。不同主题的记忆自动聚类成独立星系，语义相近的星系在空间中彼此靠近。

**核心理念**：让用户看见并管理 AI 对自己的认知，像整理物理桌面一样自然。

## 功能特性

### MVP 已实现

- **对话即记忆**：与 Gemini / DeepSeek 聊天，AI 自动提取用户事实（置信度 + 情感值）
- **多主题星系**：记忆按语义自动聚类，每个主题 = 一颗彩色恒星 + 环绕行星
- **力导向布局**：星系位置基于跨星系语义相似度动态计算，关联越紧密距离越近
- **3D 可视化**：Three.js + React Three Fiber 渲染，支持旋转/缩放视角
- **情感光晕**：行星光晕偏暖（积极）或偏冷（消极），不影响星球本体颜色
- **引力线**：关联记忆之间有可见连线，同星系靛蓝色，跨星系金色
- **拖拽关联**：拖拽星球到另一个星球上，自动建立双向关联
- **星系管理**：点击星球 → 下拉菜单切换归属星系
- **关联管理**：详情面板中查看和取消已关联记忆
- **本地持久化**：IndexedDB（Dexie.js）存储所有数据，刷新不丢失
- **隐私优先**：API Key 仅存本地浏览器，不上传任何服务器
- **零后端**：纯前端应用，无服务器成本

### 视觉设计

| 元素 | 视觉表达 |
|------|----------|
| 恒星 | 主题星系中心，脉动光球，每个主题独立颜色 |
| 行星大小 | 记忆置信度（0.22 - 0.82）|
| 轨道半径 | 记忆创建时间（越新越近，对数衰减）|
| 行星颜色 | 所属星系颜色 |
| 光晕颜色 | 情感倾向（暖金=积极、冷蓝=消极、灰=中性）|
| 引力线 | 金色=跨星系，靛蓝=同星系，脉动闪烁 |
| 关联目标 | 金色光环高亮 |

### 交互操作

- 点击星球 → 查看记忆详情（事实内容、置信度、情感、归属星系）
- 拖拽星球到另一个星球 → 建立关联
- 详情面板中 → 切换星系 / 取消关联 / 删除记忆
- 拖拽星球靠近目标 → 目标出现金色光环，松手即关联

## 技术架构

```
用户浏览器
├── React 19 + TypeScript + Vite
│   ├── ChatPanel      — AI 对话框
│   ├── SolarSystem    — 3D 记忆星图 (@react-three/fiber + Three.js)
│   └── SettingsPanel  — API 配置
├── 状态管理 (useMemories hook)
│   ├── Gemini / DeepSeek API 调用
│   ├── 记忆提取解析 ([EXTRACTED_MEMORIES] JSON)
│   └── 语义聚类 (余弦相似度 + 质心比较)
├── 本地存储 (Dexie.js / IndexedDB)
│   ├── memories 表 (id, fact, confidence, sentiment, embedding, clusterId, relatedIds)
│   ├── clusters 表 (id, label, color)
│   └── config 表 (provider, apiKey, model)
└── Web Worker
    └── transformers.js (all-MiniLM-L6-v2 embedding 生成)
```

### 组件树

```
App
├── ChatPanel          — 左侧 380px 聊天面板
├── SolarSystem        — 右侧 3D 场景
│   └── Scene
│       ├── AmbientLight / PointLight
│       ├── GravitationLines (关联连线)
│       ├── ClusterStar (主题恒星) × N
│       ├── OrbitRings (轨道环) × N
│       └── Planet (记忆行星) × M
└── SettingsPanel      — 右上角 API 配置弹窗
```

### 数据模型

```typescript
interface Memory {
  id: string;           // 唯一标识
  fact: string;         // 一句话事实
  confidence: number;   // 0-1 置信度
  sentiment: number;    // -1 到 1 情感值
  createdAt: number;    // 时间戳
  embedding?: number[]; // 语义向量 (384维)
  accessCount: number;  // 调用次数
  relatedIds: string[]; // 关联记忆 ID
  clusterId: string;    // 所属星系 ID
}

interface MemoryCluster {
  id: string;           // 唯一标识
  label: string;        // 主题名称（从第一条记忆截取）
  color: string;        // 星系颜色 (8色调色板)
  createdAt: number;
}
```

### 聚类算法

1. 用户聊天 → AI 提取记忆 → 存入 DB（默认 clusterId: 新批次 ID）
2. Web Worker 生成 embedding → 存入对应记忆
3. 触发聚类：计算新记忆与所有现有 cluster 质心的余弦相似度
4. 相似度 > 0.45 → 归入最相似 cluster；否则保持独立 cluster
5. 删除记忆时自动清理空 cluster

### 力导向布局

星系位置通过跨星系语义相似度 + 物理模拟计算：
- 初始化：均匀分布在半径 10 的圆上
- 50 轮迭代：吸引力（相似度 × 0.35）+ 排斥力（70 / 距离²）
- 结果：语义相近的星系在空间中靠得更近

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览构建结果
npm run preview
```

## 使用方法

1. 打开应用，点击右上角「API 配置」
2. 选择 AI 提供商（Gemini / DeepSeek），填入 API Key
3. 在左侧对话框开始聊天，AI 会自动提取关于你的事实
4. 右侧 3D 空间实时生成记忆星球，自动聚类到主题星系
5. 点击星球查看详情，拖拽星球到另一个星球建立关联
6. 所有数据保存在浏览器本地，刷新不丢失

## 部署

纯静态站点，可部署到任何静态托管服务：

```bash
npm run build
# 将 dist/ 目录部署到 Nginx / Vercel / Netlify / Cloudflare Pages 等
# 注意：所有 API 调用直接从浏览器发起，无需服务端代理
```

当前部署：`http://82.156.245.28:3002`（PM2 + serve）

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | React 19 + TypeScript + Vite |
| 3D 渲染 | @react-three/fiber + Three.js |
| 样式 | Tailwind CSS v4 |
| 图标 | lucide-react |
| 本地存储 | Dexie.js (IndexedDB) |
| Embedding | @xenova/transformers (all-MiniLM-L6-v2) |
| AI API | Gemini 2.0 Flash / DeepSeek |
| 部署 | PM2 + serve / Nginx |

## 后续规划（V2+）

- 遗忘模拟：长期未提及的记忆逐渐缩小外移
- 记忆矛盾检测：红色闪烁连线提示冲突事实
- 手动创建/编辑记忆
- Electron/Tauri 桌面客户端
- 可选云同步
