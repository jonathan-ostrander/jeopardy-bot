import { 
  Client, 
  GatewayIntentBits, 
  Events, 
  SlashCommandBuilder, 
  REST, 
  Routes,
  PermissionFlagsBits,
  EmbedBuilder,
  AttachmentBuilder,
  Message,
  ThreadChannel,
  TextChannel,
  DMChannel,
  ReactionEmoji,
  MessageReaction,
  User,
  MessageFlags,
  Guild
} from 'discord.js';
import { config } from 'dotenv';
import { GameManager } from './game/GameManager';
import { GameState, Question } from '../shared/types';
import { 
  renderScores, 
  renderFinalJeopardyCategory,
  renderFinalJeopardyClue,
  renderFinalResults,
  renderAnswerReveal
} from './game/BoardRenderer';
import { generateBoardImage, generateClueImage } from './game/ImageGenerator';
import { validateAnswerFormat } from './game/AnswerValidator';

async function createBoardAttachment(game: GameState): Promise<AttachmentBuilder> {
  const categories = game.round === 'jeopardy' ? game.board.jeopardyRound : game.board.doubleJeopardyRound;
  const currentPlayer = game.currentPlayerId ? game.players.find(p => p.userId === game.currentPlayerId) : undefined;
  const boardBuffer = await generateBoardImage(categories, game.round, currentPlayer?.username);
  return new AttachmentBuilder(boardBuffer, { name: 'board.jpg' });
}

async function createClueAttachment(question: Question, categoryName: string): Promise<AttachmentBuilder> {
  const clueBuffer = await generateClueImage(question.clue, categoryName, question.value, question.isDailyDouble);
  return new AttachmentBuilder(clueBuffer, { name: 'clue.jpg' });
}

