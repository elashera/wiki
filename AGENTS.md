# AI Engineer Wiki — Agent Guidelines

## Project Overview

Bilingual (ES/EN) technical wiki built with Astro. Serves as both an **Obsidian vault** (with `[[wikilinks]]`, callouts) and a **static website** deployed to `wiki.elashera.com`.

**Tech stack:** Astro 4.16+, TypeScript 5.6+, remark/rehype pipeline, Shiki syntax highlighting, Caddy server.

## Architecture

### Content flow: Markdown → Rendered page

1. Markdown files live in `src/content/docs/{es,en}/{module}/{article}.md`
2. `src/pages/{es,en}/[...slug].astro` scans the filesystem via `getStaticPaths()` to generate routes
3. `MarkdownRenderer.astro` reads files directly with `fs.readFileSync`, parses frontmatter manually, and runs a full unified/remark/rehype pipeline
4. Custom `remarkWikilink()` plugin converts `[[slug]]` and `[[slug|alias]]` to standard markdown links by resolving against a filesystem-based slug map

### Key files

| File | Purpose |
|---|---|
| `src/navigation.ts` | 18-module nav tree (ES & EN) + slug mapping + `translatePath()` |
| `src/content-links.ts` | Filesystem-based article resolver, `getAvailableNavigation()` |
| `src/search-index.ts` | Client-side search index builder |
| `src/components/MarkdownRenderer.astro` | Core renderer: reads MD, wikilinks, ToC extraction, rehype pipeline |
| `src/components/Sidebar.astro` | Collapsible module/article tree, filtered by available content |
| `src/components/LanguageSwitcher.astro` | ES/EN toggle using `translatePath()` for correct slug mapping |
| `src/styles/global.css` | All CSS (layout, typography, components, responsive) |

### Module slug mapping

ES and EN use **different module slugs** (e.g., `01-redes-internet` vs `01-networking-internet`). The `LanguageSwitcher` uses `translatePath()` from `navigation.ts` to map between them. **Never hardcode URL swapping** — always use the mapping.

## Content Structure

### Directory layout

```
src/content/docs/
├── es/
│   ├── index.md                          # Home page
│   ├── 01-redes-internet/                # Module 1
│   │   ├── 01-que-es-internet.md
│   │   └── ...
│   ├── 02-infra-contenedores/            # Module 2
│   ├── 03-sistemas-distribuidos/         # Module 3
│   └── 99-ia-para-gente-curiosa/        # Extra module (ES only)
└── en/
    ├── index.md
    ├── 01-networking-internet/           # Module 1
    └── 03-distributed-systems/           # Module 3
```

### Article frontmatter

```yaml
---
title: "Article Title"
description: "Brief description for search and meta tags"
---
```

Both `title` and `description` are required by the content collection schema in `src/content.config.ts`.

### Wikilinks

Use Obsidian-style wikilinks to reference other articles:

```markdown
See [[03-dns-profundo]] for DNS details.
Check [[05-http-profundo|HTTP deep dive]] for more.
```

- Wikilinks resolve by **slug name** across all modules in the current language
- If the slug is not found, falls back to the language index page
- Wikilinks are **language-scoped** — they only resolve within the same language folder

### Callouts

Use Obsidian callout syntax:

```markdown
> [!tip]
> Useful information

> [!warning]
> Something to watch out for

> [!info]
> General information
```

### Code blocks

Use fenced code blocks with language identifier. Syntax highlighting is handled by Shiki via `rehype-pretty-code`:

````
```python
def hello():
    print("Hello, world!")
```
````

## Adding New Content

### Steps

1. Create the `.md` file in `src/content/docs/{lang}/{module}/`
2. Follow the naming convention: `{number}-{slug-with-dashes}.md` (e.g., `04-dns-profundo.md`)
3. Add frontmatter with `title` and `description`
4. If creating a **new module**, also:
   - Add it to both `enNavData` and `esNavData` in `src/navigation.ts`
   - Add the slug mapping in `slugMapEntries`
   - Create the directory in both `es/` and `en/` folders
5. Run `npx astro build` to verify

### File naming

- Lowercase, hyphens only: `01-que-es-internet.md`
- Number prefix for ordering: `01-`, `02-`, etc.
- Match the article's primary topic slug

## Source Verification Requirements

### Mandatory sourcing

All technical content **must** cite reliable, accepted sources. This is non-negotiable for the wiki's credibility.

### Accepted sources

**Tier 1 — Primary/Official documentation (highest trust):**
- Official language/framework docs (e.g., docs.python.org, developer.mozilla.org)
- RFCs and standards (e.g., rfc-editor.org, w3.org specs)
- Official vendor documentation (e.g., docs.aws.amazon.com, cloud.google.com/docs)
- Published peer-reviewed papers (arXiv, ACM, IEEE)

**Tier 2 — Authoritative technical resources:**
- Well-known technical books (O'Reilly, Manning, etc.)
- Reputable technical blogs with cited sources (e.g., blog.cloudflare.com, netflix.techblog.com)
- Verified open-source project documentation (e.g., kubernetes.io, docker.com)
- Established educational platforms (e.g., MIT OCW, Stanford courses)

**Tier 3 — Community-verified resources:**
- High-quality Stack Overflow answers with significant community validation
- Well-maintained GitHub repositories with active communities
- Technical conference talks from recognized events (QCon, GOTO, Strange Loop)

### Rejected sources

- Unverified personal blogs without citations
- Content farms or SEO-driven articles
- AI-generated content without human verification
- Outdated documentation (check dates — prefer resources updated within 2-3 years)
- Forums or Q&A without established expertise indicators

### How to cite

Add a `## Referencias` (ES) or `## References` (EN) section at the end of each article:

```markdown
## Referencias

- [RFC 7230 — HTTP/1.1 Message Syntax](https://www.rfc-editor.org/rfc/rfc7230)
- [MDN: HTTP](https://developer.mozilla.org/en-US/docs/Web/HTTP)
- *Computer Networking: A Top-Down Approach* — Kurose & Ross, 8th Edition
```

### Verification checklist

Before finalizing any article, verify:

- [ ] All technical claims have at least one cited source
- [ ] Links point to current, accessible resources
- [ ] Code examples are tested and working
- [ ] Version-specific information includes the version/date
- [ ] No unattributed copied content

## Common Tasks

### Adding a new article

```bash
# 1. Create the file
touch src/content/docs/es/01-redes-internet/22-new-topic.md

# 2. Add frontmatter and content, then build
npx astro build
```

### Adding a new module

1. Create directories: `src/content/docs/es/{slug}/` and `src/content/docs/en/{slug}/`
2. Add module entry to `enNavData` and `esNavData` in `src/navigation.ts`
3. Add bidirectional mapping in `slugMapEntries`
4. Create `index.md` in each directory
5. Run `npx astro build`

### Testing changes

```bash
npx astro build          # Verify static build succeeds
npx astro check          # TypeScript type checking
npx astro dev            # Local dev server
```

## Gotchas

1. **Module slugs differ between languages.** Always use `translatePath()` from `navigation.ts` — never swap `es`/`en` in URLs manually.
2. **`MarkdownRenderer` requires `lang` prop.** Every usage must pass `lang="es"` or `lang="en"` explicitly.
3. **Content collection schema is unused for rendering.** The `content.config.ts` schema provides types but rendering is done via direct filesystem access.
4. **Wikilinks are language-scoped.** `[[slug]]` only resolves within the current language's content directory.
5. **Root-level draft directories are obsolete.** `01-fundamentos-internet/` and `02-infraestructura-contenedores/` at the repo root are leftover drafts — ignore them.
