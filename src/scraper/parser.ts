import { load } from 'cheerio';
import { Category, FinalJeopardy, Question } from '../shared/types';
import { parseAcceptableAnswers } from '../game/AnswerValidator';

export interface ScrapedGame {
  gameId: string;
  jeopardyCategories: Category[];
  doubleJeopardyCategories: Category[];
  finalJeopardy: FinalJeopardy | null;
}

export function parseGameHtml(html: string, gameId: string): ScrapedGame {
  const $ = load(html);
  
  const jeopardyCategories = parseRound($, 'jeopardy', gameId);
  const doubleJeopardyCategories = parseRound($, 'double_jeopardy', gameId);
  const finalJeopardy = parseFinalJeopardy($, gameId);

  return {
    gameId,
    jeopardyCategories,
    doubleJeopardyCategories,
    finalJeopardy,
  };
}

function parseRound($: ReturnType<typeof load>, round: 'jeopardy' | 'double_jeopardy', gameId: string): Category[] {
  const roundId = round === 'jeopardy' ? 'jeopardy_round' : 'double_jeopardy_round';
  const roundSection = $(`#${roundId}`);
  
  if (!roundSection.length) {
    console.log(`Round section #${roundId} not found`);
    return [];
  }

  // Find the round table with class 'round'
  const roundTable = roundSection.find('table.round').first();
  if (!roundTable.length) {
    console.log('Round table not found');
    return [];
  }

  const categories: Category[] = [];
  
  // Get category names from the first row - they're in nested tables with class 'category_name'
  const categoryNames: string[] = [];
  roundTable.find('tr').first().find('td.category_name').each((_, cell) => {
    const name = $(cell).text().trim();
    if (name) {
      categoryNames.push(name);
    }
  });

  console.log(`Found ${categoryNames.length} categories: ${categoryNames.join(', ')}`);

  // Get clues and answers for each category
  const categoryData: Map<number, Question[]> = new Map();
  
  // Iterate over clue rows (skip the first row which is categories)
  let clueRowIndex = 0;
  roundTable.find('tr').slice(1).each((_, row) => {
    // Only process rows that actually have clue cells
    const clueCells = $(row).find('td.clue');
    if (clueCells.length === 0) return;
    
    // Each row has 6 td.clue cells
    $(row).find('td.clue').each((colIndex, cell) => {
      // Find the clue text - it's in a td with class 'clue_text' and id NOT ending in '_r'
      const clueElement = $(cell).find('td.clue_text').not('[id$="_r"]').first();
      const clue = clueElement.text().trim();
      
      // Check for media clues (images, audio, video)
      const hasMedia = clueElement.find('a').length > 0 || 
                       clueElement.find('img').length > 0 ||
                       /\[.*\]/.test(clue);
      
      if (hasMedia || !clue) {
        console.log(`Skipping clue at row ${clueRowIndex}, col ${colIndex}: hasMedia=${hasMedia}, empty=${!clue}`);
        return;
      }

      // Get answer from the hidden clue_text element with id ending in '_r'
      const clueId = clueElement.attr('id');
      let answer = '';
      
      if (clueId) {
        // The answer is in the sibling td with id ending in '_r'
        const answerId = clueId + '_r';
        const answerElement = $(cell).find(`td#${answerId}`).first();
        
        if (answerElement.length) {
          // Extract answer from the em.correct_response element
          const correctResponse = answerElement.find('em.correct_response').first();
          if (correctResponse.length) {
            answer = correctResponse.text().trim();
          }
        }
        
        // Fallback: try to find answer in script tags
        if (!answer) {
          const scriptContent = $(`script:contains("${clueId}")`).text();
          const answerMatch = scriptContent.match(/correct_response\\"\u003e(.*?)\u003c/);
          if (answerMatch) {
            answer = answerMatch[1].trim();
          }
        }
      }

      // Get value from clue_value or clue_value_daily_double
      const valueElement = $(cell).find('td.clue_value, td.clue_value_daily_double').first();
      const valueText = valueElement.text().trim();
      const isDailyDouble = valueText.includes('DD');
      
      // Always use position-based value, not the wagered amount
      const value = round === 'jeopardy' ? 200 * (clueRowIndex + 1) : 400 * (clueRowIndex + 1);

      if (!answer) {
        console.log(`No answer found for clue at row ${clueRowIndex}, col ${colIndex}`);
        return;
      }

      console.log(`Parsed clue at row ${clueRowIndex}, col ${colIndex}: value=$${value}, answer="${answer}"`);

      const question: Question = {
        value,
        clue,
        answer,
        acceptableAnswers: parseAcceptableAnswers(answer),
        isDailyDouble,
        isPlayed: false,
      };

      if (!categoryData.has(colIndex)) {
        categoryData.set(colIndex, []);
      }
      categoryData.get(colIndex)!.push(question);
    });
    clueRowIndex++;
  });

  // Build categories
  categoryNames.forEach((name, index) => {
    const questions = categoryData.get(index) || [];
    
    console.log(`Category "${name}": ${questions.length} questions`);
    
    // Only include complete categories (5 questions)
    if (questions.length === 5) {
      categories.push({
        name,
        sourceGameId: gameId,
        round,
        questions,
      });
    }
  });

  console.log(`Returning ${categories.length} complete categories`);
  return categories;
}

function parseFinalJeopardy($: ReturnType<typeof load>, gameId: string): FinalJeopardy | null {
  const finalSection = $('#final_jeopardy_round');
  
  if (!finalSection.length) {
    console.log('Final Jeopardy section not found');
    return null;
  }

  // Find the category name in the nested table structure
  const category = finalSection.find('td.category_name').first().text().trim();
  
  // Find the clue text - it's in a td with class 'clue_text' NOT ending in '_r'
  const clueElement = finalSection.find('td.clue_text').not('[id$="_r"]').first();
  const clue = clueElement.text().trim();
  
  // Get answer from the hidden clue_text element with id ending in '_r'
  const clueId = clueElement.attr('id');
  let answer = '';
  
  if (clueId) {
    const answerId = clueId + '_r';
    const answerElement = finalSection.find(`td#${answerId}`).first();
    
    if (answerElement.length) {
      const correctResponse = answerElement.find('em.correct_response').first();
      if (correctResponse.length) {
        answer = correctResponse.text().trim();
      }
    }
    
    // Fallback: try to find answer in script tags
    if (!answer) {
      const scriptContent = $(`script:contains("${clueId}")`).text();
      const answerMatch = scriptContent.match(/correct_response\\"\u003e(.*?)\u003c/);
      if (answerMatch) {
        answer = answerMatch[1].trim();
      }
    }
  }

  console.log(`Final Jeopardy: category="${category}", clue="${clue?.substring(0, 50)}...", answer="${answer}"`);

  if (!category || !clue || !answer) {
    console.log('Missing Final Jeopardy data');
    return null;
  }

  return {
    category,
    clue,
    answer,
    acceptableAnswers: parseAcceptableAnswers(answer),
    sourceGameId: gameId,
  };
}
