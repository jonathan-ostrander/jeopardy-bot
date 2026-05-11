import { writeFileSync } from 'fs';
import { join } from 'path';
import { generateBoardImage, generateClueImage, generateScoresImage } from '../src/bot/game/ImageGenerator';
import { Category, Player } from '../src/shared/types';

function createMockCategories(): Category[] {
  return [
    {
      name: 'HISTORY',
      sourceGameId: 'test-1',
      round: 'jeopardy',
      questions: [
        { value: 200, clue: 'In 1492, this explorer sailed the ocean blue.', answer: 'Who is Columbus?', acceptableAnswers: ['Columbus'], isDailyDouble: false, isPlayed: false },
        { value: 400, clue: 'This ancient wonder was located in Egypt.', answer: 'What are the Pyramids?', acceptableAnswers: ['Pyramids'], isDailyDouble: false, isPlayed: false },
        { value: 600, clue: 'This war lasted from 1939 to 1945.', answer: 'What is World War II?', acceptableAnswers: ['World War II', 'WWII'], isDailyDouble: false, isPlayed: true },
        { value: 800, clue: 'The Magna Carta was signed in this year.', answer: 'What is 1215?', acceptableAnswers: ['1215'], isDailyDouble: true, isPlayed: false },
        { value: 1000, clue: 'This Roman emperor built a wall in Britain.', answer: 'Who is Hadrian?', acceptableAnswers: ['Hadrian'], isDailyDouble: false, isPlayed: false },
      ],
    },
    {
      name: 'SCIENCE',
      sourceGameId: 'test-1',
      round: 'jeopardy',
      questions: [
        { value: 200, clue: 'H2O is the chemical formula for this.', answer: 'What is water?', acceptableAnswers: ['water'], isDailyDouble: false, isPlayed: false },
        { value: 400, clue: 'This planet is known as the Red Planet.', answer: 'What is Mars?', acceptableAnswers: ['Mars'], isDailyDouble: false, isPlayed: false },
        { value: 600, clue: 'E=mc² is the famous equation of this physicist.', answer: 'Who is Einstein?', acceptableAnswers: ['Einstein'], isDailyDouble: false, isPlayed: true },
        { value: 800, clue: 'The speed of light is approximately this many miles per second.', answer: 'What is 186,000?', acceptableAnswers: ['186000', '186282'], isDailyDouble: false, isPlayed: false },
        { value: 1000, clue: 'This element has the symbol Au.', answer: 'What is gold?', acceptableAnswers: ['gold'], isDailyDouble: false, isPlayed: false },
      ],
    },
    {
      name: 'LITERATURE',
      sourceGameId: 'test-1',
      round: 'jeopardy',
      questions: [
        { value: 200, clue: '"To be or not to be" is from this play.', answer: 'What is Hamlet?', acceptableAnswers: ['Hamlet'], isDailyDouble: false, isPlayed: false },
        { value: 400, clue: 'This author wrote "1984" and "Animal Farm".', answer: 'Who is George Orwell?', acceptableAnswers: ['George Orwell', 'Orwell'], isDailyDouble: false, isPlayed: true },
        { value: 600, clue: 'The Great Gatsby was written by this author.', answer: 'Who is F. Scott Fitzgerald?', acceptableAnswers: ['F. Scott Fitzgerald', 'Fitzgerald'], isDailyDouble: false, isPlayed: false },
        { value: 800, clue: 'This epic poem begins with "Sing, Goddess, of the rage of Peleus\' son Achilles".', answer: 'What is the Iliad?', acceptableAnswers: ['Iliad'], isDailyDouble: false, isPlayed: false },
        { value: 1000, clue: 'One Hundred Years of Solitude was written by this Colombian author.', answer: 'Who is Gabriel García Márquez?', acceptableAnswers: ['Gabriel García Márquez', 'García Márquez'], isDailyDouble: false, isPlayed: false },
      ],
    },
    {
      name: 'SPORTS',
      sourceGameId: 'test-1',
      round: 'jeopardy',
      questions: [
        { value: 200, clue: 'This sport uses a bat and a ball.', answer: 'What is baseball?', acceptableAnswers: ['baseball'], isDailyDouble: false, isPlayed: false },
        { value: 400, clue: 'The Olympics are held every this many years.', answer: 'What is 4?', acceptableAnswers: ['4', 'four'], isDailyDouble: false, isPlayed: false },
        { value: 600, clue: 'This country hosted the 2016 Summer Olympics.', answer: 'What is Brazil?', acceptableAnswers: ['Brazil'], isDailyDouble: false, isPlayed: true },
        { value: 800, clue: 'Michael Jordan played for this NBA team most of his career.', answer: 'What are the Chicago Bulls?', acceptableAnswers: ['Chicago Bulls', 'Bulls'], isDailyDouble: false, isPlayed: false },
        { value: 1000, clue: 'This tennis player has won the most Grand Slam titles in the Open Era.', answer: 'Who is Novak Djokovic?', acceptableAnswers: ['Novak Djokovic', 'Djokovic', 'Serena Williams'], isDailyDouble: false, isPlayed: false },
      ],
    },
    {
      name: 'GEOGRAPHY',
      sourceGameId: 'test-1',
      round: 'jeopardy',
      questions: [
        { value: 200, clue: 'This is the capital of France.', answer: 'What is Paris?', acceptableAnswers: ['Paris'], isDailyDouble: false, isPlayed: false },
        { value: 400, clue: 'The Amazon River is primarily in this continent.', answer: 'What is South America?', acceptableAnswers: ['South America'], isDailyDouble: false, isPlayed: false },
        { value: 600, clue: 'Mount Everest is located in this mountain range.', answer: 'What are the Himalayas?', acceptableAnswers: ['Himalayas', 'Himalaya'], isDailyDouble: true, isPlayed: true },
        { value: 800, clue: 'This is the smallest country in the world by land area.', answer: 'What is Vatican City?', acceptableAnswers: ['Vatican City', 'Vatican'], isDailyDouble: false, isPlayed: false },
        { value: 1000, clue: 'The Sahara Desert is primarily located in this continent.', answer: 'What is Africa?', acceptableAnswers: ['Africa'], isDailyDouble: false, isPlayed: false },
      ],
    },
    {
      name: 'POP CULTURE',
      sourceGameId: 'test-1',
      round: 'jeopardy',
      questions: [
        { value: 200, clue: 'This movie features a boy wizard at Hogwarts.', answer: 'What is Harry Potter?', acceptableAnswers: ['Harry Potter'], isDailyDouble: false, isPlayed: false },
        { value: 400, clue: 'This band sang "Bohemian Rhapsody".', answer: 'Who are Queen?', acceptableAnswers: ['Queen'], isDailyDouble: false, isPlayed: false },
        { value: 600, clue: 'This streaming service is known for "Stranger Things".', answer: 'What is Netflix?', acceptableAnswers: ['Netflix'], isDailyDouble: false, isPlayed: true },
        { value: 800, clue: 'This actor played Iron Man in the Marvel Cinematic Universe.', answer: 'Who is Robert Downey Jr.?', acceptableAnswers: ['Robert Downey Jr.', 'Robert Downey Junior'], isDailyDouble: false, isPlayed: false },
        { value: 1000, clue: 'This 1994 film features a box of chocolates and a bench.', answer: 'What is Forrest Gump?', acceptableAnswers: ['Forrest Gump'], isDailyDouble: false, isPlayed: false },
      ],
    },
  ];
}

