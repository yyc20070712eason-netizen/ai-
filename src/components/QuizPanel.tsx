import { Check, RotateCcw, Star, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { makeStageKey } from '../content/schema'
import { gradeQuiz, sampleQuiz } from '../lib/study'
import type { QuizResult, Stage, StageKey, StageRef } from '../types'

type QuizPanelProps = {
  stage: Stage
  stageRef: StageRef
  previous?: QuizResult
  onResult: (result: QuizResult) => void
  favoriteQuestionIds: ReadonlySet<string>
  onToggleFavorite: (questionId: string) => void
}

type QuizSessionProps = Omit<QuizPanelProps, 'stageRef'> & {
  stageKey: StageKey
}

function QuizSession({ stage, stageKey, previous, onResult, favoriteQuestionIds, onToggleFavorite }: QuizSessionProps) {
  const initialAttempt = previous ? previous.attempt + 1 : 0
  const [attempt, setAttempt] = useState(initialAttempt)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<QuizResult | null>(null)
  const questions = useMemo(
    () => sampleQuiz(stage.quiz, stageKey, attempt),
    [attempt, stage.quiz, stageKey],
  )
  const allAnswered = questions.every((question) => answers[question.id])

  const submit = () => {
    if (!allAnswered) return
    const next = gradeQuiz(questions, answers, attempt)
    setResult(next)
    onResult(next)
  }

  const retry = () => {
    setAttempt((value) => value + 1)
    setAnswers({})
    setResult(null)
  }

  return (
    <section className="quiz" id="quiz" aria-labelledby="quiz-title">
      <div className="section-heading">
        <h2 id="quiz-title">过关检验</h2>
        <span>5 题 · 80% 通过</span>
      </div>
      <div className="quiz__questions">
        {questions.map((question, index) => {
          const selected = answers[question.id]
          const isCorrect = selected === question.answer
          return (
            <fieldset className="question" key={`${stageKey}:${question.id}`}>
              <legend>
                <span className="question__meta">
                  <span className="question__number">{String(index + 1).padStart(2, '0')}</span>
                  <button
                    className={`question__favorite ${favoriteQuestionIds.has(question.id) ? 'is-favorited' : ''}`}
                    type="button"
                    aria-pressed={favoriteQuestionIds.has(question.id)}
                    aria-label={`${favoriteQuestionIds.has(question.id) ? '取消收藏' : '收藏'}第 ${index + 1} 题`}
                    onClick={() => onToggleFavorite(question.id)}
                  >
                    <Star aria-hidden="true" />
                  </button>
                </span>
                {question.prompt}
                {question.critical && <span className="question__critical">关键题</span>}
              </legend>
              <div className="question__choices">
                {question.choices.map((choice) => {
                  const chosen = selected === choice.id
                  const answer = result && choice.id === question.answer
                  const wrong = result && chosen && !answer
                  return (
                    <label
                      className={`answer ${chosen ? 'is-selected' : ''} ${answer ? 'is-correct' : ''} ${wrong ? 'is-wrong' : ''}`}
                      key={`${stageKey}:${question.id}:${choice.id}`}
                    >
                      <input
                        type="radio"
                        name={question.id}
                        value={choice.id}
                        checked={chosen}
                        disabled={Boolean(result)}
                        onChange={() => setAnswers((current) => ({ ...current, [question.id]: choice.id }))}
                      />
                      <span className="answer__key">{choice.id.toUpperCase()}</span>
                      <span>{choice.label}</span>
                      {answer && <Check className="answer__icon" aria-label="正确答案" />}
                      {wrong && <X className="answer__icon" aria-label="你的答案不正确" />}
                    </label>
                  )
                })}
              </div>
              {result && (
                <p className={isCorrect ? 'question__feedback is-correct' : 'question__feedback is-wrong'}>
                  {isCorrect ? '判断正确。' : '这题需要再看一眼。'} {question.explanation}
                </p>
              )}
            </fieldset>
          )
        })}
      </div>
      {!result ? (
        <button className="button button--primary" type="button" onClick={submit} disabled={!allAnswered}>
          检查答案
        </button>
      ) : (
        <div className={`quiz__result ${result.passed ? 'is-passed' : 'is-failed'}`} role="status">
          <div>
            <strong>{result.score} 分</strong>
            <p>{result.passed ? '本关通过，复习已排入 1 / 3 / 7 / 14 / 30 天。' : '还差一点。换一组题再试，薄弱点不会被跳过。'}</p>
          </div>
          {!result.passed && (
            <button className="button button--secondary" type="button" onClick={retry}>
              <RotateCcw aria-hidden="true" /> 换题再试
            </button>
          )}
        </div>
      )}
    </section>
  )
}

export function QuizPanel({ stage, stageRef, previous, onResult, favoriteQuestionIds, onToggleFavorite }: QuizPanelProps) {
  const stageKey = makeStageKey(stageRef)

  return (
    <QuizSession
      key={stageKey}
      stage={stage}
      stageKey={stageKey}
      previous={previous}
      onResult={onResult}
      favoriteQuestionIds={favoriteQuestionIds}
      onToggleFavorite={onToggleFavorite}
    />
  )
}
