export function runTask(input, checkpoint = { version: 1, applied: false }) {
  if (!input.approved) return { status: 'human-required', checkpoint, sideEffectCount: 0 }
  if (checkpoint.applied) return { status: 'completed', checkpoint, sideEffectCount: 0 }
  return { status: 'completed', checkpoint: { ...checkpoint, applied: true }, sideEffectCount: 1 }
}
