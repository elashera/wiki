// Search index generator
// Creates a search index from the navigation data for client-side search.
import { getNavigation } from './navigation';

export interface SearchResult {
  id: string;
  title: string;
  description: string;
  slug: string;
  section: string;
}

export function buildSearchIndex(): SearchResult[] {
  const sections = getNavigation();
  const results: SearchResult[] = [];

  for (const section of sections) {
    for (const item of section.items) {
      results.push({
        id: item.id,
        title: item.title,
        description: item.description,
        slug: item.slug,
        section: section.title,
      });
    }
  }

  return results;
}
