import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FocusTimer } from './FocusTimer'

describe('FocusTimer', () => {
  beforeEach(() => vi.useFakeTimers())

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('moves through idle, running, paused, and reset without changing the props contract', () => {
    const onMinutesChange = vi.fn()
    const onComplete = vi.fn()
    render(<FocusTimer minutes={1} onMinutesChange={onMinutesChange} onComplete={onComplete} />)

    const timer = screen.getByRole('region', { name: '专注计时器' })
    expect(timer).toHaveAttribute('data-status', 'idle')
    expect(screen.getByText('01:00')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '开始专注' }))
    expect(timer).toHaveAttribute('data-status', 'running')
    act(() => vi.advanceTimersByTime(1_000))
    expect(screen.getByText('00:59')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '暂停专注' }))
    expect(timer).toHaveAttribute('data-status', 'paused')
    act(() => vi.advanceTimersByTime(2_000))
    expect(screen.getByText('00:59')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '重置计时' }))
    expect(timer).toHaveAttribute('data-status', 'idle')
    expect(screen.getByText('01:00')).toBeInTheDocument()
    expect(onComplete).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '20 分' }))
    expect(onMinutesChange).toHaveBeenCalledWith(20)
  })

  it('enters the complete state once and can restart from the beginning', () => {
    const onComplete = vi.fn()
    render(<FocusTimer minutes={1} onMinutesChange={vi.fn()} onComplete={onComplete} />)

    fireEvent.click(screen.getByRole('button', { name: '开始专注' }))
    act(() => vi.advanceTimersByTime(60_000))

    const timer = screen.getByRole('region', { name: '专注计时器' })
    expect(timer).toHaveAttribute('data-status', 'complete')
    expect(screen.getByText('本轮结束。站起来走两分钟，再继续。')).toBeInTheDocument()
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledWith(1)

    fireEvent.click(screen.getByRole('button', { name: '开始专注' }))
    expect(timer).toHaveAttribute('data-status', 'running')
    expect(screen.getByText('01:00')).toBeInTheDocument()
  })

  it('keeps compact mode compatible with the same callbacks and state labels', () => {
    const onComplete = vi.fn()
    render(<FocusTimer compact minutes={15} onMinutesChange={vi.fn()} onComplete={onComplete} />)

    const timer = screen.getByRole('region', { name: '专注计时器' })
    expect(timer).toHaveClass('timer--compact', 'timer--idle')
    fireEvent.click(screen.getByRole('button', { name: '开始计时' }))
    expect(timer).toHaveClass('timer--running')
    fireEvent.click(screen.getByRole('button', { name: '暂停计时' }))
    expect(timer).toHaveClass('timer--paused')
    expect(onComplete).not.toHaveBeenCalled()
  })
})
