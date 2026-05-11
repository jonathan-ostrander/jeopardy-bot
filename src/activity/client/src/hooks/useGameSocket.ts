import { useState, useEffect, useRef, useCallback } from 'react';
import { PublicGameState, PrivatePlayerState, ServerMessage, ClientMessage } from '../types';

export function useGameSocket(channelId: string | null, accessToken: string | null) {
  const [gameState, setGameState] = useState<PublicGameState | null>(null);
  const [privateState, setPrivateState] = useState<PrivatePlayerState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!channelId || !accessToken) return;

    const wsUrl = `wss://${window.location.host}/ws?channelId=${channelId}&token=${accessToken}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected');
      setConnected(true);
      setError(null);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as ServerMessage;
        console.log('[WS] Message received:', data.type, data);
        
        if (data.type === 'gameState') {
          console.log('[WS] Setting game state, status:', data.game.status, 'players:', data.game.players.length);
          setGameState(data.game);
        } else if (data.type === 'privateState') {
          console.log('[WS] Setting private state');
          setPrivateState(data.state);
        } else if (data.type === 'error') {
          console.log('[WS] Error message:', data.message);
          setError(data.message);
        }
      } catch (err) {
        console.error('[WS] Parse error:', err);
      }
    };

    ws.onerror = (err) => {
      console.error('[WS] Error:', err);
      setError('WebSocket error');
    };

    ws.onclose = () => {
      console.log('[WS] Disconnected');
      setConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [channelId, accessToken]);

  const sendAction = useCallback((type: ClientMessage['type'], payload?: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  return { gameState, privateState, error, connected, sendAction };
}