const STANDARD_EMOJIS = ['🎯', '🎲', '🏆', '⭐', '🔔', '🎪', '🎨', '🎭', '🎸', '🎺', '🎻', '🎮', '🎰', '🎳', '🎱', '✨', '💫', '🔥', '💥', '⚡', '🎉', '🎊', '🎈', '🎁', '🎀', '🎗️', '🎖️', '🏅', '🥇', '🥈', '🥉', '🏆', '🏵️', '🎫', '🎟️', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷'];

function getRandomEmoji(guild: Guild | null): string {
  if (guild) {
    const customEmojis = Array.from(guild.emojis.cache.values());
    if (customEmojis.length > 0) {
      const random = customEmojis[Math.floor(Math.random() * customEmojis.length)];
      return random.toString();
    }
  }
  return STANDARD_EMOJIS[Math.floor(Math.random() * STANDARD_EMOJIS.length)];
}

const answerTimeouts = new Map<string, NodeJS.Timeout>();

async function postBuzzerMessage(game: GameState, channel: TextChannel | ThreadChannel) {
  const emoji = getRandomEmoji(channel.guild);
  const buzzMessage = await channel.send(`React with ${emoji} to buzz in and answer!`);
  game.currentClueMessageId = buzzMessage.id;
  game.status = 'reading';

  // Start 15-second buzz-in timeout
  const existingTimeout = answerTimeouts.get(channel.id);
  if (existingTimeout) clearTimeout(existingTimeout);

  const timeoutId = setTimeout(async () => {
    if (game.status === 'reading' && game.selectedQuestion) {
      console.log(`[Bot] Buzz-in timeout - no one buzzed in`);
      await channel.send(`⏰ Time's up! No one buzzed in.`);
      await revealAnswerAndReset(game, channel);
    }
    answerTimeouts.delete(channel.id);
  }, 15000);

  answerTimeouts.set(channel.id, timeoutId);
}

async function revealAnswerAndReset(game: GameState, channel: TextChannel | ThreadChannel) {
  if (!game.selectedQuestion) return;
  
  game.selectedQuestion.isPlayed = true;
  
  const revealEmbed = renderAnswerReveal(game.selectedQuestion, []);
  await channel.send({ embeds: [revealEmbed] });
  await channel.send(`No one got it right! The answer was: **${game.selectedQuestion.answer}**`);
  
  game.lastAnsweredQuestion = {
    question: game.selectedQuestion,
    correctPlayerIds: [],
    answers: [],
    isCorrected: false,
  };
  
  game.selectedQuestion = null;
  game.selectedCategoryIndex = null;
  game.selectedQuestionIndex = null;
  game.currentAnsweringPlayerId = null;
  game.attemptedPlayerIds = new Set();
  game.answeredThisQuestion = new Set();
  game.wrongThisQuestion = new Set();
  game.currentClueMessageId = null;
  
  // Check round complete
  const categories = game.round === 'jeopardy'
    ? game.board.jeopardyRound
    : game.board.doubleJeopardyRound;
  
  const isComplete = categories.every(cat => cat.questions.every(q => q.isPlayed));
  
  if (isComplete) {
    if (game.round === 'jeopardy') {
      game.round = 'double_jeopardy';
      await channel.send('**Double Jeopardy!**');
    } else {
      game.round = 'final_jeopardy';
      game.status = 'final_jeopardy_wager';
      const finalEmbed = renderFinalJeopardyCategory(game.board.finalJeopardy.category);
      await channel.send({ embeds: [finalEmbed] });
      await channel.send('DM me your wagers!');
      return;
    }
  }
  
  game.status = 'selecting';
  const boardAttachment = await createBoardAttachment(game);
  await channel.send({ files: [boardAttachment] });
}

config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

const gameManager = new GameManager();

// Command definitions
const commands = [
  new SlashCommandBuilder()
    .setName('jeopardy')
    .setDescription('Start a new Jeopardy game')
    .addSubcommand(subcommand =>
      subcommand
        .setName('new')
        .setDescription('Create a new game')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('join')
        .setDescription('Join the current game')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('board')
        .setDescription('Show the current board')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('scores')
        .setDescription('Show current scores')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('begin')
        .setDescription('Begin the game (host only)')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('end')
        .setDescription('End the current game')
    ),
  new SlashCommandBuilder()
    .setName('select')
    .setDescription('Select a question')
    .addIntegerOption(option =>
      option
        .setName('category')
        .setDescription('Category number (1-6)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(6)
    )
    .addIntegerOption(option =>
      option
        .setName('value')
        .setDescription('Value ($200, $400, $600, $800, $1000)')
        .setRequired(true)
        .addChoices(
          { name: '$200', value: 200 },
          { name: '$400', value: 400 },
          { name: '$600', value: 600 },
          { name: '$800', value: 800 },
          { name: '$1000', value: 1000 }
        )
    ),
  new SlashCommandBuilder()
    .setName('wager')
    .setDescription('Place your wager')
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription('Wager amount')
        .setRequired(true)
        .setMinValue(0)
    ),
];

// Register commands
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

async function registerCommands() {
  try {
    console.log('Registering slash commands...');
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID!),
      { body: commands.map(cmd => cmd.toJSON()) }
    );
    console.log('Slash commands registered successfully!');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
}

