import { ArrowRight, Star, Trash2 } from 'lucide-react'
import type { ChapterPackage, FavoriteQuestionRef, QuizQuestion, Stage } from '../types'

export type FavoriteQuestionEntry = {
  favorite: FavoriteQuestionRef
  chapter?: ChapterPackage
  stage?: Stage
  question?: QuizQuestion
}

type FavoritesPanelProps = {
  entries: FavoriteQuestionEntry[]
  onOpenStage: (favorite: FavoriteQuestionRef) => void
  onRemove: (favorite: FavoriteQuestionRef) => void
}

export function FavoritesPanel({ entries, onOpenStage, onRemove }: FavoritesPanelProps) {
  const groups = new Map<string, FavoriteQuestionEntry[]>()
  for (const entry of entries) {
    const unit = entry.chapter?.units.find((item) => item.id === entry.stage?.unitId)
    const key = `${entry.chapter?.id ?? entry.favorite.stage.chapterId}:${unit?.id ?? 'updated'}`
    groups.set(key, [...(groups.get(key) ?? []), entry])
  }

  return (
    <section className="favorites-panel" aria-labelledby="favorites-title">
      <header className="favorites-panel__header">
        <p>复习之外的重点题</p>
        <h1 id="favorites-title">收藏集</h1>
        <span>{entries.length} 道题</span>
      </header>
      {entries.length === 0 ? (
        <p className="favorites-panel__empty">在每关测验题号旁点亮星标，重要题目会保存在这里。</p>
      ) : (
        <div className="favorites-panel__groups">
          {[...groups.values()].map((group) => {
            const first = group[0]
            const unit = first.chapter?.units.find((item) => item.id === first.stage?.unitId)
            return (
              <section className="favorites-group" key={`${first.favorite.stage.chapterId}:${first.stage?.unitId ?? 'updated'}`}>
                <header>
                  <p>{first.chapter?.title ?? first.favorite.stage.chapterId}</p>
                  <h2>{unit?.title ?? '题目内容已更新'}</h2>
                </header>
                {group.map((entry) => (
                  <article className="favorite-question" key={`${entry.favorite.stage.chapterId}:${entry.favorite.stage.stageId}:${entry.favorite.questionId}`}>
                    <header>
                      <span>{entry.stage?.title ?? `${entry.favorite.stage.stageId} · 题目内容已更新`}</span>
                      <button type="button" className="icon-button icon-button--quiet" onClick={() => onRemove(entry.favorite)} aria-label="取消收藏"><Trash2 aria-hidden="true" /></button>
                    </header>
                    {entry.question ? <>
                      <small className="favorite-question__type">{entry.question.scenario ? '情境题' : '知识题'}</small>
                      <p className="favorite-question__prompt"><Star aria-hidden="true" />{entry.question.prompt}</p>
                      <p><strong>答案</strong> {entry.question.choices.find((choice) => choice.id === entry.question?.answer)?.label ?? entry.question.answer}</p>
                      <p><strong>解析</strong> {entry.question.explanation}</p>
                    </> : <p className="favorite-question__updated">此题在课程内容更新后无法再定位；收藏记录仍保留，可手动移除。</p>}
                    <button className="text-link" type="button" onClick={() => onOpenStage(entry.favorite)}>打开所属关卡 <ArrowRight aria-hidden="true" /></button>
                  </article>
                ))}
              </section>
            )
          })}
        </div>
      )}
    </section>
  )
}
