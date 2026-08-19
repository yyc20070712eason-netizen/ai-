export function resume(checkpoint, decision, effects) {
  if (decision !== 'approve') return { state: decision === 'reject' ? 'rejected' : 'waiting', effects }
  if (checkpoint.applied) return { state: 'completed', effects }
  effects.push(`saved:${checkpoint.threadId}`)
  return { state: 'completed', effects, checkpoint: { ...checkpoint, applied: true } }
}
