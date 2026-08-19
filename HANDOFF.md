# AI 学习计划：当前对话交接记忆

> 更新日期：2026-08-18  
> 适用项目：`C:\Users\admin\Desktop\ai学习计划`  
> 用途：在新的 Codex 对话中快速恢复本次长对话的项目背景、已完成事实、未实施计划和安全边界。  
> 本文件不包含飞书密码、API Key、Cookie、登录凭据或原文全文。

## 1. 用户目标

为一位 19 岁、非计算机专业、需要 ADHD 友好节奏的学习者，制作一个本地单人使用的 AI 学习工作台：

- 先用易懂版建立概念，再学习原文、实践并完成情境化测验。
- 每关约 15–25 分钟，可计时、做笔记、收藏题目并安排间隔复习。
- 每份 AI 文档是一个章节，后续由 Codex 制作并接入，不做应用内自动抓取或课程编辑器。
- 原文可离线阅读、搜索、页码引用、高亮、批注和基于证据的 AI 追问。
- 学习完成后通过知识树节点“点亮”呈现掌握路径。

## 2. 不可破坏的产品原则

- 先只读检查，再修改；不要重建或删除学习数据、PDF、批注、数据库、桌面快捷方式或真实密钥。
- 测试持久化与密钥时只使用隔离目录和虚拟数据。
- 不绕过飞书复制/下载权限，不保存飞书密码、Cookie 或成员信息；只使用用户自己的飞书副本和官方导出。
- 不把整份第三方原文复制进源码；源码保存教学改写、结构和原文定位。
- API Key 只能由本地 Node 服务读取，经 Windows DPAPI 加密；不得进入前端包、日志、localStorage、SQLite 明文或导出档案。
- 不做账号、云同步、多人协作、系统通知或扫描 PDF OCR。
- 不设置任意最低字数门槛；实践答案只要求 `trim()` 后非空。
- 发布不能只改版本号：必须同步版本元数据与更新记录，跑完整门禁，并核对实际 `/api/version` 与桌面窗口版本。

## 3. 当前已确认的工程快照

### 当前发布

- 源码版本与发布门禁已完成为 `v4.6.0`；本版将七章知识树升级为核心课程入口，并保留 v1–v5 学习状态兼容性。
- `release.json`：stable，发布日期 2026-08-18，API v2，学习档案备份格式 v4。
- 源码、生产构建和 `http://127.0.0.1:43118/api/version` 已确认切换为 `v4.6.0`，接口返回 `compatible: true`。
- 旧启动器 `launch-ai-study.ps1` 使用端口 `43117`；当前桌面启动器 `launch-ai-study-v2.ps1` 使用端口 `43118`。Vite 生产目标是 `chrome100`。
- 项目目前不是 Git 仓库，不能依赖 `git status` 或提交记录判断改动。
- 本轮知识树重构及 `v4.6.0` 发布门禁已通过：31 个测试文件、182 项测试，内容校验 25 项，并通过 lint、TypeScript/Vite build、release check 与 release package。构建仅保留现有的大分块体积警告，不影响发布门禁。

### 七个正式章节

当前实际为 **7 章、107 关**；`README.md` 已同步为 107，并由内容注册表测试防止数量再次漂移。

| 当前目录顺序 | 章节 ID | 关卡数 | 备注 |
|---:|---|---:|---|
| 1 | `agent` | 15 | 5 个三关单元；连续订单/退款 Agent 项目与 5 个正式里程碑 |
| 2 | `vibe-coding` | 15 | 5 单元 |
| 3 | `transformer` | 16 | 5 单元 |
| 4 | `rag` | 18 | 5 单元 |
| 5 | `langchain` | 15 | 5 单元 |
| 6 | `ai-harness` | 12 | 4 单元 |
| 7 | `langgraph` | 16 | 5 单元 |

关卡导航和学习状态使用稳定键 `<chapter-id>:<stage-id>`，不能重新改回全局数字 ID。

### 已有主要能力

