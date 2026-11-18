import { expect, test } from 'claude-code/testing'
import type { Plugin } from 'claude-code/testing'
import type { On } from 'claude-code'

import { BAR_CELLS, bandChunks, bandLine, fromCache } from '../hooks/card'
import { SPEND, creditsIn, splitTool } from '../hooks/higgsfield'

const HOUR = 3_600_000

const BAND = {
  plugin: 'limit-band',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 12,
    bodyColumns: 90,
    scroll: { offset: 0, bodyRows: 11 },
    view: {},
  },
} as const

// Steht für das, was unter limit-band zeichnet (brain oder die Engine).
const beneath = (on: On) =>
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>brain-zeile</Text>
  })

// Beschriftungen auf Deutsch, unabhängig von der Sprache des Rechners.
const deutsch = (on: On) =>
  on('env.get', (_, e) => ({ value: e.name === 'PROMPT_COCKPIT_LANG' ? 'de' : undefined }))

const seed = (on: On, windows: unknown, credits: number | null) => {
  deutsch(on)
  return on('state.get', (_, e) => {
    if (e.key === 'windows') return { value: { value: windows, version: 1 } }
    if (e.key === 'higgsfield') return { value: { value: credits, version: 1 } }
    return { value: { value: undefined, version: 0 } }
  })
}

const sample = (now: number) => [
  { kind: 'five_hour', percent: 42, resetsAt: new Date(now + 2 * HOUR).toISOString() },
  { kind: 'seven_day', percent: 71.5, resetsAt: new Date(now + 72 * HOUR).toISOString() },
  { kind: 'seven_day_sonnet', percent: 93, resetsAt: new Date(now + 72 * HOUR).toISOString() },
]

test('Terminal: 5 Std, Woche und Woche je Modell als Textbalken, dann Higgsfield, dann brain', async ($, on) => {
  beneath(on)
  seed(on, sample(Date.now()), 1234.5)

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const texts = (await ui.findAll({ type: 'Text' })).map(t => t.text)

  for (const want of ['⏳ 5 Std', '📅 Woche', '📅 Woche Sonnet', '42 %', '72 %', '93 %', '🎬 Higgsfield', '1.234,50']) {
    expect(texts).toContain(want)
  }
  // Wochen-Reset nennt den Wochentag, der 5-Std-Reset nur die Uhrzeit.
  expect(texts.some(t => /^Reset (So|Mo|Di|Mi|Do|Fr|Sa) \d\d:\d\d Uhr$/.test(t ?? ''))).toBe(true)
  expect(texts.some(t => /^Reset \d\d:\d\d Uhr$/.test(t ?? ''))).toBe(true)
  const at = (s: string) => texts.indexOf(s)
  expect(at('⏳ 5 Std')).toBeLessThan(at('📅 Woche'))
  expect(at('📅 Woche')).toBeLessThan(at('🎬 Higgsfield'))
  expect(at('🎬 Higgsfield')).toBeLessThan(at('brain-zeile'))
  await ui.unmount()
})

// Steht für den Mod brain: eine eigene Zeile in der Leiste, wie ab Claude Code 2.1.32x,
// gebaut wie mods/brain (Spalte, darin die Reihe mit dem Button).
const brain: Plugin = {
  name: 'brain',
  register: on => {
    on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
      const { Box, Button, Text } = $.ui.resolve(e)
      return (
        <Box flexDirection="column">
          <Box flexDirection="row" gap={1}>
            <Button key="brain" variant="primary" label="🧠 Brain" hotkey="b" onPress={() => undefined} />
            <Text>brain-zeile</Text>
          </Box>
        </Box>
      )
    })
  },
}

type Node = { type?: string; props?: Record<string, unknown>; children?: unknown[] }
const isNode = (n: unknown): n is Node => typeof n === 'object' && n !== null && 'type' in n
const textOf = (n: unknown): string =>
  typeof n === 'string' ? n : isNode(n) ? (n.children ?? []).map(textOf).join('') : ''
const boxes = (n: unknown): Node[] =>
  isNode(n) ? [...(n.type === 'Box' ? [n] : []), ...(n.children ?? []).flatMap(boxes)] : []

const LINE = /5-Std-Limit ██░{8} 15 % Reset \d\d:\d\d Uhr \| Woche 3 % \| HF 1\.208/
const desktopSample = (now: number) => [
  { kind: 'five_hour', percent: 15, resetsAt: new Date(now + 2 * HOUR).toISOString() },
  { kind: 'seven_day', percent: 3, resetsAt: new Date(now + 72 * HOUR).toISOString() },
]

test('Desktop: Limit-Zeile links, Brain rechts in derselben Reihe', { plugins: [brain] }, async ($, on) => {
  seed(on, desktopSample(Date.now()), 1208.9)

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const tree = await ui.drawn()
  const rows = boxes(tree).filter(b => b.props?.flexWrap === 'nowrap' && b.props?.columnGap === 2)
  expect(rows).toHaveLength(1)
  // Buttons rechtsbündig, auch wenn sie in eine eigene Zeile rutschen.
  const right = boxes(rows[0]).filter(b => b.props?.justifyContent === 'flex-end' && b.props?.flexGrow === 1)
  expect(right).toHaveLength(1)
  expect(textOf(right[0])).toContain('brain-zeile')
  expect(right[0]!.props?.flexShrink).toBe(0)
  // Eine Zeile: die Limit-Zeile ist ein Text, der am Ende kürzt statt umzubrechen.
  const cut = (await ui.findAll({ type: 'Text' })).filter(t => t.props?.wrap === 'truncate-end')
  expect(cut).toHaveLength(1)
  expect(textOf(cut[0])).toMatch(LINE)
  const row = textOf(rows[0])
  expect(row).toMatch(LINE)
  expect(row.indexOf('5-Std-Limit')).toBeLessThan(row.indexOf('brain-zeile'))
  // Die eigene Zeile ist ausgeblendet: die Limit-Zeile steht genau einmal da.
  expect(textOf(tree).split('5-Std-Limit')).toHaveLength(2)
  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  await ui.unmount()
})

