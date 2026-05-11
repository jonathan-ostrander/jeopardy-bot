import { 
  GameState, 
  GameBoard, 
  GameStatus, 
  GameRound, 
  Player, 
  Question, 
  Category,
  LastAnsweredQuestion,
  PlayerAnswer
} from '../shared/types';
import { loadRandomCategories, loadRandomFinalJeopardy } from '../scraper/storage';
import { checkAnswer, validateAnswerFormat } from './AnswerValidator';

export class GameManager {
  private games: Map<string, GameState> = new Map();

  createGame(channelId: string, hostId: string): GameState {
    console.log(`[GameManager] Creating game for channel ${channelId}, host ${hostId}`);
    const board = this.generateBoard();
    
    const game: GameState = {
      status: 'waiting',
      board,
      players: [],
      currentPlayerId: null,
      selectedQuestion: null,
      selectedCategoryIndex: null,
      selectedQuestionIndex: null,
      answeredThisQuestion: new Set(),
      wrongThisQuestion: new Set(),
      round: 'jeopardy',
      lastAnsweredQuestion: null,
      channelId,
      threadId: null,
      hostId,
      currentAnsweringPlayerId: null,
      attemptedPlayerIds: new Set(),
      currentClueMessageId: null,
    };

    this.games.set(channelId, game);
    console.log(`[GameManager] Game created for channel ${channelId}. Total games: ${this.games.size}`);
    return game;
  }

  getGame(channelId: string): GameState | undefined {
    return this.games.get(channelId);
  }

  endGame(channelId: string): void {
    console.log(`[GameManager] Ending game for channel ${channelId}`);
    this.games.delete(channelId);
    console.log(`[GameManager] Game ended. Total games: ${this.games.size}`);
  }

  addPlayer(game: GameState, userId: string, username: string): Player {
    const existingPlayer = game.players.find(p => p.userId === userId);
    if (existingPlayer) {
      console.log(`[GameManager] Player ${username} (${userId}) already in game`);
      return existingPlayer;
    }

    const player: Player = {
      userId,
      username,
      score: 0,
      canAnswer: true,
      finalJeopardyWager: null,
      finalJeopardyAnswer: null,
    };

    game.players.push(player);
    console.log(`[GameManager] Player ${username} (${userId}) added. Total players: ${game.players.length}`);
    return player;
  }

  removePlayer(game: GameState, userId: string): boolean {
    const index = game.players.findIndex(p => p.userId === userId);
    if (index === -1) return false;
    
    game.players.splice(index, 1);
    console.log(`[GameManager] Player ${userId} removed. Total players: ${game.players.length}`);
    
    // If no players left, end game
    if (game.players.length === 0) {
      this.endGame(game.channelId);
      return true;
    }
    
    // If current player left, pick next
    if (game.currentPlayerId === userId) {
      game.currentPlayerId = game.players[0]?.userId ?? null;
    }
    
    return true;
  }

  startGame(game: GameState, force = false): void {
    console.log(`[GameManager] Starting game. Players: ${game.players.length}, force: ${force}`);
    if (!force && game.players.length < 2) {
      throw new Error('Need at least 2 players to start');
    }

    // Reset board and game state for a new game
    game.board = this.generateBoard();
    game.round = 'jeopardy';
    game.status = 'selecting';
    game.selectedQuestion = null;
    game.selectedCategoryIndex = null;
    game.selectedQuestionIndex = null;
    game.answeredThisQuestion = new Set();
    game.wrongThisQuestion = new Set();
    game.lastAnsweredQuestion = null;
    game.attemptedPlayerIds = new Set();
    game.currentAnsweringPlayerId = null;
    game.currentClueMessageId = null;

    // Reset player states
    game.players.forEach(p => {
      p.score = 0;
      p.canAnswer = true;
      p.finalJeopardyWager = null;
      p.finalJeopardyAnswer = null;
    });

    // Randomly select first player
    game.currentPlayerId = game.players[Math.floor(Math.random() * game.players.length)].userId;
    console.log(`[GameManager] Game started. First player: ${game.currentPlayerId}`);
  }

