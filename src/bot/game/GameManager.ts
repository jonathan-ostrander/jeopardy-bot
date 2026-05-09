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
import { loadCategories, loadFinalJeopardyQuestions } from '../../scraper/storage';
import { checkAnswer, validateAnswerFormat } from './AnswerValidator';

export class GameManager {
  private games: Map<string, GameState> = new Map();

  createGame(channelId: string, hostId: string): GameState {
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
    };

    this.games.set(channelId, game);
    return game;
  }

  getGame(channelId: string): GameState | undefined {
    return this.games.get(channelId);
  }

  endGame(channelId: string): void {
    this.games.delete(channelId);
  }

  addPlayer(game: GameState, userId: string, username: string): Player {
    const existingPlayer = game.players.find(p => p.userId === userId);
    if (existingPlayer) {
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
    return player;
  }

  startGame(game: GameState, force = false): void {
    if (!force && game.players.length < 2) {
      throw new Error('Need at least 2 players to start');
    }

    game.status = 'selecting';
    // Randomly select first player
    game.currentPlayerId = game.players[Math.floor(Math.random() * game.players.length)].userId;
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

    game.selectedQuestion = question;
    game.selectedCategoryIndex = categoryIndex;
    game.selectedQuestionIndex = questionIndex;
    game.answeredThisQuestion = new Set();
    game.wrongThisQuestion = new Set();

    if (question.isDailyDouble) {
      game.status = 'daily_double_wager';
    } else {
      game.status = 'reading';
    }

    return question;
  }

  submitWager(game: GameState, playerId: string, wager: number): void {
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
    } else if (game.status === 'final_jeopardy_wager') {
      player.finalJeopardyWager = wager;
      
      // Check if all players have wagered
      const allWagered = game.players.every(p => p.finalJeopardyWager !== null);
      if (allWagered) {
        game.status = 'final_jeopardy_answering';
      }
    }
  }

  submitAnswer(game: GameState, playerId: string, answer: string, messageId: string): { isCorrect: boolean; player: Player | null } {
    const player = game.players.find(p => p.userId === playerId);
    if (!player) {
      throw new Error('Player not found');
    }

    if (!game.selectedQuestion) {
      throw new Error('No question selected');
    }

    // Check if player already answered this question
    if (game.answeredThisQuestion.has(playerId)) {
      return { isCorrect: false, player: null };
    }

    // Check if player got a previous question wrong in this round
    if (!player.canAnswer) {
      return { isCorrect: false, player: null };
    }

    // For Daily Double, only current player can answer
    if (game.selectedQuestion.isDailyDouble && game.currentPlayerId !== playerId) {
      return { isCorrect: false, player: null };
    }

    // Validate answer format
    if (!validateAnswerFormat(answer)) {
      return { isCorrect: false, player: null };
    }

    game.answeredThisQuestion.add(playerId);

    const check = checkAnswer(answer, game.selectedQuestion.acceptableAnswers);
    
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
      
      // Check if round is complete
      if (this.isRoundComplete(game)) {
        if (game.round === 'jeopardy') {
          this.transitionToDoubleJeopardy(game);
        } else if (game.round === 'double_jeopardy') {
          this.transitionToFinalJeopardy(game);
        }
      } else {
        game.status = 'selecting';
      }

      game.selectedQuestion = null;
      game.selectedCategoryIndex = null;
      game.selectedQuestionIndex = null;

      return { isCorrect: true, player };
    } else {
      // Wrong answer
      const points = game.selectedQuestion.isDailyDouble
        ? ((game.selectedQuestion as any).wager || game.selectedQuestion.value)
        : game.selectedQuestion.value;
      
      player.score -= points;
      game.wrongThisQuestion.add(playerId);
      
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
        
        if (this.isRoundComplete(game)) {
          if (game.round === 'jeopardy') {
            this.transitionToDoubleJeopardy(game);
          } else if (game.round === 'double_jeopardy') {
            this.transitionToFinalJeopardy(game);
          }
        } else {
          game.status = 'selecting';
        }

        game.selectedQuestion = null;
        game.selectedCategoryIndex = null;
        game.selectedQuestionIndex = null;
      }

      return { isCorrect: false, player };
    }
  }

  submitFinalJeopardyAnswer(game: GameState, playerId: string, answer: string): void {
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
      this.scoreFinalJeopardy(game);
    }
  }

  scoreFinalJeopardy(game: GameState): void {
    const finalJeopardy = game.board.finalJeopardy;
    
    for (const player of game.players) {
      if (player.finalJeopardyAnswer && player.finalJeopardyWager !== null) {
        const check = checkAnswer(player.finalJeopardyAnswer, finalJeopardy.acceptableAnswers);
        
        if (check.isCorrect) {
          player.score += player.finalJeopardyWager;
        } else {
          player.score -= player.finalJeopardyWager;
        }
      }
    }

    game.status = 'ended';
  }

  correctAnswer(game: GameState, messageId: string): { success: boolean; player: Player | null } {
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

    return { success: true, player };
  }

  private generateBoard(): GameBoard {
    const jeopardyCategories = this.getRandomCategories('jeopardy', 6);
    const doubleJeopardyCategories = this.getRandomCategories('double_jeopardy', 6);
    const finalJeopardyQuestions = loadFinalJeopardyQuestions();
    
    if (jeopardyCategories.length < 6 || doubleJeopardyCategories.length < 6 || finalJeopardyQuestions.length === 0) {
      throw new Error('Not enough categories available. Please run the scraper first.');
    }

    // Assign Daily Doubles
    this.assignDailyDoubles(jeopardyCategories, 1);
    this.assignDailyDoubles(doubleJeopardyCategories, 2);

    const finalJeopardy = finalJeopardyQuestions[Math.floor(Math.random() * finalJeopardyQuestions.length)];

    return {
      id: `game_${Date.now()}`,
      jeopardyRound: jeopardyCategories,
      doubleJeopardyRound: doubleJeopardyCategories,
      finalJeopardy,
    };
  }

  private getRandomCategories(round: 'jeopardy' | 'double_jeopardy', count: number): Category[] {
    const categories = loadCategories(round);
    
    if (categories.length < count) {
      return categories;
    }

    // Shuffle and pick
    const shuffled = [...categories].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  private assignDailyDoubles(categories: Category[], count: number): void {
    const allQuestions: { categoryIndex: number; questionIndex: number }[] = [];
    
    for (let i = 0; i < categories.length; i++) {
      for (let j = 0; j < categories[i].questions.length; j++) {
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

  private transitionToDoubleJeopardy(game: GameState): void {
    game.round = 'double_jeopardy';
    game.status = 'selecting';
    game.selectedQuestion = null;
    game.selectedCategoryIndex = null;
    game.selectedQuestionIndex = null;
    game.answeredThisQuestion = new Set();
    game.wrongThisQuestion = new Set();
    game.players.forEach(p => {
      p.canAnswer = true;
      p.score = p.score * 2; // Double scores? No, that's not right
    });
  }

  private transitionToFinalJeopardy(game: GameState): void {
    game.round = 'final_jeopardy';
    game.status = 'final_jeopardy_wager';
    game.selectedQuestion = null;
    game.selectedCategoryIndex = null;
    game.selectedQuestionIndex = null;
    
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
