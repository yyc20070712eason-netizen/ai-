import { Check, ChevronDown, CircleAlert, Lightbulb, MessageSquareText, RotateCcw, Sparkles, X } from 'lucide-react'
import { useState } from 'react'
import { evaluateProjectPractice, rubricEvidenceKey } from '../lib/practice'
import type { PracticeFeedback, PracticeSubmission, ProjectSubmitPractice } from '../types'
import { PracticeOverview } from './PracticeOverview'

type Props = {
  practice: ProjectSubmitPractice
  submission?: PracticeSubmission
  hasApiKey: boolean
  busy: boolean
  onDraft: (answers: Record<string, string>) => void
  onToggleRubric: (id: string) => void
  onSubmit: () => void
  onFeedback: () => void
  onOpenSettings: () => void
}

function Feedback({ feedback }: { feedback: PracticeFeedback }) {
  return <section className="practice-feedback" aria-label="AI 点评结果">
    <h3>AI 点评</h3>
    <div><strong>做得好的地方</strong><ul>{feedback.strengths.map((item) => <li key={item}>{item}</li>)}</ul></div>
    <div><strong>还可补强</strong><ul>{feedback.gaps.map((item) => <li key={item}>{item}</li>)}</ul></div>
    <dl>{feedback.rubric.map((item) => <div key={item.id}><dt>{item.status === 'met' ? '满足' : item.status === 'partial' ? '部分满足' : '缺失'}</dt><dd>{item.note}</dd></div>)}</dl>
    <p><strong>下一步：</strong>{feedback.nextStep}</p>
    <small>本次用量：输入 {feedback.inputTokens} · 输出 {feedback.outputTokens} tokens</small>
  </section>
}

