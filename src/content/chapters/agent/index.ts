import type { ChapterPackage, Stage, StageId } from '../../../types'
import { AGENT_SOURCE_URL, acts, stages as legacyStages } from '../../agentCourse'
import { agentActivities } from './activities'
import { CHAPTER_PREREQUISITES, chapterOrder, stageKnowledge } from '../../courseTopology'

export const LEGACY_AGENT_STAGE_MAP: Record<number, StageId> = {
  1: 'what-is-agent',
  2: 'four-layer-architecture',
  3: 'model-boundaries',
  4: 'planning',
  5: 'memory',
  6: 'tools-and-react',
  7: 'stop-and-recover',
  8: 'tool-reliability',
  9: 'multi-agent',
  10: 'framework-choice',
  11: 'evaluation-monitoring',
  12: 'intent-recognition',
  13: 'slots-confidence',
  14: 'assistant-design',
  15: 'acceptance-iteration',
}

const unitIds = ['see-agent', 'make-it-act', 'make-it-reliable', 'strengthen-system', 'build-your-assistant']

const agentConcepts: Record<StageId, string[]> = {
  'what-is-agent': ['Agent', '目标驱动', '工具行动', '反馈闭环'],
  'four-layer-architecture': ['交互层', '控制层', '模型层', '工具层'],
  'model-boundaries': ['模型能力', '工具能力', '确定性规则', '实时事实'],
  planning: ['目标分解', '可验证步骤', '计划修订', '完成证据'],
  memory: ['会话状态', '用户画像', '知识记忆', '生命周期'],
  'tools-and-react': ['工具契约', 'Action', 'Observation', '执行循环'],
  'stop-and-recover': ['停止条件', '执行预算', '重复检测', '恢复策略'],
  'tool-reliability': ['工具路由', '参数校验', '失败分类', '成本预算'],
  'multi-agent': ['角色边界', '任务拆分', '交接契约', '汇合验收'],
  'framework-choice': ['最小实现', '状态机', '框架选型', '复杂度边界'],
  'evaluation-monitoring': ['固定样本', '质量指标', '运行追踪', '回归评测'],
  'intent-recognition': ['意图分类', '任务边界', '拒答', '期望动作'],
  'slots-confidence': ['槽位抽取', '缺参追问', '置信度', '确认顺序'],
  'assistant-design': ['产品规格', '多意图', '权限确认', '验收标准'],
  'acceptance-iteration': ['测试运行', '失败分类', '优先级', '迭代证据'],
}

const agentStages: Stage[] = legacyStages.map((legacy) => {
  const { id, act, duration, sourceRange, ...content } = legacy
  const stageId = LEGACY_AGENT_STAGE_MAP[id]
  void act
  return {
    ...content,
    id: stageId,
    unitId: unitIds[Math.floor((id - 1) / 3)],
    durationMinutes: duration,
    sourceRefs: [{ sourceId: 'agent-manual', label: sourceRange }],
    practice: agentActivities[stageId],
    knowledge: stageKnowledge('agent', stageId, agentConcepts[stageId]),
  }
})

const agentChapter: ChapterPackage = {
  contentSchemaVersion: 2,
  id: 'agent',
  title: 'Agent 手册',
  shortTitle: 'Agent',
  order: chapterOrder('agent'),
  prerequisites: CHAPTER_PREREQUISITES.agent,
  sources: [
    {
      id: 'agent-manual',
      kind: 'remote',
      title: '大模型 AI Agent 知识从 0–1 笔记',
      provider: 'feishu',
      url: AGENT_SOURCE_URL,
      embed: 'attempt',
    },
  ],
  units: acts.map((act, index) => ({
    id: unitIds[index],
    title: act.title,
    stageIds: legacyStages.slice(index * 3, index * 3 + 3).map((stage) => LEGACY_AGENT_STAGE_MAP[stage.id]),
  })),
  stages: agentStages,
}

export default agentChapter
