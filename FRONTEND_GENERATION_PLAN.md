# Frontend Generation Plan for site2sanity-cli

## Executive Summary

Transform site2sanity-cli from a CMS schema generator into a **complete website scaffolding tool** that generates both the Sanity backend and a fully-functional frontend that displays the content.

**Current State:** Crawl website → Generate Sanity schema
**Target State:** Crawl website → Generate Sanity schema + Complete frontend codebase

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           site2sanity-cli                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   CRAWL     │───▶│   ANALYZE   │───▶│     MAP     │───▶│   EXPORT    │  │
│  │  (existing) │    │  (existing) │    │  (existing) │    │  (enhanced) │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └──────┬──────┘  │
│         │                  │                                      │         │
│         │                  │                                      ▼         │
│         │                  │                            ┌─────────────────┐ │
│         │                  │                            │ SANITY SCHEMA   │ │
│         │                  │                            │   (existing)    │ │
│         │                  │                            └─────────────────┘ │
│         │                  │                                      │         │
│         ▼                  ▼                                      ▼         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    NEW: FRONTEND GENERATOR                           │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │                                                                      │   │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐            │   │
│  │  │    DESIGN     │  │   COMPONENT   │  │     DATA      │            │   │
│  │  │   EXTRACTOR   │  │   GENERATOR   │  │    LAYER      │            │   │
│  │  │               │  │               │  │   GENERATOR   │            │   │
│  │  │ - Colors      │  │ - Pages       │  │               │            │   │
│  │  │ - Typography  │  │ - Components  │  │ - GROQ queries│            │   │
│  │  │ - Spacing     │  │ - Layouts     │  │ - TypeScript  │            │   │
│  │  │ - Breakpoints │  │ - Blocks      │  │ - Loaders     │            │   │
│  │  └───────────────┘  └───────────────┘  └───────────────┘            │   │
│  │           │                  │                  │                    │   │
│  │           ▼                  ▼                  ▼                    │   │
│  │  ┌─────────────────────────────────────────────────────────────┐    │   │
│  │  │              FRAMEWORK ADAPTER (Next.js, Astro, etc.)        │    │   │
│  │  └─────────────────────────────────────────────────────────────┘    │   │
│  │                               │                                      │   │
│  └───────────────────────────────┼──────────────────────────────────────┘   │
│                                  ▼                                          │
│                    ┌─────────────────────────────┐                          │
│                    │   COMPLETE FRONTEND PROJECT │                          │
│                    │   - Ready to deploy         │                          │
│                    │   - Connected to Sanity     │                          │
│                    │   - Styled like original    │                          │
│                    └─────────────────────────────┘                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack Selection

### Goal
Allow users to choose their preferred technologies for every layer of the frontend stack, ensuring the generated code matches their team's expertise and project requirements.

### New Module: `src/core/frontend/techStack.ts`

### Tech Stack Configuration Interface

```typescript
interface TechStackConfig {
  // Core Framework
  framework: FrameworkChoice;

  // Styling
  styling: StylingChoice;

  // UI Components
  uiLibrary: UILibraryChoice;

  // Icons
  iconLibrary: IconLibraryChoice;

  // Animations
  animation: AnimationChoice;

  // Forms
  forms: FormsChoice;

  // State Management (if needed)
  stateManagement: StateManagementChoice;

  // Package Manager
  packageManager: PackageManagerChoice;

  // Deployment Target
  deployment: DeploymentChoice;

  // Additional Options
  options: {
    typescript: boolean;
    eslint: boolean;
    prettier: boolean;
    testing: TestingChoice;
    storybook: boolean;
    i18n: I18nChoice;
  };
}
```

---

### 1. Framework Choices

| Framework | Description | Best For |
|-----------|-------------|----------|
| **Next.js (App Router)** | React framework with SSR/SSG | Full-featured web apps, SEO-critical sites |
| **Next.js (Pages Router)** | React framework (legacy routing) | Teams familiar with pages directory |
| **Astro** | Content-focused, multi-framework | Content sites, blogs, marketing pages |
| **Remix** | React with nested routing | Data-heavy apps, complex forms |
| **Nuxt** | Vue.js framework | Vue teams, full-stack Vue apps |
| **SvelteKit** | Svelte framework | Performance-critical, smaller bundles |
| **Gatsby** | React static site generator | Static marketing sites, blogs |

```typescript
type FrameworkChoice = {
  name: 'nextjs-app' | 'nextjs-pages' | 'astro' | 'remix' | 'nuxt' | 'sveltekit' | 'gatsby';
  version: string;  // e.g., "14", "4", "3"
};
```

---

### 2. Styling Choices

