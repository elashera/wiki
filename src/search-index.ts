// Search index generator
// Creates a search index from the navigation data for client-side search.
import { getNavigation } from './navigation';
import { getArticlesForModule, getAvailableNavigation } from './content-links';

export interface SearchResult {
  id: string;
  title: string;
  description: string;
  slug: string;
  section: string;
}

export function buildSearchIndex(lang: 'es' | 'en' = 'es'): SearchResult[] {
  const sections = getAvailableNavigation(lang, getNavigation(lang));
  const results: SearchResult[] = [];

  for (const section of sections) {
    for (const item of section.items) {
      const articles = getArticlesForModule(lang, item.slug);
      articles.forEach((article, index) => {
        results.push({
          id: `${item.id}-${index}`,
          title: article.title,
          description: article.description || item.description,
          slug: article.slug,
          section: section.title,
        });
      });
    }
  }

  return results;
}