  selectQuestion(game: GameState, categoryIndex: number, questionIndex: number): Question {
    const categories = game.round === 'jeopardy' 
      ? game.board.jeopardyRound 
      : game.board.doubleJeopardyRound;

    if (categoryIndex < 0 || categoryIndex >= categories.length) {
      throw new Error('Invalid category');
    }

    const category = categories[categoryIndex];
    
    if (questionIndex < 0 || questionIndex >= category.questions.length) {
      throw new Error('Invalid question');
    }

    const question = category.questions[questionIndex];
    
    if (question.isPlayed) {
      throw new Error('Question already played');
    }

    console.log(`[GameManager] Selected question: ${category.name} $${question.value} (Daily Double: ${question.isDailyDouble})`);

    game.selectedQuestion = question;
    game.selectedCategoryIndex = categoryIndex;
    game.selectedQuestionIndex = questionIndex;
    game.answeredThisQuestion = new Set();
    game.wrongThisQuestion = new Set();
    game.attemptedPlayerIds = new Set();
    game.currentAnsweringPlayerId = null;
    game.currentClueMessageId = null;

    if (question.isDailyDouble) {
      game.status = 'daily_double_wager';
      console.log(`[GameManager] Status -> daily_double_wager`);
    } else {
      game.status = 'reading';
      console.log(`[GameManager] Status -> reading`);
    }

    return question;
  }

  buzzIn(game: GameState, playerId: string): void {
    console.log(`[GameManager] Player ${playerId} buzzing in. Attempted: ${Array.from(game.attemptedPlayerIds)}`);
    if (!game.selectedQuestion) {
      throw new Error('No question selected');
    }

    if (game.attemptedPlayerIds.has(playerId)) {
      throw new Error('You already had a turn on this question');
    }

    if (game.selectedQuestion.isDailyDouble && game.currentPlayerId !== playerId) {
      throw new Error('Only the current player can answer a Daily Double');
    }

    game.currentAnsweringPlayerId = playerId;
    game.attemptedPlayerIds.add(playerId);
    game.status = 'answering';
    console.log(`[GameManager] Status -> answering. Current answering player: ${playerId}`);
  }

  handleAnswerTimeout(game: GameState): { allAttempted: boolean } {
    console.log(`[GameManager] Answer timeout for player ${game.currentAnsweringPlayerId}`);
    if (!game.selectedQuestion) {
      throw new Error('No question selected');
    }

    const player = game.players.find(p => p.userId === game.currentAnsweringPlayerId);
    if (player) {
      const points = game.selectedQuestion.isDailyDouble
        ? ((game.selectedQuestion as any).wager || game.selectedQuestion.value)
        : game.selectedQuestion.value;
      player.score -= points;
      console.log(`[GameManager] ${player.username} timed out, lost $${points}. Score: ${player.score}`);
    }

    game.currentAnsweringPlayerId = null;
    const allAttempted = game.attemptedPlayerIds.size >= game.players.length;
    console.log(`[GameManager] Attempted: ${game.attemptedPlayerIds.size}/${game.players.length}. All attempted: ${allAttempted}`);

    if (allAttempted) {
      // End question - everyone tried and failed
      game.selectedQuestion.isPlayed = true;
      game.lastAnsweredQuestion = {
        question: game.selectedQuestion,
        correctPlayerIds: [],
        answers: [],
        isCorrected: false,
      };
      game.status = 'selecting';
      game.selectedQuestion = null;
      game.selectedCategoryIndex = null;
      game.selectedQuestionIndex = null;
      console.log(`[GameManager] Status -> selecting (all attempted, no correct answer)`);
    } else {
      game.status = 'reading';
      console.log(`[GameManager] Status -> reading (more players can buzz in)`);
    }

    return { allAttempted };
  }

