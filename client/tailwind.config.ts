import type { Config } from 'tailwindcss'
import plugin from 'tailwindcss/plugin'

/**
 * Tuan Tanah design system — light "paper" neobrutalism.
 *
 * Semantic tokens live here so components reference intent (surface/accent/ink)
 * instead of raw palette steps. The signature look = flat bright fills + thick
 * `ink` borders + hard offset shadows (no blur) + a press interaction.
 *
 * The rules this file encodes (borders, elevation, accent semantics, type) are
 * rendered live at `/design` (`src/app/StyleGuide.tsx`). Change one, change both.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    /**
     * BREAKPOINTS — declared in full (not inherited) so the set is the app's
     * own decision, not Tailwind's default. Mobile-first: a prefix applies at
     * that width and up; `max-*` variants (e.g. `max-hud:`) apply below it.
     *
     *   xs   480  Large-phone portrait. Room for a second column of chips.
     *   hud  600  ★ THE HUD SWITCH. See the note below — this is the one
     *             breakpoint with layout meaning, not just a sizing step.
     *   sm   640  Generic "not a phone" content step (grid columns, gaps).
     *   md   768  Tablet portrait. Headers go horizontal, icon buttons regain
     *             their labels (`RoomActions`).
     *   lg  1024  Board and the persistent sidebar fit side by side
     *             (`Game.tsx`: `lg:flex-row` + `lg:w-80`). Below this the
     *             sidebar stacks under the board.
     *   xl  1280  Comfortable desktop.
     *   2xl 1536  Wide desktop; the page is capped at max-w-[1400px] anyway.
     *
     * ── `hud` (600px): the phone-portrait HUD switch ──────────────────────
     * BELOW `hud` (`max-hud:`) the game screen is phone-portrait: the board
     * sits on top at full width and the player panel / action bar / event log
     * move into a swipe-up bottom drawer.
     * AT `hud` AND UP the current layout stands: board with panels beside it
     * (`lg`) or stacked beneath it (below `lg`).
     *
     * Why 600 and not `sm`:
     *   - It clears every mainstream phone-portrait width with headroom — the
     *     widest is ~430px (iPhone Pro Max / S Ultra) — so all of them, plus
     *     future/foldable portrait, get the drawer.
     *   - It sits below the narrowest phone *landscape* width (667px) and
     *     below every tablet-portrait width (744px+), so neither is dragged
     *     into a drawer layout that assumes a tall viewport.
     *   - It is deliberately NOT an alias of `sm` (640): `sm` is a content
     *     step used for grid/gap tuning across the app, and retuning the HUD
     *     threshold must not reflow unrelated grids.
     * Tailwind's built-in `portrait:` / `landscape:` variants are available if
     * a rule needs orientation on top of width.
     */
    screens: {
      xs: '480px',
      hud: '600px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
      // `short` is deliberately NOT here — see the plugin at the bottom of this
      // file. A `raw` entry in `screens` makes Tailwind stop generating the
      // `max-*` variant for EVERY screen, which would silently break
      // `max-hud:` and friends.
    },
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        display: ['"Archivo Black"', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },

      /**
       * TYPE SCALE — every step is `[size, { lineHeight, letterSpacing? }]`, so
       * `text-*` alone gives a complete, correct block of text. A `leading-*`
       * or `tracking-*` utility still wins if a call site needs to override.
       *
       * Display steps (3xl and up) carry -0.025em baked in: at Archivo Black's
       * weight, default tracking reads loose above ~30px. That is exactly the
       * `tracking-tight` every display heading already spells out by hand, so
       * the utility is now redundant rather than load-bearing at those steps.
       *
       * 2xl and below keep normal tracking, because they are shared with body
       * and UI text (`text-2xl font-black` on a cash figure, `text-xl` on a
       * label) which must not tighten. A `font-display` heading at 2xl or below
       * therefore still spells out `tracking-tight` itself — that pairing is the
       * one place the scale can't decide for you.
       *
       * `3xs`/`2xs` are the new steps: dense game chrome (owner chips, tier
       * pips, tooltips, the money-delta pop) was reaching for `text-[10px]` /
       * `text-[11px]` ~40 times. Those are the two sizes below `xs`, named.
       */
      fontSize: {
        '3xs': ['0.625rem', { lineHeight: '0.875rem' }], // 10px — pips, dense chips
        '2xs': ['0.6875rem', { lineHeight: '0.875rem' }], // 11px — badges, tooltips
        xs: ['0.75rem', { lineHeight: '1rem' }], // 12px — labels, overlines, hints
        sm: ['0.875rem', { lineHeight: '1.25rem' }], // 14px — dense UI copy, sm controls
        base: ['1rem', { lineHeight: '1.5rem' }], // 16px — body copy, md controls
        lg: ['1.125rem', { lineHeight: '1.75rem' }], // 18px — lg controls, modal titles
        xl: ['1.25rem', { lineHeight: '1.75rem' }], // 20px — section headings
        '2xl': ['1.5rem', { lineHeight: '2rem' }], // 24px — card/page headings
        '3xl': ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '-0.025em' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem', letterSpacing: '-0.025em' }],
        '5xl': ['3rem', { lineHeight: '1', letterSpacing: '-0.025em' }],
        '6xl': ['3.75rem', { lineHeight: '1', letterSpacing: '-0.025em' }],
      },

      /**
       * SPACING — deliberately NOT extended. An audit of every arbitrary-value
       * utility in `src/` found zero one-off spacing values outside the board,
       * and the board's are `cqw` container-query units (`Board/geometry.ts`)
       * which are a fluid measuring system, not a scale this config should own.
       * Tailwind's 4px-step spacing already covers the component sizing here,
       * so adding a parallel scale would only give callers a second way to say
       * the same thing. Revisit only if a real repeated gap shows up.
       */

      colors: {
        // Surfaces
        paper: '#FBF3E2', // warm cream — the page background
        surface: '#FFFFFF', // cards / panels
        'surface-sunken': '#F4EAD2', // insets, wells, muted tiles
        // Ink (borders + text). The black is the load-bearing brutalist element.
        ink: '#1A1714',
        'ink-muted': '#6B6256',
        'ink-faint': '#9A8F7D',
        /**
         * ACCENT FAMILIES — four, each with a fixed job. Pick by meaning, never
         * to decorate. Every family is `DEFAULT` (the fill) / `strong` (hover
         * and emphasized text on paper) / `soft` (tinted surface behind copy).
         *
         *   accent   Attention + "this is yours to do". The primary button, the
         *            active tab, the current-turn marker, modal title bars, the
         *            page-title plate. One accent element per view wins; more
         *            than a couple and none of them read as primary.
         *   info     Neutral fact, not a call to action. Explanatory callouts,
         *            secondary/informational buttons, board region tags,
         *            "waiting…" states.
         *   danger   Loss, risk, irreversible. Debt and bankruptcy panels, rent
         *            owed, sell/surrender/delete confirms, error toasts.
         *   success  Gain, confirmed, complete. Income pops, deal accepted,
         *            property acquired, success toasts.
         *
         * `DEFAULT` fills always take an ink border and ink text — they are
         * tuned to be readable at full saturation behind black. `strong` is for
         * hover fills (which flip to white text) and for colored *text* on
         * paper, where `DEFAULT` is too light to pass contrast.
         */
        accent: { DEFAULT: '#FBBF24', strong: '#F59E0B', soft: '#FDE9B8' },
        info: { DEFAULT: '#4DABF7', strong: '#1C7ED6', soft: '#D5E9FB' },
        danger: { DEFAULT: '#FF6B6B', strong: '#E03131', soft: '#FFE0E0' },
        success: { DEFAULT: '#51CF66', strong: '#2F9E44', soft: '#D8F3DD' },
      },

      /**
       * BORDERS — the frame is the design. Rules:
       *   border-2 (2px)  THE frame weight. Every card, button, badge, input,
       *                   tile and modal panel uses it. ~85 call sites; treat
       *                   it as the only correct answer for a framed element.
       *   border-4 (4px)  Emphasis rule only — a heading underline or a divider
       *                   that has to out-shout the frames around it. Never a
       *                   box outline.
       *   border (1px)    Not used. A hairline reads as a different design
       *                   language next to a 2px frame; reach for `border-2`.
       * Border color defaults to `ink`, so `border-2` alone is already correct
       * and `border-ink` is only worth spelling out for emphasis.
       *
       * RADIUS — three steps, by element size:
       *   rounded-md (6px)   chips, pips, close buttons, icon squares
       *   rounded-lg (8px)   controls — buttons, inputs, tabs, toasts
       *   rounded-xl (12px)  containers — cards, panels, modal shells
       *   rounded-full       avatars, tokens, circular board marks
       */
      borderColor: {
        DEFAULT: '#1A1714',
      },

      /**
       * ELEVATION — hard offset shadows, no blur, no spread. The step encodes
       * how far an element sits off the page, and it pairs with `zIndex` below:
       *
       *   brutal-xs  1.5px  z-board  Sub-tile marks — ownership pips, tokens.
       *                             Anything drawn *on* the board surface.
       *   brutal-sm  2px    z-panel  Nested inside an already-framed parent:
       *                             inputs, tooltips, the active tab,
       *                             `<Card flat>`, and the disabled/pressed
       *                             state of a control. (`<Badge>` is the
       *                             exception: an inline chip stays unelevated
       *                             — border only — so runs of them in a row
       *                             don't read as a field of floating boxes.)
       *   brutal     4px    z-panel  THE RESTING DEFAULT. Standalone controls
       *                             and surfaces: `<Button>`, `<Card>`, panels.
       *   brutal-lg  6px    z-panel  Lifted — the hover state of a pressable
       *                             (`.brutal-press`), page-title plates, and
       *                             floating attention pieces (turn banner).
       *   brutal-xl  8px    z-modal  Top layer only: the modal panel. Nothing
       *                             that lives in the page flow gets this.
       *
       * `.brutal` / `.brutal-sm` / `.brutal-lg` in `index.css` bundle the
       * matching border with the shadow; `.brutal-press` animates xs→lg→sm
       * across rest/hover/active. Prefer those helpers over hand-pairing.
       */
      boxShadow: {
        'brutal-xs': '1.5px 1.5px 0 0 #1A1714',
        'brutal-sm': '2px 2px 0 0 #1A1714',
        brutal: '4px 4px 0 0 #1A1714',
        'brutal-lg': '6px 6px 0 0 #1A1714',
        'brutal-xl': '8px 8px 0 0 #1A1714',
      },

      transitionTimingFunction: {
        // Slight overshoot — gives chunky elements a tactile "snap".
        snap: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },

      // Named stacking order — see the elevation table above for the pairing.
      zIndex: {
        board: '0',
        panel: '10',
        drawer: '30', // phone-portrait HUD drawer (below hud) — over panels, under toasts
        toast: '40',
        modal: '50',
        tooltip: '60',
      },
    },
  },
  plugins: [
    /**
     * `short:` — a landscape phone. NOT part of the mobile-first width ladder:
     * it is an orientation + height guard, and the companion to `hud`. `hud`
     * handles "too narrow"; `short` handles "too flat". Always stack the two as
     * `hud:short:` so a small landscape *window* on a desktop can't be given a
     * layout too wide for it.
     *
     * What it fixes: the board already caps itself at `max-w-[min(90vh,1024px)]`,
     * so in phone landscape it shrinks correctly and does fit. The bug is that
     * the panels are stacked *underneath* it and therefore below the fold — you
     * would have to scroll away from the board to roll. That is a viewport
     * *height* condition, so no width breakpoint can express it.
     *
     * 540px separates phone landscape (heights 320–430) from tablet landscape
     * (iPad mini 744, iPad 768), so tablets keep the normal ladder.
     *
     * Why a plugin and not a `raw` entry in `screens`: a single `raw` screen
     * makes Tailwind stop emitting the `max-*` variant for *every* screen, so
     * `max-hud:` — which the phone-portrait HUD depends on — silently vanishes.
     * Registering the variant here leaves the `screens` ladder untouched.
     */
    plugin(({ addVariant }) => {
      addVariant('short', '@media (orientation: landscape) and (max-height: 540px)')
    }),
  ],
} satisfies Config
