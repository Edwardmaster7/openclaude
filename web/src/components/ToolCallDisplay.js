import { useState, useCallback } from 'react';
import { ChevronDown, ChevronRight, Terminal, FileText, Search, Wrench, Loader2, CheckCircle2, XCircle, Copy, Check, } from 'lucide-react';
import { useChatStore } from '../stores/chatStore';
import { useElapsedTime } from '../hooks/useElapsedTime';
import { MarkdownRenderer } from './MarkdownRenderer';
const toolIcons = {
    Bash: Terminal,
    bash: Terminal,
    Read: FileText,
    read: FileText,
    Write: FileText,
    write: FileText,
    Edit: FileText,
    edit: FileText,
    Grep: Search,
    grep: Search,
    Glob: Search,
    glob: Search,
};
function getToolIcon(toolName) {
    return toolIcons[toolName] || Wrench;
}
function getToolColor(state) {
    switch (state) {
        case 'running':
            return 'text-amber-400';
        case 'completed':
            return 'text-emerald-400';
        case 'error':
            return 'text-red-400';
    }
}
function getToolBg(state) {
    switch (state) {
        case 'running':
            return 'border-amber-500/30 bg-amber-500/5';
        case 'completed':
            return 'border-emerald-500/20 bg-emerald-500/5';
        case 'error':
            return 'border-red-500/30 bg-red-500/5';
    }
}
function formatToolArgs(args) {
    const parts = [];
    for (const [key, value] of Object.entries(args)) {
        if (key === 'command' || key === 'file_path' || key === 'path' || key === 'pattern') {
            const str = typeof value === 'string' ? value : JSON.stringify(value);
            parts.push(str.length > 80 ? str.slice(0, 80) + '...' : str);
        }
    }
    return parts.join(' ') || '';
}
function OutputContent({ output, toolName }) {
    const [copied, setCopied] = useState(false);
    const handleCopy = useCallback(async () => {
        await navigator.clipboard.writeText(output);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    }, [output]);
    // Detect if output looks like a diff
    const isDiff = output.includes('--- ') || output.includes('+++ ') || output.includes('@@');
    if (isDiff) {
        return (<div className="relative group">
        <button onClick={handleCopy} className="absolute top-1 right-1 p-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted hover:text-ink">
          {copied ? <Check size={12}/> : <Copy size={12}/>}
        </button>
        <pre className="text-xs overflow-x-auto p-3 bg-black/30 rounded font-mono leading-relaxed">
          {output.split('\n').map((line, i) => {
                let color = 'text-ink-2';
                if (line.startsWith('+'))
                    color = 'text-emerald-400';
                else if (line.startsWith('-'))
                    color = 'text-red-400';
                else if (line.startsWith('@@'))
                    color = 'text-cyan-400';
                return (<div key={i} className={color}>
                {line}
              </div>);
            })}
        </pre>
      </div>);
    }
    // For bash output, render as monospace
    if (toolName === 'Bash' || toolName === 'bash') {
        return (<div className="relative group">
        <button onClick={handleCopy} className="absolute top-1 right-1 p-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted hover:text-ink">
          {copied ? <Check size={12}/> : <Copy size={12}/>}
        </button>
        <pre className="text-xs overflow-x-auto p-3 bg-black/30 rounded font-mono text-ink-2 leading-relaxed max-h-80 overflow-y-auto">
          {output}
        </pre>
      </div>);
    }
    // Default: render as markdown
    return (<div className="text-sm p-2">
      <MarkdownRenderer content={output}/>
    </div>);
}
export function ToolCallDisplay({ toolCall }) {
    const [collapsed, setCollapsed] = useState(toolCall.collapsed);
    const Icon = getToolIcon(toolCall.toolName);
    const color = getToolColor(toolCall.state);
    const bg = getToolBg(toolCall.state);
    const argsPreview = formatToolArgs(toolCall.arguments);
    const hasOutput = toolCall.output && toolCall.output.length > 0;
    const streamStartTime = useChatStore((s) => s.streamStartTime);
    const elapsed = useElapsedTime(streamStartTime, toolCall.state === 'running' && !hasOutput);
    return (<div className={`border rounded-md ${bg} my-1.5 animate-fade-in`}>
      <button onClick={() => setCollapsed(!collapsed)} className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/[0.02] transition-colors">
        <span className="text-quiet">
          {collapsed ? <ChevronRight size={14}/> : <ChevronDown size={14}/>}
        </span>
        <Icon size={14} className={color}/>
        <span className={`text-xs font-medium ${color}`}>
          {toolCall.toolName}
        </span>
        {argsPreview && (<span className="text-xs text-muted truncate flex-1 min-w-0">
            {argsPreview}
          </span>)}
        <span className="flex-shrink-0">
          {toolCall.state === 'running' && (<Loader2 size={12} className="text-amber-400 animate-spin"/>)}
          {toolCall.state === 'completed' && !toolCall.isError && (<CheckCircle2 size={12} className="text-emerald-400"/>)}
          {(toolCall.state === 'error' || toolCall.isError) && (<XCircle size={12} className="text-red-400"/>)}
        </span>
      </button>

      {!collapsed && (hasOutput || toolCall.state === 'running') && (<div className="border-t border-white/5 mx-2">
          {toolCall.state === 'running' && !hasOutput && (<div className="flex items-center gap-2 py-3 px-2 text-xs text-muted">
              <Loader2 size={12} className="animate-spin"/>
              <span>executing...{elapsed ? ` ${elapsed}` : ''}</span>
            </div>)}
          {hasOutput && (<div className="py-1">
              <OutputContent output={toolCall.output} toolName={toolCall.toolName}/>
            </div>)}
        </div>)}
    </div>);
}
