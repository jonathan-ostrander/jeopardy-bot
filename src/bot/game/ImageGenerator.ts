import sharp from 'sharp';
import { Category, Player } from '../../shared/types';
import { generateBoardSvg, generateScoresSvg, generateClueSvg } from '../../shared/svgRenderer';

export async function generateBoardImage(
  categories: Category[],
  round: 'jeopardy' | 'double_jeopardy',
  currentPlayerUsername?: string
): Promise<Buffer> {
  const svg = generateBoardSvg(categories, round, currentPlayerUsername);
  return sharp(Buffer.from(svg)).jpeg({ quality: 95 }).toBuffer();
}

export async function generateScoresImage(players: Player[]): Promise<Buffer> {
  const svg = generateScoresSvg(players);
  return sharp(Buffer.from(svg)).jpeg({ quality: 95 }).toBuffer();
}

export async function generateClueImage(
  clue: string,
  category: string,
  value: number,
  isDailyDouble: boolean
): Promise<Buffer> {
  const svg = generateClueSvg(clue, category, value, isDailyDouble);
  return sharp(Buffer.from(svg)).jpeg({ quality: 95 }).toBuffer();
}