| Styling | Description | Generates |
|---------|-------------|-----------|
| **Tailwind CSS** | Utility-first CSS | tailwind.config.ts, utility classes |
| **CSS Modules** | Scoped CSS files | *.module.css files |
| **styled-components** | CSS-in-JS (React) | Styled component definitions |
| **Emotion** | CSS-in-JS (flexible) | @emotion/styled components |
| **Sass/SCSS** | CSS preprocessor | *.scss files with variables |
| **Vanilla CSS** | Plain CSS | Standard CSS files |
| **UnoCSS** | Atomic CSS engine | uno.config.ts, utility classes |
| **Panda CSS** | Type-safe CSS-in-JS | panda.config.ts, styled system |

```typescript
type StylingChoice = {
  name: 'tailwind' | 'css-modules' | 'styled-components' | 'emotion' | 'scss' | 'vanilla' | 'unocss' | 'panda';
  version: string;
  config?: {
    // Tailwind-specific
    plugins?: ('forms' | 'typography' | 'aspect-ratio' | 'container-queries')[];
    // General
    cssVariables: boolean;
    darkMode: 'class' | 'media' | false;
  };
};
```

---

### 3. UI Component Library Choices

| Library | Description | Framework | Best For |
|---------|-------------|-----------|----------|
| **shadcn/ui** | Copy-paste Radix components | React | Full customization, modern React |
| **Radix UI** | Unstyled accessible primitives | React | Custom design systems |
| **Headless UI** | Unstyled Tailwind components | React/Vue | Tailwind projects |
| **Chakra UI** | Styled component library | React | Rapid prototyping |
| **MUI (Material UI)** | Google Material Design | React | Enterprise apps |
| **Mantine** | Full-featured React library | React | Feature-rich apps |
| **Ant Design** | Enterprise UI library | React | Admin dashboards |
| **DaisyUI** | Tailwind component library | Any | Quick Tailwind styling |
| **Vuetify** | Material Design for Vue | Vue | Vue Material apps |
| **PrimeVue** | Rich UI components | Vue | Enterprise Vue apps |
| **Skeleton** | Svelte UI toolkit | Svelte | SvelteKit projects |
| **None** | Custom components only | Any | Full control |

```typescript
type UILibraryChoice = {
  name: 'shadcn' | 'radix' | 'headless-ui' | 'chakra' | 'mui' | 'mantine' | 'antd' | 'daisyui' | 'vuetify' | 'primevue' | 'skeleton' | 'none';
  version: string;
  components?: string[];  // Specific components to include (for shadcn)
};
```

#### shadcn/ui Component Selection

When shadcn/ui is selected, prompt for which components to install:

```
? Select shadcn/ui components to include:
  ◉ Button
  ◉ Card
  ◉ Input
  ◉ Dialog
  ◉ Dropdown Menu
  ◉ Navigation Menu
  ◯ Data Table
  ◯ Calendar
  ◯ Carousel
  ◯ Charts
```

---

### 4. Icon Library Choices

| Library | Icons | Style |
|---------|-------|-------|
| **Lucide** | 1400+ | Clean, consistent |
| **Heroicons** | 300+ | Tailwind's official |
| **Phosphor** | 7000+ | Flexible weights |
| **Tabler** | 4500+ | Consistent stroke |
| **Radix Icons** | 300+ | Minimal, accessible |
| **Font Awesome** | 2000+ | Classic, recognizable |
| **React Icons** | Multi-library | Collection of libraries |
| **Iconify** | 150,000+ | Universal icon framework |

```typescript
type IconLibraryChoice = {
  name: 'lucide' | 'heroicons' | 'phosphor' | 'tabler' | 'radix-icons' | 'fontawesome' | 'react-icons' | 'iconify' | 'none';
};
```

---

### 5. Animation Library Choices

| Library | Description | Best For |
|---------|-------------|----------|
| **Framer Motion** | Declarative animations | React, complex animations |
| **GSAP** | Professional-grade | Timeline animations, scroll |
| **Motion One** | Lightweight, performant | Simple animations |
| **AutoAnimate** | Automatic transitions | Quick wins, lists |
| **Lottie** | After Effects animations | Complex illustrations |
| **CSS Animations** | Native CSS | Simple transitions |
| **None** | No animation library | Minimal bundle |

```typescript
type AnimationChoice = {
  name: 'framer-motion' | 'gsap' | 'motion-one' | 'auto-animate' | 'lottie' | 'css' | 'none';
};
```

---

### 6. Form Handling Choices

| Library | Description | Validation |
|---------|-------------|------------|
| **React Hook Form** | Performant, minimal re-renders | zod, yup, joi |
| **Formik** | Battle-tested, declarative | yup, custom |
| **TanStack Form** | Headless, type-safe | Built-in, zod |
| **Conform** | Progressive enhancement | zod |
| **Native Forms** | HTML forms only | HTML5 validation |
| **VeeValidate** | Vue form validation | zod, yup |
| **Superforms** | SvelteKit forms | zod |

```typescript
type FormsChoice = {
  name: 'react-hook-form' | 'formik' | 'tanstack-form' | 'conform' | 'native' | 'vee-validate' | 'superforms';
  validation: 'zod' | 'yup' | 'joi' | 'native' | 'none';
};
```

