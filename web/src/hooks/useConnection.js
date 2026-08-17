import { useCallback, useEffect } from 'react';
import { createWebSocketConnection } from '../connection/websocket';
import { useChatStore } from '../stores/chatStore';
import { useSettingsStore } from '../stores/settingsStore';
/**
 * Module-level ref shared across all useConnection callers.
 * This ensures the Sidebar and ChatView operate on the same connection.
 */
const connectionRef = { current: null };
/**
 * Hook that manages the WebSocket connection to the OpenClaude server
 * and wires incoming messages to the chat store.
 */
export function useConnection() {
    const setConnection = useChatStore((s) => s.setConnection);
    const setConnectionStatus = useChatStore((s) => s.setConnectionStatus);
    const appendToCurrentText = useChatStore((s) => s.appendToCurrentText);
    const addToolCall = useChatStore((s) => s.addToolCall);
    const updateToolCall = useChatStore((s) => s.updateToolCall);
    const finalizeResponse = useChatStore((s) => s.finalizeResponse);
    const setPendingPrompt = useChatStore((s) => s.setPendingPrompt);
    const stopStreaming = useChatStore((s) => s.stopStreaming);
    const autoApproveTools = useSettingsStore((s) => s.autoApproveTools);
    const handleServerMessage = useCallback((msg) => {
        if ('text_chunk' in msg) {
            appendToCurrentText(msg.text_chunk.text);
        }
        else if ('tool_start' in msg) {
            let parsedArgs = {};
            try {
                parsedArgs = JSON.parse(msg.tool_start.arguments_json);
            }
            catch {
                // keep as raw
            }
            const tc = {
                id: msg.tool_start.tool_use_id,
                toolName: msg.tool_start.tool_name,
                arguments: parsedArgs,
                argumentsRaw: msg.tool_start.arguments_json,
                state: 'running',
                collapsed: false,
            };
            addToolCall(tc);
        }
        else if ('tool_result' in msg) {
            updateToolCall(msg.tool_result.tool_use_id, (tc) => ({
                ...tc,
                output: msg.tool_result.output,
                isError: msg.tool_result.is_error,
                state: msg.tool_result.is_error ? 'error' : 'completed',
            }));
        }
        else if ('action_required' in msg) {
            if (autoApproveTools && msg.action_required.type === 'CONFIRM_COMMAND') {
                // Auto-approve if setting enabled
                connectionRef.current?.send({
                    input: {
                        reply: 'y',
                        prompt_id: msg.action_required.prompt_id,
                    },
                });
            }
            else {
                setPendingPrompt({
                    promptId: msg.action_required.prompt_id,
                    question: msg.action_required.question,
                    type: msg.action_required.type,
                });
            }
        }
        else if ('done' in msg) {
            finalizeResponse(msg.done.full_text, msg.done.prompt_tokens, msg.done.completion_tokens);
        }
        else if ('error' in msg) {
            stopStreaming();
            console.error('[server error]', msg.error.code, msg.error.message);
        }
    }, [
        appendToCurrentText,
        addToolCall,
        updateToolCall,
        finalizeResponse,
        setPendingPrompt,
        stopStreaming,
        autoApproveTools,
    ]);
    const connect = useCallback((url, authToken) => {
        // Close existing connection
        if (connectionRef.current) {
            connectionRef.current.close();
        }
        setConnectionStatus('connecting');
        const conn = createWebSocketConnection({ url, authToken });
        connectionRef.current = conn;
        conn.onOpen(() => {
            setConnectionStatus('connected');
        });
        conn.onMessage(handleServerMessage);
        conn.onClose(() => {
            setConnectionStatus('disconnected');
        });
        conn.onError(() => {
            setConnectionStatus('error');
        });
        setConnection(conn);
    }, [setConnection, setConnectionStatus, handleServerMessage]);
    // Re-wire message handler when it changes
    useEffect(() => {
        const conn = connectionRef.current;
        if (conn) {
            conn.onMessage(handleServerMessage);
        }
    }, [handleServerMessage]);
    const disconnect = useCallback(() => {
        if (connectionRef.current) {
            connectionRef.current.close();
            connectionRef.current = null;
            setConnection(null);
            setConnectionStatus('disconnected');
        }
    }, [setConnection, setConnectionStatus]);
    return { connect, disconnect };
}
