export function classifyNps(score) {
  if (!Number.isInteger(score) || score < 0 || score > 10) return null;
  if (score <= 6) return 'detractor';
  if (score <= 8) return 'passive';
  return 'promoter';
}

export function calculateNps(scores) {
  const valid = scores.filter((score) => classifyNps(score));
  if (!valid.length) return null;
  const promoters = valid.filter((score) => score >= 9).length;
  const detractors = valid.filter((score) => score <= 6).length;
  return Math.round(((promoters - detractors) * 100) / valid.length);
}
