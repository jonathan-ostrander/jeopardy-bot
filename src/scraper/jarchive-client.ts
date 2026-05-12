const BASE_URL = 'https://j-archive.com/showgame.php?game_id=';
const SEASON_URL = 'https://j-archive.com/showseason.php?season=';

// Minimum delay between requests to j-archive.com (ms)
const MIN_REQUEST_INTERVAL = 1500;

let lastRequestTime = 0;

async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  // Rate limiting: ensure we wait at least MIN_REQUEST_INTERVAL between requests
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    await delay(waitTime);
  }

  for (let i = 0; i < retries; i++) {
    try {
      lastRequestTime = Date.now();
      const response = await fetch(url);
      if (response.ok) {
        return response;
      }

      if (response.status === 429) {
        // Rate limited by server, wait longer
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

export async function fetchGameHtml(gameId: string): Promise<string> {
  const response = await fetchWithRetry(`${BASE_URL}${gameId}`);
  return response.text();
}

export async function fetchSeasonGameIds(season: number): Promise<string[]> {
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