  submitWager(game: GameState, playerId: string, wager: number): void {
    console.log(`[GameManager] Player ${playerId} wagering $${wager}`);
    const player = game.players.find(p => p.userId === playerId);
    if (!player) {
      throw new Error('Player not found');
    }

    const maxWager = game.round === 'jeopardy' 
      ? (player.score > 0 ? player.score : 1000)
      : (player.score > 0 ? player.score : 2000);

    if (wager < 0 || wager > maxWager) {
      throw new Error(`Wager must be between $0 and $${maxWager}`);
    }

    if (game.status === 'daily_double_wager') {
      // Daily double: only current player can wager
      if (game.currentPlayerId !== playerId) {
        throw new Error('Only the current player can wager on a Daily Double');
      }
      
      // Store wager in the question temporarily
      if (game.selectedQuestion) {
        (game.selectedQuestion as any).wager = wager;
      }
      
      game.status = 'reading';
      console.log(`[GameManager] Daily double wager placed. Status -> reading`);
    } else if (game.status === 'final_jeopardy_wager') {
      player.finalJeopardyWager = wager;
      
      // Check if all players have wagered
      const allWagered = game.players.every(p => p.finalJeopardyWager !== null);
      if (allWagered) {
        game.status = 'final_jeopardy_answering';
        console.log(`[GameManager] All wagers in. Status -> final_jeopardy_answering`);
      }
    }
  }

  submitAnswer(game: GameState, playerId: string, answer: string, messageId: string): { isCorrect: boolean; player: Player | null; allAttempted: boolean } {
    console.log(`[GameManager] Player ${playerId} submitted answer: "${answer}"`);
    const player = game.players.find(p => p.userId === playerId);
    if (!player) {
      throw new Error('Player not found');
    }

    if (!game.selectedQuestion) {
      throw new Error('No question selected');
    }

    if (game.currentAnsweringPlayerId !== playerId) {
      throw new Error('It is not your turn to answer');
    }

    // Validate answer format - treat invalid format as wrong answer
    const isValidFormat = validateAnswerFormat(answer);
    if (!isValidFormat) {
      console.log(`[GameManager] Invalid answer format from ${playerId}: "${answer}"`);
    }

    game.answeredThisQuestion.add(playerId);

    // Only check answer content if format is valid
    const check = isValidFormat 
      ? checkAnswer(answer, game.selectedQuestion.acceptableAnswers)
      : { isCorrect: false, confidence: 0, matchedAnswer: null };
    console.log(`[GameManager] Answer check: isCorrect=${check.isCorrect}, formatValid=${isValidFormat}`);
    
    const playerAnswer: PlayerAnswer = {
      playerId,
      answer,
      timestamp: new Date(),
      isCorrect: check.isCorrect,
      messageId,
    };

    if (check.isCorrect) {
      // Correct answer
      const points = game.selectedQuestion.isDailyDouble 
        ? ((game.selectedQuestion as any).wager || game.selectedQuestion.value)
        : game.selectedQuestion.value;
      
      player.score += points;
      console.log(`[GameManager] Correct! ${player.username} gains $${points}. Score: ${player.score}`);
      
      // Mark question as played
      game.selectedQuestion.isPlayed = true;
      
      // Store last answered question for correction system
      game.lastAnsweredQuestion = {
        question: game.selectedQuestion,
        correctPlayerIds: [playerId],
        answers: [playerAnswer],
        isCorrected: false,
      };

      // Reset player canAnswer for next question
      game.players.forEach(p => p.canAnswer = true);
      
      // Set current player to the one who got it right
      game.currentPlayerId = playerId;
      
      // Reset question state
      game.currentAnsweringPlayerId = null;
      game.attemptedPlayerIds = new Set();
      game.answeredThisQuestion = new Set();
      game.wrongThisQuestion = new Set();
      game.currentClueMessageId = null;
      
      // Always set status to selecting, let dismiss handle round transition
      game.status = 'selecting';
      console.log(`[GameManager] Status -> selecting (correct answer)`);

      game.selectedQuestion = null;
      game.selectedCategoryIndex = null;
      game.selectedQuestionIndex = null;

      return { isCorrect: true, player, allAttempted: false };
    } else {
      // Wrong answer
      const points = game.selectedQuestion.isDailyDouble
        ? ((game.selectedQuestion as any).wager || game.selectedQuestion.value)
        : game.selectedQuestion.value;
      
      player.score -= points;
      game.wrongThisQuestion.add(playerId);
      console.log(`[GameManager] Wrong! ${player.username} loses $${points}. Score: ${player.score}`);
      
      // For Daily Double, wrong answer ends the question
      if (game.selectedQuestion.isDailyDouble) {
        game.selectedQuestion.isPlayed = true;
        
        game.lastAnsweredQuestion = {
          question: game.selectedQuestion,
          correctPlayerIds: [],
          answers: [playerAnswer],
          isCorrected: false,
        };

        game.players.forEach(p => p.canAnswer = true);
        
        game.currentAnsweringPlayerId = null;
        game.status = 'selecting';
        game.selectedQuestion = null;
        game.selectedCategoryIndex = null;
        game.selectedQuestionIndex = null;
        console.log(`[GameManager] Status -> selecting (daily double wrong)`);

        return { isCorrect: false, player, allAttempted: true };
      }

      // Non-daily-double: release turn, check if all attempted
      game.currentAnsweringPlayerId = null;
      const allAttempted = game.attemptedPlayerIds.size >= game.players.length;
      
      if (allAttempted) {
        // End question - everyone tried and failed
        game.selectedQuestion.isPlayed = true;
        game.lastAnsweredQuestion = {
          question: game.selectedQuestion,
          correctPlayerIds: [],
          answers: [playerAnswer],
          isCorrected: false,
        };
        game.status = 'selecting';
        game.selectedQuestion = null;
        game.selectedCategoryIndex = null;
        game.selectedQuestionIndex = null;
        console.log(`[GameManager] Status -> selecting (all attempted wrong)`);
      } else {
        game.status = 'reading';
        console.log(`[GameManager] Status -> reading (wrong answer, more players)`);
      }

      return { isCorrect: false, player, allAttempted };
    }
  }