// Event handlers
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, options } = interaction;
  const channelId = interaction.channelId;
  const userId = interaction.user.id;
  const username = interaction.user.username;

  const subcommand = commandName === 'jeopardy' && options.getSubcommand ? options.getSubcommand() : '';
  console.log(`[Bot] Command: ${commandName}${subcommand ? ' ' + subcommand : ''} from ${username} (${userId}) in channel ${channelId}`);

  try {
    if (commandName === 'jeopardy') {
      const subcommand = options.getSubcommand();

      if (subcommand === 'new') {
        console.log(`[Bot] Processing /jeopardy new`);
        // Check if game already exists
        const existingGame = gameManager.getGame(channelId);
        if (existingGame) {
          console.log(`[Bot] Game already exists in channel ${channelId}`);
          await interaction.reply({ content: 'A game is already in progress!', flags: [MessageFlags.Ephemeral] });
          return;
        }

        // Create game
        const game = gameManager.createGame(channelId, userId);
        
        // Create thread
        const channel = await client.channels.fetch(channelId);
        if (channel instanceof TextChannel) {
          const thread = await channel.threads.create({
            name: `Jeopardy Game - ${new Date().toLocaleDateString()}`,
            autoArchiveDuration: 60,
          });
          game.threadId = thread.id;
          console.log(`[Bot] Created thread ${thread.id}`);
        }

        const embed = new EmbedBuilder()
          .setTitle('🎯 Jeopardy Game Starting!')
          .setDescription('Use `/jeopardy join` to join the game!')
          .setColor(0x0000FF)
          .addFields({
            name: 'Host',
            value: `<@${userId}>`,
            inline: false,
          });

        await interaction.reply({ embeds: [embed] });
        console.log(`[Bot] Game created successfully`);

      } else if (subcommand === 'join') {
        console.log(`[Bot] Processing /jeopardy join`);
        const game = gameManager.getGame(channelId);
        if (!game) {
          await interaction.reply({ content: 'No game in progress! Create one with `/jeopardy new`', flags: [MessageFlags.Ephemeral] });
          return;
        }

        if (game.status !== 'waiting') {
          await interaction.reply({ content: 'Game has already started!', flags: [MessageFlags.Ephemeral] });
          return;
        }

        const player = gameManager.addPlayer(game, userId, username);
        await interaction.reply({ content: `<@${userId}> has joined the game! (${game.players.length} players)` });

        // Auto-start if 3+ players
        if (game.players.length >= 3) {
          console.log(`[Bot] Auto-starting game with ${game.players.length} players`);
          gameManager.startGame(game);
          const boardAttachment = await createBoardAttachment(game);
          await interaction.followUp({ files: [boardAttachment] });
        }

      } else if (subcommand === 'board') {
        console.log(`[Bot] Processing /jeopardy board`);
        const game = gameManager.getGame(channelId);
        if (!game) {
          await interaction.reply({ content: 'No game in progress!', flags: [MessageFlags.Ephemeral] });
          return;
        }

        const boardAttachment = await createBoardAttachment(game);
        await interaction.reply({ files: [boardAttachment] });

      } else if (subcommand === 'scores') {
        console.log(`[Bot] Processing /jeopardy scores`);
        const game = gameManager.getGame(channelId);
        if (!game) {
          await interaction.reply({ content: 'No game in progress!', flags: [MessageFlags.Ephemeral] });
          return;
        }

        const scoresEmbed = renderScores(game.players);
        await interaction.reply({ embeds: [scoresEmbed] });

      } else if (subcommand === 'begin') {
        console.log(`[Bot] Processing /jeopardy begin`);
        const game = gameManager.getGame(channelId);
        if (!game) {
          await interaction.reply({ content: 'No game in progress!', flags: [MessageFlags.Ephemeral] });
          return;
        }

        if (game.hostId !== userId) {
          await interaction.reply({ content: 'Only the host can begin the game!', flags: [MessageFlags.Ephemeral] });
          return;
        }

        if (game.status !== 'waiting') {
          await interaction.reply({ content: 'Game has already started!', flags: [MessageFlags.Ephemeral] });
          return;
        }

        // Auto-add host if they haven't joined
        const hostPlayer = game.players.find(p => p.userId === userId);
        if (!hostPlayer) {
          gameManager.addPlayer(game, userId, username);
        }

        gameManager.startGame(game, true);
        const boardAttachment = await createBoardAttachment(game);
        await interaction.reply({ files: [boardAttachment] });

      } else if (subcommand === 'end') {
        console.log(`[Bot] Processing /jeopardy end`);
        const game = gameManager.getGame(channelId);
        if (!game) {
          await interaction.reply({ content: 'No game in progress!', flags: [MessageFlags.Ephemeral] });
          return;
        }

        gameManager.endGame(channelId);
        await interaction.reply({ content: 'Game ended!' });
      }

    } else if (commandName === 'select') {
      console.log(`[Bot] Processing /select`);
      const game = gameManager.getGame(channelId);
      if (!game) {
        await interaction.reply({ content: 'No game in progress!', flags: [MessageFlags.Ephemeral] });
        return;
      }

      if (game.status !== 'selecting') {
        console.log(`[Bot] Rejecting select: game status is ${game.status}`);
        await interaction.reply({ content: 'Cannot select a question right now!', flags: [MessageFlags.Ephemeral] });
        return;
      }

      if (game.currentPlayerId !== userId) {
        console.log(`[Bot] Rejecting select: not ${userId}'s turn (current: ${game.currentPlayerId})`);
        await interaction.reply({ content: 'It\'s not your turn to select!', flags: [MessageFlags.Ephemeral] });
        return;
      }

      const categoryIndex = options.getInteger('category')! - 1;
      const value = options.getInteger('value')!;

      try {
        const question = gameManager.selectQuestion(game, categoryIndex, value / 200 - 1);
        const category = game.round === 'jeopardy'
          ? game.board.jeopardyRound[categoryIndex]
          : game.board.doubleJeopardyRound[categoryIndex];

        const clueAttachment = await createClueAttachment(question, category.name);
        await interaction.reply({ files: [clueAttachment] });
        console.log(`[Bot] Posted clue for ${category.name} $${question.value}`);

        // If not daily double, post buzzer message
        if (!question.isDailyDouble) {
          const channel = await client.channels.fetch(channelId);
          if (channel instanceof TextChannel || channel instanceof ThreadChannel) {
            await postBuzzerMessage(game, channel);
          }
        }

      } catch (error) {
        await interaction.reply({ content: `Error: ${(error as Error).message}`, flags: [MessageFlags.Ephemeral] });
      }

    } else if (commandName === 'wager') {
      const game = gameManager.getGame(channelId);
      if (!game) {
        await interaction.reply({ content: 'No game in progress!', flags: [MessageFlags.Ephemeral] });
        return;
      }

      if (game.status !== 'daily_double_wager' && game.status !== 'final_jeopardy_wager') {
        await interaction.reply({ content: 'Cannot place a wager right now!', flags: [MessageFlags.Ephemeral] });
        return;
      }

      const amount = options.getInteger('amount')!;

      try {
        gameManager.submitWager(game, userId, amount);
        await interaction.reply({ content: `Wager of $${amount} placed!`, flags: [MessageFlags.Ephemeral] });

        if (game.status === 'reading' && game.selectedQuestion) {
          // Daily double - show the question
          const category = game.round === 'jeopardy'
            ? game.board.jeopardyRound[game.selectedCategoryIndex!]
            : game.board.doubleJeopardyRound[game.selectedCategoryIndex!];
          
          const clueAttachment = await createClueAttachment(game.selectedQuestion, category.name);
          await interaction.followUp({ files: [clueAttachment] });

          setTimeout(async () => {
            game.status = 'answering';
            game.currentAnsweringPlayerId = game.currentPlayerId;
            if (game.currentPlayerId) {
              game.attemptedPlayerIds.add(game.currentPlayerId);
            }
            await interaction.followUp({ content: '⏰ You have 15 seconds to answer! Type your answer in the chat.' });
            
            const timeoutId = setTimeout(async () => {
              if (game.status === 'answering' && game.selectedQuestion) {
                const timedOutPlayerId = game.currentAnsweringPlayerId;
                const result = gameManager.handleAnswerTimeout(game);
                
                const channel = await client.channels.fetch(channelId);
                if (channel instanceof TextChannel || channel instanceof ThreadChannel) {
                  if (timedOutPlayerId) {
                    const points = game.selectedQuestion?.value || 0;
                    await channel.send(`⏰ Time's up! <@${timedOutPlayerId}> loses $${points}.`);
                  }
                  
                  await revealAnswerAndReset(game, channel);
                }
              }
              answerTimeouts.delete(channelId);
            }, 15000);
            answerTimeouts.set(channelId, timeoutId);
          }, 3000);
        } else if (game.status === 'final_jeopardy_answering') {
          // All wagers placed - show clue
          const clueEmbed = renderFinalJeopardyClue(game.board.finalJeopardy.clue, game.board.finalJeopardy.category);
          await interaction.followUp({ embeds: [clueEmbed] });
          await interaction.followUp({ content: 'DM me your answers! You have 30 seconds.' });

          setTimeout(async () => {
            gameManager.scoreFinalJeopardy(game);
            
            const resultsEmbed = renderFinalResults(game.players);
            await interaction.followUp({ embeds: [resultsEmbed] });
          }, 30000);
        }

      } catch (error) {
        await interaction.reply({ content: `Error: ${(error as Error).message}`, flags: [MessageFlags.Ephemeral] });
      }
    }

  } catch (error) {
    console.error('Error handling interaction:', error);
    if (!interaction.replied) {
      await interaction.reply({ content: 'An error occurred!', flags: [MessageFlags.Ephemeral] });
    }
  }
});

