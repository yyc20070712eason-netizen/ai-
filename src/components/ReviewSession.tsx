import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { makeStageKey } from '../content/schema'
import { sampleQuiz } from '../lib/study'
import type { ChapterPackage, QuizQuestion, ReviewItem, Stage, StageProgress } from '../types'

export type ReviewEntry = {
  item: ReviewItem
  chapter: ChapterPackage
  stage: Stage
  progress?: StageProgress
}

type ReviewSessionProps = {
  entries: ReviewEntry[]
  onAnswer: (entry: ReviewEntry, correct: boolean) => void
  onClose: () => void
  onOpenStage: (entry: ReviewEntry) => void
}

function chooseQuestion(entry: ReviewEntry): QuizQuestion {
  const wrongIds = entry.progress?.quizResult?.wrongQuestionIds ?? []
  const previousWrong = entry.stage.quiz.find((question) => wrongIds.includes(question.id))
  if (previousWrong) return previousWrong
  const critical = entry.stage.quiz.find((question) => question.scenario && question.critical)
  if (critical) return critical
  return sampleQuiz(entry.stage.quiz, makeStageKey(entry.item.stage), entry.item.intervalIndex)[0]
}

export function ReviewSession({ entries, onAnswer, onClose, onOpenStage }: ReviewSessionProps) {
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const entry = entries[index]
  const question = useMemo(() => (entry ? chooseQuestion(entry) : null), [entry])
  const reviewKey = entry ? `${makeStageKey(entry.item.stage)}:${question?.id ?? 'empty'}` : 'empty'
  const correct = Boolean(question && selected === question.answer)

  if (!entry || !question) {
    return (
      <section className="review-session review-session--empty" aria-labelledby="review-title">
        <button className="text-link" type="button" onClick={onClose}><ArrowLeft aria-hidden="true" /> 返回学习</button>
        <h1 id="review-title">今天没有到期复习</h1>
        <p>继续当前关卡即可。新的复习会在通过测验后自动安排。</p>
      </section>
    )
  }

  const submit = () => {
    if (!selected) return
    setSubmitted(true)
    onAnswer(entry, selected === question.answer)
  }

  const next = () => {
    if (index >= entries.length - 1) {
      onClose()
      return
    }
    setIndex((value) => value + 1)
    setSelected('')
    setSubmitted(false)
  }

  return (
    <section className="review-session" aria-labelledby="review-title">
      <button className="text-link" type="button" onClick={onClose}><ArrowLeft aria-hidden="true" /> 返回学习</button>
      <header className="review-session__header">
        <p>复习 {index + 1} / {entries.length}</p>
        <h1 id="review-title">{entry.stage.title}</h1>
        <span>{entry.chapter.title}</span>
      </header>
      <fieldset className="question review-question" key={reviewKey}>
        <legend>{question.prompt}{question.critical && <span className="question__critical">关键题</span>}</legend>
        <div className="question__choices">
          {question.choices.map((choice) => {
            const chosen = choice.id === selected
            const answer = submitted && choice.id === question.answer
            const wrong = submitted && chosen && !answer
            return (
              <label className={`answer ${chosen ? 'is-selected' : ''} ${answer ? 'is-correct' : ''} ${wrong ? 'is-wrong' : ''}`} key={`${reviewKey}:${choice.id}`}>
                <input type="radio" name="review-answer" value={choice.id} checked={chosen} disabled={submitted} onChange={() => setSelected(choice.id)} />
                <span className="answer__key">{choice.id.toUpperCase()}</span>
                <span>{choice.label}</span>
                {answer && <Check className="answer__icon" aria-label="正确答案" />}
                {wrong && <X className="answer__icon" aria-label="你的答案不正确" />}
              </label>
            )
          })}
        </div>
        {submitted && (
          <p className={correct ? 'question__feedback is-correct' : 'question__feedback is-wrong'} role="status">
            {correct ? '判断正确。' : '这次没有答对。'} {question.explanation}
          </p>
        )}
      </fieldset>
      <div className="review-session__actions">
        <button className="text-link" type="button" onClick={() => onOpenStage(entry)}>打开本关</button>
        {!submitted ? (
          <button className="button button--primary" type="button" onClick={submit} disabled={!selected}>检查答案</button>
        ) : (
          <button className="button button--primary" type="button" onClick={next}>
            {index === entries.length - 1 ? '结束复习' : '下一题'} <ArrowRight aria-hidden="true" />
          </button>
        )}
      </div>
    </section>
  )
}
