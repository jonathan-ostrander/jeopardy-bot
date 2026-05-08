import { parseGameHtml, ScrapedGame } from './parser';
import { ensureDirectories, saveCategory, saveFinalJeopardy, markGameAsScraped, isGameScraped } from './storage';

const BASE_URL = 'https://j-archive.com/showgame.php?game_id=';
const SEASON_URL = 'https://j-archive.com/showseason.php?season=';

async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response;
      }
      
      if (response.status === 429) {
        // Rate limited, wait longer
        await delay(5000 * (i + 1));
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      if (i === retries - 1) {
        throw error;
      }
      await delay(1000 * (i + 1));
    }
  }
  
  throw new Error(`Failed to fetch ${url} after ${retries} retries`);
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function fetchGameIdsFromSeason(season: number): Promise<string[]> {
  const response = await fetchWithRetry(`${SEASON_URL}${season}`);
  const html = await response.text();
  
  // Extract game IDs from links like showgame.php?game_id=1234
  const gameIdRegex = /showgame\.php\?game_id=(\d+)/g;
  const gameIds: string[] = [];
  let match;
  
  while ((match = gameIdRegex.exec(html)) !== null) {
    gameIds.push(match[1]);
  }
  
  // Remove duplicates
  return [...new Set(gameIds)];
}

export async function fetchGame(gameId: string): Promise<ScrapedGame | null> {
  if (isGameScraped(gameId)) {
    console.log(`Game ${gameId} already scraped, skipping...`);
    return null;
  }

  console.log(`Fetching game ${gameId}...`);
  
  try {
    const response = await fetchWithRetry(`${BASE_URL}${gameId}`);
    const html = await response.text();
    
    const game = parseGameHtml(html, gameId);
    
    // Save categories
    for (const category of game.jeopardyCategories) {
      saveCategory(category);
    }
    
    for (const category of game.doubleJeopardyCategories) {
      saveCategory(category);
    }
    
    if (game.finalJeopardy) {
      saveFinalJeopardy(game.finalJeopardy);
    }
    
    markGameAsScraped(gameId);
    
    console.log(`Game ${gameId} scraped successfully:`);
    console.log(`  - Jeopardy categories: ${game.jeopardyCategories.length}`);
    console.log(`  - Double Jeopardy categories: ${game.doubleJeopardyCategories.length}`);
    console.log(`  - Final Jeopardy: ${game.finalJeopardy ? 'yes' : 'no'}`);
    
    return game;
  } catch (error) {
    console.error(`Error fetching game ${gameId}:`, error);
    return null;
  }
}

export async function scrapeSeason(season: number): Promise<void> {
  console.log(`Scraping season ${season}...`);
  
  const gameIds = await fetchGameIdsFromSeason(season);
  console.log(`Found ${gameIds.length} games in season ${season}`);
  
  for (const gameId of gameIds) {
    await fetchGame(gameId);
    // Rate limiting: wait 1 second between requests
    await delay(1000);
  }
  
  console.log(`Season ${season} scraping complete!`);
}

export async function scrapeRecentGames(count: number = 10): Promise<void> {
  console.log(`Scraping ${count} most recent games...`);
  
  // Start from the most recent season (42 as of now)
  const currentSeason = 42;
  const gameIds: string[] = [];
  
  // Fetch game IDs from current season
  const seasonGameIds = await fetchGameIdsFromSeason(currentSeason);
  gameIds.push(...seasonGameIds.slice(0, count));
  
  for (const gameId of gameIds) {
    await fetchGame(gameId);
    await delay(1000);
  }
  
  console.log(`Recent games scraping complete!`);
}

export async function scrapeAllGames(startSeason: number = 1, endSeason: number = 42): Promise<void> {
  console.log(`Scraping all games from season ${startSeason} to ${endSeason}...`);
  
  let totalGames = 0;
  let totalCategories = 0;
  
  for (let season = startSeason; season <= endSeason; season++) {
    try {
      console.log(`\n=== Season ${season} ===`);
      const gameIds = await fetchGameIdsFromSeason(season);
      console.log(`Found ${gameIds.length} games in season ${season}`);
      
      for (const gameId of gameIds) {
        const game = await fetchGame(gameId);
        if (game) {
          totalGames++;
          totalCategories += game.jeopardyCategories.length + game.doubleJeopardyCategories.length;
        }
        // Rate limiting: wait 1.5 seconds between requests to be respectful
        await delay(1500);
      }
      
      console.log(`Season ${season} complete. Total games so far: ${totalGames}`);
      
      // Wait 5 seconds between seasons
      if (season < endSeason) {
        await delay(5000);
      }
    } catch (error) {
      console.error(`Error scraping season ${season}:`, error);
      // Continue to next season even if one fails
    }
  }
  
  console.log(`\n=== All seasons complete! ===`);
  console.log(`Total games scraped: ${totalGames}`);
  console.log(`Total categories: ${totalCategories}`);
}

async function main() {
  ensureDirectories();
  
  // Check command line arguments
  const args = process.argv.slice(2);
  
  if (args.includes('--all')) {
    const startIndex = args.indexOf('--start');
    const endIndex = args.indexOf('--end');
    const startSeason = startIndex !== -1 ? parseInt(args[startIndex + 1], 10) : 1;
    const endSeason = endIndex !== -1 ? parseInt(args[endIndex + 1], 10) : 42;
    
    if (isNaN(startSeason) || isNaN(endSeason)) {
      console.error('Please provide valid season numbers');
      process.exit(1);
    }
    
    await scrapeAllGames(startSeason, endSeason);
  } else if (args.includes('--season')) {
    const seasonIndex = args.indexOf('--season');
    const season = parseInt(args[seasonIndex + 1], 10);
    
    if (isNaN(season)) {
      console.error('Please provide a valid season number');
      process.exit(1);
    }
    
    await scrapeSeason(season);
  } else if (args.includes('--recent')) {
    const recentIndex = args.indexOf('--recent');
    const count = parseInt(args[recentIndex + 1], 10) || 10;
    await scrapeRecentGames(count);
  } else {
    // Default: scrape recent games
    await scrapeRecentGames(10);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
