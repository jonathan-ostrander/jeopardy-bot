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
  User
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
        .setName('start')
        .setDescription('Start a new game')
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

  try {
    if (commandName === 'jeopardy') {
      const subcommand = options.getSubcommand();

      if (subcommand === 'start') {
        // Check if game already exists
        const existingGame = gameManager.getGame(channelId);
        if (existingGame) {
          await interaction.reply({ content: 'A game is already in progress!', ephemeral: true });
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

      } else if (subcommand === 'join') {
        const game = gameManager.getGame(channelId);
        if (!game) {
          await interaction.reply({ content: 'No game in progress! Start one with `/jeopardy start`', ephemeral: true });
          return;
        }

        if (game.status !== 'waiting') {
          await interaction.reply({ content: 'Game has already started!', ephemeral: true });
          return;
        }

        const player = gameManager.addPlayer(game, userId, username);
        await interaction.reply({ content: `<@${userId}> has joined the game! (${game.players.length} players)`, ephemeral: false });

        // Auto-start if 3+ players
        if (game.players.length >= 3) {
          gameManager.startGame(game);
          const boardAttachment = await createBoardAttachment(game);
          await interaction.followUp({ files: [boardAttachment] });
        }

      } else if (subcommand === 'board') {
        const game = gameManager.getGame(channelId);
        if (!game) {
          await interaction.reply({ content: 'No game in progress!', ephemeral: true });
          return;
        }

        const boardAttachment = await createBoardAttachment(game);
        await interaction.reply({ files: [boardAttachment] });

      } else if (subcommand === 'scores') {
        const game = gameManager.getGame(channelId);
        if (!game) {
          await interaction.reply({ content: 'No game in progress!', ephemeral: true });
          return;
        }

        const scoresEmbed = renderScores(game.players);
        await interaction.reply({ embeds: [scoresEmbed] });

      } else if (subcommand === 'end') {
        const game = gameManager.getGame(channelId);
        if (!game) {
          await interaction.reply({ content: 'No game in progress!', ephemeral: true });
          return;
        }

        gameManager.endGame(channelId);
        await interaction.reply({ content: 'Game ended!' });
      }

    } else if (commandName === 'select') {
      const game = gameManager.getGame(channelId);
      if (!game) {
        await interaction.reply({ content: 'No game in progress!', ephemeral: true });
        return;
      }

      if (game.status !== 'selecting') {
        await interaction.reply({ content: 'Cannot select a question right now!', ephemeral: true });
        return;
      }

      if (game.currentPlayerId !== userId) {
        await interaction.reply({ content: 'It\'s not your turn to select!', ephemeral: true });
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

        // If not daily double, start accepting answers after 3 seconds
        if (!question.isDailyDouble) {
          setTimeout(async () => {
            game.status = 'answering';
            await interaction.followUp({ content: '⏰ You have 15 seconds to answer! Type your answer in the chat.' });
            
            // Set 15-second timer
            setTimeout(async () => {
              if (game.status === 'answering' && game.selectedQuestion) {
                // Time's up
                game.selectedQuestion.isPlayed = true;
                
                const revealEmbed = renderAnswerReveal(game.selectedQuestion, []);
                await interaction.followUp({ embeds: [revealEmbed] });

                game.lastAnsweredQuestion = {
                  question: game.selectedQuestion,
                  correctPlayerIds: [],
                  answers: [],
                  isCorrected: false,
                };

                game.selectedQuestion = null;
                game.selectedCategoryIndex = null;
                game.selectedQuestionIndex = null;
                game.status = 'selecting';

                // Check if round is complete
                const categories = game.round === 'jeopardy'
                  ? game.board.jeopardyRound
                  : game.board.doubleJeopardyRound;
                
                const isComplete = categories.every(cat => 
                  cat.questions.every(q => q.isPlayed)
                );

                if (isComplete) {
                  if (game.round === 'jeopardy') {
                    game.round = 'double_jeopardy';
                    await interaction.followUp({ content: '**Double Jeopardy!**' });
                  } else {
                    game.round = 'final_jeopardy';
                    game.status = 'final_jeopardy_wager';
                    
                    const finalEmbed = renderFinalJeopardyCategory(game.board.finalJeopardy.category);
                    await interaction.followUp({ embeds: [finalEmbed] });
                    await interaction.followUp({ content: 'DM me your wagers!' });
                    return;
                  }
                }

                const boardAttachment = await createBoardAttachment(game);
                await interaction.followUp({ files: [boardAttachment] });
              }
            }, 15000);
          }, 3000);
        }

      } catch (error) {
        await interaction.reply({ content: `Error: ${(error as Error).message}`, ephemeral: true });
      }

    } else if (commandName === 'wager') {
      const game = gameManager.getGame(channelId);
      if (!game) {
        await interaction.reply({ content: 'No game in progress!', ephemeral: true });
        return;
      }

      if (game.status !== 'daily_double_wager' && game.status !== 'final_jeopardy_wager') {
        await interaction.reply({ content: 'Cannot place a wager right now!', ephemeral: true });
        return;
      }

      const amount = options.getInteger('amount')!;

      try {
        gameManager.submitWager(game, userId, amount);
        await interaction.reply({ content: `Wager of $${amount} placed!`, ephemeral: true });

        if (game.status === 'reading' && game.selectedQuestion) {
          // Daily double - show the question
          const category = game.round === 'jeopardy'
            ? game.board.jeopardyRound[game.selectedCategoryIndex!]
            : game.board.doubleJeopardyRound[game.selectedCategoryIndex!];
          
          const clueAttachment = await createClueAttachment(game.selectedQuestion, category.name);
          await interaction.followUp({ files: [clueAttachment] });

          setTimeout(async () => {
            game.status = 'answering';
            await interaction.followUp({ content: '⏰ You have 15 seconds to answer! Type your answer in the chat.' });
            
            setTimeout(async () => {
              if (game.status === 'answering' && game.selectedQuestion) {
                game.selectedQuestion.isPlayed = true;
                
                const revealEmbed = renderAnswerReveal(game.selectedQuestion, []);
                await interaction.followUp({ embeds: [revealEmbed] });

                game.lastAnsweredQuestion = {
                  question: game.selectedQuestion,
                  correctPlayerIds: [],
                  answers: [],
                  isCorrected: false,
                };

                game.selectedQuestion = null;
                game.selectedCategoryIndex = null;
                game.selectedQuestionIndex = null;
                game.status = 'selecting';

                const boardAttachment = await createBoardAttachment(game);
                await interaction.followUp({ files: [boardAttachment] });
              }
            }, 15000);
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
        await interaction.reply({ content: `Error: ${(error as Error).message}`, ephemeral: true });
      }
    }

  } catch (error) {
    console.error('Error handling interaction:', error);
    if (!interaction.replied) {
      await interaction.reply({ content: 'An error occurred!', ephemeral: true });
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

  if (!validateAnswerFormat(message.content)) return;

  try {
    const result = gameManager.submitAnswer(game, message.author.id, message.content, message.id);
    
    if (result.isCorrect && result.player) {
      await message.reply(`✅ Correct! <@${result.player.userId}> gains $${game.selectedQuestion?.value || 0}`);
      
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
      await message.react('❌');
    }
  } catch (error) {
    console.error('Error processing answer:', error);
  }
});

// Handle reactions for answer corrections
client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (user.bot) return;
  if (reaction.emoji.name !== '✅') return;

  const game = gameManager.getGame(reaction.message.channelId);
  if (!game) return;

  // Only allow corrections before next question is selected
  if (game.status !== 'selecting') return;

  // Don't allow self-corrections
  if (user.id === reaction.message.author?.id) return;

  try {
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