export function PracticeWorkbench({ practice, submission, hasApiKey, busy, onDraft, onToggleRubric, onSubmit, onFeedback, onOpenSettings }: Props) {
  const answers = submission?.answers ?? {}
  const submitted = Boolean(submission?.submittedAt)
  const evaluation = evaluateProjectPractice(practice, submission)
  const canSubmit = evaluation.fieldsReady && evaluation.rubricReady && evaluation.evidenceReady
  const [hintLevel, setHintLevel] = useState(0)
  const stateLabel = evaluation.state === 'meets' ? '按标准达标' : evaluation.state === 'needs-revision' ? '建议修改' : submitted ? '已提交' : '草稿中'
  const knownAnswerIds = new Set([
    ...practice.fields.map((field) => field.id),
    ...practice.rubric.map((item) => rubricEvidenceKey(item.id)),
  ])
  const legacyAnswers = Object.entries(answers).filter(([id, value]) => !knownAnswerIds.has(id) && value.trim())

  return <section className="practice practice--guided" aria-labelledby="practice-title">
    <PracticeOverview practice={practice} label="正式里程碑" starterPackUrl={practice.starterPackUrl} />
    <div className={`practice-state practice-state--${evaluation.state}`} role="status"><span>{stateLabel}</span><strong>{practice.milestoneId}</strong></div>
    <ol className="practice-steps" aria-label="实践进度"><li className="is-active"><span>1/4</span>整理产物</li><li className={evaluation.fieldsReady ? 'is-active' : ''}><span>2/4</span>自动检查</li><li className={evaluation.rubricReady && evaluation.evidenceReady ? 'is-active' : ''}><span>3/4</span>证据自检</li><li className={submitted ? 'is-active' : ''}><span>4/4</span>提交修改</li></ol>
    <div className="practice-artifacts"><strong>本阶段文件</strong><ul>{practice.artifactFiles.map((file) => <li key={file}><code>{file}</code></li>)}</ul></div>
    <div className="practice-fields">
      {practice.fields.map((item, index) => <label className="practice-field" key={item.id}>
        <span><b>{String(index + 1).padStart(2, '0')}</b><strong>{item.label}</strong><em>{item.artifact}</em></span>
        <small>{item.prompt}</small>
        <textarea value={answers[item.id] ?? ''} placeholder={item.placeholder} onChange={(event) => onDraft({ ...answers, [item.id]: event.target.value })} spellCheck={item.format !== 'json'} />
      </label>)}
    </div>
    <section className="practice-checks" aria-labelledby="practice-checks-title">
      <div><h3 id="practice-checks-title">自动检查</h3><span>只检查确定性结构，不评价文风</span></div>
      <ul>{evaluation.checks.map((item) => <li className={item.passed ? 'is-passed' : 'is-failed'} key={item.id}>{item.passed ? <Check aria-hidden="true" /> : <X aria-hidden="true" />}<span><strong>{item.label}</strong>{item.message}</span></li>)}</ul>
      <div className="practice-commands"><strong>本机验证命令</strong>{practice.validationCommands.map((command) => <code key={command}>{command}</code>)}</div>
    </section>
    <div className="practice-hints">
      <button className="text-link" type="button" onClick={() => setHintLevel((value) => Math.min(2, value + 1))}><Lightbulb aria-hidden="true" />{hintLevel ? '再给一个提示' : '我卡住了，给提示'}</button>
      {hintLevel > 0 && <p>{practice.hints[hintLevel - 1]}</p>}
    </div>
    <fieldset className="practice-rubric" disabled={!evaluation.fieldsReady}>
      <legend>关键量表与证据</legend>
      {!evaluation.fieldsReady && <p>先完成每个产物栏，才能开始自检。</p>}
      {practice.rubric.map((item) => <div className="practice-rubric__item" key={item.id}>
        <label><input type="checkbox" checked={submission?.checkedRubricIds.includes(item.id) ?? false} onChange={() => onToggleRubric(item.id)} /><span><strong>{item.label}{item.critical ? ' · 关键' : ''}</strong>{item.criterion}</span></label>
        <label className="practice-rubric__evidence"><span>{item.evidencePrompt}</span><textarea value={answers[rubricEvidenceKey(item.id)] ?? ''} onChange={(event) => onDraft({ ...answers, [rubricEvidenceKey(item.id)]: event.target.value })} placeholder="指出文件名、字段或段落，并简要说明证据。" /></label>
      </div>)}
    </fieldset>
    <div className="practice-submit">
      <button className="button button--primary" type="button" disabled={!canSubmit} onClick={onSubmit}>{submitted ? <><RotateCcw aria-hidden="true" />重新检查并保存</> : <><Check aria-hidden="true" />提交阶段成果</>}</button>
      {!canSubmit && <small>必须完成所有产物、勾选量表并为每条量表写出证据。</small>}
      {canSubmit && evaluation.checks.some((item) => !item.passed) && <small><CircleAlert aria-hidden="true" />可以提交并查看参考结构，但自动检查通过前不会标记达标。</small>}
    </div>
    {submitted && <details className="practice-reference" open><summary>参考结构与常见遗漏 <ChevronDown aria-hidden="true" /></summary><ol>{practice.reference.outline.map((item) => <li key={item}>{item}</li>)}</ol>{practice.fields.map((item) => <div key={item.id}><strong>{item.label}</strong><p>{practice.reference.exampleAnswers[item.id]}</p></div>)}<h3>常见遗漏</h3><ul>{practice.reference.commonMistakes.map((item) => <li key={item}>{item}</li>)}</ul></details>}
    {legacyAnswers.length > 0 && <details className="practice-legacy"><summary>旧版实践记录</summary>{legacyAnswers.map(([id, value]) => <div key={id}><strong>{id}</strong><p>{value}</p></div>)}</details>}
    {submitted && (hasApiKey ? <button className="button button--secondary" type="button" disabled={busy} onClick={onFeedback}><Sparkles aria-hidden="true" />{busy ? 'AI 正在点评…' : '让 AI 点评'}</button> : <button className="text-link" type="button" onClick={onOpenSettings}><MessageSquareText aria-hidden="true" />配置 API Key 后获取 AI 点评</button>)}
    {submission?.feedback && <Feedback feedback={submission.feedback} />}
  </section>
}
