// Sprache der Beschriftungen: Deutsch oder Englisch.
// Reihenfolge: PROMPT_COCKPIT_LANG (de|en, zum Erzwingen), LC_ALL, LANG,
// dann die Systemsprache (macOS: AppleLocale, Windows: Get-Culture).
// Alles außer Deutsch wird Englisch.
import type { EngineInterface } from 'claude-code'

export type Lang = 'de' | 'en'

const fromLocale = (s: string | undefined): Lang | undefined => {
  const m = /^([a-z]{2})(?:[_-]|$)/i.exec((s ?? '').trim())
  if (!m) return undefined
  return m[1]!.toLowerCase() === 'de' ? 'de' : 'en'
}

let cached: Lang | undefined

async function osLocale($: EngineInterface): Promise<string | undefined> {
  const tries: string[][] = [
    ['defaults', 'read', '-g', 'AppleLocale'],
    ['powershell', '-NoProfile', '-Command', '(Get-Culture).Name'],
  ]
  for (const argv of tries) {
    const r = await $.process.run(argv, { timeoutMs: 3_000 }).catch(() => undefined)
    if (r?.exitCode === 0 && r.stdout.trim()) return r.stdout.trim()
  }
  return undefined
}

export async function langOf($: EngineInterface): Promise<Lang> {
  if (cached) return cached
  // Jede Abfrage darf scheitern (Test, fremde Oberfläche): dann gilt die nächste.
  const forced = (await $.env.get('PROMPT_COCKPIT_LANG').catch(() => undefined))?.trim().toLowerCase()
  if (forced === 'de' || forced === 'en') return (cached = forced)
  cached =
    fromLocale(await $.env.get('LC_ALL').catch(() => undefined)) ??
    fromLocale(await $.env.get('LANG').catch(() => undefined)) ??
    fromLocale(await osLocale($).catch(() => undefined)) ??
    'en'
  return cached
}
