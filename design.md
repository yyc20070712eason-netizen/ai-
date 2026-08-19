# Design - AI 学习计划 v5.1.0

Locked design system for the whole application. Future UI work reads this file
first. `tokens.css` is the runtime source of truth; local pages may extend roles,
but must not fork the palette, typography, spacing, motion, or component states.

## Product Context

- Audience: one desktop learner building durable AI knowledge from long-form lessons.
- Primary job: read, predict, practise, review, and move to the next stage without losing context.
- Tone: atmospheric, technical, quiet, and exact. This is a research workbench, not a dashboard or marketing site.
- Genre: atmospheric application UI.
- Macrostructure: Workbench for app surfaces; Long Document rhythm inside lessons; Map / Diagram only for the knowledge tree.

## Structural Fingerprint

- Top: 56px fixed masthead with course-rail toggle, versioned identity, day/night switch, and a bounded workspace menu for search, notes, practice, favorites, review, archive, tree, and settings.
- Left: 272px P3-derived course rail with a 3x3 dot mark, continuous rounded progress line, compact chapter hierarchy, outlined green completion marks, and real weekly study time.
- Centre: compact stage header, flat two-column learning brief, readable lesson stream, code, practice, notes, quiz, and next-stage handoff.
- Right: 272px conditional utility rail with a large circular timer, vertical next-task timeline, and next-stage handoff. It is hidden before 1280px.
- Flat surfaces and rules create hierarchy. Do not put cards inside cards or turn page sections into floating cards.

## Deterministic Layout

- Below 1024px: course directory is a drawer; lesson uses the full viewport.
- 1024-1279px: `15rem / minmax(0, 1fr)`; the right utility rail is hidden.
- 1280px and above: `17rem / minmax(0, 1fr) / 17rem`.
- Lesson page container may expand to 68rem for the learning brief; running prose remains at no more than 68ch.
- Learning brief: one flat two-column band separated by a single rule. Stack below the desktop content breakpoint.
- Stable desktop stage title: 36px / 1.16. Do not scale it with viewport width.
- Validate at 320, 375, 414, 768, 1280, 1440, and 1920 CSS pixels without horizontal page overflow.

## Theme

- Axis: dark paper / technical grotesk sans / cool ice-blue accent.
- Graphite is blue-tinted and never pure black. Text is warm-white but never pure white.
- Ice blue is reserved for focus, active state, links, progress, and timer progress.
- Green is reserved for verified completion. Red is reserved for errors and destructive actions.
- PDF document pages retain their source-white canvas; only the reader shell uses the graphite system.
- No gradients, glow, glass, blur decoration, neon HUD, floating blobs, or decorative illustration.

## Typography

- Display and body: `IBM Plex Sans Variable`, then `Noto Sans SC`, then `Microsoft YaHei UI`.
- Data and code: `JetBrains Mono`.
- All letter spacing is `0`. No negative tracking, expanded small caps, synthetic italics, or viewport-scaled type.
- Body: 16px / 1.75. UI labels: 12-14px. Stage title: 36px desktop. Compact page titles: 28-36px.
- Headings, functional labels, and data differ through size, weight, placement, and font role, not extra colour.

## Spacing And Shape

- Use the named 4/8-derived scale in `tokens.css`. Raw spacing values are allowed only for one-pixel rules and fixed control geometry.
- Control height: 44px where touch reachable. Icon controls use a stable square footprint.
- Radius: 4px small, 6px controls, 8px framed tools; circular indicators may use a full radius.
- Rules are 1px or 2px. Dark-surface elevation comes from surface lightness, not glow shadows.

## Motion

- Press feedback: 100ms `translateY(1px) scale(0.97)` plus an immediate surface change.
- Active indicator: 180-240ms transform/opacity movement; course-rail locator, reading timeline, completion mark, and day/night switch use this primitive.
- Overlay and drawer: 280-360ms, same path on enter and exit, transform plus opacity only; they remain interruptible.
- No bounce, spring, parallax, width/height animation, scroll spectacle, or universal reveal.
- `prefers-reduced-motion`: remove spatial travel and use an opacity change of at most 150ms.

## Interaction And Accessibility

- Every interactive element supports default, hover, focus-visible, active, disabled, loading, error, and success where applicable.
- Focus rings are immediate, 2px, and at least 3:1 against both the element and surrounding surface.
- Clickable labels never wrap. Touch targets are at least 44x44px on coarse pointers.
- Overlays return focus to their opener; Escape and the visible back/close command follow the same exit path.
- Success is silent when the result is already visible. State is never communicated by colour alone.

## Learning-Specific Rules

- Overall progress uses the live catalog total and exposes progressbar semantics.
- Completed stages use an outlined green circle-check. Current plus completed keeps both signals.
- Weekly study time includes local Monday 00:00 through the current moment only.
- The learning brief always reads real `stage.outcome`, `stage.knowledge.keyConcepts`, `stage.problem`, and `stage.prediction` fields.
- Lesson section numbers are stage-aware, for example `3.1`, `3.2`, `3.3`.
- Timer states are idle, running, paused, and complete; ice blue indicates progress and green indicates completion.
- Section time allocation is calculated from real stage duration and reading weight; displayed section totals exactly match the stage duration.

