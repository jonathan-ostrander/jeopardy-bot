export interface Question {
  value: number;
  clue: string;
  answer: string;
  acceptableAnswers: string[];
  isDailyDouble: boolean;
  isPlayed: boolean;
}

export interface Category {
  name: string;
  sourceGameId: string;
  round: 'jeopardy' | 'double_jeopardy';
  questions: Question[];
}

export interface FinalJeopardy {
  category: string;
  clue: string;
  answer: string;
  acceptableAnswers: string[];
  sourceGameId: string;
}

export interface Player {
  userId: string;
  username: string;
  score: number;
  canAnswer: boolean;
  finalJeopardyWager: number | null;
  finalJeopardyAnswer: string | null;
}

export interface PlayerAnswer {
  playerId: string;
  answer: string;
  timestamp: Date;
  isCorrect: boolean;
  messageId: string;
}

export interface LastAnsweredQuestion {
  question: Question;
  correctPlayerIds: string[];
  answers: PlayerAnswer[];
  isCorrected: boolean;
}

export type GameStatus = 
  | 'waiting'
  | 'selecting'
  | 'reading'
  | 'answering'
  | 'daily_double_wager'
  | 'final_jeopardy_wager'
  | 'final_jeopardy_answering'
  | 'ended';

export type GameRound = 'jeopardy' | 'double_jeopardy' | 'final_jeopardy';

export interface GameBoard {
  id: string;
  jeopardyRound: Category[];
  doubleJeopardyRound: Category[];
  finalJeopardy: FinalJeopardy;
}

export interface GameState {
  status: GameStatus;
  board: GameBoard;
  players: Player[];
  currentPlayerId: string | null;
  selectedQuestion: Question | null;
  selectedCategoryIndex: number | null;
  selectedQuestionIndex: number | null;
  answeredThisQuestion: Set<string>;
  wrongThisQuestion: Set<string>;
  round: GameRound;
  lastAnsweredQuestion: LastAnsweredQuestion | null;
  channelId: string;
  threadId: string | null;
  hostId: string;
  currentAnsweringPlayerId: string | null;
  attemptedPlayerIds: Set<string>;
  currentClueMessageId: string | null;
}

export interface AnswerCheck {
  isCorrect: boolean;
  confidence: number;
  matchedAnswer: string | null;
}
