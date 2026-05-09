import sharp from 'sharp';
import { Category } from '../../shared/types';

const BOARD_BG = '#000000';
const CELL_BG = '#071277';
const PLAYED_BG = '#333333';
const TEXT_GOLD = '#FFD700';
const TEXT_WHITE = '#FFFFFF';
const BORDER_COLOR = '#000033';
const CLUE_BG = '#060CE9';

const FONT_FAMILY = "'ITC Korinna', Georgia, 'Times New Roman', serif";

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapTextIntoLines(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (!currentLine) {
      currentLine = word;
    } else if ((currentLine + ' ' + word).length <= maxCharsPerLine) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

function fitText(
  text: string,
  availableWidth: number,
  availableHeight: number,
  startFontSize: number,
  minFontSize: number
): { lines: string[]; fontSize: number } {
  let fontSize = startFontSize;
  const avgCharWidth = fontSize * 0.55;
  const maxCharsPerLine = Math.floor(availableWidth / avgCharWidth);

  while (fontSize >= minFontSize) {
    const currentAvgCharWidth = fontSize * 0.55;
    const currentMaxChars = Math.floor(availableWidth / currentAvgCharWidth);
    const lines = wrapTextIntoLines(text, currentMaxChars);
    const lineHeight = fontSize * 1.3;
    const totalHeight = lines.length * lineHeight;

    if (totalHeight <= availableHeight) {
      return { lines, fontSize };
    }

    fontSize -= 2;
  }

  const finalAvgCharWidth = minFontSize * 0.55;
  const finalMaxChars = Math.floor(availableWidth / finalAvgCharWidth);
  return { lines: wrapTextIntoLines(text, finalMaxChars), fontSize: minFontSize };
}

function renderSvgTextLines(
  lines: string[],
  x: number,
  centerY: number,
  fontSize: number,
  color: string,
  fontWeight: string = 'bold'
): string {
  const lineHeight = fontSize * 1.3;
  const totalHeight = lines.length * lineHeight;
  const startY = centerY - totalHeight / 2 + lineHeight / 2;

  let svg = `<text x="${x}" y="${startY}" font-family="${FONT_FAMILY}" font-size="${fontSize}" font-weight="${fontWeight}" fill="${color}" text-anchor="middle">`;
  lines.forEach((line, i) => {
    const dy = i === 0 ? 0 : lineHeight;
    svg += `<tspan x="${x}" dy="${dy}">${escapeXml(line)}</tspan>`;
  });
  svg += '</text>';
  return svg;
}

async function svgToJpeg(svgString: string): Promise<Buffer> {
  return sharp(Buffer.from(svgString))
    .jpeg({ quality: 95 })
    .toBuffer();
}

export async function generateBoardImage(
  categories: Category[],
  round: 'jeopardy' | 'double_jeopardy',
  currentPlayerUsername?: string
): Promise<Buffer> {
  const width = 1200;
  const height = 900;
  const cols = 6;
  const rows = 5;
  const titleHeight = 60;
  const headerHeight = 130;
  const footerHeight = currentPlayerUsername ? 60 : 0;
  const gridHeight = height - titleHeight - headerHeight - footerHeight;
  const cellWidth = width / cols;
  const cellHeight = gridHeight / rows;
  const borderWidth = 4;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`;
  svg += `<rect width="${width}" height="${height}" fill="${BOARD_BG}"/>`;

  // Title
  const roundName = round === 'jeopardy' ? 'Jeopardy!' : 'Double Jeopardy!';
  svg += `<text x="${width / 2}" y="${titleHeight / 2}" font-family="${FONT_FAMILY}" font-size="40" font-weight="bold" fill="${TEXT_GOLD}" text-anchor="middle" dominant-baseline="middle">${escapeXml(roundName)}</text>`;

  // Category cells
  for (let col = 0; col < cols; col++) {
    const x = col * cellWidth + borderWidth;
    const y = titleHeight + borderWidth;
    const w = cellWidth - borderWidth * 2;
    const h = headerHeight - borderWidth * 2;
    svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${CELL_BG}"/>`;

    const category = categories[col];
    const textX = col * cellWidth + cellWidth / 2;
    const textCenterY = titleHeight + headerHeight / 2;
    const maxTextWidth = cellWidth - 20;
    const maxTextHeight = headerHeight - 30;
    const { lines, fontSize } = fitText(category.name, maxTextWidth, maxTextHeight, 28, 14);
    svg += renderSvgTextLines(lines, textX, textCenterY, fontSize, TEXT_WHITE);
  }

  // Value cells
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const question = categories[col].questions[row];
      const x = col * cellWidth + borderWidth;
      const y = titleHeight + headerHeight + row * cellHeight + borderWidth;
      const w = cellWidth - borderWidth * 2;
      const h = cellHeight - borderWidth * 2;
      const fill = question.isPlayed ? PLAYED_BG : CELL_BG;
      svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;

      if (!question.isPlayed) {
        const textX = col * cellWidth + cellWidth / 2;
        const textY = titleHeight + headerHeight + row * cellHeight + cellHeight / 2;
        svg += `<text x="${textX}" y="${textY}" font-family="${FONT_FAMILY}" font-size="48" font-weight="bold" fill="${TEXT_GOLD}" text-anchor="middle" dominant-baseline="middle">$${question.value}</text>`;
      }
    }
  }

  // Grid borders
  for (let i = 0; i <= cols; i++) {
    const x = i * cellWidth;
    svg += `<line x1="${x}" y1="${titleHeight}" x2="${x}" y2="${titleHeight + headerHeight + rows * cellHeight}" stroke="${BORDER_COLOR}" stroke-width="${borderWidth}"/>`;
  }

  for (let i = 0; i <= rows + 1; i++) {
    const y = i === 0 ? titleHeight : titleHeight + headerHeight + (i - 1) * cellHeight;
    svg += `<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="${BORDER_COLOR}" stroke-width="${borderWidth}"/>`;
  }

  // Footer
  if (currentPlayerUsername) {
    const footerY = height - footerHeight / 2;
    svg += `<text x="${width / 2}" y="${footerY}" font-family="${FONT_FAMILY}" font-size="28" font-weight="bold" fill="${TEXT_GOLD}" text-anchor="middle" dominant-baseline="middle">Current Player: ${escapeXml(currentPlayerUsername)}</text>`;
  }

  svg += '</svg>';
  return svgToJpeg(svg);
}

export async function generateClueImage(
  clue: string,
  category: string,
  value: number,
  isDailyDouble: boolean
): Promise<Buffer> {
  const width = 1200;
  const height = 700;

  const headerText = isDailyDouble
    ? `${category} — DAILY DOUBLE`
    : `${category} — $${value}`;

  const maxTextWidth = width - 120;
  const maxTextHeight = height - 150;
  const { lines, fontSize } = fitText(clue, maxTextWidth, maxTextHeight, 52, 20);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`;
  svg += `<rect width="${width}" height="${height}" fill="${CLUE_BG}"/>`;

  // Header
  svg += `<text x="${width / 2}" y="50" font-family="${FONT_FAMILY}" font-size="36" font-weight="bold" fill="${TEXT_GOLD}" text-anchor="middle">${escapeXml(headerText)}</text>`;

  // Clue text
  const textCenterY = height / 2;
  svg += renderSvgTextLines(lines, width / 2, textCenterY, fontSize, TEXT_WHITE);

  svg += '</svg>';
  return svgToJpeg(svg);
}
