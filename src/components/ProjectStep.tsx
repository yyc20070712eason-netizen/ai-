import { ArrowRight, Check } from 'lucide-react'
import type { PracticeSubmission, ProjectStepPractice } from '../types'
import { PracticeOverview } from './PracticeOverview'

type Props = {
  practice: ProjectStepPractice
  submission?: PracticeSubmission
  onDraft: (answers: Record<string, string>) => void
}

export function ProjectStep({ practice, submission, onDraft }: Props) {
  const answers = submission?.answers ?? {}
  const ready = practice.fields.every((field) => (answers[field.id] ?? '').trim().length > 0)
  return <section className="practice practice--activity practice--project-step" aria-labelledby="practice-title">
    <PracticeOverview practice={practice} label="跨关项目草稿" starterPackUrl={practice.starterPackUrl} />
    <p className="practice-milestone"><ArrowRight aria-hidden="true" /><span>这些内容会自动汇入里程碑：<strong>{practice.milestoneTitle}</strong></span></p>
    <div className="practice-fields">
      {practice.fields.map((field, index) => <label className="practice-field" key={field.id}>
        <span><b>{String(index + 1).padStart(2, '0')}</b><strong>{field.label}</strong><em>{field.artifact}</em></span>
        <small>{field.prompt}</small>
        <textarea value={answers[field.id] ?? ''} placeholder={field.placeholder} onChange={(event) => onDraft({ ...answers, [field.id]: event.target.value })} spellCheck={field.format !== 'json'} />
      </label>)}
    </div>
    <div className={`practice-draft-status ${ready ? 'is-ready' : ''}`} role="status">
      <Check aria-hidden="true" />
      <span>{ready ? '本关草稿已完整，后续关卡仍可继续修改。' : '草稿自动保存在本机，不需要在本关正式提交。'}</span>
    </div>
  </section>
}
