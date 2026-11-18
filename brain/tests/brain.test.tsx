import { expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'

// Steht für das, was unter brain zeichnet (Engine oder limit-band).
// Beschriftungen auf Deutsch, unabhängig von der Sprache des Rechners.
const deutsch = (on: On) =>
  on('env.get', (_, e) => ({ value: e.name === 'PROMPT_COCKPIT_LANG' ? 'de' : undefined }))

const beneath = (on: On) => {
  deutsch(on)
  return on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>limit-band</Text>
  })
}

const RAW =
  'bau mir einen mod für Claude ich möchte äh einen Button haben der halt den Text strukturiert'
const CLEAN = 'Bau mir einen Mod für Claude.\n\n**Anforderungen:**\n- Button, der den Text strukturiert'
const USAGE = {
  input_tokens: 1,
  output_tokens: 1,
  cache_read_input_tokens: 0,
  cache_creation_input_tokens: 0,
}

const BAND = {
  plugin: 'brain',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 9 },
    view: {},
  },
} as const

for (const surface of ['terminal', 'desktop'] as const) {
  test(`Brain räumt das Diktat auf und kann es zurücknehmen (${surface})`, async ($, on) => {
    beneath(on)
    const fills: string[] = []
    let sent = ''

    on('prompt.read', () => ({ value: { text: RAW, cursor: RAW.length } }))
    on('model.complete', (_, e) => {
      sent = e.prompt
      return { value: { isAnswered: true, text: `  ${CLEAN}\n`, usage: USAGE } }
    })
    on('prompt.fill', (_, e) => {
      fills.push(e.text)
      return { isFilled: true }
    })

    const ui = await $.ui.mount({ ...BAND, surface })
    const button = await ui.find({ type: 'Button', key: 'brain' })
    // Gehirn und Name stehen im Button, keine eigene Beschriftung davor.
    expect((button?.props as { label?: string } | undefined)?.label).toBe('🧠 Brain')
    // Text "🧠 Brain" nur im Button selbst (Desktop: Schriftstufe footnote), nie davor.
    const name = await ui.find({ type: 'Text', text: /^🧠 Brain$/ })
    expect(name?.props?.size).toBe(surface === 'terminal' ? undefined : 'footnote')
    expect(await ui.find({ type: 'Text', text: /limit-band/ })).toBeDefined()

    await ui.press({ key: 'brain' })

    expect(sent).toContain(RAW)
    expect(fills).toEqual([CLEAN])
    expect(await ui.find({ type: 'Text', text: /aufgeräumt/ })).toBeDefined()

    await ui.press({ key: 'undo' })

    expect(fills).toEqual([CLEAN, RAW])
    expect(await ui.find({ type: 'Button', key: 'undo' })).toBeUndefined()
    await ui.unmount()
  })
}

test('leeres Eingabefeld ruft kein Modell auf', async ($, on) => {
    beneath(on)
  let calls = 0
  on('prompt.read', () => ({ value: { text: '   ', cursor: 0 } }))
  on('model.complete', () => {
    calls += 1
    return { value: { isAnswered: true, text: 'x', usage: USAGE } }
  })
  on('ui.toast', () => ({ value: undefined }))

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await ui.press({ key: 'brain' })

  expect(calls).toBe(0)
  await ui.unmount()
})

test('API-Fehler wird im Band angezeigt', async ($, on) => {
    beneath(on)
  on('prompt.read', () => ({ value: { text: RAW, cursor: 0 } }))
  on('model.complete', () => ({
    value: {
      isAnswered: false,
      reason: 'api-error',
      status: 529,
      error: 'overloaded',
      usage: USAGE,
    },
  }))

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await ui.press({ key: 'brain' })

  expect((await ui.find({ type: 'Text', text: /Fehler:/ }))?.text).toContain('overloaded')
  await ui.unmount()
})

type Node = { type?: string; props?: Record<string, unknown>; children?: unknown[] }
const isNode = (n: unknown): n is Node => typeof n === 'object' && n !== null && 'type' in n
const labels = (n: unknown): string[] =>
  isNode(n)
    ? [...(n.type === 'Button' ? [String(n.props?.label)] : []), ...(n.children ?? []).flatMap(labels)]
    : []

for (const surface of ['terminal', 'desktop'] as const) {
  test(`Was unter brain angehängt wird, steht links neben Brain in derselben Reihe (${surface})`, async ($, on) => {
    on('ui.render', { component: 'AbovePrompt', plugin: 'brain' }, ($, e) => {
      const { Button } = $.ui.resolve(e)
      return <Button key="game" variant="primary" label="🎮 GAME" hotkey="g" onPress={() => undefined} />
    })

    const ui = await $.ui.mount({ ...BAND, surface })
    const tree = await ui.drawn()
    const row = (function find(n: unknown): Node | undefined {
      if (!isNode(n)) return undefined
      if (n.type === 'Box' && n.props?.flexDirection === 'row' && (n.children ?? []).some(c => labels(c).includes('🎮 GAME')))
        return n
      for (const c of n.children ?? []) {
        const hit = find(c)
        if (hit) return hit
      }
      return undefined
    })(tree)
    expect(row).toBeDefined()
    // GAME links, Brain ganz rechts, Abstand genau einmal: Rand links von Brain,
    // kein `gap` in der Reihe (sonst doppelt um das Element der Engine).
    expect(labels(row)).toEqual(['🎮 GAME', '🧠 Brain'])
    expect(row?.props?.gap).toBeUndefined()
    const brainBox = (row?.children ?? []).filter(isNode).find(c => labels(c).includes('🧠 Brain'))
    expect(brainBox?.props?.marginLeft).toBe('sm')
    expect(labels(brainBox)).toEqual(['🧠 Brain'])
    await ui.unmount()
  })
}
