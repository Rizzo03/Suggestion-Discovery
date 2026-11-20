import { PILOT_PROFILE } from './pilot';
export function textStatistics(text: string) {
  return {
    wordCount: [...new Intl.Segmenter('en', { granularity: 'word' }).segment(text)].filter(
      (x) => x.isWordLike,
    ).length,
    sentenceCount: [...new Intl.Segmenter('en', { granularity: 'sentence' }).segment(text)].filter(
      (x) => x.segment.trim(),
    ).length,
  };
}
export function meetsTextPolicy(text: string) {
  const stats = textStatistics(text),
    policy = PILOT_PROFILE.textPolicy;
  return (
    stats.sentenceCount === policy.sentences &&
    stats.wordCount >= policy.minWords &&
    stats.wordCount <= policy.maxWords
  );
}
