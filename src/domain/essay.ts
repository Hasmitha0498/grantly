/** Words are whitespace-delimited tokens after trimming. */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/u).length;
}

export interface EssayEvaluation {
  words: number;
  limit: number;
  overBy: number;
  isEmpty: boolean;
  canMarkReady: boolean;
  ready: boolean;
}

export function evaluateEssayDraft(body: string, wordLimit: number, userMarkedReady: boolean): EssayEvaluation {
  const words = countWords(body);
  const overBy = Math.max(0, words - wordLimit);
  const isEmpty = words === 0;
  const canMarkReady = !isEmpty && overBy === 0;
  return { words, limit: wordLimit, overBy, isEmpty, canMarkReady, ready: canMarkReady && userMarkedReady };
}
