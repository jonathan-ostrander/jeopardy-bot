import { GameManager } from '../../game/GameManager';
import { GameState, GameAction, ClientMessage, PublicGameState } from '../../shared/types';
import { sanitizeGameState, getPrivatePlayerState } from './sanitizeState';

export class GameActionHandler {
  private timers = new Map<string, { timeout: NodeJS.Timeout; endTime: number }>();

  constructor(private gameManager: GameManager) {}

  handleAction(
    game: GameState,
    userId: string,
    action: ClientMessage,
    broadcast: (state: PublicGameState) => void,
    sendPrivate: (userId: string, state: ReturnType<typeof getPrivatePlayerState>) => void
  ): void {
    console.log(`[ActionHandler] ${action.type} from ${userId}`);

    try {
      switch (action.type) {
        case 'join':
          this.handleJoin(game, userId, action.payload);
          break;
        case 'start':
          this.handleStart(game, userId);
          break;
        case 'select':
          this.handleSelect(game, userId, action.payload);
          break;
        case 'buzz':
          this.handleBuzz(game, userId);
          break;
        case 'answer':
          this.handleAnswer(game, userId, action.payload);
          break;
        case 'pass':
          this.handlePass(game, userId);
          break;
        case 'wager':
          this.handleWager(game, userId, action.payload);
          break;
        case 'leave':
          this.handleLeave(game, userId);
          break;
        case 'dismiss_result':
          this.handleDismissResult(game, userId);
          break;
        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }

      // Handle timers first so broadcast includes correct timeRemaining
      this.updateTimer(game, broadcast);

      // Broadcast updated state
      const publicState = sanitizeGameState(game);
      publicState.timeRemaining = this.getTimeRemaining(game.channelId);
      console.log(`[ActionHandler] Broadcasting state after ${action.type}, status: ${publicState.status}, timeRemaining: ${publicState.timeRemaining}`);
      broadcast(publicState);

      // Send private state to each player
      for (const player of game.players) {
        const privateState = getPrivatePlayerState(game, player.userId);
        sendPrivate(player.userId, privateState);
      }

    } catch (error) {
      console.error(`[ActionHandler] Error: ${error}`);
      throw error;
    }
  }

  private handleJoin(game: GameState, userId: string, payload: unknown): void {
    if (game.status !== 'waiting') {
      throw new Error('Game has already started');
    }
    const { username } = payload as { username?: string };
    this.gameManager.addPlayer(game, userId, username || 'Player');
  }

  private handleStart(game: GameState, userId: string): void {
    if (game.hostId !== userId) {
      throw new Error('Only the host can start the game');
    }
    if (game.players.length < 1) {
      throw new Error('Need at least 1 player to start');
    }
    this.gameManager.startGame(game, true);
  }

  private handleSelect(game: GameState, userId: string, payload: unknown): void {
    if (game.currentPlayerId !== userId) {
      throw new Error('It is not your turn to select');
    }
    const { categoryIndex, questionIndex } = payload as { categoryIndex: number; questionIndex: number };
    this.gameManager.selectQuestion(game, categoryIndex, questionIndex);
  }

  private handleBuzz(game: GameState, userId: string): void {
    this.gameManager.buzzIn(game, userId);
  }

  private handleAnswer(game: GameState, userId: string, payload: unknown): void {
    const { text } = payload as { text: string };
    if (game.status === 'final_jeopardy_answering') {
      this.gameManager.submitFinalJeopardyAnswer(game, userId, text);
    } else {
      // Use userId as messageId for simplicity
      this.gameManager.submitAnswer(game, userId, text, userId);
    }
  }

  private handleWager(game: GameState, userId: string, payload: unknown): void {
    const { amount } = payload as { amount: number };
    this.gameManager.submitWager(game, userId, amount);
  }

  private handleLeave(game: GameState, userId: string): void {
    this.gameManager.removePlayer(game, userId);
  }

