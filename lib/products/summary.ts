export function summaryFromDescription(description: string): string {
  const trimmed = description.trim();
  const match = trimmed.match(/^[\s\S]*?[.!?](?:\s|$)/);
  const sentence = (match?.[0] ?? trimmed).trim();
  if (sentence.length <= 180) {
    return sentence;
  }
  return `${sentence.slice(0, 177).trimEnd()}…`;
}
