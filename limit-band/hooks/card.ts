// Reine Funktionen ohne `$`: Beschriftung, Zeitformat und die Zeile für
// grafische Oberflächen (Desktop-App, VS Code). register.tsx und die Tests
// nutzen dieselben Funktionen. Jede Beschriftung gibt es auf Deutsch und Englisch.
import type { Window } from '../types'
import type { Lang } from './lang'

const MODEL_NAMES: Record<string, string> = {
  opus: 'Opus',
  sonnet: 'Sonnet',
  haiku: 'Haiku',
  fable: 'Fable',
}

const TEXT = {
  de: { five: '5 Std', week: 'Woche', budget: 'Budget', limit: '5-Std-Limit', credits: 'Credits' },
  en: { five: '5 h', week: 'Week', budget: 'Budget', limit: '5h limit', credits: 'credits' },
} as const

/** five_hour zuerst, dann die Woche gesamt, dann die Wochen je Modell, dann der Rest. */
export const rank = (kind: string) =>
  kind === 'five_hour' ? 0 : kind === 'seven_day' ? 1 : kind.startsWith('seven_day_') ? 2 : 3

// Nur Emojis, die jedes Terminal zwei Zellen breit zeichnet (ohne Variation Selector).
export const iconOf = (kind: string): string =>
  kind === 'five_hour' ? '⏳' : kind.startsWith('seven_day') ? '📅' : kind === 'spend_limit' ? '💶' : '📊'

export const nameOf = (kind: string, lang: Lang = 'de'): string => {
  const t = TEXT[lang]
  if (kind === 'five_hour') return t.five
  if (kind === 'seven_day') return t.week
  if (kind.startsWith('seven_day_')) {
    const m = kind.slice('seven_day_'.length)
    return `${t.week} ${MODEL_NAMES[m] ?? m.replace(/_/g, ' ')}`
  }
  if (kind === 'spend_limit') return t.budget
  return kind
}

export const labelOf = (kind: string, lang: Lang = 'de') => `${iconOf(kind)} ${nameOf(kind, lang)}`

export const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

export type Level = 'success' | 'warning' | 'error'
export const levelOf = (p: number): Level => (p >= 90 ? 'error' : p >= 70 ? 'warning' : 'success')

const WEEKDAY = {
  de: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
} as const
const pad = (n: number) => String(n).padStart(2, '0')

/** Heute: "17:30". Später als 20 Std: "Mo 09:00" (en: "Mon 09:00"). Ohne Zeitpunkt: "". */
export const resetTime = (iso: string | null, now: number, lang: Lang = 'de'): string => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  return d.getTime() - now > 20 * 3_600_000 ? `${WEEKDAY[lang][d.getDay()]} ${time}` : time
}

/** "Reset 17:30 Uhr" (de) oder "resets 17:30" (en); ohne Zeitpunkt "". */
export const resetLabel = (iso: string | null, now: number, lang: Lang = 'de'): string => {
  const t = resetTime(iso, now, lang)
  if (!t) return ''
  return lang === 'de' ? `Reset ${t} Uhr` : `resets ${t}`
}

const group = (int: string, sep: string) => int.replace(/\B(?=(\d{3})+(?!\d))/g, sep)

/** 1234.5 → "1.234,50" (de) oder "1,234.50" (en) */
export const money = (n: number, lang: Lang = 'de') => {
  const [int = '0', frac = '00'] = n.toFixed(2).split('.')
  return lang === 'de' ? `${group(int, '.')},${frac}` : `${group(int, ',')}.${frac}`
}

/** 1240.15 → "1.240" (de) oder "1,240" (en), abgerundet: nie mehr Credits als vorhanden */
export const wholeNumber = (n: number, lang: Lang = 'de') =>
  group(String(Math.floor(n)), lang === 'de' ? '.' : ',')

export const creditsWord = (lang: Lang = 'de') => TEXT[lang].credits

/**
 * Fenster aus dem Speicher der letzten Sitzung. Ein Fenster, dessen Reset
 * schon vorbei ist, steht wieder bei 0 % und hat noch keinen neuen Zeitpunkt.
 */