---

### 7. State Management Choices (Optional)

| Library | Description | Best For |
|---------|-------------|----------|
| **None (React Context)** | Built-in React | Simple state |
| **Zustand** | Minimal, hooks-based | Small-medium apps |
| **Jotai** | Atomic state | Fine-grained reactivity |
| **TanStack Query** | Server state | API data fetching |
| **Redux Toolkit** | Predictable state | Large apps, time-travel |
| **Pinia** | Vue store | Vue apps |
| **Svelte Stores** | Built-in Svelte | SvelteKit apps |

```typescript
type StateManagementChoice = {
  name: 'none' | 'zustand' | 'jotai' | 'tanstack-query' | 'redux-toolkit' | 'pinia' | 'svelte-stores';
};
```

---

### 8. Package Manager Choices

| Manager | Description |
|---------|-------------|
| **npm** | Node.js default |
| **yarn** | Facebook's alternative |
| **pnpm** | Fast, disk-efficient |
| **bun** | All-in-one toolkit |

```typescript
type PackageManagerChoice = 'npm' | 'yarn' | 'pnpm' | 'bun';
```

---

### 9. Deployment Target Choices

| Platform | Features | Config Generated |
|----------|----------|-----------------|
| **Vercel** | Next.js native, edge | vercel.json |
| **Netlify** | JAMstack, forms | netlify.toml |
| **Cloudflare Pages** | Edge, fast | wrangler.toml |
| **AWS Amplify** | Full AWS integration | amplify.yml |
| **Railway** | Simple deploys | railway.json |
| **Docker** | Container-based | Dockerfile |
| **Generic** | No platform-specific | None |

```typescript
type DeploymentChoice = {
  name: 'vercel' | 'netlify' | 'cloudflare' | 'amplify' | 'railway' | 'docker' | 'generic';
  config?: {
    // Platform-specific options
    edge?: boolean;
    serverless?: boolean;
    static?: boolean;
  };
};
```

---

### 10. Testing Choices

| Framework | Description |
|-----------|-------------|
| **Vitest** | Fast, Vite-native |
| **Jest** | Industry standard |
| **Playwright** | E2E, cross-browser |
| **Cypress** | E2E, component testing |
| **Testing Library** | Component testing |
| **None** | Skip testing setup |

```typescript
type TestingChoice = {
  unit: 'vitest' | 'jest' | 'none';
  e2e: 'playwright' | 'cypress' | 'none';
  component: 'testing-library' | 'none';
};
```

---

### 11. Internationalization (i18n) Choices

| Library | Framework |
|---------|-----------|
| **next-intl** | Next.js |
| **react-i18next** | React |
| **vue-i18n** | Vue/Nuxt |
| **Paraglide** | Any (Inlang) |
| **None** | Single language |

```typescript
type I18nChoice = {
  name: 'next-intl' | 'react-i18next' | 'vue-i18n' | 'paraglide' | 'none';
  defaultLocale?: string;
  locales?: string[];
};
```

---

### Interactive Tech Stack Selection Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    TECH STACK CONFIGURATION                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ? Select your framework:                                        │
│    ❯ Next.js (App Router)    - React with SSR/SSG               │
│      Next.js (Pages Router)  - Legacy Next.js routing           │
│      Astro                   - Content-focused, islands         │
│      Remix                   - Full-stack React                 │
│      Nuxt                    - Vue.js framework                 │
│      SvelteKit               - Svelte framework                 │
│                                                                  │
│  ? Select styling approach:                                      │
│    ❯ Tailwind CSS            - Utility-first CSS                │
│      shadcn/ui + Tailwind    - Pre-built components             │
│      CSS Modules             - Scoped CSS files                 │
│      styled-components       - CSS-in-JS                        │
│      Sass/SCSS               - CSS preprocessor                 │
│                                                                  │
│  ? Select UI component library:                                  │
│    ❯ shadcn/ui               - Customizable Radix components    │
│      Radix UI (unstyled)     - Accessible primitives            │
│      Headless UI             - Tailwind Labs components         │
│      Chakra UI               - Styled component library         │
│      None                    - Custom components only           │
│                                                                  │
│  ? Select icon library:                                          │
│    ❯ Lucide                  - Clean, consistent (recommended)  │
│      Heroicons               - Tailwind's official icons        │
│      Phosphor                - Flexible icon weights            │
│                                                                  │
│  ? Select animation library:                                     │
│    ❯ Framer Motion           - Declarative animations           │
│      CSS Only                - Native CSS transitions           │
│      None                    - No animations                    │
│                                                                  │
│  ? Select form handling:                                         │
│    ❯ React Hook Form + Zod   - Performant with validation       │
│      Native HTML Forms       - Simple HTML5 forms               │
│                                                                  │
│  ? Select package manager:                                       │
│    ❯ pnpm                    - Fast, disk-efficient             │
│      npm                     - Node.js default                  │
│      yarn                    - Classic alternative              │
│      bun                     - All-in-one runtime               │
│                                                                  │
│  ? Select deployment target:                                     │
│    ❯ Vercel                  - Best for Next.js                 │
│      Netlify                 - Great for static/JAMstack        │
│      Docker                  - Container-based                  │
│      Generic                 - No platform config               │
│                                                                  │
│  ? Additional options:                                           │
│    ◉ TypeScript                                                  │
│    ◉ ESLint + Prettier                                          │
│    ◯ Storybook                                                   │
│    ◯ Unit Tests (Vitest)                                         │
│    ◯ E2E Tests (Playwright)                                      │
│    ◯ Internationalization (i18n)                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

