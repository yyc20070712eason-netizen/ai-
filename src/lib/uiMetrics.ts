import type { FocusSession } from '../types'
import { startOfLocalWeek } from './study'

export function allocateSectionMinutes(totalMinutes: number, weights: readonly number[]) {
  if (weights.length === 0) return []
  const safeTotal = Math.max(0, Math.floor(totalMinutes))
  const minimum = safeTotal >= weights.length ? 1 : 0
  const remaining = safeTotal - minimum * weights.length
  const normalized = weights.map((weight) => Math.max(1, Number.isFinite(weight) ? weight : 1))
  const weightTotal = normalized.reduce((sum, weight) => sum + weight, 0)
  const exact = normalized.map((weight) => remaining * weight / weightTotal)
  const result = exact.map((value) => minimum + Math.floor(value))
  let unassigned = safeTotal - result.reduce((sum, value) => sum + value, 0)
  const order = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index)
  for (let index = 0; index < order.length && unassigned > 0; index += 1, unassigned -= 1) {
    result[order[index].index] += 1
  }
  return result
}

export function focusMinutesByWeekday(sessions: readonly FocusSession[], now = new Date()) {
  const start = startOfLocalWeek(now).getTime()
  const end = now.getTime()
  const totals = Array.from({ length: 7 }, () => 0)
  for (const session of sessions) {
    const completed = new Date(session.completedAt)
    const time = completed.getTime()
    if (!Number.isFinite(time) || time < start || time > end) continue
    totals[(completed.getDay() + 6) % 7] += Math.max(0, session.minutes)
  }
  return totals
}
