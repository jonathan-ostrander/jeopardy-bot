import { writeFileSync, mkdirSync, existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { Category, FinalJeopardy } from '../shared/types';

const DATA_DIR = join(process.cwd(), 'src', 'shared', 'data');
const CATEGORIES_DIR = join(DATA_DIR, 'categories');
const GAMES_DIR = join(DATA_DIR, 'games');

export function ensureDirectories(): void {
  const dirs = [
    CATEGORIES_DIR,
    join(CATEGORIES_DIR, 'jeopardy'),
    join(CATEGORIES_DIR, 'double_jeopardy'),
    join(CATEGORIES_DIR, 'final_jeopardy'),
    GAMES_DIR,
  ];

  for (const dir of dirs) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}

export function saveCategory(category: Category): void {
  const roundDir = join(CATEGORIES_DIR, category.round);
  const fileName = `${category.sourceGameId}_${sanitizeFileName(category.name)}.json`;
  const filePath = join(roundDir, fileName);
  
  writeFileSync(filePath, JSON.stringify(category, null, 2));
}

export function saveFinalJeopardy(finalJeopardy: FinalJeopardy): void {
  const dir = join(CATEGORIES_DIR, 'final_jeopardy');
  const fileName = `${finalJeopardy.sourceGameId}_${sanitizeFileName(finalJeopardy.category)}.json`;
  const filePath = join(dir, fileName);
  
  writeFileSync(filePath, JSON.stringify(finalJeopardy, null, 2));
}

export function markGameAsScraped(gameId: string): void {
  const filePath = join(GAMES_DIR, `${gameId}.json`);
  writeFileSync(filePath, JSON.stringify({ scraped: true, date: new Date().toISOString() }));
}

export function isGameScraped(gameId: string): boolean {
  const filePath = join(GAMES_DIR, `${gameId}.json`);
  return existsSync(filePath);
}

export function loadCategories(round: 'jeopardy' | 'double_jeopardy'): Category[] {
  const dir = join(CATEGORIES_DIR, round);
  
  if (!existsSync(dir)) {
    return [];
  }

  const files = readdirSync(dir).filter(f => f.endsWith('.json'));
  
  return files.map(file => {
    const content = readFileSync(join(dir, file), 'utf-8');
    return JSON.parse(content) as Category;
  });
}

export function loadFinalJeopardyQuestions(): FinalJeopardy[] {
  const dir = join(CATEGORIES_DIR, 'final_jeopardy');
  
  if (!existsSync(dir)) {
    return [];
  }

  const files = readdirSync(dir).filter(f => f.endsWith('.json'));
  
  return files.map(file => {
    const content = readFileSync(join(dir, file), 'utf-8');
    return JSON.parse(content) as FinalJeopardy;
  });
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}
