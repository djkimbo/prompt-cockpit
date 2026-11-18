export type BrainStatus =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'done'; original: string }
  | { kind: 'fallback'; original: string; text: string }
  | { kind: 'error'; message: string }

declare module 'claude-code' {
  interface PluginState {
    brain: { status: Shaped<BrainStatus> }
  }
}
