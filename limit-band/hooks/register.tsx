import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionRateLimit } from 'claude-code'

import type { Window } from '../types'
import {
  bandLine,
  clamp,
  creditsWord,
  fromCache,
  labelOf,
  levelOf,
  money,
  rank,
  resetLabel,
} from './card'
import { SPEND, creditsIn, fetchBalance, findServer, isHiggsfield, splitTool } from './higgsfield'
import { langOf } from './lang'
import type { Lang } from './lang'

const windows = atom({ plugin: 'limit-band', key: 'windows' } as const, [])
const higgsfield = atom({ plugin: 'limit-band', key: 'higgsfield' } as const, null)

// Dauerhafter Speicher ($.store, pro Mod): die letzten Limit-Werte und der
// letzte Higgsfield-Kontostand. Beim Sitzungsstart meldet die API noch keine
// Limits; bis zur ersten Antwort zeigt die Leiste diese Werte.
const STORE_WINDOWS = 'windows'
const STORE_CREDITS = 'higgsfield-credits'

// Terminal-Raster. Jede Zeile wie "🧠 Brain": Emoji als Logo, Name fett in der Claude-Farbe.
const LABEL_W = 16
const LABEL_COLOR = 'claude'
const PCT_W = 5
const RESET_W = 19
const BAR_MIN = 8
const BAR_MAX = 24

// Die Zeile dieses Mods und die des Mods, dessen Zeile er auf grafischen
// Oberflächen mitzeichnet (Button "🧠 Brain"). Installiert über einen
// Marketplace kann der Name "<mod>@<marketplace>" lauten.
const SELF = /^limit-band(@|$)/
const PARTNER = /^brain(@|$)/
// Oberflächen, auf denen die Zeile von brain gerade die Limit-Zeile trägt.
// Nur dann blendet AbovePromptList die eigene Zeile aus.
const wrapped = new Set<string>()

type UI = ReturnType<EngineInterface['ui']['resolve']>

// Die Limit-Zeile für grafische Oberflächen: ein einziges Text-Element ohne
// Umbruch. Wird das Fenster schmal, schrumpft nur die Limit-Zeile und wird am
// Ende mit "…" gekürzt (zuerst Higgsfield, dann Woche, zuletzt der Balken);
// die Buttons behalten ihre Breite.
const limitLine = (ui: UI, list: Window[], credits: number | null, now: number, lang: Lang) => {
  const { Box, Text } = ui
  return (
    <Box flexDirection="row" flexShrink={1} minWidth={0} overflow="hidden">
      <Text wrap="truncate-end">
        {bandLine(list, credits, now, lang).map(s =>
          s.tone === 'plain' ? (
            s.text
          ) : s.tone === 'strong' ? (
            <Text bold>{s.text}</Text>
          ) : s.tone === 'dim' ? (
            <Text dimColor>{s.text}</Text>
          ) : (
            <Text color={s.tone}>{s.text}</Text>
          ),
        )}
      </Text>
    </Box>
  )
}

const toWindows = (limits: readonly SessionRateLimit[]): Window[] =>
  limits
    .filter(l => typeof l.percentUsed === 'number')
    .map(l => ({ kind: l.kind, percent: l.percentUsed, resetsAt: l.resetsAt ?? null }))
    .sort((a, b) => rank(a.kind) - rank(b.kind) || a.kind.localeCompare(b.kind))

async function setCredits($: EngineInterface, credits: number | null) {
  if (credits === null) return
  await update($, higgsfield, () => credits)
  await $.store.set(STORE_CREDITS, { credits, updated: Date.now() }).catch(() => undefined)
}

async function storedCredits($: EngineInterface): Promise<number | null> {
  const v = (await $.store.get(STORE_CREDITS).catch(() => undefined)) as { credits?: unknown } | undefined
  return typeof v?.credits === 'number' ? v.credits : null
}

