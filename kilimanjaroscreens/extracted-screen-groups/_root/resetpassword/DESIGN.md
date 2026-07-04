---
name: Alpine Academic
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#3e4850'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#6e7881'
  outline-variant: '#bec8d2'
  surface-tint: '#006591'
  primary: '#006591'
  on-primary: '#ffffff'
  primary-container: '#0ea5e9'
  on-primary-container: '#003751'
  inverse-primary: '#89ceff'
  secondary: '#00687a'
  on-secondary: '#ffffff'
  secondary-container: '#57dffe'
  on-secondary-container: '#006172'
  tertiary: '#494bd6'
  on-tertiary: '#ffffff'
  tertiary-container: '#8d90ff'
  on-tertiary-container: '#1407ad'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#c9e6ff'
  primary-fixed-dim: '#89ceff'
  on-primary-fixed: '#001e2f'
  on-primary-fixed-variant: '#004c6e'
  secondary-fixed: '#acedff'
  secondary-fixed-dim: '#4cd7f6'
  on-secondary-fixed: '#001f26'
  on-secondary-fixed-variant: '#004e5c'
  tertiary-fixed: '#e1e0ff'
  tertiary-fixed-dim: '#c0c1ff'
  on-tertiary-fixed: '#07006c'
  on-tertiary-fixed-variant: '#2f2ebe'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  display-lg:
    fontFamily: Space Grotesk
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 36px
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 28px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  container-padding: 20px
---

## Brand & Style
The design system for Kilimanjaro Schools is built on a foundation of **Corporate Modern** aesthetics with a distinctive **High-Contrast** tech edge. It aims to evoke feelings of peak performance, clarity, and limitless potential—much like the view from a summit. The UI balances the structured reliability required for educational management with the energetic, forward-thinking spirit of a modern learning environment.

The visual style utilizes expansive whitespace, vibrant sky-based gradients, and precision-engineered typography to create an interface that feels both institutional and inspirational. It is designed specifically for a mobile-first experience, ensuring high legibility and touch-friendly interactions for students, teachers, and parents.

## Colors
This design system utilizes a hierarchy of blues to signify depth and academic rigor. The **primary skyBlue500** is the main interactive driver, while the **heroGradient** is reserved for high-impact surfaces like dashboard headers and profile summaries.

**Color Modes:**
- **Light Mode:** Uses `offWhite` (#F8FAFC) for backgrounds and `surface` (#F1F5F9) for secondary groupings. Borders should remain crisp at #E2E8F0.
- **Dark Mode:** Switches to a "Navy Night" theme using `darkBg` (#0F172A). UI cards should use `darkCard` (#243044) to maintain separation from the background. 

**Accent Logic:**
- Use **Emerald** for grades and success states.
- Use **Amber** for pending assignments or attendance warnings.
- Use **Rose** for critical alerts or overdue balances.

## Typography
The typography strategy pairings create a "Tech-Academic" hybrid. 

**Space Grotesk** is used for headings and displays. Its geometric, slightly industrial terminals provide a modern, innovative feel appropriate for a school looking toward the future. 

**Plus Jakarta Sans** handles all functional and reading tasks. Its soft, rounded characteristics ensure that dense information (like report cards or schedules) remains approachable and highly legible on small screens. Use `label-lg` for all button text and navigation items to ensure clarity.

## Layout & Spacing
This design system follows a **Fixed-Fluid Hybrid** model for mobile. While the outer container uses a fixed `20px` horizontal margin to frame the content, internal components follow an 8px (base 4px) soft grid.

**Layout Rules:**
- **Vertical Rhythm:** Use `24px` (lg) to separate distinct functional blocks (e.g., between "Upcoming Classes" and "Latest Announcements").
- **Component Padding:** Internal card padding should be `16px` (md) to maintain a spacious, breathable feel.
- **Lists:** List items should have a minimum height of `64px` for optimal thumb-tap targets.

## Elevation & Depth
Elevation in this design system is conveyed through **Sky-Tinted Shadows** in Light Mode and **Inner Glows** in Dark Mode.

**Light Mode Elevation:**
- **shadow1:** `0 2px 4px rgba(14, 165, 233, 0.05)` — subtle separation for cards.
- **shadow3:** `0 10px 15px rgba(14, 165, 233, 0.12)` — standard for floating buttons and active states.
- **shadow5:** `0 20px 25px rgba(14, 165, 233, 0.18)` — for modals and overlays.

**Dark Mode Elevation:**
Instead of heavy shadows, use a `1px` inner border of `darkBorder` at 0.6 opacity. For high-priority elements, add a subtle `0 0 15px rgba(14, 165, 233, 0.2)` blue outer glow to simulate depth in a dark environment.

## Shapes
The shape language is defined by a consistent **14px radius**, which strikes a balance between professional geometry and friendly accessibility. 

- **Containers & Cards:** Use the 14px standard.
- **Inputs & Buttons:** Use the 14px standard.
- **Chips:** Use a fully rounded (pill) shape to differentiate from interactive buttons.
- **Avatars:** Always circular to provide a soft counterpoint to the structured card layout.

## Components
Consistent component behavior is critical for the school ecosystem.

**Buttons:**
- Primary: Height of `54px`, 14px radius, using `primaryGradient`. Text is bold white.
- Secondary: Outline style using `skyBlue500` border and text.

**Input Fields:**
- Height: `56px`.
- Radius: `14px`.
- **Light Mode:** Filled with `offWhite`, `border` (#E2E8F0) on inactive, `skyBlue500` on focus.
- **Dark Mode:** Filled with `darkSurface`, `darkBorder` on inactive, `skyBlue500` glow on focus.

**Cards:**
- Use a white background (light) or `darkCard` (dark).
- Apply `shadow1` and a `1px` border of `surface` (light) or `darkBorder` (dark) to define the silhouette.

**Chips/Badges:**
- Use for subject tags (e.g., "Mathematics", "Physics"). 
- Backgrounds should be 10% opacity of the accent color with 100% opacity text of the same color.

**Lists:**
- Use "Clean Inset" dividers (dividers that don't reach the edge of the screen) using the `border` color.