### Preset Configurations

Offer quick-start presets for common combinations:

```typescript
const presets: Record<string, Partial<TechStackConfig>> = {
  'modern-react': {
    framework: { name: 'nextjs-app', version: '14' },
    styling: { name: 'tailwind', version: '3' },
    uiLibrary: { name: 'shadcn' },
    iconLibrary: { name: 'lucide' },
    animation: { name: 'framer-motion' },
    forms: { name: 'react-hook-form', validation: 'zod' },
    packageManager: 'pnpm',
    deployment: { name: 'vercel' },
  },

  'minimal': {
    framework: { name: 'astro', version: '4' },
    styling: { name: 'tailwind', version: '3' },
    uiLibrary: { name: 'none' },
    iconLibrary: { name: 'lucide' },
    animation: { name: 'css' },
    forms: { name: 'native', validation: 'native' },
    packageManager: 'npm',
    deployment: { name: 'netlify' },
  },

  'enterprise': {
    framework: { name: 'nextjs-app', version: '14' },
    styling: { name: 'tailwind', version: '3' },
    uiLibrary: { name: 'shadcn' },
    iconLibrary: { name: 'lucide' },
    animation: { name: 'framer-motion' },
    forms: { name: 'react-hook-form', validation: 'zod' },
    stateManagement: { name: 'tanstack-query' },
    packageManager: 'pnpm',
    deployment: { name: 'vercel' },
    options: {
      typescript: true,
      eslint: true,
      prettier: true,
      testing: { unit: 'vitest', e2e: 'playwright', component: 'testing-library' },
      storybook: true,
      i18n: { name: 'next-intl' },
    },
  },

  'vue': {
    framework: { name: 'nuxt', version: '3' },
    styling: { name: 'tailwind', version: '3' },
    uiLibrary: { name: 'headless-ui' },
    iconLibrary: { name: 'heroicons' },
    animation: { name: 'css' },
    forms: { name: 'vee-validate', validation: 'zod' },
    stateManagement: { name: 'pinia' },
    packageManager: 'pnpm',
    deployment: { name: 'vercel' },
  },

  'svelte': {
    framework: { name: 'sveltekit', version: '2' },
    styling: { name: 'tailwind', version: '3' },
    uiLibrary: { name: 'skeleton' },
    iconLibrary: { name: 'lucide' },
    animation: { name: 'css' },
    forms: { name: 'superforms', validation: 'zod' },
    stateManagement: { name: 'svelte-stores' },
    packageManager: 'pnpm',
    deployment: { name: 'vercel' },
  },
};
```

---

### CLI Command Integration

```bash
# Interactive selection
s2s frontend

# Use preset
s2s frontend --preset=modern-react

# Specify individual options
s2s frontend --framework=nextjs --ui=shadcn --styling=tailwind

# Full custom configuration
s2s frontend \
  --framework=nextjs-app \
  --styling=tailwind \
  --ui=shadcn \
  --icons=lucide \
  --animation=framer-motion \
  --forms=react-hook-form \
  --validation=zod \
  --package-manager=pnpm \
  --deploy=vercel \
  --typescript \
  --eslint \
  --prettier
```

---

### Compatibility Matrix

Not all combinations work together. The system validates choices:

```typescript
const compatibilityRules: CompatibilityRule[] = [
  // Framework-specific UI libraries
  { if: { framework: 'nuxt' }, then: { uiLibrary: ['headless-ui', 'vuetify', 'primevue', 'none'] } },
  { if: { framework: 'sveltekit' }, then: { uiLibrary: ['skeleton', 'none'] } },

  // Styling compatibility
  { if: { uiLibrary: 'chakra' }, then: { styling: ['emotion', 'styled-components'] } },
  { if: { uiLibrary: 'shadcn' }, then: { styling: ['tailwind'] } },
  { if: { uiLibrary: 'daisyui' }, then: { styling: ['tailwind'] } },

  // Form libraries per framework
  { if: { framework: 'nuxt' }, then: { forms: ['vee-validate', 'native'] } },
  { if: { framework: 'sveltekit' }, then: { forms: ['superforms', 'native'] } },

  // State management per framework
  { if: { framework: 'nuxt' }, then: { stateManagement: ['pinia', 'none'] } },
  { if: { framework: 'sveltekit' }, then: { stateManagement: ['svelte-stores', 'none'] } },
];
```