// Handle text messages for answers
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  // Handle DMs for Final Jeopardy
  if (message.channel instanceof DMChannel) {
    const games = Array.from(gameManager['games'].values());
    const game = games.find(g => 
      g.players.some(p => p.userId === message.author.id)
    );

    if (!game) return;

    const player = game.players.find(p => p.userId === message.author.id);
    if (!player) return;

    if (game.status === 'final_jeopardy_wager' && player.finalJeopardyWager === null) {
      // This is a wager
      const wager = parseInt(message.content, 10);
      if (isNaN(wager) || wager < 0) {
        await message.reply('Please enter a valid wager amount!');
        return;
      }

      try {
        gameManager.submitWager(game, player.userId, wager);
        await message.reply(`Wager of $${wager} recorded!`);

        // Check if all wagers are in
        const allWagered = game.players.every(p => p.finalJeopardyWager !== null);
        if (allWagered) {
          // Send clue to all players
          for (const p of game.players) {
            const user = await client.users.fetch(p.userId);
            const clueEmbed = renderFinalJeopardyClue(game.board.finalJeopardy.clue, game.board.finalJeopardy.category);
            await user.send({ embeds: [clueEmbed] });
            await user.send('You have 30 seconds to send your answer!');
          }

          // Announce in channel
          const channel = await client.channels.fetch(game.channelId);
          if (channel instanceof TextChannel) {
            await channel.send('All wagers are in! Final Jeopardy clue has been sent to all players via DM.');
          }

          // Set timer
          setTimeout(async () => {
            gameManager.scoreFinalJeopardy(game);
            
            const channel = await client.channels.fetch(game.channelId);
            if (channel instanceof TextChannel) {
              const resultsEmbed = renderFinalResults(game.players);
              await channel.send({ embeds: [resultsEmbed] });
            }
          }, 30000);
        }
      } catch (error) {
        await message.reply(`Error: ${(error as Error).message}`);
      }

    } else if (game.status === 'final_jeopardy_answering' && player.finalJeopardyAnswer === null) {
      // This is an answer
      if (!validateAnswerFormat(message.content)) {
        await message.reply('Please phrase your answer as a question! (e.g., "What is...?")');
        return;
      }

      gameManager.submitFinalJeopardyAnswer(game, player.userId, message.content);
      await message.reply('Answer recorded!');

      // Check if all players have answered
      const allAnswered = game.players.every(p => p.finalJeopardyAnswer !== null);
      if (allAnswered) {
        gameManager.scoreFinalJeopardy(game);
        
        const channel = await client.channels.fetch(game.channelId);
        if (channel instanceof TextChannel) {
          const resultsEmbed = renderFinalResults(game.players);
          await channel.send({ embeds: [resultsEmbed] });
        }
      }
    }

    return;
  }

  // Handle answers in game thread
  const game = gameManager.getGame(message.channelId);
  if (!game) return;

  if (game.status !== 'answering') return;
  if (game.currentAnsweringPlayerId !== message.author.id) return;

  console.log(`[Bot] Answer from ${message.author.username}: "${message.content}"`);

  if (!validateAnswerFormat(message.content)) {
    await message.reply('Please phrase your answer as a question! (e.g., "What is...?")');
    return;
  }

  // Clear timeout
  const existingTimeout = answerTimeouts.get(message.channelId);
  if (existingTimeout) clearTimeout(existingTimeout);
  answerTimeouts.delete(message.channelId);

  try {
    const selectedQuestionValue = game.selectedQuestion?.value || 0;
    const result = gameManager.submitAnswer(game, message.author.id, message.content, message.id);
    console.log(`[Bot] Answer result: correct=${result.isCorrect}, allAttempted=${result.allAttempted}`);
    
    if (result.isCorrect && result.player) {
      await message.reply(`✅ Correct! <@${result.player.userId}> gains $${selectedQuestionValue}`);
      
      // Show answer reveal
      if (game.lastAnsweredQuestion) {
        const revealEmbed = renderAnswerReveal(game.lastAnsweredQuestion.question, game.lastAnsweredQuestion.correctPlayerIds);
        await message.channel.send({ embeds: [revealEmbed] });
      }

      // Show board if game continues
      if (game.status === 'selecting') {
        const boardAttachment = await createBoardAttachment(game);
        await message.channel.send({ files: [boardAttachment] });
      }
    } else if (!result.isCorrect && result.player) {
      await message.reply(`❌ Wrong! You lose $${selectedQuestionValue}`);
      
      // Check if all players attempted
      if (result.allAttempted) {
        await revealAnswerAndReset(game, message.channel as TextChannel | ThreadChannel);
      } else {
        await postBuzzerMessage(game, message.channel as TextChannel | ThreadChannel);
      }
    }
  } catch (error) {
    console.error('Error processing answer:', error);
  }
});

