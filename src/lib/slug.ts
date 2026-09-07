/**
 * Slug uniqueness — probe an exists-checker and append `-2`, `-3`, … suffixes.
 * Pure/async-generic so it is unit-testable without a database.
 */
export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  let slug = base;
  let i = 1;
  while (await exists(slug)) {
    slug = `${base}-${++i}`;
  }
  return slug;
}

export const slugifyTitle = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