---

### Generated Dependencies Example

For `modern-react` preset, `package.json` includes:

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@sanity/client": "^6.0.0",
    "@sanity/image-url": "^1.0.0",
    "@portabletext/react": "^3.0.0",
    "lucide-react": "^0.300.0",
    "framer-motion": "^10.0.0",
    "react-hook-form": "^7.0.0",
    "@hookform/resolvers": "^3.0.0",
    "zod": "^3.22.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "@types/react": "^18.2.0",
    "@types/node": "^20.0.0",
    "eslint": "^8.56.0",
    "prettier": "^3.1.0"
  }
}
```

---

## Phase 1: Design System Extraction

### Goal
Extract design tokens and visual patterns from the crawled website to ensure the generated frontend matches the original site's look and feel.

### New Module: `src/core/design/extractor.ts`

```typescript
interface DesignSystem {
  colors: {
    primary: string[];
    secondary: string[];
    neutral: string[];
    semantic: { success: string; warning: string; error: string; info: string };
    backgrounds: string[];
    text: string[];
  };
  typography: {
    fontFamilies: { heading: string; body: string; mono?: string };
    fontSizes: Record<string, string>;  // sm, base, lg, xl, 2xl, etc.
    fontWeights: Record<string, number>;
    lineHeights: Record<string, string>;
  };
  spacing: {
    scale: Record<string, string>;  // 1, 2, 4, 8, 16, etc.
    containerMaxWidth: string;
    sectionPadding: string;
  };
  breakpoints: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  borders: {
    radius: Record<string, string>;
    widths: string[];
  };
  shadows: string[];
  transitions: {
    duration: string;
    easing: string;
  };
}
```

### Implementation Steps

1. **CSS Extraction** - Parse stylesheets from crawled pages
   - Extract CSS custom properties (--var-name)
   - Parse computed styles from key elements
   - Identify CSS framework (Tailwind, Bootstrap, custom)

2. **Color Analysis** - Use AI vision on screenshots
   - Identify primary brand colors
   - Extract color palette with frequency analysis
   - Map colors to semantic roles (primary, secondary, etc.)

3. **Typography Detection**
   - Extract font-family declarations
   - Identify Google Fonts or custom fonts
   - Map heading/body typography scales

4. **Spacing & Layout**
   - Analyze container widths
   - Extract common padding/margin values
   - Identify grid systems

### Output: `design-system.json` + Tailwind config / CSS variables file

---

## Phase 2: Component Generation

### Goal
Generate React/Vue/Svelte components for every detected page type, block type, and reusable object.

### New Module: `src/core/frontend/componentGenerator.ts`

### Component Categories

#### 1. Page Components
One component per document type in the Sanity schema:

```
src/components/pages/
├── HomePage.tsx          # From 'homePage' document type
├── BlogPost.tsx          # From 'blogPost' document type
├── ProductPage.tsx       # From 'product' document type
├── AboutPage.tsx         # From 'aboutPage' singleton
└── ContactPage.tsx       # From 'contactPage' singleton
```

#### 2. Block Components
UI blocks detected from visual analysis:

```
src/components/blocks/
├── HeroSection.tsx       # Hero/banner sections
├── FeatureGrid.tsx       # Feature cards in grid
├── Testimonials.tsx      # Testimonial carousels/grids
├── CallToAction.tsx      # CTA sections
├── PricingTable.tsx      # Pricing comparison
├── FAQ.tsx               # Accordion FAQ
├── ImageGallery.tsx      # Photo galleries
├── TeamGrid.tsx          # Team member cards
└── ContactForm.tsx       # Contact forms
```

#### 3. Layout Components
```
src/components/layout/
├── Header.tsx            # From navigation.json
├── Footer.tsx            # From navigation.json
├── Sidebar.tsx           # If detected
├── Breadcrumbs.tsx       # From navigation patterns
└── Layout.tsx            # Main layout wrapper
```

#### 4. UI Primitives
```
src/components/ui/
├── Button.tsx
├── Card.tsx
├── Image.tsx             # Sanity image component
├── Link.tsx              # Internal/external link handling
├── PortableText.tsx      # Rich text renderer
├── SEO.tsx               # Meta tags component
└── Loading.tsx           # Loading states
```

### AI-Powered Component Generation

Use Claude with vision to analyze screenshots and generate components:

```typescript
interface ComponentGenerationContext {
  // From existing analysis
  pageType: PageType;
  documentSchema: SanityDocumentType;
  blockTypes: BlockType[];

  // Design context
  designSystem: DesignSystem;

  // Visual context
  screenshots: string[];  // Base64 or URLs

  // Framework target
  framework: 'nextjs' | 'astro' | 'remix' | 'nuxt' | 'sveltekit';
  styling: 'tailwind' | 'css-modules' | 'styled-components';
}
```

### Component Generation Pipeline

```
1. Screenshot + Schema → AI Analysis
   "Here's a blog post page. The schema has: title, author, publishedAt,
    content (portableText), categories. Generate a React component."

