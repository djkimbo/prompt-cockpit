import type { EngineInterface, Register } from 'claude-code'

import { langOf } from './lang'

// Seit Claude Code 2.1.32x bekommt jeder Mod eine eigene Zeile in der Leiste,
// und die App stapelt die Zeilen untereinander. Damit GAME neben "🧠 Brain"
// steht, hängt sich dieser Mod an die Zeile von brain und setzt den Button
// links davor, Brain bleibt ganz rechts. Steht game in der Kette unter brain,
// ordnet brain selbst so an. Fehlt brain, erscheint auch GAME nicht.
// Kein eigener Abstand: brain setzt genau einen Rand links von seinem Button
// (Stufe "sm", wie zwischen Buttons im Chat). Ein `gap` hier käme doppelt dazu.
// Installiert über einen Marketplace kann der Name "brain@<marketplace>" lauten.
const PARTNER = /^brain(@|$)/

// Spiele sind einzelne HTML-Dateien in games/. Ein neues Spiel: Datei dazulegen,
// fertig. Jeder Klick auf GAME öffnet das nächste Spiel, reihum nach Dateiname:
// nie zweimal hintereinander dasselbe. Welches zuletzt lief, merkt sich der Mod
// in seinem Speicher ($.store). Eine alte Auswahlseite index.html wird übergangen.
const ALTE_AUSWAHL = 'index.html'
const MERKER = 'zuletzt'

const TEXT = {
  de: {
    none: '🎮 Noch kein Spiel im Ordner games/',
    running: (title: string) => `🎮 ${title} läuft im Browser`,
    noBrowser: '🎮 Browser ließ sich nicht öffnen',
  },
  en: {
    none: '🎮 No game in the games/ folder yet',
    running: (title: string) => `🎮 ${title} is open in your browser`,
    noBrowser: '🎮 Could not open the browser',
  },
} as const

type Game = { file: string; path: string; title: string }

async function listGames($: EngineInterface, dir: string): Promise<Game[]> {
  const entries = await $.fs.list(dir).catch(() => [])
  const files = entries
    .filter(e => e.kind === 'file' && e.name.toLowerCase().endsWith('.html') && e.name !== ALTE_AUSWAHL)
    .map(e => e.name)
    .sort((a, b) => a.localeCompare(b, 'de'))

  return Promise.all(
    files.map(async file => {
      const path = `${dir}/${file}`
      const html = await $.fs.read(path).catch(() => '')
      const title = /<title>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() || file.replace(/\.html$/i, '')
      return { file, path, title }
    }),
  )
}

// macOS: open, Linux: xdg-open, Windows: start.
async function openInBrowser($: EngineInterface, path: string): Promise<boolean> {
  const tries: string[][] = [['open', path], ['xdg-open', path], ['cmd', '/c', 'start', '', path]]
  for (const argv of tries) {
    const r = await $.process.run(argv, { timeoutMs: 10_000 }).catch(() => undefined)
    if (r?.exitCode === 0) return true
  }
  return false
}

async function play($: EngineInterface): Promise<void> {
  const t = TEXT[await langOf($)]
  const dir = `${$.plugin.root}/games`
  const games = await listGames($, dir)

  if (games.length === 0) {
    $.ui.toast(t.none)
    return
  }

  const zuletzt = String((await $.store.get(MERKER).catch(() => undefined)) ?? '')
  const game = games[(games.findIndex(g => g.file === zuletzt) + 1) % games.length]!
  // Merker ist Komfort: ohne ihn startet GAME wieder beim ersten Spiel.
  await $.store.set(MERKER, game.file).catch(() => undefined)

  const ok = await openInBrowser($, game.path)
  $.ui.toast(ok ? t.running(game.title) : t.noBrowser)
}

export const register: Register = on => {
  on('ui.render', { component: 'AbovePrompt', plugin: PARTNER }, async ($, e, next) => {
    const partner = await next(e)
    if (e.props.hasSurvey) return partner

    const { Box, Button, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="row" alignItems="center">
        {e.surface === 'terminal' ? (
          <Button key="game" variant="primary" label="🎮 GAME" hotkey="g" onPress={() => play($)} />
        ) : (
          // Desktop und Handy: Schrift eine Stufe kleiner (footnote), Button etwas kleiner.
          <Button key="game" variant="primary" label="🎮 GAME" hotkey="g" onPress={() => play($)}>
            <Text size="footnote">🎮 GAME</Text>
          </Button>
        )}
        {partner}
      </Box>
    )
  })
}
