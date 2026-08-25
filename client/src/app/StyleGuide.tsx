import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  Badge,
  Button,
  Card,
  FloatUp,
  Modal,
  MoneyDelta,
  Tabs,
  Toast,
  Tooltip,
} from '@/components/ui/index.js'

/**
 * Living design-system reference at /design. Built entirely from the `ui/`
 * primitives + tokens, so it doubles as a visual smoke test for the system.
 *
 * This page is the human-readable half of `tailwind.config.ts` — the rules
 * documented in that file's comments are demonstrated here. If you change a
 * scale or a usage rule, change both.
 */
export function StyleGuide() {
  const [modalOpen, setModalOpen] = useState(false)
  const [modalSize, setModalSize] = useState<'xs' | 'sm' | 'md' | 'lg' | 'xl'>('md')
  const [toast, setToast] = useState<null | 'error' | 'warning' | 'info' | 'success'>(null)
  const [tab, setTab] = useState('actions')
  const [floatId, setFloatId] = useState<number | null>(null)
  const [cash, setCash] = useState(1_500_000)

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="-rotate-1">
          <h1 className="inline-block rounded-xl border-2 border-ink bg-accent px-5 py-2 font-display text-4xl uppercase shadow-brutal-lg">
            Design System
          </h1>
        </div>
        <Link to="/">
          <Button variant="ghost" size="sm">
            ← Back home
          </Button>
        </Link>
      </div>
      <p className="mt-4 max-w-2xl font-semibold text-ink-muted">
        Tuan Tanah — light “paper” neobrutalism. Flat bright fills, thick ink borders, hard offset
        shadows, and a tactile press. Everything below renders from the shared tokens + primitives
        in <Code>tailwind.config.ts</Code> and <Code>components/ui/</Code>.
      </p>

      {/* ─────────────────────────── Breakpoints ─────────────────────────── */}
      <Section
        title="Breakpoints"
        note="Declared in full in tailwind.config.ts — the app owns this set, it is not Tailwind's default. Mobile-first: a prefix applies at that width and up; max-* variants apply below it."
      >
        <Card pad="none" className="overflow-hidden">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-ink bg-surface-sunken text-left">
                <Th>Name</Th>
                <Th>Width</Th>
                <Th>What changes</Th>
              </tr>
            </thead>
            <tbody>
              <BreakRow
                name="xs"
                width="480px"
                desc="Large-phone portrait. Room for a second column of chips."
              />
              <BreakRow
                name="hud"
                width="600px"
                desc="★ The HUD switch — the one breakpoint with layout meaning. See below."
                highlight
              />
              <BreakRow
                name="sm"
                width="640px"
                desc="Generic “not a phone” content step: grid columns, gaps."
              />
              <BreakRow
                name="md"
                width="768px"
                desc="Tablet portrait. Headers go horizontal; icon buttons regain their labels."
              />
              <BreakRow
                name="lg"
                width="1024px"
                desc="Board + persistent sidebar fit side by side (Game.tsx: lg:flex-row, lg:w-80)."
              />
              <BreakRow name="xl" width="1280px" desc="Comfortable desktop." />
              <BreakRow
                name="2xl"
                width="1536px"
                desc="Wide desktop; the page is capped at max-w-[1400px] anyway."
              />
            </tbody>
          </table>
        </Card>

        <Card tone="accent" pad="md" className="mt-4">
          <h3 className="font-display text-lg uppercase tracking-tight">
            <Code>hud</Code> — the phone-portrait HUD switch
          </h3>
          <p className="mt-2 text-sm font-medium leading-relaxed">
            <strong>
              Below <Code>hud</Code>
            </strong>{' '}
            (<Code>max-hud:</Code>) the game screen is phone-portrait: the board sits on top at full
            width, and the player panel, action bar and event log move into a swipe-up bottom drawer
            (<Code>z-drawer</Code>).{' '}
            <strong>
              At <Code>hud</Code> and up
            </strong>{' '}
            the current layout stands — board with panels beside it (<Code>lg</Code>) or stacked
            beneath it (below <Code>lg</Code>).
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm font-medium">
            <li>
              600px clears every mainstream phone-portrait width with headroom — the widest is
              ~430px — so all of them, plus foldable portrait, get the drawer.
            </li>
            <li>
              It sits below the narrowest phone <em>landscape</em> width (667px) and below every
              tablet-portrait width (744px+), so neither is dragged into a drawer layout that
              assumes a tall viewport.
            </li>
            <li>
              It is deliberately <em>not</em> an alias of <Code>sm</Code>: <Code>sm</Code> tunes
              grids across the app, and retuning the HUD threshold must not reflow them.
            </li>
          </ul>
          <p className="mt-3 text-sm font-medium">
            The board itself is already fluid via container queries (<Code>cqw</Code> units in{' '}
            <Code>Board/geometry.ts</Code>) — it needs no breakpoints. Tailwind’s built-in{' '}
            <Code>portrait:</Code> / <Code>landscape:</Code> variants are available when a rule
            needs orientation on top of width.
          </p>
        </Card>
      </Section>

      {/* ───────────────────────────── Colors ────────────────────────────── */}
      <Section title="Colors">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Swatch name="paper" hex="#FBF3E2" className="bg-paper" />
          <Swatch name="surface" hex="#FFFFFF" className="bg-surface" />
          <Swatch name="surface-sunken" hex="#F4EAD2" className="bg-surface-sunken" />
          <Swatch name="ink" hex="#1A1714" className="bg-ink" dark />
          <Swatch name="accent" hex="#FBBF24" className="bg-accent" />
          <Swatch name="accent-strong" hex="#F59E0B" className="bg-accent-strong" />
          <Swatch name="info" hex="#4DABF7" className="bg-info" />
          <Swatch name="danger" hex="#FF6B6B" className="bg-danger" />
          <Swatch name="success" hex="#51CF66" className="bg-success" />
          <Swatch name="accent-soft" hex="#FDE9B8" className="bg-accent-soft" />
          <Swatch name="info-soft" hex="#D5E9FB" className="bg-info-soft" />
          <Swatch name="danger-soft" hex="#FFE0E0" className="bg-danger-soft" />
        </div>
      </Section>

      <Section
        title="Accent semantics"
        note="Four families, each with a fixed job. Pick by meaning, never to decorate. DEFAULT is the fill (always with an ink border and ink text). strong is for hover fills and for colored text on paper. soft is a tinted surface behind copy."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <AccentRule
            name="accent"
            tone="accent"
            job="Attention + “this is yours to do.”"
            uses="Primary button, active tab, current-turn marker, modal title bars, page-title plates."
            caution="One accent element per view wins. More than a couple and none of them read as primary."
          />
          <AccentRule
            name="info"
            tone="info"
            job="Neutral fact, not a call to action."
            uses="Explanatory callouts, secondary/informational buttons, board region tags, “waiting…” states."
          />
          <AccentRule
            name="danger"
            tone="danger"
            job="Loss, risk, irreversible."
            uses="Debt and bankruptcy panels, rent owed, sell/surrender/delete confirms, error toasts."
          />
          <AccentRule
            name="success"
            tone="success"
            job="Gain, confirmed, complete."
            uses="Income pops, deal accepted, property acquired, success toasts."
          />
        </div>
      </Section>

      {/* ───────────────────────── Typography ────────────────────────────── */}
      <Section
        title="Type scale"
        note="Every step carries its own line-height, so text-* alone gives a complete block of text. Display steps (3xl+) bake in -0.025em — at Archivo Black's weight, default tracking reads loose above ~30px, so tracking-tight is no longer needed there. 2xl and below keep normal tracking because they are shared with body and UI text, so a font-display heading at those steps still spells out tracking-tight itself."
      >
        <Card pad="none" className="divide-y-2 divide-ink">
          <TypeRow cls="text-5xl" px="48px" use="Home hero plate" display />
          <TypeRow cls="text-4xl" px="36px" use="Page title plates" display />
          <TypeRow cls="text-3xl" px="30px" use="Secondary page titles" display />
          <TypeRow cls="text-2xl" px="24px" use="Card / section headings, room codes" />
          <TypeRow cls="text-xl" px="20px" use="Section headings, turn banner" />
          <TypeRow cls="text-lg" px="18px" use="Modal titles, lg buttons" />
          <TypeRow cls="text-base" px="16px" use="Body copy, md buttons" />
          <TypeRow cls="text-sm" px="14px" use="Dense UI copy, sm buttons, tables" />
          <TypeRow cls="text-xs" px="12px" use="Labels, overlines, hints, xs buttons" />
          <TypeRow cls="text-2xs" px="11px" use="Badges, tooltips, money-delta pops" isNew />
          <TypeRow cls="text-3xs" px="10px" use="Board pips, dense chips" isNew />
        </Card>
        <p className="mt-3 text-sm font-medium text-ink-muted">
          <Code>text-2xs</Code> and <Code>text-3xs</Code> are new: dense game chrome was reaching
          for <Code>text-[11px]</Code> / <Code>text-[10px]</Code> around 40 times. Use the tokens in
          new code.
        </p>
      </Section>

      <Section title="Fonts">
        <Card pad="lg" className="space-y-3">
          <p className="font-display text-4xl uppercase">Archivo Black — display</p>
          <p className="text-2xl font-extrabold">Plus Jakarta ExtraBold — heading</p>
          <p className="text-base font-medium">
            Plus Jakarta Medium — body copy. Rupiah formats as Rp 1.500.000.
          </p>
          <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">
            Bold — label / overline
          </p>
          <p className="text-sm text-ink-faint">ink-faint muted hint text</p>
        </Card>
      </Section>

      {/* ─────────────────── Borders / radius / spacing ───────────────────── */}
      <Section title="Borders & radius" note="The frame is the design.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Card pad="md" className="space-y-3">
            <RuleHead>Border weight</RuleHead>
            <RuleLine
              code="border-2"
              body="THE frame weight. Every card, button, badge, input, tile and modal panel. Treat it as the only correct answer for a framed element."
            />
            <RuleLine
              code="border-4"
              body="Emphasis rule only — a heading underline or a divider that has to out-shout the frames around it. Never a box outline."
            />
            <RuleLine
              code="border"
              body="Not used. A 1px hairline reads as a different design language next to a 2px frame."
            />
            <p className="text-sm font-medium text-ink-muted">
              Border color defaults to <Code>ink</Code>, so <Code>border-2</Code> alone is already
              correct.
            </p>
          </Card>
          <Card pad="md" className="space-y-3">
            <RuleHead>Radius — by element size</RuleHead>
            <div className="flex flex-wrap items-end gap-3">
              <RadiusChip cls="rounded-md" label="md · 6px" use="chips, pips, icon squares" />
              <RadiusChip cls="rounded-lg" label="lg · 8px" use="buttons, inputs, tabs, toasts" />
              <RadiusChip cls="rounded-xl" label="xl · 12px" use="cards, panels, modal shells" />
              <RadiusChip cls="rounded-full" label="full" use="avatars, tokens" />
            </div>
          </Card>
        </div>
        <Card tone="sunken" pad="md" className="mt-3">
          <RuleHead>Spacing</RuleHead>
          <p className="mt-2 text-sm font-medium leading-relaxed">
            Tailwind’s default 4px-step spacing, unextended — on purpose. An audit of every
            arbitrary-value utility in <Code>src/</Code> found zero one-off spacing values outside
            the board, and the board’s are <Code>cqw</Code> container-query units (
            <Code>Board/geometry.ts</Code>) — a fluid measuring system, not a scale this config
            should own. A parallel spacing scale would only give callers a second way to say the
            same thing.
          </p>
        </Card>
      </Section>

      {/* ──────────────────────────── Elevation ──────────────────────────── */}
      <Section
        title="Elevation"
        note="Hard offset shadows — no blur, no spread. The step encodes how far off the page an element sits, and pairs with the z-index scale."
      >
        <div className="flex flex-wrap gap-6 rounded-xl bg-surface-sunken p-8">
          {[
            ['shadow-brutal-xs', 'brutal-xs'],
            ['shadow-brutal-sm', 'brutal-sm'],
            ['shadow-brutal', 'brutal'],
            ['shadow-brutal-lg', 'brutal-lg'],
            ['shadow-brutal-xl', 'brutal-xl'],
          ].map(([cls, label]) => (
            <div
              key={label}
              className={`flex h-20 w-28 items-center justify-center rounded-lg border-2 border-ink bg-surface text-xs font-bold ${cls}`}
            >
              {label}
            </div>
          ))}
        </div>
        <Card pad="none" className="mt-4 overflow-hidden">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-ink bg-surface-sunken text-left">
                <Th>Step</Th>
                <Th>Offset</Th>
                <Th>Layer</Th>
                <Th>Use</Th>
              </tr>
            </thead>
            <tbody>
              <ElevRow
                step="brutal-xs"
                offset="1.5px"
                layer="z-board"
                use="Sub-tile marks — ownership pips, tokens. Anything drawn on the board surface."
              />
              <ElevRow
                step="brutal-sm"
                offset="2px"
                layer="z-panel"
                use="Nested inside an already-framed parent: inputs, tooltips, the active tab, <Card flat>, and the disabled/pressed state of a control."
              />
              <ElevRow
                step="brutal"
                offset="4px"
                layer="z-panel"
                use="THE RESTING DEFAULT. Standalone controls and surfaces: <Button>, <Card>, panels."
              />
              <ElevRow
                step="brutal-lg"
                offset="6px"
                layer="z-panel"
                use="Lifted — the hover state of a pressable (.brutal-press), page-title plates, floating attention pieces (turn banner)."
              />
              <ElevRow
                step="brutal-xl"
                offset="8px"
                layer="z-modal"
                use="Top layer only: the modal panel. Nothing in the page flow gets this."
              />
            </tbody>
          </table>
        </Card>
        <p className="mt-3 text-sm font-medium text-ink-muted">
          <Code>.brutal</Code> / <Code>.brutal-sm</Code> / <Code>.brutal-lg</Code> in{' '}
          <Code>index.css</Code> bundle the matching border with the shadow;{' '}
          <Code>.brutal-press</Code> animates rest → hover → active. Prefer those helpers over
          hand-pairing a border and a shadow.{' '}
          <strong>
            <Code>&lt;Badge&gt;</Code> is the one exception
          </strong>{' '}
          — an inline chip stays unelevated so runs of them don’t read as a field of floating boxes.
        </p>
        <Card tone="sunken" pad="md" className="mt-3">
          <RuleHead>Stacking order</RuleHead>
          <div className="mt-2 flex flex-wrap gap-2">
            {[
              ['z-board', '0'],
              ['z-panel', '10'],
              ['z-drawer', '30'],
              ['z-toast', '40'],
              ['z-modal', '50'],
              ['z-tooltip', '60'],
            ].map(([name, value]) => (
              <Badge key={name} size="md" tone="neutral">
                <span className="font-mono">{name}</span>
                <span className="text-ink-muted">{value}</span>
              </Badge>
            ))}
          </div>
          <p className="mt-2 text-sm font-medium text-ink-muted">
            <Code>z-drawer</Code> is reserved for the phone-portrait HUD drawer: over panels, under
            toasts.
          </p>
        </Card>
      </Section>

      {/* ──────────────────────────── Buttons ────────────────────────────── */}
      <Section
        title="Buttons"
        note="Padding and type step move together — a call site never bolts a text-* onto a button to make it fit."
      >
        <div className="space-y-5">
          <Row label="Variants">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="info">Info</Button>
            <Button variant="success">Success</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="ghost">Ghost</Button>
          </Row>
          <Row label="Sizes">
            <Button size="xs">xs</Button>
            <Button size="sm">sm</Button>
            <Button size="md">md</Button>
            <Button size="lg">lg</Button>
          </Row>
          <Row label="States">
            <Button disabled>Disabled</Button>
            <Button>🎲 With icon</Button>
            <div className="w-48">
              <Button block>Block</Button>
            </div>
          </Row>
        </div>
        <Card tone="sunken" pad="md" className="mt-4">
          <RuleHead>Which size where</RuleHead>
          <div className="mt-2 grid gap-1 text-sm font-medium sm:grid-cols-2">
            <RuleLine code="xs" body="Toast and inline row actions." />
            <RuleLine code="sm" body="In-game panels and sidebars." />
            <RuleLine code="md" body="Modals and page-level forms (default)." />
            <RuleLine code="lg" body="The single hero action on a page." />
          </div>
        </Card>
      </Section>

      {/* ───────────────────────────── Cards ─────────────────────────────── */}
      <Section
        title="Cards"
        note="tone picks the soft accent step behind copy. flat drops to brutal-sm for a card nested inside another framed surface. pad is the new inner-padding step — none (default) keeps every existing call site's own padding."
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {(['surface', 'sunken', 'accent', 'info', 'danger', 'success'] as const).map((tone) => (
            <Card key={tone} tone={tone} pad="md">
              <div className="font-bold capitalize">{tone}</div>
              <div className="text-sm text-ink-muted">tone=&quot;{tone}&quot;</div>
            </Card>
          ))}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Card pad="md">
            <div className="font-bold">Standalone</div>
            <div className="text-sm text-ink-muted">brutal — 4px, the resting default</div>
            <Card flat tone="sunken" pad="sm" className="mt-3">
              <div className="font-bold">Nested</div>
              <div className="text-sm text-ink-muted">flat → brutal-sm — 2px</div>
            </Card>
          </Card>
          <Card tone="sunken" pad="md">
            <RuleHead>Padding steps</RuleHead>
            <div className="mt-2 space-y-1">
              <RuleLine code="none" body="Default. The caller supplies its own padding." />
              <RuleLine code="sm" body="p-3 — dense in-game panels." />
              <RuleLine code="md" body="p-4 — the standard panel/modal body." />
              <RuleLine code="lg" body="p-5 — page-level feature cards." />
            </div>
          </Card>
        </div>
      </Section>

      {/* ───────────────────────────── Badges ────────────────────────────── */}
      <Section title="Badges" note="Border only, no shadow — badges appear in runs.">
        <Row label="Tones">
          <Badge tone="neutral">Neutral</Badge>
          <Badge tone="accent">Tier 3</Badge>
          <Badge tone="info">Transport</Badge>
          <Badge tone="success">Owned</Badge>
          <Badge tone="danger">Eliminated</Badge>
          <Badge color="#7c3aed">Player color</Badge>
          <Badge color="#0ea5e9">Budi</Badge>
        </Row>
        <div className="mt-3">
          <Row label="Sizes">
            <Badge size="sm">sm · 11px — in-board chips</Badge>
            <Badge size="md">md · 12px — page-level tags</Badge>
          </Row>
        </div>
      </Section>

      {/* ────────────────────────────── Tabs ─────────────────────────────── */}
      <Section
        title="Tabs"
        note="Controlled segmented control. The strip is a sunken well; the active tab is the only elevated child."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>size=&quot;sm&quot; — panel strips</Label>
            <Tabs
              tabs={[
                { id: 'actions', label: 'Actions' },
                { id: 'status', label: 'Status' },
                { id: 'log', label: 'Log' },
              ]}
              active={tab}
              onChange={setTab}
            />
          </div>
          <div>
            <Label>size=&quot;md&quot; — page-level</Label>
            <Tabs
              size="md"
              tabs={[
                { id: 'actions', label: 'Actions' },
                { id: 'status', label: 'Status' },
                { id: 'log', label: 'Log' },
              ]}
              active={tab}
              onChange={setTab}
            />
          </div>
        </div>
      </Section>

      {/* ───────────────────────────── Tooltip ───────────────────────────── */}
      <Section
        title="Tooltip"
        note="Hover and keyboard focus. Wrap a block button and pass className='w-full' so the trigger keeps its width."
      >
        <Row label="Sides">
          <Tooltip content="Anchored above the trigger (default).">
            <Button variant="secondary" size="sm">
              Hover me — top
            </Button>
          </Tooltip>
          <Tooltip content="Anchored below the trigger." side="bottom">
            <Button variant="secondary" size="sm">
              Hover me — bottom
            </Button>
          </Tooltip>
          <Tooltip content={null}>
            <Button variant="ghost" size="sm">
              Empty content → no bubble
            </Button>
          </Tooltip>
        </Row>
      </Section>

      {/* ──────────────────────── Motion primitives ──────────────────────── */}
      <Section
        title="Transient motion"
        note="FloatUp is the shared rise-and-fade vocabulary; MoneyDelta builds on it to pop cash changes. Both need a relative parent — positioning is the caller's job."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Card pad="md">
            <Label>FloatUp</Label>
            <div className="relative flex h-24 items-center justify-center rounded-lg bg-surface-sunken">
              <FloatUp
                id={floatId}
                className="absolute font-display text-xl uppercase tracking-tight text-success-strong"
              >
                Nice!
              </FloatUp>
              <Button size="sm" onClick={() => setFloatId((n) => (n ?? 0) + 1)}>
                Trigger
              </Button>
            </div>
          </Card>
          <Card pad="md">
            <Label>MoneyDelta</Label>
            <div className="relative flex h-24 flex-col items-center justify-center gap-2 rounded-lg bg-surface-sunken">
              <div className="relative font-mono text-lg font-extrabold">
                Rp {cash.toLocaleString('id-ID')}
                <MoneyDelta cash={cash} />
              </div>
              <div className="flex gap-2">
                <Button size="xs" variant="success" onClick={() => setCash((c) => c + 250_000)}>
                  +250k
                </Button>
                <Button size="xs" variant="danger" onClick={() => setCash((c) => c - 180_000)}>
                  −180k
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </Section>

      {/* ──────────────────────────── Overlays ───────────────────────────── */}
      <Section
        title="Overlays"
        note="Modal is w-full up to its size cap, so on phone portrait every size collapses to the same near-full-width sheet — pick by content, not by screen."
      >
        <Row label="Modal">
          {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((size) => (
            <Button
              key={size}
              size="sm"
              variant={size === modalSize ? 'primary' : 'secondary'}
              onClick={() => {
                setModalSize(size)
                setModalOpen(true)
              }}
            >
              {size}
            </Button>
          ))}
        </Row>
        <div className="mt-3">
          <Row label="Toasts">
            <Button size="sm" variant="danger" onClick={() => setToast('error')}>
              Error
            </Button>
            <Button size="sm" onClick={() => setToast('warning')}>
              Warning
            </Button>
            <Button size="sm" variant="info" onClick={() => setToast('info')}>
              Info
            </Button>
            <Button size="sm" variant="success" onClick={() => setToast('success')}>
              Success
            </Button>
          </Row>
        </div>
      </Section>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={`Property · size="${modalSize}"`}
        size={modalSize}
      >
        <p className="font-medium">
          This is the shared <Code>Modal</Code> primitive: framed panel, backdrop dismiss, Escape to
          close, scroll-lock, and snappy enter/exit motion.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => setModalOpen(false)}>Got it</Button>
        </div>
      </Modal>

      <Toast show={toast !== null} tone={toast ?? 'info'} onDismiss={() => setToast(null)}>
        {toast === 'error' && 'Tidak cukup uang!'}
        {toast === 'warning' && 'Sisa waktu giliranmu menipis…'}
        {toast === 'info' && 'Giliranmu sebentar lagi…'}
        {toast === 'success' && 'Properti berhasil dibeli.'}
      </Toast>
    </div>
  )
}