2. Design System Injection
   - Apply extracted colors, typography, spacing
   - Use Tailwind classes or CSS variables

3. Data Layer Integration
   - Generate TypeScript types from schema
   - Add GROQ query for the component
   - Wire up data fetching

4. Accessibility Enhancement
   - Add ARIA labels
   - Ensure keyboard navigation
   - Add semantic HTML
```

---

## Phase 3: Data Layer Generation

### Goal
Generate type-safe data fetching with GROQ queries, TypeScript types, and loader functions.

### New Module: `src/core/frontend/dataLayerGenerator.ts`

### Generated Files

#### 1. TypeScript Types (`src/types/sanity.ts`)
```typescript
// Auto-generated from Sanity schema
export interface BlogPost {
  _id: string;
  _type: 'blogPost';
  title: string;
  slug: { current: string };
  author: Reference<Author>;
  publishedAt: string;
  content: PortableTextBlock[];
  categories: Reference<Category>[];
  seo?: SEO;
}

export interface Author {
  _id: string;
  _type: 'author';
  name: string;
  image?: SanityImage;
  bio?: PortableTextBlock[];
}
// ... etc
```

#### 2. GROQ Queries (`src/lib/queries.ts`)
```typescript
export const blogPostQuery = groq`
  *[_type == "blogPost" && slug.current == $slug][0] {
    _id,
    title,
    slug,
    publishedAt,
    content,
    "author": author-> {
      _id,
      name,
      image,
      bio
    },
    "categories": categories[]-> {
      _id,
      title,
      slug
    },
    seo
  }
`;

export const blogPostsListQuery = groq`
  *[_type == "blogPost"] | order(publishedAt desc) {
    _id,
    title,
    slug,
    publishedAt,
    "author": author->name,
    "excerpt": pt::text(content)[0..200]
  }
`;
```

#### 3. Data Loaders (`src/lib/loaders.ts`)
```typescript
import { client } from './sanity.client';
import { blogPostQuery, blogPostsListQuery } from './queries';
import type { BlogPost } from '@/types/sanity';

export async function getBlogPost(slug: string): Promise<BlogPost | null> {
  return client.fetch(blogPostQuery, { slug });
}

export async function getBlogPosts(): Promise<BlogPost[]> {
  return client.fetch(blogPostsListQuery);
}
```

#### 4. Sanity Client (`src/lib/sanity.client.ts`)
```typescript
import { createClient } from '@sanity/client';
import imageUrlBuilder from '@sanity/image-url';

export const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
  apiVersion: '2024-01-01',
  useCdn: process.env.NODE_ENV === 'production',
});

const builder = imageUrlBuilder(client);
export const urlFor = (source: any) => builder.image(source);
```

---

## Phase 4: Framework Adapters

### Goal
Support multiple frontend frameworks with adapters that handle framework-specific patterns.

### New Module: `src/core/frontend/adapters/`

### Supported Frameworks

#### 1. Next.js (App Router) - Primary
```
out/frontend/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                    # Home page
│   ├── blog/
│   │   ├── page.tsx                # Blog listing
│   │   └── [slug]/
│   │       └── page.tsx            # Blog post
│   ├── products/
│   │   ├── page.tsx
│   │   └── [slug]/
│   │       └── page.tsx
│   └── [...slug]/
│       └── page.tsx                # Catch-all for other pages
├── components/
│   ├── blocks/
│   ├── layout/
│   ├── pages/
│   └── ui/
├── lib/
│   ├── sanity.client.ts
│   ├── queries.ts
│   └── loaders.ts
├── types/
│   └── sanity.ts
├── styles/
│   └── globals.css
├── tailwind.config.ts
├── next.config.js
├── package.json
└── .env.example
```

#### 2. Astro
```
out/frontend/
├── src/
│   ├── pages/
│   │   ├── index.astro
│   │   ├── blog/
│   │   │   ├── index.astro
│   │   │   └── [slug].astro
│   ├── components/
│   ├── layouts/
│   └── lib/
├── astro.config.mjs
└── package.json
```

#### 3. Remix
```
out/frontend/
├── app/
│   ├── routes/
│   │   ├── _index.tsx
│   │   ├── blog._index.tsx
│   │   └── blog.$slug.tsx
│   ├── components/
│   └── lib/
└── package.json
```

#### 4. Nuxt (Vue)
```
out/frontend/
├── pages/
│   ├── index.vue
│   ├── blog/
│   │   ├── index.vue
│   │   └── [slug].vue
├── components/
├── composables/
└── nuxt.config.ts
```

#### 5. SvelteKit
```
out/frontend/
├── src/
│   ├── routes/
│   │   ├── +page.svelte
│   │   ├── blog/
│   │   │   ├── +page.svelte
│   │   │   └── [slug]/
│   │   │       └── +page.svelte
│   └── lib/
└── svelte.config.js
```

### Framework Adapter Interface

```typescript
interface FrameworkAdapter {
  name: string;
  fileExtension: '.tsx' | '.vue' | '.svelte' | '.astro';

