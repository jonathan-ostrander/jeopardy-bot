// These types mirror the server types for the Activity client

export type GameStatus = 
  | 'waiting'
  | 'selecting'
  | 'reading'
  | 'answering'
  | 'daily_double_wager'
  | 'final_jeopardy_wager'
  | 'final_jeopardy_answering'
  | 'final_jeopardy_reveal'
  | 'ended';

export type GameRound = 'jeopardy' | 'double_jeopardy' | 'final_jeopardy';

// SVG Renderer types
export interface Question {
  value: number;
  clue: string;
  answer: string;
  acceptableAnswers: string[];
  isDailyDouble: boolean;
  isPlayed: boolean;
}

export interface Player {
  userId: string;
  username: string;
  score: number;
  canAnswer: boolean;
  finalJeopardyWager: number | null;
  finalJeopardyAnswer: string | null;
}

export interface Category {
  name: string;
  sourceGameId: string;
  round: 'jeopardy' | 'double_jeopardy';
  questions: Question[];
}

export interface PublicQuestion {
  value: number;
  isPlayed: boolean;
  isDailyDouble: boolean;
}

export interface PublicCategory {
  name: string;
  questions: PublicQuestion[];
}

export interface PublicPlayer {
  userId: string;
  username: string;
  score: number;
  isHost: boolean;
}

export interface PublicSelectedQuestion {
  categoryIndex: number;
  questionIndex: number;
  clue: string;
  categoryName: string;
  value: number;
  isDailyDouble: boolean;
}

export interface PublicGameState {
  status: GameStatus;
  round: GameRound;
  board: {
    categories: PublicCategory[];
    finalJeopardy?: { category: string };
  };
  players: PublicPlayer[];
  currentPlayerId: string | null;
  currentAnsweringPlayerId: string | null;
  selectedQuestion: PublicSelectedQuestion | null;
  timeRemaining: number | null;
  attemptedPlayerIds: string[];
  correctAnswer: string | null;
  correctPlayerIds: string[];
  dailyDoubleWager: number | null;
  lastQuestionCategory: string | null;
  lastQuestionValue: number | null;
  lastQuestionIsDailyDouble: boolean;
  buzzDelayRemaining: number | null;
  buzzDelayTotal: number | null;
}

export interface PrivatePlayerState {
  canWager: boolean;
  maxWager: number;
  finalJeopardyClue: string | null;
  canAnswer: boolean;
}

export type GameActionType = 
  | 'join'
  | 'start'
  | 'select'
  | 'buzz'
  | 'answer'
  | 'wager'
  | 'pass'
  | 'leave'
  | 'dismiss_result';

export interface ClientMessage {
  type: GameActionType;
  payload?: unknown;
}

export interface GameStateUpdate {
  type: 'gameState';
  game: PublicGameState;
}

export interface PrivateStateUpdate {
  type: 'privateState';
  state: PrivatePlayerState;
}

export type ServerMessage = 
  | GameStateUpdate 
  | PrivateStateUpdate 
  | { type: 'error'; message: string } 
  | { type: 'joined'; userId: string };
