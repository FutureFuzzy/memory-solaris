import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, User, Bot, AlertCircle } from 'lucide-react';
import type { ChatMessage } from '../types';

interface Props {
  messages: ChatMessage[];
  isLoading: boolean;
  hasConfig: boolean;
  onSend: (text: string) => void;
}

export function ChatPanel({ messages, isLoading, hasConfig, onSend }: Props) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    onSend(input.trim());
    setInput('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex h-full flex-col border-r border-border bg-bg-panel">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-medium text-text-primary">AI 对话</h2>
        <p className="text-xs text-text-secondary/60 mt-0.5">聊天即记忆，AI 会自动提取关于你的事实</p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-text-secondary/40">
            <Bot size={40} className="mb-3 opacity-50" />
            <p className="text-sm">开始对话，让 AI 了解你</p>
            <p className="text-xs mt-1">每轮对话后，右侧会生成新的记忆星球</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
              msg.role === 'user' ? 'bg-accent/20' : 'bg-positive/20'
            }`}>
              {msg.role === 'user' ? <User size={14} className="text-accent" /> : <Bot size={14} className="text-positive" />}
            </div>
            <div className={`max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'bg-accent/15 text-text-primary'
                : 'bg-bg-secondary text-text-primary border border-border'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-positive/20">
              <Bot size={14} className="text-positive" />
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-bg-secondary px-3.5 py-2.5 text-sm text-text-secondary border border-border">
              <Loader2 size={14} className="animate-spin" />
              AI 思考中...
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border p-4">
        {!hasConfig && (
          <div className="mb-3 flex items-center gap-1.5 rounded-lg bg-accent/10 px-3 py-2 text-xs text-accent">
            <AlertCircle size={13} />
            请先点击右上角「API 配置」输入你的 API Key
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!hasConfig || isLoading}
            rows={2}
            placeholder={hasConfig ? '说说你自己吧，比如你的喜好、经历、习惯...' : '请先配置 API Key'}
            className="flex-1 resize-none rounded-xl border border-border bg-bg-primary px-4 py-3 text-sm text-text-primary placeholder:text-text-secondary/40 focus:border-accent focus:outline-none disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={!hasConfig || isLoading || !input.trim()}
            className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl bg-accent text-white hover:bg-accent-hover disabled:opacity-40 transition-colors"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
