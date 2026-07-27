import { useEffect, useRef } from 'react';
import { useChatStore } from '../stores/chatStore';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { Bot, Zap } from 'lucide-react';
function EmptyState() {
    return (<div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
      <div className="w-16 h-16 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-6">
        <Bot size={28} className="text-accent"/>
      </div>
      <h2 className="text-lg font-semibold text-ink mb-2">openclaude chat</h2>
      <p className="text-sm text-muted max-w-md mb-6">
        connect to an openclaude server and start a conversation.
        the agent can read files, run commands, search code, and more.
      </p>
      <div className="flex flex-col gap-2 text-xs text-quiet">
        <div className="flex items-center gap-2">
          <Zap size={12} className="text-accent"/>
          <span>streaming responses with live tool execution</span>
        </div>
        <div className="flex items-center gap-2">
          <Zap size={12} className="text-accent"/>
          <span>supports bash, file ops, grep, glob, and mcp tools</span>
        </div>
        <div className="flex items-center gap-2">
          <Zap size={12} className="text-accent"/>
          <span>works with any model via openai-compatible api</span>
        </div>
      </div>
    </div>);
}
export function ChatView() {
    const messages = useChatStore((s) => s.messages);
    const isStreaming = useChatStore((s) => s.isStreaming);
    const currentText = useChatStore((s) => s.currentText);
    const connectionStatus = useChatStore((s) => s.connectionStatus);
    const messagesEndRef = useRef(null);
    const scrollContainerRef = useRef(null);
    // Auto-scroll to bottom on new messages or streaming text
    useEffect(() => {
        const el = messagesEndRef.current;
        if (el) {
            el.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, currentText]);
    const isEmpty = messages.length === 0;
    return (<div className="flex flex-col h-full">
      {/* Messages area */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
        {isEmpty ? (<EmptyState />) : (<div className="max-w-4xl mx-auto py-4">
            {messages.map((msg, i) => {
                const isLast = i === messages.length - 1;
                const isStreamingThis = isStreaming && isLast && msg.role === 'assistant';
                return (<MessageBubble key={msg.id} message={msg} isStreaming={isStreamingThis} streamingText={isStreamingThis ? currentText : undefined}/>);
            })}
            <div ref={messagesEndRef}/>
          </div>)}
      </div>

      {/* Input area */}
      <MessageInput />
    </div>);
}