  // Generate project structure
  generateProjectStructure(config: FrontendConfig): FileTree;

  // Generate page component
  generatePage(pageType: PageType, schema: DocumentType): GeneratedFile;

  // Generate routing
  generateRoutes(navigation: Navigation, pageTypes: PageType[]): GeneratedFile[];

  // Generate layout
  generateLayout(navigation: Navigation, designSystem: DesignSystem): GeneratedFile;

  // Generate config files
  generateConfigFiles(config: FrontendConfig): GeneratedFile[];

  // Package.json dependencies
  getDependencies(): Record<string, string>;
}
```

---

## Phase 5: New CLI Commands

### 1. Enhanced `export` Command

Add `--frontend` flag to existing export:

```bash
s2s export --frontend              # Export Sanity + frontend
s2s export --frontend=nextjs       # Specify framework
s2s export --frontend --no-sanity  # Frontend only
```

### 2. New `frontend` Command

Dedicated frontend generation command:

```bash
s2s frontend                       # Interactive frontend generation
s2s frontend --framework=nextjs    # Specify framework
s2s frontend --styling=tailwind    # Specify styling
s2s frontend --preview             # Generate and run dev server
```

### Command Options

```typescript
interface FrontendCommandOptions {
  framework: 'nextjs' | 'astro' | 'remix' | 'nuxt' | 'sveltekit';
  styling: 'tailwind' | 'css-modules' | 'styled-components' | 'vanilla';
  typescript: boolean;

  // Design options
  extractDesign: boolean;        // Extract design from crawled site
  designSystem?: string;         // Path to custom design system

  // Component options
  componentStyle: 'functional' | 'class';
  includeTests: boolean;
  includeStorybook: boolean;

  // Data options
  generateTypes: boolean;
  generateQueries: boolean;

  // Output
  outDir: string;
  dryRun: boolean;
}
```

### 3. New `preview` Command

Preview generated frontend locally:

```bash
s2s preview                        # Start dev server for generated frontend
s2s preview --port=3001            # Custom port
```

---

## Phase 6: Interactive Workflow Enhancement

### Enhanced `start` Command Flow

```
1. URL Input (existing)
2. Crawl Configuration (existing)
3. Phase 1: HTML Crawl (existing)
4. Analysis (existing)
5. Phase 2: Screenshots (existing)
6. AI Analysis (existing)
7. Interactive Mapping (existing)
8. ─────────────────────────────
   NEW: Frontend Configuration
   ─────────────────────────────
   ? Generate frontend? (Y/n)
   ? Select framework: (Next.js / Astro / Remix / Nuxt / SvelteKit)
   ? Styling approach: (Tailwind / CSS Modules / Styled Components)
   ? Extract design from original site? (Y/n)
   ? Include TypeScript? (Y/n)
   ? Include Storybook? (y/N)
9. Export Sanity Schema (existing)
10. ─────────────────────────────
    NEW: Frontend Generation
    ─────────────────────────────
    ◐ Extracting design system...
    ◐ Generating TypeScript types...
    ◐ Generating GROQ queries...
    ◐ Generating components...
    ◐ Generating pages...
    ◐ Generating layouts...
    ◐ Writing project files...
    ✓ Frontend generated!
11. Summary & Next Steps
```

---

## Phase 7: AI Integration Enhancements

### Visual-to-Component Pipeline

```typescript
interface AIComponentGeneration {
  // Input
  screenshot: Buffer;
  documentSchema: SanityDocumentType;
  designSystem: DesignSystem;
  framework: string;

  // AI prompt construction
  buildPrompt(): string;

  // Output parsing
  parseResponse(response: string): GeneratedComponent;