async function refreshFromServer($: EngineInterface) {
  const server = await findServer($)
  if (server) await setCredits($, await fetchBalance($, server))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const r = await next(e)
    const usage = await $.session.usage()
    const live = toWindows(usage.rateLimits)
    const list =
      live.length > 0 ? live : fromCache(await $.store.get(STORE_WINDOWS).catch(() => []), Date.now())
    await update($, windows, () => list)
    const credits = await storedCredits($)
    if (credits !== null) await update($, higgsfield, () => credits)
    // Frischer Kontostand im Hintergrund, falls Higgsfield verbunden ist.
    void refreshFromServer($).catch(() => undefined)
    return r
  })

  on('session.measure', async ($, e, next) => {
    const list = toWindows(e.rateLimits)
    // Eine Messung ohne Limit-Werte überschreibt die letzten Werte nicht.
    if (list.length > 0) {
      await update($, windows, () => list)
      // Speicher ist Komfort: ohne ihn fehlen die Balken nur bis zur ersten Antwort.
      await $.store.set(STORE_WINDOWS, list).catch(() => undefined)
    }
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const r = await next(e)
    const mcp = splitTool(e.tool)
    if (!mcp) return r
    if (mcp.tool === 'balance') {
      if (await isHiggsfield($, mcp.server)) await setCredits($, creditsIn(r))
    } else if (SPEND.test(mcp.tool) && (await isHiggsfield($, mcp.server))) {
      void fetchBalance($, mcp.server)
        .then(c => setCredits($, c))
        .catch(() => undefined)
    }
    return r
  }).catch(($, e, next) => next(e)) // Fehler hier halten den Tool-Aufruf nie auf.

  // Seit Claude Code 2.1.32x bekommt jeder Mod eine eigene Zeile in der Leiste,
  // und die App stapelt die Zeilen untereinander. Damit Brain in derselben Zeile
  // steht, übernimmt limit-band auf grafischen Oberflächen die Zeile von brain
  // (Hook auf deren Zeile), setzt die Limit-Zeile links davor und blendet die
  // eigene Zeile aus (AbovePromptList). Ohne brain bleibt die eigene Zeile stehen.
  on('ui.render', { component: 'AbovePrompt', plugin: PARTNER }, async ($, e, next) => {
    const partner = await next(e)
    wrapped.delete(e.surface)
    if (e.surface === 'terminal' || e.props.hasSurvey) return partner

    const list = await read($, windows)
    const credits = await read($, higgsfield)
    if (list.length === 0 && credits === null) return partner

    const lang = await langOf($)
    const ui = $.ui.resolve(e)
    const { Box } = ui
    wrapped.add(e.surface)
    // Eine Zeile, nie ein Umbruch: links die Limit-Zeile (schrumpft, wird gekürzt),
    // rechts die Buttons (GAME, Brain) in voller Breite.
    return (
      <Box flexDirection="row" flexWrap="nowrap" alignItems="center" columnGap={2}>
        {limitLine(ui, list, credits, Date.now(), lang)}
        <Box flexDirection="row" flexGrow={1} flexShrink={0} justifyContent="flex-end">
          {partner}
        </Box>
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePromptList' }, async ($, e, next) => {
    const rows = e.props.rows
    if (!wrapped.has(e.surface) || !rows.some(r => PARTNER.test(r.plugin))) return next(e)
    return next({ ...e, props: { ...e.props, rows: rows.filter(r => !SELF.test(r.plugin)) } })
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const list = await read($, windows)
    const credits = await read($, higgsfield)
    if (e.props.hasSurvey || (list.length === 0 && credits === null)) return next(e)

    const now = Date.now()
    const lang = await langOf($)

    // Grafische Oberflächen (Desktop-App, VS Code): eine Textzeile.
    // Steht brain in der Leiste, zeichnet der Hook darüber die Zeile dort mit.
    if (e.surface !== 'terminal') {
      return limitLine($.ui.resolve(e), list, credits, now, lang)
    }

    // Terminal: Textraster, brain bekommt darunter seine eigene Zeile.
    const { Box, Text } = $.ui.resolve(e)
    const barW = clamp(e.props.bodyColumns - LABEL_W - PCT_W - RESET_W - 3, BAR_MIN, BAR_MAX)

    return (
      <Box flexDirection="column">
        {list.map(w => {
          const p = clamp(w.percent, 0, 100)
          const filled = Math.round((p / 100) * barW)
          const color = levelOf(p)
          return (
            <Box key={w.kind} flexDirection="row" gap={1}>
              <Box width={LABEL_W}>
                <Text bold color={LABEL_COLOR}>
                  {labelOf(w.kind, lang)}
                </Text>
              </Box>
              <Box width={barW}>
                <Text color={color}>{'━'.repeat(filled)}</Text>
                <Text color="subtle">{'─'.repeat(barW - filled)}</Text>
              </Box>
              <Box width={PCT_W} justifyContent="flex-end">
                <Text color={color}>{`${Math.round(w.percent)} %`}</Text>
              </Box>
              <Text dimColor>{resetLabel(w.resetsAt, now, lang)}</Text>
            </Box>
          )
        })}
        {credits !== null && (
          <Box key="higgsfield" flexDirection="row" gap={1}>
            <Box width={LABEL_W}>
              <Text bold color={LABEL_COLOR}>
                🎬 Higgsfield
              </Text>
            </Box>
            <Text>{money(credits, lang)}</Text>
            <Text dimColor>{creditsWord(lang)}</Text>
          </Box>
        )}
      </Box>
    )
  })
}
