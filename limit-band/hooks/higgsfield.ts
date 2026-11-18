// Higgsfield-Credits ohne Extra-Hook in settings.json: der Mod erkennt den
// Higgsfield-MCP-Server selbst, liest den Kontostand aus dessen Tool `balance`
// und fragt ihn nach jedem Credit-verbrauchenden Aufruf neu ab.
// Wer kein Higgsfield verbunden hat, sieht kein HF-Feld.
import type { EngineInterface } from 'claude-code'

const MCP_TOOL = /^mcp__(.+?)__(.+)$/

/** "mcp__<server>__<tool>" → { server, tool } */
export const splitTool = (name: string): { server: string; tool: string } | undefined => {
  const m = MCP_TOOL.exec(name)
  return m ? { server: m[1]!, tool: m[2]! } : undefined
}

/** Higgsfield-Tools, die Credits kosten. */
export const SPEND =
  /^(generate_|upscale_|remove_background|outpaint_image|reframe|motion_control|voice_change|dubbing|execute_preset|ads_studio_generate|build_ai_influencer|ai_influencer_generate|create_voice|shorts_studio_create|separate_stems|gpu_generate|gpu_rental_generate|scene_builder_3d_generate)/

/** Kontostand aus einer `balance`-Antwort: das Feld "credits", auch in JSON-Text verpackt. */
export const creditsIn = (result: unknown): number | null => {
  let s: string
  try {
    s = typeof result === 'string' ? result : JSON.stringify(result)
  } catch {
    return null
  }
  const m = /\\*"credits\\*"\s*:\s*(\d+(?:\.\d+)?)/.exec(s ?? '')
  return m ? Number(m[1]) : null
}

const verdict = new Map<string, boolean>()

/**
 * Ist `server` der Higgsfield-Server? Ein claude.ai-Konnektor heißt in den
 * Tool-Namen nur nach seiner ID, darum zählen auch die Tool-Beschreibungen
 * und die typischen Tool-Namen (balance und motion_control zusammen).
 */
export async function isHiggsfield($: EngineInterface, server: string): Promise<boolean> {
  if (/higgsfield/i.test(server)) return true
  const known = verdict.get(server)
  if (known !== undefined) return known
  const prefix = `mcp__${server}__`
  const tools = (await $.tool.list().catch(() => [])).filter(t => t.name.startsWith(prefix))
  // Server noch nicht verbunden: nichts merken, später neu prüfen.
  if (tools.length === 0) return false
  const names = new Set(tools.map(t => t.name.slice(prefix.length)))
  const hit =
    tools.some(t => /higgsfield/i.test(t.description)) || (names.has('balance') && names.has('motion_control'))
  verdict.set(server, hit)
  return hit
}

/** Der verbundene Higgsfield-Server, oder undefined. */
export async function findServer($: EngineInterface): Promise<string | undefined> {
  const tools = await $.tool.list().catch(() => [])
  for (const t of tools) {
    const s = splitTool(t.name)
    if (s?.tool === 'balance' && (await isHiggsfield($, s.server))) return s.server
  }
  return undefined
}

/** Fragt den Kontostand direkt beim Server ab (kostet keine Credits). */
export async function fetchBalance($: EngineInterface, server: string): Promise<number | null> {
  const r = await $.mcp.call(server, 'balance', {}).catch(() => undefined)
  if (!r || r.isError) return null
  return creditsIn(r.content)
}