// Handle reactions for buzzing in and answer corrections
client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (user.bot) return;

  const game = gameManager.getGame(reaction.message.channelId);
  if (!game) return;

  // Handle buzz-in reactions
  if (game.status === 'reading' && game.currentClueMessageId === reaction.message.id) {
    console.log(`[Bot] Reaction from ${user.username} on buzzer message`);
    try {
      gameManager.buzzIn(game, user.id);
      
      // Clear any existing timeout
      const existingTimeout = answerTimeouts.get(reaction.message.channelId);
      if (existingTimeout) clearTimeout(existingTimeout);
      
      const answerMessage = await reaction.message.channel.send(`⏰ <@${user.id}> has 15 seconds to answer! Type your answer in the chat.`);
      console.log(`[Bot] Player ${user.id} assigned answering turn`);
      
      // Start 15-second timer
      const timeoutId = setTimeout(async () => {
        console.log(`[Bot] Answer timeout for player ${user.id}`);
        if (game.status === 'answering' && game.selectedQuestion) {
          const timedOutPlayerId = game.currentAnsweringPlayerId;
          const points = game.selectedQuestion.value;
          const result = gameManager.handleAnswerTimeout(game);
          
          const channel = reaction.message.channel as TextChannel | ThreadChannel;
          
          if (timedOutPlayerId) {
            await channel.send(`⏰ Time's up! <@${timedOutPlayerId}> loses $${points}.`);
          }
          
          if (result.allAttempted) {
            console.log(`[Bot] All players attempted, revealing answer`);
            await revealAnswerAndReset(game, channel);
          } else {
            console.log(`[Bot] Posting new buzzer message`);
            await postBuzzerMessage(game, channel);
          }
        }
        answerTimeouts.delete(reaction.message.channelId);
      }, 15000);
      
      answerTimeouts.set(reaction.message.channelId, timeoutId);
    } catch (error) {
      console.log(`[Bot] Buzz-in rejected: ${(error as Error).message}`);
    }
    return;
  }

  // Handle answer corrections
  if (reaction.emoji.name !== '✅') return;

  // Only allow corrections before next question is selected
  if (game.status !== 'selecting') return;

  // Don't allow self-corrections
  if (user.id === reaction.message.author?.id) return;

  try {
    console.log(`[Bot] Correction reaction on message ${reaction.message.id}`);
    const result = gameManager.correctAnswer(game, reaction.message.id);
    
    if (result.success && result.player) {
      await reaction.message.reply(`✅ <@${result.player.userId}>'s answer has been corrected! They gain $${game.lastAnsweredQuestion?.question.value || 0}`);
    }
  } catch (error) {
    console.error('Error processing correction:', error);
  }
});

client.on(Events.Ready, () => {
  console.log(`Logged in as ${client.user?.tag}!`);
});

// Login
client.login(process.env.DISCORD_TOKEN);

// Register commands on startup
registerCommands();
