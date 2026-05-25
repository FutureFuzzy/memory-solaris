import { useMemories } from './hooks/useMemories';
import { ChatPanel } from './components/ChatPanel';
import { SolarSystem } from './components/SolarSystem';
import { SettingsPanel } from './components/SettingsPanel';

function App() {
  const {
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
  } = useMemories();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg-primary">
      <div className="w-[380px] shrink-0 border-r border-border">
        <ChatPanel
          messages={messages}
          isLoading={isLoading}
          hasConfig={!!config?.apiKey}
          onSend={sendMessage}
        />
      </div>
      <div className="flex-1">
        <SolarSystem
          memories={memories}
          clusters={clusters}
          onDelete={deleteMemory}
          onLink={addMemoryLink}
          onUnlink={removeMemoryLink}
          onMoveToCluster={moveMemoryToCluster}
        />
      </div>
      <SettingsPanel config={config} onUpdate={updateConfig} />
    </div>
  );
}

export default App;
