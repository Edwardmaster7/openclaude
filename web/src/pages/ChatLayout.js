import { useState, useEffect } from 'react';
import { Sidebar } from '../components/Sidebar';
import { ChatView } from '../components/ChatView';
import { useSettingsStore } from '../stores/settingsStore';
import { PanelLeft } from 'lucide-react';
export function ChatLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const theme = useSettingsStore((s) => s.theme);
    // Apply theme on mount
    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        document.documentElement.style.colorScheme = theme;
    }, [theme]);
    return (<div className="h-screen flex bg-surface-0 text-ink overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)}/>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-line bg-surface-0/80 backdrop-blur-sm">
          {!sidebarOpen && (<button onClick={() => setSidebarOpen(true)} className="p-1.5 text-quiet hover:text-ink rounded transition-colors hover:bg-surface-2" title="Open sidebar">
              <PanelLeft size={16}/>
            </button>)}
          <span className="text-xs text-quiet font-mono">openclaude chat</span>
        </div>

        {/* Chat area */}
        <ChatView />
      </div>
    </div>);
}