export function fromCache(raw: unknown, now: number): Window[] {
  let list: unknown = raw
  if (typeof raw === 'string') {
    try {
      list = JSON.parse(raw)
    } catch {
      return []
    }
  }
  if (!Array.isArray(list)) return []
  return list
    .filter(
      (w): w is Window =>
        !!w && typeof w.kind === 'string' && typeof w.percent === 'number',
    )
    .map(w => {
      const at = w.resetsAt ? Date.parse(w.resetsAt) : Number.NaN
      return at < now
        ? { kind: w.kind, percent: 0, resetsAt: null }
        : { kind: w.kind, percent: w.percent, resetsAt: w.resetsAt ?? null }
    })
}

// ── Zeile für grafische Oberflächen ─────────────────────────────────────────
// Eine Zeile:
// "5-Std-Limit ███░░░… 15 % Reset 12:30 Uhr | Woche 3 % | HF 1.208" (HF = Higgsfield-Credits)
// en: "5h limit ███░░░… 15 % resets 12:30 | Week 3 % | HF 1,208"

/** Zellen des 5-Std-Balkens: eine Zelle = 10 %. 10 statt 20, damit die Buttons rechts in dieselbe Zeile passen. */
export const BAR_CELLS = 10

/** Wie ein Stück der Zeile gezeichnet wird: hell und halbfett, gedimmt, ohne Stil oder in Ampelfarbe. */
export type Tone = 'strong' | 'dim' | 'plain' | Level
export type Seg = { text: string; tone: Tone }

/**
 * Die Zeile als Blöcke, jeder Block eine Folge von Stücken. Zwischen Blöcken
 * darf die Zeile umbrechen, innerhalb eines Blocks nie (Balken, "Woche 14 %",
 * "HF 1.095" bleiben zusammen). Ab dem zweiten Block beginnt jeder mit " | ".
 * Fehlt das 5-Std-Fenster, obwohl Limit-Werte da sind, läuft gerade keins:
 * 0 %, ohne Reset. Ohne Limit-Werte nur Higgsfield.
 */
export function bandChunks(
  windows: readonly Window[],
  credits: number | null,
  now: number,
  lang: Lang = 'de',
): Seg[][] {
  const chunks: Seg[][] = []
  const open = (): Seg[] => {
    const c: Seg[] = chunks.length > 0 ? [{ text: ' | ', tone: 'dim' }] : []
    chunks.push(c)
    return c
  }

  if (windows.length > 0) {
    const five = windows.find(w => w.kind === 'five_hour')
    const p = clamp(five?.percent ?? 0, 0, 100)
    const filled = Math.round((p / 100) * BAR_CELLS)
    const level = levelOf(p)
    const c = open()
    c.push({ text: TEXT[lang].limit, tone: 'strong' }, { text: ' ', tone: 'plain' })
    if (filled > 0) c.push({ text: '█'.repeat(filled), tone: level })
    if (filled < BAR_CELLS) c.push({ text: '░'.repeat(BAR_CELLS - filled), tone: 'dim' })
    c.push({ text: ' ', tone: 'plain' }, { text: `${Math.round(p)} %`, tone: level })
    const reset = resetLabel(five?.resetsAt ?? null, now, lang)
    if (reset) c.push({ text: ` ${reset}`, tone: 'dim' })

    for (const w of windows) {
      if (!w.kind.startsWith('seven_day')) continue
      open().push(
        { text: `${nameOf(w.kind, lang)} `, tone: 'dim' },
        { text: `${Math.round(w.percent)} %`, tone: levelOf(w.percent) },
      )
    }
  }

  if (credits !== null) {
    open().push(
      { text: 'HF ', tone: 'dim' },
      { text: wholeNumber(credits, lang), tone: 'strong' },
    )
  }
  return chunks
}

/** Dieselbe Zeile ohne Blockgrenzen. */
export const bandLine = (
  windows: readonly Window[],
  credits: number | null,
  now: number,
  lang: Lang = 'de',
): Seg[] => bandChunks(windows, credits, now, lang).flat()
