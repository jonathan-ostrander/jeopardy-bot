import { parseGameHtml, ScrapedGame } from './parser';
import { ensureDirectories, saveCategory, saveFinalJeopardy, markGameAsScraped, isGameScraped, getScrapedGameIds } from './storage';
import { fetchGameHtml, fetchSeasonGameIds } from './jarchive-client';

export async function fetchGame(gameId: string, alreadyScraped?: Set<string>): Promise<ScrapedGame | null> {
  if (alreadyScraped ? alreadyScraped.has(gameId) : isGameScraped(gameId)) {
    console.log(`Game ${gameId} already scraped, skipping...`);
    return null;
  }

  console.log(`Fetching game ${gameId}...`);

  try {
    const html = await fetchGameHtml(gameId);
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

  const gameIds = await fetchSeasonGameIds(season);
  console.log(`Found ${gameIds.length} games in season ${season}`);

  const alreadyScraped = getScrapedGameIds();
  for (const gameId of gameIds) {
    await fetchGame(gameId, alreadyScraped);
  }

  console.log(`Season ${season} scraping complete!`);
}

export async function scrapeRecentGames(count: number = 10): Promise<void> {
  console.log(`Scraping ${count} most recent games...`);

  // Start from the most recent season (42 as of now)
  const currentSeason = 42;
  const gameIds: string[] = [];

  // Fetch game IDs from current season
  const seasonGameIds = await fetchSeasonGameIds(currentSeason);
  gameIds.push(...seasonGameIds.slice(0, count));

  const alreadyScraped = getScrapedGameIds();
  for (const gameId of gameIds) {
    await fetchGame(gameId, alreadyScraped);
  }

  console.log(`Recent games scraping complete!`);
}

export async function scrapeAllGames(startSeason: number = 1, endSeason: number = 42): Promise<void> {
  console.log(`Scraping all games from season ${startSeason} to ${endSeason}...`);

  const alreadyScraped = getScrapedGameIds();
  console.log(`Found ${alreadyScraped.size} already scraped games`);

  let totalGames = 0;
  let totalCategories = 0;

  for (let season = startSeason; season <= endSeason; season++) {
    try {
      console.log(`\n=== Season ${season} ===`);
      const gameIds = await fetchSeasonGameIds(season);
      console.log(`Found ${gameIds.length} games in season ${season}`);

      for (const gameId of gameIds) {
        const game = await fetchGame(gameId, alreadyScraped);
        if (game) {
          totalGames++;
          totalCategories += game.jeopardyCategories.length + game.doubleJeopardyCategories.length;
        }
      }

      console.log(`Season ${season} complete. Total games so far: ${totalGames}`);
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
