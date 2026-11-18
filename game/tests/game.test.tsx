import { expect, test } from 'claude-code/testing'
import type { Plugin } from 'claude-code/testing'

type On = Parameters<Extract<Parameters<typeof test>[1], (...a: never[]) => unknown>>[1]

const LAUF = { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false }

// lässt die im Hintergrund laufenden Schritte des Klicks durchlaufen
async function ruhe() {
  for (let i = 0; i < 1000; i++) await Promise.resolve()
}

// Beschriftungen auf Deutsch, unabhängig von der Sprache des Rechners.
const deutsch = (on: On) =>
  on('env.get', (_, e) => ({ value: e.name === 'PROMPT_COCKPIT_LANG' ? 'de' : undefined }))

function browser(on: On) {
  deutsch(on)
  const geoeffnet: string[][] = []
  on('process.run', (_, e) => {
    geoeffnet.push([...e.argv])
    return { value: LAUF }
  })
  return geoeffnet
}

function meldungen(on: On) {
  const toasts: string[] = []
  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  return toasts
}

const datei = (name: string) => ({ name, kind: 'file' as const, size: 100, mtimeMs: 0, isLink: false })

const BAND = {
  plugin: 'game',
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

// Steht für den Mod brain, gebaut wie mods/brain: Reihe aus dem, was darunter
// hängt, und dem Button mit einem Rand links (Stufe "sm").
const brain: Plugin = {
  name: 'brain',
  register: on => {
    on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
      const { Box, Button } = $.ui.resolve(e)
      const below = await next(e)
      return (
        <Box flexDirection="row" alignItems="center">
          {below}
          <Box marginLeft="sm">
            <Button key="brain" variant="primary" label="🧠 Brain" hotkey="b" onPress={() => undefined} />
          </Box>
        </Box>
      )
    })
  },
}

type Node = { type?: string; props?: Record<string, unknown>; children?: unknown[] }
const isNode = (n: unknown): n is Node => typeof n === 'object' && n !== null && 'type' in n
const buttons = (n: unknown): string[] =>
  isNode(n)
    ? [...(n.type === 'Button' ? [String(n.props?.label)] : []), ...(n.children ?? []).flatMap(buttons)]
    : []
const rowsHolding = (n: unknown, labels: string[]): Node[] =>
  isNode(n)
    ? [
        ...(n.type === 'Box' && n.props?.flexDirection === 'row' && labels.every(l => buttons(n).includes(l)) ? [n] : []),
        ...(n.children ?? []).flatMap(c => rowsHolding(c, labels)),
      ]
    : []

test('GAME steht links neben Brain, Brain ganz rechts, auf jeder Oberfläche', { plugins: [brain] }, async $ => {
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    const tree = await ui.drawn()
    expect(buttons(tree)).toEqual(['🎮 GAME', '🧠 Brain'])
    // Abstand genau einmal: keine Reihe mit beiden Buttons setzt `gap`,
    // der einzige Abstand ist brains Rand links vom Button.
    const rows = rowsHolding(tree, ['🧠 Brain', '🎮 GAME'])
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.map(r => r.props?.gap)).toEqual(rows.map(() => undefined))
    await ui.unmount()
  }
})

test('ein Spiel im Ordner: GAME öffnet bei jedem Klick dieses Spiel', { plugins: [brain] }, async ($, on) => {
  const geoeffnet = browser(on)
  const toasts = meldungen(on)
  on('fs.list', (_, e) => ({ value: e.path.endsWith('/games') ? [datei('fussball-runner.html')] : [] }))
  on('fs.read', () => ({ value: '<title>Wartungspause Minispiel</title>' }))
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await ui.press({ key: 'game' })
  await ruhe()
  expect(toasts).toEqual(['🎮 Wartungspause Minispiel läuft im Browser'])
  expect(geoeffnet.length).toBe(1)
  expect(geoeffnet[0]?.[0]).toBe('open')
  expect(geoeffnet[0]?.[1]?.endsWith('/games/fussball-runner.html')).toBe(true)
  await ui.unmount()
})

test('mehrere Spiele: jeder Klick öffnet das nächste Spiel, reihum', { plugins: [brain] }, async ($, on) => {
  const geoeffnet = browser(on)
  const toasts = meldungen(on)
  const speicher: Record<string, unknown> = {}
  on('fs.list', (_, e) => ({ value: e.path.endsWith('/games') ? [datei('b-spiel.html'), datei('index.html'), datei('a-spiel.html'), datei('notiz.txt'), datei('c-spiel.html')] : [] }))
  on('fs.read', (_, e) => ({ value: e.path.endsWith('/a-spiel.html') ? '<title>Alpha & Co</title>' : e.path.endsWith('/c-spiel.html') ? '<title>Gamma</title>' : '<html>ohne Titel</html>' }))
  on('store.get', (_, e) => ({ value: speicher[e.key] }))
  on('store.set', (_, e) => {
    speicher[e.key] = e.value
    return { value: undefined }
  })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  for (let i = 0; i < 4; i++) {
    await ui.press({ key: 'game' })
    await ruhe()
  }
  // a, b, c, dann wieder a; index.html und notiz.txt nie
  expect(geoeffnet.map(a => (a[1] ?? '').split('/').pop())).toEqual(['a-spiel.html', 'b-spiel.html', 'c-spiel.html', 'a-spiel.html'])
  expect(toasts).toEqual(['🎮 Alpha & Co läuft im Browser', '🎮 b-spiel läuft im Browser', '🎮 Gamma läuft im Browser', '🎮 Alpha & Co läuft im Browser'])
  await ui.unmount()
})

test('kein Spiel im Ordner: kein Browser', { plugins: [brain] }, async ($, on) => {
  const geoeffnet = browser(on)
  const toasts = meldungen(on)
  on('fs.list', () => ({ value: [] }))
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await ui.press({ key: 'game' })
  await ruhe()
  expect(geoeffnet.length).toBe(0)
  expect(toasts).toEqual(['🎮 Noch kein Spiel im Ordner games/'])
  await ui.unmount()
})

test('ohne brain kein GAME', async $ => {
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(buttons(await ui.drawn())).toEqual([])
  await ui.unmount()
})
