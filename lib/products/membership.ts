export function categoryMembership(category: string): { $or: Array<Record<string, string>> } {
  return { $or: [{ category }, { collectionSlugs: category }] };
}