async function main() {
  const categories = createMockCategories();
  const outputDir = join(__dirname, 'output');

  console.log('Generating board image...');
  const boardBuffer = await generateBoardImage(categories, 'jeopardy', 'TestPlayer123');
  writeFileSync(join(outputDir, 'board.jpg'), boardBuffer);
  console.log('Board image saved to test/output/board.jpg');

  console.log('Generating clue images...');
  const clue1 = categories[0].questions[0];
  const clueBuffer = await generateClueImage(clue1.clue, categories[0].name, clue1.value, clue1.isDailyDouble);
  writeFileSync(join(outputDir, 'clue_normal.jpg'), clueBuffer);
  console.log('Clue image saved to test/output/clue_normal.jpg');

  const dailyDouble = categories[0].questions[3];
  const ddBuffer = await generateClueImage(dailyDouble.clue, categories[0].name, dailyDouble.value, dailyDouble.isDailyDouble);
  writeFileSync(join(outputDir, 'clue_daily_double.jpg'), ddBuffer);
  console.log('Daily double clue image saved to test/output/clue_daily_double.jpg');

  console.log('Generating scores image...');
  const mockPlayers: Player[] = [
    { userId: '1', username: 'Alice', score: 2400, canAnswer: true, finalJeopardyWager: null, finalJeopardyAnswer: null },
    { userId: '2', username: 'Bob', score: -800, canAnswer: true, finalJeopardyWager: null, finalJeopardyAnswer: null },
    { userId: '3', username: 'Charlie', score: 1200, canAnswer: true, finalJeopardyWager: null, finalJeopardyAnswer: null },
    { userId: '4', username: 'Diana', score: 0, canAnswer: true, finalJeopardyWager: null, finalJeopardyAnswer: null },
  ];
  const scoresBuffer = await generateScoresImage(mockPlayers);
  writeFileSync(join(outputDir, 'scores.jpg'), scoresBuffer);
  console.log('Scores image saved to test/output/scores.jpg');

  console.log('Done!');
}

main().catch(console.error);
