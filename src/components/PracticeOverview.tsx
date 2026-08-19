import { Download, FileCode2 } from 'lucide-react'
import type { PracticeFrame } from '../types'

type Props = {
  practice: PracticeFrame
  label: string
  starterPackUrl?: string
}

export function PracticeOverview({ practice, label, starterPackUrl }: Props) {
  return <>
    <div className="section-heading">
      <h2 id="practice-title">{practice.title}</h2>
      <span>{practice.estimatedMinutes} 分钟 · {label}</span>
    </div>
    <p>{practice.brief}</p>
    <dl className="practice-brief">
      <div><dt>固定情境</dt><dd>{practice.context}</dd></div>
      <div><dt>给定材料</dt><dd><ul>{practice.given.map((item) => <li key={item}>{item}</li>)}</ul></dd></div>
      <div><dt>交付结果</dt><dd>{practice.deliverable}</dd></div>
      <div><dt>限制条件</dt><dd><ul>{practice.constraints.map((item) => <li key={item}>{item}</li>)}</ul></dd></div>
    </dl>
    {starterPackUrl && <a className="button button--secondary practice-download" href={starterPackUrl} download>
      <Download aria-hidden="true" /> 下载 Agent 设计包起始模板
    </a>}
    {starterPackUrl && <p className="practice-local-note"><FileCode2 aria-hidden="true" />在你选择的本机目录中编辑文件；应用只保存你主动粘贴的内容和检查结果。</p>}
  </>
}