  submitFinalJeopardyAnswer(game: GameState, playerId: string, answer: string): void {
    console.log(`[GameManager] Final Jeopardy answer from ${playerId}: "${answer}"`);
    const player = game.players.find(p => p.userId === playerId);
    if (!player) {
      throw new Error('Player not found');
    }

    if (game.status !== 'final_jeopardy_answering') {
      throw new Error('Not in Final Jeopardy answering phase');
    }

    player.finalJeopardyAnswer = answer;

    // Check if all players have answered
    const allAnswered = game.players.every(p => p.finalJeopardyAnswer !== null);
    if (allAnswered) {
      console.log(`[GameManager] All Final Jeopardy answers in`);
      this.scoreFinalJeopardy(game);
    }
  }

  scoreFinalJeopardy(game: GameState): void {
    console.log(`[GameManager] Scoring Final Jeopardy`);
    const finalJeopardy = game.board.finalJeopardy;
    
    for (const player of game.players) {
      if (player.finalJeopardyAnswer && player.finalJeopardyWager !== null) {
        const check = checkAnswer(player.finalJeopardyAnswer, finalJeopardy.acceptableAnswers);
        
        if (check.isCorrect) {
          player.score += player.finalJeopardyWager;
          console.log(`[GameManager] ${player.username} correct! +$${player.finalJeopardyWager}. Score: ${player.score}`);
        } else {
          player.score -= player.finalJeopardyWager;
          console.log(`[GameManager] ${player.username} wrong! -$${player.finalJeopardyWager}. Score: ${player.score}`);
        }
      }
    }

    game.status = 'ended';
    console.log(`[GameManager] Game ended`);
  }

  correctAnswer(game: GameState, messageId: string): { success: boolean; player: Player | null } {
    console.log(`[GameManager] Correcting answer for message ${messageId}`);
    if (!game.lastAnsweredQuestion) {
      return { success: false, player: null };
    }

    if (game.lastAnsweredQuestion.isCorrected) {
      return { success: false, player: null };
    }

    const answer = game.lastAnsweredQuestion.answers.find(a => a.messageId === messageId);
    if (!answer) {
      return { success: false, player: null };
    }

    // Check if this answer was already marked correct
    if (game.lastAnsweredQuestion.correctPlayerIds.includes(answer.playerId)) {
      return { success: false, player: null };
    }

    const player = game.players.find(p => p.userId === answer.playerId);
    if (!player) {
      return { success: false, player: null };
    }

    // Validate the answer
    const check = checkAnswer(answer.answer, game.lastAnsweredQuestion.question.acceptableAnswers);
    if (!check.isCorrect) {
      return { success: false, player: null };
    }

    // Award points
    const points = game.lastAnsweredQuestion.question.isDailyDouble
      ? ((game.lastAnsweredQuestion.question as any).wager || game.lastAnsweredQuestion.question.value)
      : game.lastAnsweredQuestion.question.value;
    
    player.score += points;
    game.lastAnsweredQuestion.correctPlayerIds.push(answer.playerId);
    game.lastAnsweredQuestion.isCorrected = true;
    console.log(`[GameManager] Corrected! ${player.username} gains $${points}. Score: ${player.score}`);

    return { success: true, player };
  }