  private handlePass(game: GameState, userId: string): void {
    console.log(`[ActionHandler] Player ${userId} passed`);
    if (game.status !== 'reading') {
      throw new Error('Can only pass during reading phase');
    }

    if (game.attemptedPlayerIds.has(userId)) {
      throw new Error('You already passed or buzzed on this question');
    }

    game.attemptedPlayerIds.add(userId);
    console.log(`[ActionHandler] Player ${userId} passed. Attempted: ${game.attemptedPlayerIds.size}/${game.players.length}`);

    // If all players passed, treat as timeout
    if (game.attemptedPlayerIds.size >= game.players.length) {
      console.log(`[ActionHandler] All players passed, treating as timeout`);
      if (game.selectedQuestion) {
        game.selectedQuestion.isPlayed = true;
        game.lastAnsweredQuestion = {
          question: game.selectedQuestion,
          correctPlayerIds: [],
          answers: [],
          isCorrected: false,
        };
      }
      game.status = 'selecting';
      game.selectedQuestion = null;
      game.selectedCategoryIndex = null;
      game.selectedQuestionIndex = null;
      game.currentAnsweringPlayerId = null;
      game.attemptedPlayerIds = new Set();
      game.currentClueMessageId = null;
      this.clearTimer(game.channelId);
    }
  }

  private handleDismissResult(game: GameState, userId: string): void {
    // Only the current player or host can dismiss the result
    if (game.currentPlayerId !== userId && game.hostId !== userId) {
      throw new Error('Only the current player or host can dismiss the result');
    }
    // Clear the last answered question to hide the overlay
    game.lastAnsweredQuestion = null;
    // Check if round is complete and transition if needed
    this.gameManager.checkAndTransitionRound(game);
    console.log(`[ActionHandler] Result dismissed by ${userId}`);
  }

  private updateTimer(
    game: GameState,
    broadcast: (state: PublicGameState) => void
  ): void {
    this.clearTimer(game.channelId);

    let duration = 0;
    if (game.status === 'reading') {
      duration = 15000;
    } else if (game.status === 'answering') {
      duration = 15000;
    } else if (game.status === 'final_jeopardy_answering') {
      duration = 30000;
    } else {
      return;
    }

    const endTime = Date.now() + duration;
    this.timers.set(game.channelId, {
      endTime,
      timeout: setTimeout(() => {
        this.handleTimeout(game, broadcast);
      }, duration),
    });
  }

  private handleTimeout(game: GameState, broadcast: (state: PublicGameState) => void): void {
    console.log(`[ActionHandler] Timer expired for channel ${game.channelId}`);
    
    if (game.status === 'reading') {
      // No one buzzed in
      if (game.selectedQuestion) {
        game.selectedQuestion.isPlayed = true;
        game.lastAnsweredQuestion = {
          question: game.selectedQuestion,
          correctPlayerIds: [],
          answers: [],
          isCorrected: false,
        };
      }
      game.status = 'selecting';
      game.selectedQuestion = null;
      game.selectedCategoryIndex = null;
      game.selectedQuestionIndex = null;
      game.currentAnsweringPlayerId = null;
      game.attemptedPlayerIds = new Set();
      game.currentClueMessageId = null;
    } else if (game.status === 'answering') {
      // Player timed out
      this.gameManager.handleAnswerTimeout(game);
    }

    this.clearTimer(game.channelId);
    
    const publicState = sanitizeGameState(game);
    publicState.timeRemaining = 0;
    broadcast(publicState);
  }

  private getTimeRemaining(channelId: string): number | null {
    const timer = this.timers.get(channelId);
    if (!timer) return null;
    return Math.max(0, timer.endTime - Date.now());
  }

  clearTimer(channelId: string): void {
    const timer = this.timers.get(channelId);
    if (timer) {
      clearTimeout(timer.timeout);
      this.timers.delete(channelId);
    }
  }
}
