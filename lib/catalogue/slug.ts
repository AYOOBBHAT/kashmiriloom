export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isSlug(value: string, max = 80): boolean {
  return value.length > 0 && value.length <= max && SLUG_PATTERN.test(value);
}
