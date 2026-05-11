import { ServerWebSocket } from 'bun';
import { GameManager } from '../../game/GameManager';
import { GameState, ClientMessage, PublicGameState, PrivatePlayerState } from '../../shared/types';
import { sanitizeGameState, getPrivatePlayerState } from './sanitizeState';
import { GameActionHandler } from './gameActions';

interface SocketData {
  userId: string;
  channelId: string;
  accessToken: string;
}

export class SocketHandler {
  private sockets = new Map<string, Set<ServerWebSocket<SocketData>>>(); // channelId -> sockets
  private userSockets = new Map<string, Set<ServerWebSocket<SocketData>>>(); // userId -> sockets
  private actionHandler: GameActionHandler;

  constructor(private gameManager: GameManager) {
    this.actionHandler = new GameActionHandler(gameManager);
  }

  registerSocket(ws: ServerWebSocket<SocketData>): void {
    const { userId, channelId } = ws.data;
    
    if (!this.sockets.has(channelId)) {
      this.sockets.set(channelId, new Set());
    }
    this.sockets.get(channelId)!.add(ws);

    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(ws);

    console.log(`[Socket] User ${userId} connected to channel ${channelId}`);

    // Send current game state if exists
    const game = this.gameManager.getGame(channelId);
    if (game) {
      this.sendGameState(ws, game);
      this.sendPrivateState(ws, game);
    }
  }

  removeSocket(ws: ServerWebSocket<SocketData>): void {
    const { userId, channelId } = ws.data;
    
    this.sockets.get(channelId)?.delete(ws);
    this.userSockets.get(userId)?.delete(ws);

    console.log(`[Socket] User ${userId} disconnected from channel ${channelId}`);
  }

  handleMessage(ws: ServerWebSocket<SocketData>, message: string): void {
    try {
      const data = JSON.parse(message) as ClientMessage;
      const { userId, channelId } = ws.data;
      const game = this.gameManager.getGame(channelId);

      if (!game && data.type !== 'join') {
        ws.send(JSON.stringify({ type: 'error', message: 'No game in progress' }));
        return;
      }

      if (!game) {
        // Create game if joining and none exists
        if (data.type === 'join') {
          const newGame = this.gameManager.createGame(channelId, userId);
          this.handleAction(newGame, userId, data);
        }
        return;
      }

      this.handleAction(game, userId, data);
    } catch (error) {
      console.error('[Socket] Error handling message:', error);
      ws.send(JSON.stringify({ type: 'error', message: (error as Error).message }));
    }
  }

  private handleAction(game: GameState, userId: string, action: ClientMessage): void {
    this.actionHandler.handleAction(
      game,
      userId,
      action,
      (state) => this.broadcast(game.channelId, state),
      (uid, state) => this.sendPrivateStateByUserId(uid, state)
    );
  }

  private broadcast(channelId: string, state: PublicGameState): void {
    const channelSockets = this.sockets.get(channelId);
    if (!channelSockets) {
      console.log(`[Socket] No sockets found for channel ${channelId}`);
      return;
    }

    const message = JSON.stringify({ type: 'gameState', game: state });
    console.log(`[Socket] Broadcasting to ${channelSockets.size} sockets in channel ${channelId}, status: ${state.status}`);
    for (const ws of channelSockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
        console.log(`[Socket] Sent gameState to ${ws.data.userId}`);
      } else {
        console.log(`[Socket] Socket not open for ${ws.data.userId}, state: ${ws.readyState}`);
      }
    }
  }

  private sendGameState(ws: ServerWebSocket<SocketData>, game: GameState): void {
    const state = sanitizeGameState(game);
    state.timeRemaining = null;
    ws.send(JSON.stringify({ type: 'gameState', game: state }));
  }

  private sendPrivateState(ws: ServerWebSocket<SocketData>, game: GameState): void {
    const state = getPrivatePlayerState(game, ws.data.userId);
    ws.send(JSON.stringify({ type: 'privateState', state }));
  }

  private sendPrivateStateByUserId(userId: string, state: PrivatePlayerState): void {
    const userSockets = this.userSockets.get(userId);
    if (!userSockets) return;

    const message = JSON.stringify({ type: 'privateState', state });
    for (const ws of userSockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }
  }

  getChannelSockets(channelId: string): Set<ServerWebSocket<SocketData>> | undefined {
    return this.sockets.get(channelId);
  }
}
