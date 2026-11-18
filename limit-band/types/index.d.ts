/** Ein Limit-Fenster aus `rateLimits`: five_hour, seven_day, seven_day_<modell>, ... */
export type Window = { kind: string; percent: number; resetsAt: string | null }

declare module 'claude-code' {
  interface PluginState {
    'limit-band': { windows: Window[]; higgsfield: number | null }
  }
}
