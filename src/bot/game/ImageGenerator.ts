import sharp from 'sharp';
import { Category, Player } from '../../shared/types';

const JEOPARDY_BLUE = '#071277';
const PLAYED_BG = '#333333';
const TEXT_GOLD = '#CEA15A';
const TEXT_WHITE = '#FFFFFF';
const BORDER_COLOR = '#000033';

const FONT_KORINNA = "'ITC Korinna', Georgia, 'Times New Roman', serif";
const FONT_SWISS = "'Swiss 911', Arial, sans-serif";

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
  fontFamily: string = FONT_KORINNA,
  fontWeight: string = 'bold',
  dominantBaseline: boolean = false
): string {
  const lineHeight = fontSize * 1.3;
  const totalHeight = lines.length * lineHeight;
  const startY = centerY - totalHeight / 2 + lineHeight / 2;

  const baselineAttr = dominantBaseline ? ' dominant-baseline="middle"' : '';
  let svg = `<text x="${x}" y="${startY}" font-family="${fontFamily}" font-size="${fontSize}" font-weight="${fontWeight}" fill="${color}" text-anchor="middle"${baselineAttr} filter="url(#textShadow)">`;
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
  const headerHeight = 130;
  const footerHeight = currentPlayerUsername ? 60 : 0;
  const gridHeight = height - headerHeight - footerHeight;
  const cellWidth = width / cols;
  const cellHeight = gridHeight / rows;
  const borderWidth = 4;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`;
  
  // Define text shadow filter
  svg += `<defs><filter id="textShadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="2" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.8"/></filter></defs>`;
  
  svg += `<rect width="${width}" height="${height}" fill="${JEOPARDY_BLUE}"/>`;

  // Category cells
  for (let col = 0; col < cols; col++) {
    const x = col * cellWidth + borderWidth;
    const y = borderWidth;
    const w = cellWidth - borderWidth * 2;
    const h = headerHeight - borderWidth * 2;
    svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${JEOPARDY_BLUE}"/>`;

    const category = categories[col];
    const textX = col * cellWidth + cellWidth / 2;
    const textCenterY = headerHeight / 2;
    const maxTextWidth = cellWidth - 20;
    const maxTextHeight = headerHeight - 30;
    const { lines, fontSize } = fitText(category.name, maxTextWidth, maxTextHeight, 40, 18);
    svg += renderSvgTextLines(lines, textX, textCenterY, fontSize, TEXT_WHITE, FONT_SWISS, 'normal', true);
  }

  // Value cells
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const question = categories[col].questions[row];
      const x = col * cellWidth + borderWidth;
      const y = headerHeight + row * cellHeight + borderWidth;
      const w = cellWidth - borderWidth * 2;
      const h = cellHeight - borderWidth * 2;
      const fill = question.isPlayed ? PLAYED_BG : JEOPARDY_BLUE;
      svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;

      if (!question.isPlayed) {
        const textX = col * cellWidth + cellWidth / 2;
        const textY = headerHeight + row * cellHeight + cellHeight / 2;
        svg += `<text x="${textX}" y="${textY}" font-family="${FONT_SWISS}" font-size="60" fill="${TEXT_GOLD}" text-anchor="middle" dominant-baseline="middle" filter="url(#textShadow)">$${question.value}</text>`;
      }
    }
  }

  // Grid borders
  for (let i = 0; i <= cols; i++) {
    const x = i * cellWidth;
    svg += `<line x1="${x}" y1="0" x2="${x}" y2="${headerHeight + rows * cellHeight}" stroke="${BORDER_COLOR}" stroke-width="${borderWidth}"/>`;
  }

  for (let i = 0; i <= rows + 1; i++) {
    const y = i === 0 ? 0 : headerHeight + (i - 1) * cellHeight;
    svg += `<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="${BORDER_COLOR}" stroke-width="${borderWidth}"/>`;
  }

  // Footer
  if (currentPlayerUsername) {
    const footerY = height - footerHeight / 2;
    svg += `<text x="${width / 2}" y="${footerY}" font-family="${FONT_KORINNA}" font-size="28" font-weight="bold" fill="${TEXT_GOLD}" text-anchor="middle" dominant-baseline="middle" filter="url(#textShadow)">Current Player: ${escapeXml(currentPlayerUsername)}</text>`;
  }

  svg += '</svg>';
  return svgToJpeg(svg);
}

export async function generateScoresImage(players: Player[]): Promise<Buffer> {
  const width = 1200;
  const rowHeight = 90;
  const padding = 60;
  const headerHeight = 110;
  const height = Math.max(300, headerHeight + players.length * rowHeight + padding);
  
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`;
  
  // Define text shadow filter
  svg += `<defs><filter id="textShadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="2" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.8"/></filter></defs>`;
  
  // Background
  svg += `<rect width="${width}" height="${height}" fill="${JEOPARDY_BLUE}"/>`;
  
  // Title
  svg += `<text x="${width / 2}" y="${headerHeight / 2}" font-family="${FONT_SWISS}" font-size="52" fill="${TEXT_GOLD}" text-anchor="middle" dominant-baseline="middle" filter="url(#textShadow)">CURRENT SCORES</text>`;
  
  // Horizontal line under header
  svg += `<line x1="${padding}" y1="${headerHeight}" x2="${width - padding}" y2="${headerHeight}" stroke="${BORDER_COLOR}" stroke-width="3"/>`;
  
  // Player rows
  sortedPlayers.forEach((player, index) => {
    const y = headerHeight + index * rowHeight;
    const textY = y + rowHeight / 2;
    const scoreColor = player.score >= 0 ? TEXT_WHITE : '#FF4444';
    
    // Username (left)
    svg += `<text x="${padding}" y="${textY}" font-family="${FONT_SWISS}" font-size="42" fill="${TEXT_WHITE}" dominant-baseline="middle" filter="url(#textShadow)">${escapeXml(player.username)}</text>`;
    
    // Score (right)
    const scoreText = player.score >= 0 ? `$${player.score}` : `-$${Math.abs(player.score)}`;
    svg += `<text x="${width - padding}" y="${textY}" font-family="${FONT_SWISS}" font-size="42" fill="${scoreColor}" text-anchor="end" dominant-baseline="middle" filter="url(#textShadow)">${scoreText}</text>`;
    
    // Separator line
    if (index < sortedPlayers.length - 1) {
      svg += `<line x1="${padding}" y1="${y + rowHeight}" x2="${width - padding}" y2="${y + rowHeight}" stroke="${BORDER_COLOR}" stroke-width="2" stroke-opacity="0.5"/>`;
    }
  });
  
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
  
  // Define text shadow filter
  svg += `<defs><filter id="textShadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="2" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.8"/></filter></defs>`;
  
  svg += `<rect width="${width}" height="${height}" fill="${JEOPARDY_BLUE}"/>`;

  // Header
  svg += `<text x="${width / 2}" y="50" font-family="${FONT_SWISS}" font-size="40" fill="${TEXT_GOLD}" text-anchor="middle" filter="url(#textShadow)">${escapeXml(headerText)}</text>`;

  // Clue text
  const textCenterY = height / 2;
  svg += renderSvgTextLines(lines, width / 2, textCenterY, fontSize, TEXT_WHITE);

  svg += '</svg>';
  return svgToJpeg(svg);
}
