import { useState, useRef, useCallback } from 'react';
import { useChatStore } from '../stores/chatStore';
import { useSettingsStore } from '../stores/settingsStore';
import { Send, Square } from 'lucide-react';
export function MessageInput() {
    const [text, setText] = useState('');
    const textareaRef = useRef(null);
    const sendMessage = useChatStore((s) => s.sendMessage);
    const cancelRequest = useChatStore((s) => s.cancelRequest);
    const isStreaming = useChatStore((s) => s.isStreaming);
    const pendingPrompt = useChatStore((s) => s.pendingPrompt);
    const sendPermissionReply = useChatStore((s) => s.sendPermissionReply);
    const connectionStatus = useChatStore((s) => s.connectionStatus);
    const workingDirectory = useSettingsStore((s) => s.workingDirectory);
    const model = useSettingsStore((s) => s.model);
    const isConnected = connectionStatus === 'connected';
    const handleSend = useCallback(() => {
        const trimmed = text.trim();
        if (!trimmed || !isConnected)
            return;
        if (pendingPrompt) {
            sendPermissionReply(pendingPrompt.promptId, trimmed);
        }
        else {
            sendMessage(trimmed, workingDirectory, model || undefined);
        }
        setText('');
        // Reset textarea height
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
    }, [text, isConnected, pendingPrompt, sendMessage, sendPermissionReply, workingDirectory, model]);
    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (isStreaming)
                return;
            handleSend();
        }
    }, [handleSend, isStreaming]);
    const handleInput = useCallback(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
        }
    }, []);
    const placeholder = !isConnected
        ? 'connect to a server to start chatting...'
        : pendingPrompt
            ? 'type your response...'
            : 'send a message... (shift+enter for newline)';
    return (<div className="border-t border-line bg-surface-0/80 backdrop-blur-sm">
      {/* Pending prompt indicator */}
      {pendingPrompt && (<div className="px-4 pt-3 pb-0">
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-xs">
            <span className="text-amber-400 font-medium">Action Required:</span>
            <span className="text-muted truncate">{pendingPrompt.question}</span>
          </div>
        </div>)}

      <div className="flex items-end gap-2 p-3 max-w-4xl mx-auto">
        <textarea ref={textareaRef} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={handleKeyDown} onInput={handleInput} placeholder={placeholder} disabled={!isConnected} rows={1} className="flex-1 resize-none bg-surface-2 border border-line rounded-lg px-3.5 py-2.5
            text-sm text-ink placeholder:text-quiet
            focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20
            disabled:opacity-40 disabled:cursor-not-allowed
            transition-colors font-mono" style={{ maxHeight: '200px' }}/>
        {isStreaming ? (<button onClick={cancelRequest} className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg
              bg-red-500/20 border border-red-500/40 text-red-400
              hover:bg-red-500/30 transition-colors" title="Cancel request">
            <Square size={16}/>
          </button>) : (<button onClick={handleSend} disabled={!text.trim() || !isConnected} className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg
              bg-accent/20 border border-accent/40 text-accent
              hover:bg-accent/30 disabled:opacity-30 disabled:cursor-not-allowed
              transition-colors" title="Send message">
            <Send size={16}/>
          </button>)}
      </div>
    </div>);
}
