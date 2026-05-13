# AI Engineer Wiki

Bilingual technical documentation for AI engineers and distributed systems practitioners. Built with [Astro](https://astro.build/).

## Prerequisites

- [Node.js](https://nodejs.org/) 18+ 
- [npm](https://www.npmjs.com/) or [pnpm](https://pnpm.io/)

## Setup

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

The dev server will be available at `http://localhost:4321`.

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the development server on port 4321 |
| `npm run start` | Alias for `npm run dev` |
| `npm run build` | Build the site for production |
| `npm run preview` | Preview the production build locally |
| `npm run check` | Run TypeScript/Astro type checking |

## Directory Structure

```
src/
├── components/          # Reusable UI components
│   ├── NavBar.astro     # Top navigation bar
│   ├── Sidebar.astro    # Left sidebar navigation
│   ├── SearchBar.astro  # Search input with filtering
│   └── LanguageSwitcher.astro  # Language toggle (ES/EN)
├── content/
│   └── docs/
│       ├── es/          # Spanish content
│       │   ├── index.md # Spanish home page
│       │   └── [module-slug]/  # Module directories
│       └── en/          # English content
│           ├── index.md # English home page
│           └── [module-slug]/  # Module directories
├── layouts/
│   ├── BaseLayout.astro   # HTML skeleton with fonts
│   └── AppLayout.astro    # Main layout (NavBar + Sidebar + Content)
├── pages/
│   ├── es/
│   │   ├── index.astro    # Spanish home page route
│   │   └── [...slug].astro  # Spanish module routes
│   └── en/
│       ├── index.astro    # English home page route
│       └── [...slug].astro  # English module routes
├── styles/
│   └── global.css         # Global CSS variables and styles
├── navigation.ts          # Navigation data (18 modules)
├── search-index.ts        # Search index builder
└── content.config.ts      # Astro content collection config
```

## Content

- Each language has an `index.md` home page and a directory for each of the 18 modules.
- Content uses Markdown with frontmatter (`title` and `description`).
- Module directories follow the slugs defined in `src/navigation.ts` (e.g., `01-redes-internet`, `02-infra-contenedores`).

## Symlinks

At the repository root:
- `ES` → `src/content/docs/es/` (Spanish content)
- `EN` → `src/content/docs/en/` (English content)

## License

Internal documentation project.