## Shared Global Surfaces

- Knowledge tree, favorites, review, archive, search, settings, and PDF shell share the same page-header density, rules, typography, completion states, and motion primitives.
- Knowledge-tree topology, pan, zoom, minimap, and persisted viewport remain unchanged. Only hierarchy, colour, node states, and detail surfaces may change.
- Search is a focused overlay, not a glass command palette. Settings is a bounded native dialog with stable focus management.
- Application pages do not use decorative enrichment. The original PDF canvas is the only media surface.

## Exports

### tokens.css

`tokens.css` in the project root is canonical. Core contract:

```css
:root {
  --color-paper: oklch(13.5% 0.018 250);
  --color-paper-2: oklch(16.5% 0.020 250);
  --color-paper-3: oklch(20% 0.022 250);
  --color-ink: oklch(94% 0.010 245);
  --color-ink-2: oklch(82% 0.016 245);
  --color-rule: oklch(27% 0.023 250);
  --color-accent: oklch(72% 0.140 248);
  --color-accent-ink: oklch(13% 0.018 250);
  --color-focus: oklch(80% 0.140 248);
  --font-display: "IBM Plex Sans Variable", "Noto Sans SC", "Microsoft YaHei UI", sans-serif;
  --font-body: "IBM Plex Sans Variable", "Noto Sans SC", "Microsoft YaHei UI", sans-serif;
  --font-mono: "JetBrains Mono", "Cascadia Code", monospace;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in: cubic-bezier(0.7, 0, 0.84, 0);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --dur-press: 100ms;
  --dur-indicator: 220ms;
  --dur-overlay: 320ms;
}
```

### Tailwind v4 `@theme`

```css
@theme {
  --color-paper: oklch(13.5% 0.018 250);
  --color-paper-2: oklch(16.5% 0.020 250);
  --color-paper-3: oklch(20% 0.022 250);
  --color-ink: oklch(94% 0.010 245);
  --color-ink-2: oklch(82% 0.016 245);
  --color-rule: oklch(27% 0.023 250);
  --color-accent: oklch(72% 0.140 248);
  --color-focus: oklch(80% 0.140 248);
  --font-display: "IBM Plex Sans Variable", "Noto Sans SC", "Microsoft YaHei UI", sans-serif;
  --font-body: "IBM Plex Sans Variable", "Noto Sans SC", "Microsoft YaHei UI", sans-serif;
  --font-mono: "JetBrains Mono", monospace;
  --spacing-xs: 0.5rem;
  --spacing-sm: 0.75rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --text-base: 1rem;
  --text-xl: 1.75rem;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
}
```

### DTCG `tokens.json`

```json
{
  "$schema": "https://design-tokens.github.io/community-group/format/",
  "color": {
    "paper": { "$value": "oklch(13.5% 0.018 250)", "$type": "color" },
    "paper-2": { "$value": "oklch(16.5% 0.020 250)", "$type": "color" },
    "ink": { "$value": "oklch(94% 0.010 245)", "$type": "color" },
    "accent": { "$value": "oklch(72% 0.140 248)", "$type": "color" },
    "focus": { "$value": "oklch(80% 0.140 248)", "$type": "color" }
  },
  "font": {
    "display": { "$value": "IBM Plex Sans Variable, Noto Sans SC, Microsoft YaHei UI, sans-serif", "$type": "fontFamily" },
    "body": { "$value": "IBM Plex Sans Variable, Noto Sans SC, Microsoft YaHei UI, sans-serif", "$type": "fontFamily" },
    "mono": { "$value": "JetBrains Mono, Cascadia Code, monospace", "$type": "fontFamily" }
  },
  "space": {
    "xs": { "$value": "0.5rem", "$type": "dimension" },
    "md": { "$value": "1rem", "$type": "dimension" },
    "xl": { "$value": "2.5rem", "$type": "dimension" }
  },
  "duration": {
    "press": { "$value": "100ms", "$type": "duration" },
    "indicator": { "$value": "220ms", "$type": "duration" },
    "overlay": { "$value": "320ms", "$type": "duration" }
  }
}
```

### shadcn/ui CSS variables

These are compatibility mappings only; the app does not import shadcn/ui.

```css
:root {
  --background: 13.5% 0.018 250;
  --foreground: 94% 0.010 245;
  --card: 16.5% 0.020 250;
  --card-foreground: 94% 0.010 245;
  --popover: 16.5% 0.020 250;
  --popover-foreground: 94% 0.010 245;
  --primary: 72% 0.140 248;
  --primary-foreground: 13% 0.018 250;
  --secondary: 20% 0.022 250;
  --secondary-foreground: 82% 0.016 245;
  --muted: 27% 0.023 250;
  --muted-foreground: 72% 0.018 245;
  --destructive: 66% 0.180 28;
  --destructive-foreground: 96% 0.010 245;
  --border: 27% 0.023 250;
  --input: 36% 0.027 250;
  --ring: 80% 0.140 248;
  --radius: 0.5rem;
}
```
