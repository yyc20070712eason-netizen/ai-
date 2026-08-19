import { ArrowRight, Check, X } from 'lucide-react'
import { useState } from 'react'
import type { ConceptCheckPractice } from '../types'
import { PracticeOverview } from './PracticeOverview'

export function ConceptCheck({ practice }: { practice: ConceptCheckPractice }) {
  const [selected, setSelected] = useState('')
  const [checked, setChecked] = useState(false)
  const correct = checked && selected === practice.answer
  const answer = practice.choices.find((choice) => choice.id === practice.answer)

  return <section className="practice practice--activity" aria-labelledby="practice-title">
    <PracticeOverview practice={practice} label="轻量理解活动" />
    <fieldset className="concept-check">
      <legend>{practice.prompt}</legend>
      <div className="question__choices">
        {practice.choices.map((choice) => {
          const chosen = choice.id === selected
          const isAnswer = checked && choice.id === practice.answer
          const wrong = checked && chosen && !isAnswer
          return <label className={`answer ${chosen ? 'is-selected' : ''} ${isAnswer ? 'is-correct' : ''} ${wrong ? 'is-wrong' : ''}`} key={choice.id}>
            <input type="radio" name={`concept-${practice.title}`} value={choice.id} checked={chosen} onChange={() => { setSelected(choice.id); setChecked(false) }} />
            <span className="answer__key">{choice.id.toUpperCase()}</span>
            <span>{choice.label}</span>
            {isAnswer && <Check className="answer__icon" aria-label="正确答案" />}
            {wrong && <X className="answer__icon" aria-label="你的答案不正确" />}
          </label>
        })}
      </div>
    </fieldset>
    {!checked ? (
      <button className="button button--primary" type="button" disabled={!selected} onClick={() => setChecked(true)}>检查判断</button>
    ) : (
      <div className={`prediction-feedback ${correct ? 'is-correct' : 'is-wrong'}`} role="status">
        {correct ? <Check aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
        <p><strong>{correct ? '判断正确。' : `正确选项是 ${answer?.label ?? practice.answer}。`}</strong> {practice.feedback}</p>
      </div>
    )}
    <div className="practice__success"><Check aria-hidden="true" /><span><strong>完成标准</strong>{practice.success}</span></div>
  </section>
}