- 自动发现 `ChapterPackage` 的多章节内容注册表、知识树、跨章导航和自由预览。
- `#/knowledge-tree` 使用单张画布展示七章依赖网络；`#/chapter/:id` 在同一网络中一次只展开一章，并保留其他章节及上下游关系。
- 七章 107 关全部具备内容模式 v2 的认知深度、核心概念和直接前置关卡；目录、编号、“下一关”和知识树共用同一拓扑顺序。
- 章节与关卡节点固定不可拖动；关卡点击先打开详情，再由“进入关卡”导航。桌面使用右栏详情，手机使用底部详情。
- UI preferences 使用 `ai-study:ui:v2`，兼容读取 v1，独立保存最后展开章节及全局/各章视口；画布尺寸变化较大时自动重新适配。
- 每关：问题、预测、易懂版、模型/代码视角、实践、原文定位、笔记、5 题测验和下一关。
- Agent 章实践已重构为 `concept-check`、`project-step`、`project-submit` 三种明确活动类型。
- Agent 第 3、6、9、12、15 关是正式里程碑；跨关草稿继续写入目标里程碑的 `practiceSubmissions[stageKey]`，没有新增数据库或学习状态迁移。
- 正式实践检查 JSON 结构、必填字段、评测类别、预算、确认点和 Node 测试摘要；每条关键量表必须写出对应字段或段落证据。
- 正式实践状态为“已提交 / 建议修改 / 按标准达标”；正式关只有测验通过且实践达标才算掌握。AI 点评可选，不能单独改变掌握状态。
- 静态起始包位于 `public/practice/agent-blueprint/`，下载文件为 `public/practice/agent-blueprint-starter.zip`；测试使用 `node --test`，无第三方依赖和外部服务调用。
- 其余六章也已完成独立项目式实践：
  - Vibe Coding：个人学习任务板，正式关 3/6/9/12/15，包 `public/practice/vibe-task-board-starter.zip`。
  - Transformer：迷你注意力实验室，正式关 3/6/9/13/16，包 `public/practice/transformer-attention-lab-starter.zip`。
  - RAG：本地课程资料检索器，正式关 3/6/9/12/18，包 `public/practice/rag-course-retriever-starter.zip`。
  - LangChain：个人学习助手，正式关 3/6/9/12/15，包 `public/practice/langchain-learning-assistant-starter.zip`。
  - AI Harness：个人 AI 任务执行工作台，正式关 3/6/9/12，包 `public/practice/ai-harness-workbench-starter.zip`。
  - LangGraph：可暂停、可恢复的学习流程图，正式关 3/6/10/13/16，包 `public/practice/langgraph-study-flow-starter.zip`。
- 新增共享实践构造器 `src/content/chapters/activityBuilders.ts` 和章节级 `activities.ts`；章节工厂通过 `activities` 覆盖表注入活动，不改变 `StudyStateV5`、实践提交结构或历史数据。
- 六章起始包均为虚拟数据；Transformer、RAG、AI Harness、Vibe Coding 无第三方依赖，LangChain/LangGraph 固定官方 JS 依赖并默认 Mock，不调用外部服务。
- 掌握规则：5 题中 3 道情境题 + 2 道知识题；总分至少 80%，且关键题正确。
- 1/3/7/14/30 天复习队列、题目收藏集、专注计时和本地学习档案导入导出。
- 七份个人资料归档、本地 PDF/Markdown/HTML、SQLite FTS5 索引、离线阅读、搜索和页码跳转。
- PDF 全屏工作台、文字层、高亮、批注、手动重新定位、删除撤销和文档版本保留。
- 左侧重点、右侧批注/原文追问；矩形浅色荧光标记。
- 官方 OpenAI 与第三方中转站配置、Responses/Chat 能力探测、关键词降级、DPAPI 密钥保护和代理 fake-IP 公网 DNS 复核。
- 应用内统一返回历史、七章独立折叠、手机抽屉、平板/桌面响应式布局。
- 设置页展示历代版本更新。

### 数据与关键文件

- 前端学习状态写入 `ai-study:v5`，因为加入了实践提交；可从 v1–v4 迁移，旧键只作为迁移来源保留。
- `dataSchemaVersion: 4` 已明确表示“学习档案备份格式 v4”，而不是浏览器本地状态版本。备份格式 v4 可以承载独立版本化的学习状态 v5；导入时验证顶层档案版本，并继续兼容历史裸 v1–v5 状态。
- 本地工作区默认位于 `%LOCALAPPDATA%\AIStudyPlan\data`。
- SQLite：`workspace.sqlite`；原文文件：`data\documents`；加密密钥：`data\secrets\*.dpapi`。
- 核心入口：
  - `src/App.tsx`
  - `src/App.css`
  - `src/types.ts`
  - `src/lib/study.ts`
  - `src/lib/knowledgeGraph.ts`
  - `src/lib/uiPreferences.ts`
  - `src/content/registry.ts`
  - `src/content/courseTopology.ts`
  - `src/content/chapters/*/index.ts`
  - `src/content/chapters/factory.ts`
  - `src/components/SourceWorkspace.tsx`
  - `src/components/QuizPanel.tsx`
  - `src/components/PracticeWorkbench.tsx`
  - `src/components/KnowledgeTree.tsx`
  - `server/index.mjs`
  - `server/workspace.mjs`
  - `server/ai-config.mjs`
  - `release.json`
  - `CHANGELOG.md`

## 4. UI 与体验约定