  // Refinement loop
  refine(component: GeneratedComponent, feedback: string): GeneratedComponent;
}
```

### Prompt Templates

```typescript
const componentGenerationPrompt = `
You are generating a ${framework} component for a ${pageType.name} page.

SANITY SCHEMA:
${JSON.stringify(documentSchema, null, 2)}

DESIGN SYSTEM:
${JSON.stringify(designSystem, null, 2)}

SCREENSHOT:
[Attached image of the original page]

Generate a React component that:
1. Renders all fields from the schema
2. Matches the visual layout from the screenshot
3. Uses the design system colors, typography, spacing
4. Uses Tailwind CSS classes
5. Is fully accessible (ARIA labels, semantic HTML)
6. Handles loading and error states
7. Is TypeScript-typed

Return the component code wrapped in \`\`\`tsx code blocks.
`;
```

### Cost Optimization

- **Batch screenshots**: Send multiple page types in one request
- **Template fallbacks**: Use templates when AI unavailable
- **Caching**: Cache generated components for similar page types
- **Incremental**: Only regenerate changed components

---

## Phase 8: Output Structure

### Complete Generated Project

```
out/
├── sanity/                          # Existing Sanity output
│   ├── schemaTypes/
│   │   ├── documents/
│   │   ├── objects/
│   │   ├── blocks/
│   │   └── index.ts
│   └── README.md
│
├── frontend/                        # NEW: Frontend output
│   ├── app/                         # Next.js app directory
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   ├── blog/
│   │   │   ├── page.tsx
│   │   │   └── [slug]/
│   │   │       └── page.tsx
│   │   └── [slug]/
│   │       └── page.tsx
│   │
│   ├── components/
│   │   ├── blocks/
│   │   │   ├── HeroSection.tsx
│   │   │   ├── FeatureGrid.tsx
│   │   │   ├── Testimonials.tsx
│   │   │   ├── CallToAction.tsx
│   │   │   └── index.ts
│   │   │
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   ├── Navigation.tsx
│   │   │   └── index.ts
│   │   │
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Image.tsx
│   │   │   ├── PortableText.tsx
│   │   │   └── index.ts
│   │   │
│   │   └── pages/
│   │       ├── HomePage.tsx
│   │       ├── BlogPost.tsx
│   │       └── index.ts
│   │
│   ├── lib/
│   │   ├── sanity.client.ts
│   │   ├── sanity.image.ts
│   │   ├── queries.ts
│   │   └── loaders.ts
│   │
│   ├── types/
│   │   └── sanity.ts
│   │
│   ├── styles/
│   │   └── design-tokens.css
│   │
│   ├── public/
│   │   └── fonts/
│   │
│   ├── .env.example
│   ├── .env.local.example
│   ├── next.config.js
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── package.json
│   └── README.md
│
└── mapping/                         # Existing mapping output
    └── mappingSpec.json
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Design system extractor module
- [ ] TypeScript type generator from Sanity schema
- [ ] GROQ query generator
- [ ] Basic Next.js adapter

### Phase 2: Component Generation (Week 3-4)
- [ ] AI component generation pipeline
- [ ] Block component templates
- [ ] Layout component generation
- [ ] UI primitive library

### Phase 3: Framework Support (Week 5-6)
- [ ] Complete Next.js adapter
- [ ] Astro adapter
- [ ] Routing generation
- [ ] Configuration file generation

### Phase 4: CLI Integration (Week 7)
- [ ] `frontend` command
- [ ] Enhanced `export` command
- [ ] Interactive workflow updates
- [ ] `preview` command

### Phase 5: Polish & Documentation (Week 8)
- [ ] Error handling & validation
- [ ] Documentation
- [ ] Example projects
- [ ] Testing

---

## Technical Considerations

### Dependencies to Add

```json
{
  "@babel/parser": "^7.23.0",
  "@babel/generator": "^7.23.0",
  "prettier": "^3.1.0",
  "typescript": "^5.3.0",
  "postcss": "^8.4.0",
  "tailwindcss": "^3.4.0",
  "css-tree": "^2.3.0"
}
```

### File System Helpers

```typescript
interface GeneratedFile {
  path: string;           // Relative path from output root
  content: string;        // File content
  overwrite: boolean;     // Allow overwriting existing
}

interface FileTree {
  files: GeneratedFile[];
  directories: string[];
}
```

### Template Engine

Use simple string interpolation with fallbacks:

```typescript
const renderTemplate = (
  template: string,
  context: Record<string, any>
): string => {
  return template.replace(
    /\{\{(\w+)\}\}/g,
    (_, key) => context[key] ?? ''
  );
};
```

---

## Configuration Extensions

### `config.json` Additions

```json
{
  "frontend": {
    "enabled": true,
    "framework": "nextjs",
    "frameworkVersion": "14",
    "styling": "tailwind",
    "typescript": true,
    "features": {
      "designExtraction": true,
      "aiComponents": true,
      "storybook": false,
      "tests": false
    },
    "output": {
      "dir": "frontend",
      "componentStyle": "functional",
      "fileNaming": "PascalCase"
    }
  }
}
```

---

## Success Metrics

1. **Functional**: Generated frontend runs with `npm run dev`
2. **Connected**: Successfully fetches data from Sanity
3. **Styled**: Visually similar to original site (70%+ similarity)
4. **Typed**: Full TypeScript coverage
5. **Accessible**: Passes axe-core basic checks
6. **Deployable**: Works on Vercel/Netlify out of the box

---

## Open Questions

1. **Content migration**: Should we also migrate content or just structure?
2. **Image handling**: Download images or keep original URLs during dev?
3. **Form handling**: How to handle contact forms, search, etc.?
4. **Authentication**: Support for protected pages?
5. **E-commerce**: Special handling for product pages?
6. **Multi-language**: i18n support from the start?

---

## Next Steps

1. Review and approve this plan
2. Create feature branch
3. Start with Phase 1: Design system extraction
4. Iterate with user feedback

