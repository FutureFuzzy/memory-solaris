import { useState } from 'react';
import { Settings, X, KeyRound } from 'lucide-react';
import type { ApiConfig } from '../types';

interface Props {
  config: ApiConfig | null;
  onUpdate: (config: ApiConfig) => void;
}

export function SettingsPanel({ config, onUpdate }: Props) {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<ApiConfig['provider']>(config?.provider || 'gemini');
  const [apiKey, setApiKey] = useState(config?.apiKey || '');
  const [model, setModel] = useState(config?.model || '');

  const handleSave = () => {
    onUpdate({ provider, apiKey: apiKey.trim(), model: model.trim() || undefined });
    setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-lg bg-bg-panel px-3 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors border border-border"
      >
        <Settings size={16} />
        API 配置
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-border bg-bg-panel p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-medium text-text-primary">API 配置</h2>
              <button onClick={() => setOpen(false)} className="text-text-secondary hover:text-text-primary">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-text-secondary">AI 提供商</label>
                <div className="flex gap-2">
                  {(['gemini', 'deepseek'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => {
                        setProvider(p);
                        setModel(p === 'gemini' ? '' : 'deepseek-chat');
                      }}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                        provider === p
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {p === 'gemini' ? 'Gemini' : 'DeepSeek'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm text-text-secondary">
                  API Key
                  <span className="ml-1 text-xs text-text-secondary/60">（仅存储在本地浏览器）</span>
                </label>
                <div className="relative">
                  <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary/60" />
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={provider === 'gemini' ? 'AIzaSy...' : 'sk-...'}
                    className="w-full rounded-lg border border-border bg-bg-primary py-2.5 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-secondary/40 focus:border-accent focus:outline-none"
                  />
                </div>
              </div>

              {provider === 'deepseek' && (
                <div>
                  <label className="mb-1 block text-sm text-text-secondary">模型</label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="deepseek-chat"
                    className="w-full rounded-lg border border-border bg-bg-primary py-2.5 px-3 text-sm text-text-primary placeholder:text-text-secondary/40 focus:border-accent focus:outline-none"
                  />
                </div>
              )}

              <p className="text-xs text-text-secondary/60">
                你的 API Key 只会保存在浏览器的本地数据库中，不会上传到任何服务器。
              </p>

              <button
                onClick={handleSave}
                disabled={!apiKey.trim()}
                className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40 transition-colors"
              >
                保存配置
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