test('Desktop ohne brain: Limit-Zeile steht allein', async ($, on) => {
  seed(on, desktopSample(Date.now()), 1208.9)

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const tree = await ui.drawn()
  expect(textOf(tree)).toMatch(LINE)
  expect(textOf(tree).split('5-Std-Limit')).toHaveLength(2)
  await ui.unmount()
})

test('Terminal mit brain: Raster oben, Brain in eigener Zeile darunter', { plugins: [brain] }, async ($, on) => {
  seed(on, desktopSample(Date.now()), 1208.9)

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const texts = (await ui.findAll({ type: 'Text' })).map(t => t.text ?? '')
  expect(texts.indexOf('🎬 Higgsfield')).toBeLessThan(texts.indexOf('brain-zeile'))
  expect(texts.filter(t => t === '⏳ 5 Std')).toHaveLength(1)
  await ui.unmount()
})

test('Zeile: ohne laufendes 5-Std-Fenster 0 % ohne Reset, Woche je Modell, nur Credits', () => {
  const now = Date.now()
  const join = (w: Parameters<typeof bandLine>[0], c: number | null) =>
    bandLine(w, c, now)
      .map(s => s.text)
      .join('')

  expect(join([{ kind: 'seven_day', percent: 3, resetsAt: null }], 1240.15)).toBe(
    `5-Std-Limit ${'░'.repeat(BAR_CELLS)} 0 % | Woche 3 % | HF 1.240`,
  )
  expect(
    join(
      [
        { kind: 'five_hour', percent: 100, resetsAt: null },
        { kind: 'seven_day', percent: 71.5, resetsAt: null },
        { kind: 'seven_day_sonnet', percent: 93, resetsAt: null },
      ],
      null,
    ),
  ).toBe(`5-Std-Limit ${'█'.repeat(BAR_CELLS)} 100 % | Woche 72 % | Woche Sonnet 93 %`)
  expect(join([], 1208)).toBe('HF 1.208')
  // Ampelfarben am Balken und an den Prozenten.
  const tones = bandLine([{ kind: 'five_hour', percent: 95, resetsAt: null }], null, now).map(s => s.tone)
  expect(tones).toContain('error')
})

test('Cache: abgelaufenes Fenster steht bei 0 %, laufendes bleibt', () => {
  const now = Date.now()
  const raw = JSON.stringify([
    { kind: 'five_hour', percent: 80, resetsAt: new Date(now - HOUR).toISOString() },
    { kind: 'seven_day', percent: 40, resetsAt: new Date(now + HOUR).toISOString() },
    { kind: 42 },
  ])
  expect(fromCache(raw, now)).toEqual([
    { kind: 'five_hour', percent: 0, resetsAt: null },
    { kind: 'seven_day', percent: 40, resetsAt: new Date(now + HOUR).toISOString() },
  ])
  expect(fromCache('kaputt', now)).toEqual([])
})

test('ohne Daten zeichnet nur, was darunter liegt', async ($, on) => {
  beneath(on)
  seed(on, [], null)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    const texts = (await ui.findAll({ type: 'Text' })).map(t => t.text)
    expect(texts).toEqual(['brain-zeile'])
    expect(await ui.find({ type: 'Svg' })).toBeUndefined()
    await ui.unmount()
  }
})

test('Blöcke: Balken, Woche und Higgsfield bleiben je ganz', () => {
  const now = Date.now()
  const chunks = bandChunks(
    [
      { kind: 'five_hour', percent: 0, resetsAt: null },
      { kind: 'seven_day', percent: 14, resetsAt: null },
    ],
    1095.4,
    now,
  ).map(c => c.map(s => s.text).join(''))
  expect(chunks).toEqual(['5-Std-Limit ░░░░░░░░░░ 0 %', ' | Woche 14 %', ' | HF 1.095'])
})


test('Englisch: Zeile mit 5h limit, resets, Week und Tausenderkomma', () => {
  const now = Date.now()
  const text = bandLine(
    [
      { kind: 'five_hour', percent: 15, resetsAt: new Date(now + 2 * 3_600_000).toISOString() },
      { kind: 'seven_day', percent: 3, resetsAt: null },
    ],
    1208.9,
    now,
    'en',
  )
    .map(s => s.text)
    .join('')
  expect(text).toMatch(/^5h limit ██░{8} 15 % resets \d\d:\d\d \| Week 3 % \| HF 1,208$/)
})

test('Higgsfield: Kontostand aus balance-Antwort, Toolname zerlegt, Verbrauch erkannt', () => {
  expect(creditsIn({ content: [{ type: 'text', text: '{"credits":1095.4,"plan":"pro"}' }] })).toBe(1095.4)
  expect(creditsIn('{\\"credits\\":12}')).toBe(12)
  expect(creditsIn({ content: [{ type: 'text', text: '{"total_credits_used":5}' }] })).toBeNull()
  expect(splitTool('mcp__00000000-0000-4000-8000-000000000000__balance')).toEqual({
    server: '00000000-0000-4000-8000-000000000000',
    tool: 'balance',
  })
  expect(splitTool('Bash')).toBeUndefined()
  expect(SPEND.test('generate_video')).toBe(true)
  expect(SPEND.test('list_projects')).toBe(false)
})
