import * as fs from 'fs';
import * as path from 'path';
import type { NavItem, NavSection } from './navigation';

const docsRoot = path.resolve('src/content/docs');

export interface ArticleLink {
  title: string;
  description: string;
  slug: string;
}

function parseFrontmatterValue(raw: string, key: string): string | null {
  const match = raw.match(new RegExp(`^${key}:\\s*"?([^"\\n]+)"?`, 'm'));
  return match?.[1]?.trim() ?? null;
}

function readArticleLink(lang: 'es' | 'en', moduleSlug: string, fileName: string): ArticleLink {
  const moduleName = moduleSlug.replace(/^\//, '');
  const filePath = path.join(docsRoot, lang, moduleName, fileName);
  const raw = fs.readFileSync(filePath, 'utf-8');
  const slug = `${moduleSlug}/${fileName.replace(/\.md$/, '')}`;

  return {
    title: parseFrontmatterValue(raw, 'title') ?? fileName.replace(/\.md$/, ''),
    description: parseFrontmatterValue(raw, 'description') ?? '',
    slug,
  };
}

export function getArticlesForModule(lang: 'es' | 'en', moduleSlug: string): ArticleLink[] {
  const moduleDir = path.join(docsRoot, lang, moduleSlug.replace(/^\//, ''));

  if (!fs.existsSync(moduleDir)) {
    return [];
  }

  return fs
    .readdirSync(moduleDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b))
    .map((fileName) => readArticleLink(lang, moduleSlug, fileName));
}

export function getFirstArticleSlug(lang: 'es' | 'en', moduleSlug: string): string | null {
  return getArticlesForModule(lang, moduleSlug)[0]?.slug ?? null;
}

export function getFirstArticleHref(lang: 'es' | 'en', moduleSlug: string): string | null {
  const firstArticleSlug = getFirstArticleSlug(lang, moduleSlug);
  return firstArticleSlug ? `/${lang}${firstArticleSlug}` : null;
}

export function getAvailableNavigation(lang: 'es' | 'en', sections: NavSection[]): NavSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item: NavItem) => getFirstArticleSlug(lang, item.slug) !== null),
    }))
    .filter((section) => section.items.length > 0);
}