- 视觉保持“提示词图库/资料库”气质：暖米色纸张、深棕 masthead 与正文、砖红强调色、资料库式留白。
- 标题可使用宋体/Newsreader 气质，正文使用 IBM Plex Sans，代码使用 JetBrains Mono。
- Hallmark 方向为 Workbench / Index-First，N3 左侧资料目录。
- 不复制用户需求提示词到界面，不做营销首页、欢迎页、资料说明卡、渐变、玻璃、霓虹或装饰动画。
- 所有界面要可返回；七章可全部同时收起，也可多章同时展开。
- 继续支持 320、375、414、768、1024、1280、1440、2048px；页面本身不得横向滚动，只有代码块或文档画布可内部滚动。
- 桌面应用必须兼容 Chrome/Edge 100 级构建目标，不能只在现代开发浏览器截图验收。

## 5. 已实现的 v4.6.0 知识树体系

- 全局与章内知识树都由 `src/content/courseTopology.ts` 的直接依赖生成，不再使用隐藏排序边或可见 `contains` 连线。
- 全局章节网络为：

```text
Agent
├─ Vibe Coding
│  ├─ Transformer → RAG → LangChain ─┐
│  └─ AI Harness ────────────────────┤
└────────────────────────────────────┴→ LangGraph
```

- 默认线性顺序为 Agent → Vibe Coding → Transformer → RAG → LangChain → AI Harness → LangGraph；分叉时默认先走 Transformer 主线。
- 章内使用最长路径分层：同层表示并列，多前置表示汇合；校验器拒绝循环、无效引用、重复前置和冗余传递边。
- 单元仅作为浅色横向分区，不是知识节点；章节与关卡是唯一可交互节点。
- 节点状态区分未开始、学习中、薄弱、已掌握和待复习；认知深度另行显示为识别、理解、应用、迁移和精通。
- 选中关卡时高亮完整前置路径与直接后继；保留平移、缩放、适配视图、回到当前节点和 minimap。
- 原 `chapter-map` 学习位置继续兼容，但现在表示对应章节展开的知识树；`StudyStateV5`、稳定 ID 和实践提交均未迁移。
- 已清除知识树大标题、副标题、图例、空详情操作提示和两处纯操作引导；课程正文、错误、安全警告和事实空状态保留。

## 6. 最近一次课程完整性审查结论

当前产品工作台已经较成熟，但“课程深度”仍不够完善：

- 七章都已完成独立项目式实践和正式门禁，但章内正文仍有较多工厂生成结构，可继续做人工编辑深化。
- 当前 App 已把七章正式实践提交统一纳入同一掌握规则：正式关要求测验通过且实践按标准达标，概念关和项目草稿不创建独立正式门禁。
- 显式代码示例较少，LangChain 和 Vibe Coding 当前没有独立代码片段。
- 缺少贯穿多章的作品集项目、综合考核和真正的跨章能力验证。
- 对非计算机专业初学者，CLI、Git、Python/JavaScript、HTTP/JSON、测试和基础数学等桥接内容不足。
- 复习目前是固定 1/3/7/14/30 天和二元通过/失败，尚未根据遗忘、错题模式与节点依赖自适应。

建议不要继续扩大功能数量，而是在知识树基础上优先做：

1. 策划独立的新手工程基础桥接课程，不在现有 107 关中插入占位节点。
2. 设计三个可展示作品集的跨章项目。
3. 增加累积测验与依赖感知复习。
4. 深化工厂生成章节的讲解、代码示例和边界案例。
5. 根据真实使用记录再调整知识树密度，不继续增加装饰性说明文案。

## 7. 新对话的推荐执行顺序

1. 先阅读本文件、`package.json`、`release.json`、`CHANGELOG.md`、`src/content/registry.ts` 和 `src/lib/study.ts`。
2. 只读检查项目目录、实际运行版本、七章数量、数据目录和桌面启动器；不要先改文件。
3. 先确认用户的新目标，不要在没有明确需求时重排 `courseTopology.ts` 或迁移学习状态。
4. 修改时保护 `%LOCALAPPDATA%\AIStudyPlan\data`，持久化测试使用临时数据目录。
5. 实施完成后运行：

```powershell
npm.cmd run test
npm.cmd run lint
npm.cmd run build
npm.cmd run validate:content
npm.cmd run release:check
npm.cmd run release:package
```

6. 最终核对 `/api/version`、真实 Edge 应用窗口、桌面入口和目标宽度视觉表现。

## 8. 可直接复制到新对话的开场提示

```text
请继续维护 C:\Users\admin\Desktop\ai学习计划。

先完整阅读项目根目录 HANDOFF.md，并做只读检查；不要删除、覆盖或迁移我的学习数据、PDF、批注、SQLite、桌面快捷方式或真实 API Key，持久化测试只用隔离虚拟数据。

当前源码与生产构建是 v4.6.0；七章单画布知识树、107 关拓扑元数据和 UI preferences v2 已实现。请先核对 HANDOFF.md 的真实工程快照，再按用户的新目标继续。
```
