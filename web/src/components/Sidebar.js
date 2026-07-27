import { useState, useCallback } from 'react';
import { useChatStore } from '../stores/chatStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useConnection } from '../hooks/useConnection';
import { StatusBadge } from './StatusBadge';
import { Plug, PlugZap, Plus, MessageSquare, Trash2, Settings, ChevronDown, ChevronRight, FolderOpen, Cpu, Shield, X, } from 'lucide-react';
function formatRelativeTime(ts) {
    const now = Date.now();
    const diff = now - ts;
    const sec = Math.floor(diff / 1000);
    if (sec < 60)
        return 'agora';
    const min = Math.floor(sec / 60);
    if (min < 60)
        return `${min}m`;
    const hours = Math.floor(min / 60);
    if (hours < 24)
        return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7)
        return `${days}d`;
    const weeks = Math.floor(days / 7);
    return `${weeks}sem`;
}
function ConnectionSection() {
    const serverUrl = useSettingsStore((s) => s.serverUrl);
    const authToken = useSettingsStore((s) => s.authToken);
    const setServerUrl = useSettingsStore((s) => s.setServerUrl);
    const setAuthToken = useSettingsStore((s) => s.setAuthToken);
    const connectionStatus = useChatStore((s) => s.connectionStatus);
    const { connect, disconnect } = useConnection();
    const [showAuth, setShowAuth] = useState(false);
    const isConnected = connectionStatus === 'connected';
    const isConnecting = connectionStatus === 'connecting';
    const handleToggleConnection = useCallback(() => {
        if (isConnected) {
            disconnect();
        }
        else {
            connect(serverUrl, authToken || undefined);
        }
    }, [isConnected, disconnect, connect, serverUrl, authToken]);
    return (<div className="p-3 border-b border-line">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-ink-2">connection</span>
        <StatusBadge />
      </div>

      <div className="flex gap-1.5">
        <input type="text" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} placeholder="ws://localhost:50051" className="flex-1 bg-surface-2 border border-line rounded px-2 py-1.5 text-xs text-ink
            placeholder:text-quiet focus:outline-none focus:border-accent/50 font-mono"/>
        <button onClick={handleToggleConnection} disabled={isConnecting} className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${isConnected
            ? 'bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30'
            : 'bg-accent/20 border border-accent/40 text-accent hover:bg-accent/30'} disabled:opacity-50`}>
          {isConnecting ? (<>
              <Plug size={12} className="animate-pulse"/>
              <span>connecting</span>
            </>) : isConnected ? (<>
              <PlugZap size={12}/>
              <span>disconnect</span>
            </>) : (<>
              <Plug size={12}/>
              <span>connect</span>
            </>)}
        </button>
      </div>

      <button onClick={() => setShowAuth(!showAuth)} className="flex items-center gap-1 mt-1.5 text-xs text-quiet hover:text-muted transition-colors">
        {showAuth ? <ChevronDown size={10}/> : <ChevronRight size={10}/>}
        auth token
      </button>

      {showAuth && (<input type="password" value={authToken} onChange={(e) => setAuthToken(e.target.value)} placeholder="optional auth token" className="w-full mt-1 bg-surface-2 border border-line rounded px-2 py-1.5 text-xs text-ink
            placeholder:text-quiet focus:outline-none focus:border-accent/50 font-mono"/>)}
    </div>);
}
function ConversationsSection() {
    const conversations = useChatStore((s) => s.conversations);
    const loadConversation = useChatStore((s) => s.loadConversation);
    const deleteConversation = useChatStore((s) => s.deleteConversation);
    const clearChat = useChatStore((s) => s.clearChat);
    const sessionId = useChatStore((s) => s.sessionId);
    return (<div className="flex-1 overflow-y-auto">
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-ink-2">conversations</span>
          <button onClick={clearChat} className="flex items-center gap-1 text-xs text-accent hover:text-accent-2 transition-colors">
            <Plus size={12}/>
            new
          </button>
        </div>

        {conversations.length === 0 ? (<p className="text-xs text-quiet py-4 text-center">no conversations yet</p>) : (<div className="space-y-0.5">
            {conversations.map((conv) => {
                const isActive = conv.id === sessionId;
                const timeAgo = conv.updatedAt ? formatRelativeTime(conv.updatedAt) : '';
                return (<div key={conv.id} className={`group flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${isActive
                        ? 'bg-accent/10 border border-accent/20'
                        : 'hover:bg-surface-2 border border-transparent'}`} onClick={() => loadConversation(conv)}>
                  <MessageSquare size={12} className="text-quiet flex-shrink-0"/>
                  <span className="text-xs text-ink-2 truncate flex-1">
                    {conv.title}
                  </span>
                  <span className="text-xs text-quiet flex-shrink-0" title={new Date(conv.updatedAt).toLocaleString('pt-BR')}>
                    {timeAgo}
                  </span>
                  <button onClick={(e) => {
                        e.stopPropagation();
                        deleteConversation(conv.id);
                    }} className="opacity-0 group-hover:opacity-100 p-0.5 text-quiet hover:text-red-400 transition-all">
                    <Trash2 size={10}/>
                  </button>
                </div>);
            })}
          </div>)}
      </div>
    </div>);
}
function SettingsSection() {
    const [expanded, setExpanded] = useState(false);
    const workingDirectory = useSettingsStore((s) => s.workingDirectory);
    const model = useSettingsStore((s) => s.model);
    const autoApproveTools = useSettingsStore((s) => s.autoApproveTools);
    const setWorkingDirectory = useSettingsStore((s) => s.setWorkingDirectory);
    const setModel = useSettingsStore((s) => s.setModel);
    const setAutoApproveTools = useSettingsStore((s) => s.setAutoApproveTools);
    return (<div className="p-3 border-t border-line">
      <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 w-full text-left text-xs font-medium text-ink-2 hover:text-ink transition-colors">
        <Settings size={12} className="text-quiet"/>
        settings
        <span className="ml-auto text-quiet">
          {expanded ? <ChevronDown size={10}/> : <ChevronRight size={10}/>}
        </span>
      </button>

      {expanded && (<div className="mt-2.5 space-y-2.5">
          <div>
            <label className="flex items-center gap-1.5 text-xs text-muted mb-1">
              <FolderOpen size={10}/>
              working directory
            </label>
            <input type="text" value={workingDirectory} onChange={(e) => setWorkingDirectory(e.target.value)} placeholder="/path/to/project" className="w-full bg-surface-2 border border-line rounded px-2 py-1.5 text-xs text-ink
                placeholder:text-quiet focus:outline-none focus:border-accent/50 font-mono"/>
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs text-muted mb-1">
              <Cpu size={10}/>
              model
            </label>
            <input type="text" value={model} onChange={(e) => setModel(e.target.value)} placeholder="leave empty for server default" className="w-full bg-surface-2 border border-line rounded px-2 py-1.5 text-xs text-ink
                placeholder:text-quiet focus:outline-none focus:border-accent/50 font-mono"/>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={autoApproveTools} onChange={(e) => setAutoApproveTools(e.target.checked)} className="rounded border-line bg-surface-2 text-accent focus:ring-accent/30"/>
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <Shield size={10}/>
              auto-approve tool confirmations
            </span>
          </label>
        </div>)}
    </div>);
}
export function Sidebar({ open, onClose }) {
    return (<>
      {/* Mobile overlay */}
      {open && (<div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={onClose}/>)}

      {/* Sidebar */}
      <aside className={`fixed lg:relative z-40 h-full w-72 bg-surface-0 border-r border-line
          flex flex-col transition-transform duration-200 ease-in-out
          ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${open ? 'lg:w-72' : 'lg:w-0 lg:overflow-hidden lg:border-0'}
        `}>
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-line">
          <div className="flex items-center gap-2">
            <img src="/openclaude.png" alt="" className="w-5 h-5"/>
            <span className="text-sm font-semibold text-ink">openclaude</span>
          </div>
          <button onClick={onClose} className="p-1 text-quiet hover:text-ink lg:hidden transition-colors">
            <X size={16}/>
          </button>
        </div>

        <ConnectionSection />
        <ConversationsSection />
        <SettingsSection />
      </aside>
    </>);
}
