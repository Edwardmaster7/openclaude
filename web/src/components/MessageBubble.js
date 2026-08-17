import { User, Bot, AlertCircle, Loader2 } from 'lucide-react';
import { useChatStore } from '../stores/chatStore';
import { useElapsedTime } from '../hooks/useElapsedTime';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ToolCallDisplay } from './ToolCallDisplay';
function formatTime(ts) {
    if (ts === 0)
        return '';
    return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
export function MessageBubble({ message, isStreaming, streamingText }) {
    const isUser = message.role === 'user';
    const isSystem = message.role === 'system';
    const hasToolCalls = message.toolCalls.length > 0;
    const content = isStreaming ? streamingText || '' : message.content;
    const isEmpty = !content && !hasToolCalls && !isStreaming;
    const streamStartTime = useChatStore((s) => s.streamStartTime);
    const elapsed = useElapsedTime(streamStartTime, isStreaming === true && !content && !hasToolCalls);
    if (isEmpty)
        return null;
    return (<div className={`group flex gap-3 py-3 px-4 animate-fade-in ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center mt-0.5 ${isUser
            ? 'bg-accent/20 text-accent'
            : isSystem
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-emerald-500/20 text-emerald-400'}`}>
        {isUser ? (<User size={14}/>) : isSystem ? (<AlertCircle size={14}/>) : (<Bot size={14}/>)}
      </div>

      {/* Content */}
      <div className={`flex-1 min-w-0 ${isUser ? 'text-right' : ''}`}>
        {/* Header */}
        <div className={`flex items-center gap-2 mb-1 ${isUser ? 'justify-end' : ''}`}>
          <span className="text-xs font-medium text-ink-2">
            {isUser ? 'you' : isSystem ? 'system' : 'assistant'}
          </span>
          <span className="text-xs text-quiet">{formatTime(message.timestamp)}</span>
          {message.tokenUsage && (<span className="text-xs text-quiet">
              {message.tokenUsage.prompt + message.tokenUsage.completion} tokens
            </span>)}
        </div>

        {/* Tool calls */}
        {hasToolCalls && (<div className={`${isUser ? 'ml-auto max-w-2xl' : 'max-w-2xl'}`}>
            {message.toolCalls.map((tc) => (<ToolCallDisplay key={tc.id} toolCall={tc}/>))}
          </div>)}

        {/* Message content */}
        {content && (<div className={`${isUser
                ? 'inline-block ml-auto max-w-2xl bg-accent/10 border border-accent/20 rounded-lg px-3.5 py-2.5 text-sm text-ink-2'
                : 'max-w-2xl text-sm text-ink-2'}`}>
            {isUser ? (<p className="whitespace-pre-wrap break-words text-left">{content}</p>) : (<MarkdownRenderer content={content}/>)}
            {isStreaming && (<span className="inline-block w-1.5 h-4 bg-accent ml-0.5 animate-pulse"/>)}
          </div>)}

        {/* Streaming indicator when no content yet */}
        {isStreaming && !content && !hasToolCalls && (<div className="flex items-center gap-2 text-xs text-muted">
            <Loader2 size={12} className="animate-spin"/>
            <span>thinking...{elapsed ? ` ${elapsed}` : ''}</span>
          </div>)}
      </div>
    </div>);
}
