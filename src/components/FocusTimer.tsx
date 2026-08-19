import { Pause, Play, RotateCcw, Settings } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

type FocusTimerProps = {
  minutes: number
  onMinutesChange: (minutes: number) => void
  onComplete: (minutes: number) => void
  compact?: boolean
}

type TimerStatus = 'idle' | 'running' | 'paused' | 'complete'

export function FocusTimer({ minutes, onMinutesChange, onComplete, compact = false }: FocusTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState(minutes * 60)
  const [status, setStatus] = useState<TimerStatus>('idle')
  const [announcement, setAnnouncement] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const completedRef = useRef(false)
  const running = status === 'running'

  useEffect(() => {
    completedRef.current = false
    setSecondsLeft(minutes * 60)
    setStatus('idle')
  }, [minutes])

  useEffect(() => {
    if (!running) return
    const interval = window.setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1))
    }, 1000)
    return () => window.clearInterval(interval)
  }, [running])

  useEffect(() => {
    if (secondsLeft !== 0 || completedRef.current || status !== 'running') return
    completedRef.current = true
    setStatus('complete')
    setAnnouncement(`本轮 ${minutes} 分钟专注已结束。`)
    onComplete(minutes)
  }, [minutes, onComplete, secondsLeft, status])

  const reset = () => {
    completedRef.current = false
    setStatus('idle')
    setSecondsLeft(minutes * 60)
    setAnnouncement(`计时已重置为 ${minutes} 分钟。`)
  }

  const toggle = () => {
    if (secondsLeft === 0) {
      completedRef.current = false
      setSecondsLeft(minutes * 60)
      setStatus('running')
      setAnnouncement(`开始 ${minutes} 分钟专注。`)
      return
    }
    completedRef.current = false
    setStatus((value) => {
      const next = value === 'running' ? 'paused' : 'running'
      setAnnouncement(next === 'paused' ? '计时已暂停。' : `开始 ${minutes} 分钟专注。`)
      return next
    })
  }

  const display = `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`
  const timeLabel = `剩余 ${Math.floor(secondsLeft / 60)} 分 ${secondsLeft % 60} 秒`
  const radius = 54
  const progress = secondsLeft / (minutes * 60)
  const statusLabel = status === 'running'
    ? '进行中'
    : status === 'paused'
      ? '已暂停'
      : status === 'complete'
        ? '已完成'
        : '准备开始'

  return (
    <section className={`timer timer--${status} ${compact ? 'timer--compact' : ''} ${status === 'complete' ? 'is-complete' : ''}`} data-status={status} aria-label="专注计时器">
      {compact ? (
        <div className="timer__row">
          <time className="timer__time" aria-label={timeLabel}>{display}</time>
          <button className="icon-button" type="button" onClick={toggle} aria-label={running ? '暂停计时' : '开始计时'}>{running ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}</button>
          <button className="icon-button icon-button--quiet" type="button" onClick={reset} aria-label="重置计时"><RotateCcw aria-hidden="true" /></button>
        </div>
      ) : (
        <>
          <div className="timer__head">
            <p className="timer__label">专注计时器</p>
            <button className="icon-button icon-button--quiet timer__settings" type="button" onClick={() => setSettingsOpen((current) => !current)} aria-label="设置专注时长" aria-expanded={settingsOpen}><Settings aria-hidden="true" /></button>
          </div>
          <div className="timer__dial">
            <svg viewBox="0 0 128 128" aria-hidden="true">
              <circle className="timer__track" cx="64" cy="64" r={radius} />
              <circle className="timer__progress" cx="64" cy="64" r={radius} pathLength="100" style={{ strokeDasharray: '100', strokeDashoffset: String(100 - progress * 100) }} />
            </svg>
            <div className="timer__dial-copy"><span>本关专注</span><time className="timer__time" aria-label={timeLabel}>{display}</time><small>建议 {minutes} 分钟</small></div>
          </div>
          <button className="timer__start" type="button" onClick={toggle}>{running ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}{running ? '暂停专注' : '开始专注'}</button>
          <div className="timer__utilities"><button className="timer__reset" type="button" onClick={reset} aria-label="重置计时"><RotateCcw aria-hidden="true" /><span>重置</span></button><span>{statusLabel}</span></div>
        </>
      )}
      {!compact && (
        <div className={`timer__presets ${settingsOpen ? 'is-open' : ''}`} aria-label="选择专注时长">
          {[10, 15, 20, 25].map((value) => (
            <button
              className={value === minutes ? 'preset is-active' : 'preset'}
              type="button"
              key={value}
              onClick={() => onMinutesChange(value)}
              aria-pressed={value === minutes}
              disabled={running}
            >
              {value} 分
            </button>
          ))}
        </div>
      )}
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>
      {secondsLeft === 0 && <p className="timer__done">本轮结束。站起来走两分钟，再继续。</p>}
    </section>
  )
}