/* ─────────────────────────────── Page furniture ─────────────────────────── */

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="mb-2 inline-block border-b-4 border-ink pb-1 font-display text-xl uppercase tracking-tight">
        {title}
      </h2>
      {note && <p className="mb-4 max-w-3xl text-sm font-medium text-ink-muted">{note}</p>}
      {!note && <div className="mb-4" />}
      {children}
    </section>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="w-20 shrink-0 text-xs font-bold uppercase tracking-wide text-ink-muted">
        {label}
      </span>
      {children}
    </div>
  )
}

function Label({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">{children}</div>
  )
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-md border-2 border-ink bg-surface-sunken px-1 py-0.5 font-mono text-2xs font-bold">
      {children}
    </code>
  )
}

function RuleHead({ children }: { children: ReactNode }) {
  return <div className="text-xs font-bold uppercase tracking-wide text-ink-muted">{children}</div>
}

function RuleLine({ code, body }: { code: string; body: string }) {
  return (
    <p className="text-sm font-medium">
      <Code>{code}</Code> <span className="text-ink-muted">{body}</span>
    </p>
  )
}

function Th({ children }: { children: ReactNode }) {
  return <th className="px-3 py-2 text-xs font-bold uppercase tracking-wide">{children}</th>
}

function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-top ${className}`}>{children}</td>
}

function BreakRow({
  name,
  width,
  desc,
  highlight,
}: {
  name: string
  width: string
  desc: string
  highlight?: boolean
}) {
  return (
    <tr className={`border-b-2 border-ink/10 ${highlight ? 'bg-accent-soft' : ''}`}>
      <Td className="font-mono font-bold">{name}</Td>
      <Td className="font-mono tabular-nums">{width}</Td>
      <Td className="font-medium text-ink-muted">{desc}</Td>
    </tr>
  )
}

function ElevRow({
  step,
  offset,
  layer,
  use,
}: {
  step: string
  offset: string
  layer: string
  use: string
}) {
  return (
    <tr className="border-b-2 border-ink/10">
      <Td className="whitespace-nowrap font-mono font-bold">{step}</Td>
      <Td className="font-mono tabular-nums">{offset}</Td>
      <Td className="whitespace-nowrap font-mono text-ink-muted">{layer}</Td>
      <Td className="font-medium text-ink-muted">{use}</Td>
    </tr>
  )
}

function TypeRow({
  cls,
  px,
  use,
  display,
  isNew,
}: {
  cls: string
  px: string
  use: string
  display?: boolean
  isNew?: boolean
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 p-3">
      <span className="w-24 shrink-0 font-mono text-xs font-bold">{cls}</span>
      <span className="w-12 shrink-0 font-mono text-xs tabular-nums text-ink-muted">{px}</span>
      <span className={`${cls} ${display ? 'font-display uppercase' : 'font-bold'} truncate`}>
        Tuan Tanah
      </span>
      <span className="ml-auto flex items-center gap-2 text-xs font-medium text-ink-muted">
        {isNew && <Badge tone="success">new</Badge>}
        {use}
      </span>
    </div>
  )
}

function AccentRule({
  name,
  tone,
  job,
  uses,
  caution,
}: {
  name: string
  tone: 'accent' | 'info' | 'danger' | 'success'
  job: string
  uses: string
  caution?: string
}) {
  // Static map — Tailwind can't see a class built by interpolation.
  const chip = {
    accent: 'bg-accent',
    info: 'bg-info',
    danger: 'bg-danger',
    success: 'bg-success',
  }[tone]
  return (
    <Card tone={tone} pad="md">
      <div className="flex items-center gap-2">
        <span className={`h-5 w-5 rounded-md border-2 border-ink ${chip}`} />
        <span className="font-display text-lg uppercase tracking-tight">{name}</span>
      </div>
      <p className="mt-2 text-sm font-bold">{job}</p>
      <p className="mt-1 text-sm font-medium text-ink-muted">{uses}</p>
      {caution && <p className="mt-2 text-xs font-bold uppercase tracking-wide">{caution}</p>}
    </Card>
  )
}

function RadiusChip({ cls, label, use }: { cls: string; label: string; use: string }) {
  return (
    <div className="text-center">
      <div
        className={`mx-auto flex h-14 w-14 items-center justify-center border-2 border-ink bg-surface-sunken ${cls}`}
      />
      <div className="mt-1 font-mono text-2xs font-bold">{label}</div>
      <div className="max-w-[9rem] text-3xs text-ink-muted">{use}</div>
    </div>
  )
}

function Swatch({
  name,
  hex,
  className,
  dark,
}: {
  name: string
  hex: string
  className: string
  dark?: boolean
}) {
  return (
    <div className="overflow-hidden rounded-lg border-2 border-ink shadow-brutal-sm">
      <div className={`h-16 ${className} ${dark ? 'text-paper' : 'text-ink'}`} />
      <div className="border-t-2 border-ink bg-surface px-2 py-1.5">
        <div className="text-xs font-bold">{name}</div>
        <div className="font-mono text-3xs uppercase text-ink-muted">{hex}</div>
      </div>
    </div>
  )
}
