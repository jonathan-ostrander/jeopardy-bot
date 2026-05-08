import { AnswerCheck } from '../shared/types';

export function normalizeAnswer(answer: string): string {
  return answer
    .toLowerCase()
    .replace(/^(what|who|where|when|why|how) (is|are|was|were) /i, '')
    .replace(/^(the|a|an) /i, '')
    .replace(/[?!.]+$/, '')
    .trim();
}

export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

export function checkAnswer(
  playerAnswer: string,
  acceptableAnswers: string[],
  threshold: number = parseFloat(process.env.ANSWER_SIMILARITY_THRESHOLD || '0.8')
): AnswerCheck {
  const normalizedPlayer = normalizeAnswer(playerAnswer);

  if (!normalizedPlayer) {
    return { isCorrect: false, confidence: 0, matchedAnswer: null };
  }

  for (const correct of acceptableAnswers) {
    const normalizedCorrect = normalizeAnswer(correct);

    if (!normalizedCorrect) continue;

    // Exact match
    if (normalizedPlayer === normalizedCorrect) {
      return { isCorrect: true, confidence: 1.0, matchedAnswer: correct };
    }

    // Substring match
    if (normalizedPlayer.includes(normalizedCorrect) || normalizedCorrect.includes(normalizedPlayer)) {
      return { isCorrect: true, confidence: 0.9, matchedAnswer: correct };
    }

    // Levenshtein distance
    const distance = levenshteinDistance(normalizedPlayer, normalizedCorrect);
    const maxLen = Math.max(normalizedPlayer.length, normalizedCorrect.length);
    const similarity = 1 - (distance / maxLen);

    if (similarity >= threshold) {
      return { isCorrect: true, confidence: similarity, matchedAnswer: correct };
    }
  }

  return { isCorrect: false, confidence: 0, matchedAnswer: null };
}

export function parseAcceptableAnswers(answer: string): string[] {
  // Split on common separators used in j-archive
  const separators = /\s*(?:\(or\)|\/|\|\|)\s*/i;
  const answers = answer.split(separators).map(a => a.trim()).filter(a => a.length > 0);
  
  // Also add the full answer as an option
  if (!answers.includes(answer.trim())) {
    answers.push(answer.trim());
  }

  return answers;
}

export function validateAnswerFormat(answer: string): boolean {
  // Must start with "What is", "Who is", "Where is", etc. and end with "?"
  const formatRegex = /^(what|who|where|when|why|how)\s+(is|are|was|were)\s+.+\?$/i;
  return formatRegex.test(answer.trim());
}
