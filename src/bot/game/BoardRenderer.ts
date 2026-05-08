import { EmbedBuilder } from 'discord.js';
import { GameState, Category, Question, Player } from '../../shared/types';

export function renderBoard(game: GameState): EmbedBuilder {
  const categories = game.round === 'jeopardy'
    ? game.board.jeopardyRound
    : game.board.doubleJeopardyRound;

  const roundName = game.round === 'jeopardy' ? 'Jeopardy!' : 'Double Jeopardy!';

  const embed = new EmbedBuilder()
    .setTitle(`🎯 ${roundName}`)
    .setColor(game.round === 'jeopardy' ? 0x0000FF : 0xFFD700)
    .setDescription('Select a category and value!');

  // Create board grid
  let boardText = '';
  
  // Category names
  const categoryNames = categories.map((cat, i) => `${i + 1}. ${cat.name}`).join('\n');
  embed.addFields({ name: 'Categories', value: categoryNames, inline: false });

  // Values for each category
  for (let valueIndex = 0; valueIndex < 5; valueIndex++) {
    let rowText = '';
    for (let catIndex = 0; catIndex < categories.length; catIndex++) {
      const question = categories[catIndex].questions[valueIndex];
      if (question.isPlayed) {
        rowText += '  ~~$' + question.value + '~~  ';
      } else {
        rowText += '  $' + question.value + '  ';
      }
    }
    embed.addFields({ name: `Row ${valueIndex + 1}`, value: '```' + rowText + '```', inline: false });
  }

  // Current player
  if (game.currentPlayerId) {
    const currentPlayer = game.players.find(p => p.userId === game.currentPlayerId);
    if (currentPlayer) {
      embed.addFields({ name: 'Current Player', value: `<@${currentPlayer.userId}> ($${currentPlayer.score})`, inline: false });
    }
  }

  return embed;
}

export function renderQuestion(question: Question, categoryName: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`📝 ${categoryName} - $${question.value}`)
    .setDescription(question.clue)
    .setColor(question.isDailyDouble ? 0xFF0000 : 0x00FF00);

  if (question.isDailyDouble) {
    embed.addFields({ name: '⚠️ DAILY DOUBLE!', value: 'Place your wager!', inline: false });
  }

  return embed;
}

export function renderScores(players: Player[]): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('📊 Current Scores')
    .setColor(0x0099FF);

  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  
  for (let i = 0; i < sortedPlayers.length; i++) {
    const player = sortedPlayers[i];
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '•';
    embed.addFields({
      name: `${medal} ${player.username}`,
      value: `$${player.score}`,
      inline: true,
    });
  }

  return embed;
}

export function renderFinalJeopardyCategory(category: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('🏁 Final Jeopardy!')
    .setDescription(`Category: **${category}**`)
    .setColor(0x800080)
    .addFields({
      name: 'Instructions',
      value: 'DM me your wager! You can wager up to your current score.',
      inline: false,
    });
}

export function renderFinalJeopardyClue(clue: string, category: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`🏁 Final Jeopardy! - ${category}`)
    .setDescription(clue)
    .setColor(0x800080)
    .addFields({
      name: 'Instructions',
      value: 'DM me your answer! Remember to phrase it as a question.',
      inline: false,
    });
}

export function renderFinalResults(players: Player[]): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('🎉 Game Over!')
    .setColor(0xFFD700);

  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  
  for (let i = 0; i < sortedPlayers.length; i++) {
    const player = sortedPlayers[i];
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '•';
    embed.addFields({
      name: `${medal} ${player.username}`,
      value: `$${player.score}`,
      inline: false,
    });
  }

  const winner = sortedPlayers[0];
  embed.setDescription(`🏆 Winner: **${winner.username}** with $${winner.score}!`);

  return embed;
}

export function renderAnswerReveal(question: Question, correctPlayerIds: string[]): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('✅ Answer')
    .setDescription(`The correct answer was: **${question.answer}**`)
    .setColor(0x00FF00);

  if (correctPlayerIds.length > 0) {
    const playersText = correctPlayerIds.map(id => `<@${id}>`).join(', ');
    embed.addFields({
      name: 'Correct Players',
      value: playersText,
      inline: false,
    });
  } else {
    embed.addFields({
      name: 'Result',
      value: 'No one got it right!',
      inline: false,
    });
  }

  return embed;
}