  private generateBoard(): GameBoard {
    console.log('[GameManager] Starting board generation...');
    const startTime = Date.now();
    
    const jeopardyCategories = loadRandomCategories('jeopardy', 6);
    const doubleJeopardyCategories = loadRandomCategories('double_jeopardy', 6);
    const finalJeopardy = loadRandomFinalJeopardy();
    
    if (jeopardyCategories.length < 6 || doubleJeopardyCategories.length < 6 || !finalJeopardy) {
      throw new Error('Not enough categories available. Please run the scraper first.');
    }

    // Assign Daily Doubles
    this.assignDailyDoubles(jeopardyCategories, 1);
    this.assignDailyDoubles(doubleJeopardyCategories, 2);

    const duration = Date.now() - startTime;
    console.log(`[GameManager] Board generation complete (${duration}ms)`);

    return {
      id: `game_${Date.now()}`,
      jeopardyRound: jeopardyCategories,
      doubleJeopardyRound: doubleJeopardyCategories,
      finalJeopardy,
    };
  }

  private assignDailyDoubles(categories: Category[], count: number): void {
    const allQuestions: { categoryIndex: number; questionIndex: number }[] = [];

    for (let i = 0; i < categories.length; i++) {
      for (let j = 0; j < categories[i].questions.length; j++) {
        categories[i].questions[j].isDailyDouble = false;
        allQuestions.push({ categoryIndex: i, questionIndex: j });
      }
    }

    // Shuffle and pick
    const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, count);

    for (const { categoryIndex, questionIndex } of selected) {
      categories[categoryIndex].questions[questionIndex].isDailyDouble = true;
    }
  }

  private isRoundComplete(game: GameState): boolean {
    const categories = game.round === 'jeopardy'
      ? game.board.jeopardyRound
      : game.board.doubleJeopardyRound;

    return categories.every(category => 
      category.questions.every(question => question.isPlayed)
    );
  }

  checkAndTransitionRound(game: GameState): boolean {
    if (game.status === 'selecting' && this.isRoundComplete(game)) {
      if (game.round === 'jeopardy') {
        this.transitionToDoubleJeopardy(game);
      } else if (game.round === 'double_jeopardy') {
        this.transitionToFinalJeopardy(game);
      }
      return true;
    }
    return false;
  }

  private transitionToDoubleJeopardy(game: GameState): void {
    game.round = 'double_jeopardy';
    game.status = 'selecting';
    game.selectedQuestion = null;
    game.selectedCategoryIndex = null;
    game.selectedQuestionIndex = null;
    game.answeredThisQuestion = new Set();
    game.wrongThisQuestion = new Set();
    game.attemptedPlayerIds = new Set();
    game.currentAnsweringPlayerId = null;
    game.currentClueMessageId = null;
    game.players.forEach(p => {
      p.canAnswer = true;
    });
  }

  private transitionToFinalJeopardy(game: GameState): void {
    game.round = 'final_jeopardy';
    game.status = 'final_jeopardy_wager';
    game.selectedQuestion = null;
    game.selectedCategoryIndex = null;
    game.selectedQuestionIndex = null;
    game.attemptedPlayerIds = new Set();
    game.currentAnsweringPlayerId = null;
    game.currentClueMessageId = null;
    
    // Reset Final Jeopardy state
    game.players.forEach(p => {
      p.finalJeopardyWager = null;
      p.finalJeopardyAnswer = null;
    });
  }

  getLeaderboard(game: GameState): Player[] {
    return [...game.players].sort((a, b) => b.score - a.score);
  }
}
