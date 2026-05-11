import { GameState, PublicGameState, PublicCategory, PublicPlayer, PublicSelectedQuestion, PrivatePlayerState } from '../shared/types';

export function sanitizeGameState(game: GameState): PublicGameState {
  const categories: PublicCategory[] = (game.round === 'jeopardy' 
    ? game.board.jeopardyRound 
    : game.board.doubleJeopardyRound
  ).map(cat => ({
    name: cat.name,
    questions: cat.questions.map(q => ({
      value: q.value,
      isPlayed: q.isPlayed,
      isDailyDouble: q.isDailyDouble,
    })),
  }));

  const players: PublicPlayer[] = game.players.map(p => ({
    userId: p.userId,
    username: p.username,
    score: p.score,
    isHost: p.userId === game.hostId,
  }));

  let selectedQuestion: PublicSelectedQuestion | null = null;
  if (game.selectedQuestion && game.selectedCategoryIndex !== null && game.selectedQuestionIndex !== null) {
    const category = game.round === 'jeopardy'
      ? game.board.jeopardyRound[game.selectedCategoryIndex]
      : game.board.doubleJeopardyRound[game.selectedCategoryIndex];
    
    selectedQuestion = {
      categoryIndex: game.selectedCategoryIndex,
      questionIndex: game.selectedQuestionIndex,
      clue: game.selectedQuestion.clue,
      categoryName: category.name,
      value: game.selectedQuestion.value,
      isDailyDouble: game.selectedQuestion.isDailyDouble,
    };
  }

  let correctAnswer: string | null = null;
  let correctPlayerIds: string[] = [];
  if (game.status === 'selecting' && game.lastAnsweredQuestion) {
    correctAnswer = game.lastAnsweredQuestion.question.answer;
    correctPlayerIds = game.lastAnsweredQuestion.correctPlayerIds;
  }

  let dailyDoubleWager: number | null = null;
  if (game.selectedQuestion?.isDailyDouble) {
    dailyDoubleWager = (game.selectedQuestion as any).wager ?? null;
  }

  return {
    status: game.status,
    round: game.round,
    board: {
      categories,
      finalJeopardy: game.round === 'final_jeopardy' 
        ? { category: game.board.finalJeopardy.category }
        : undefined,
    },
    players,
    currentPlayerId: game.currentPlayerId,
    currentAnsweringPlayerId: game.currentAnsweringPlayerId,
    selectedQuestion,
    timeRemaining: null,
    attemptedPlayerIds: Array.from(game.attemptedPlayerIds),
    correctAnswer,
    correctPlayerIds,
    dailyDoubleWager,
  };
}

export function getPrivatePlayerState(game: GameState, userId: string): PrivatePlayerState {
  const player = game.players.find(p => p.userId === userId);
  
  let canWager = false;
  let maxWager = 0;
  let finalJeopardyClue: string | null = null;

  if (game.status === 'daily_double_wager' && game.currentPlayerId === userId) {
    canWager = true;
    maxWager = player ? (player.score > 0 ? player.score : 1000) : 0;
    if (game.round === 'double_jeopardy') {
      maxWager = player ? (player.score > 0 ? player.score : 2000) : 0;
    }
  }

  if (game.status === 'final_jeopardy_wager' && player && player.finalJeopardyWager === null) {
    canWager = true;
    maxWager = player.score > 0 ? player.score : 0;
  }

  if (game.status === 'final_jeopardy_answering' && player && player.finalJeopardyAnswer === null) {
    finalJeopardyClue = game.board.finalJeopardy.clue;
  }

  return { canWager, maxWager, finalJeopardyClue };
}
