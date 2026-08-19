# AI 学习计划

一个本地运行的多章节 AI 学习工作台。当前包含 Agent、AI Harness、Transformer、RAG、LangChain、LangGraph 与 Vibe Coding 七章，共 107 个关卡，并提供章节知识地图、测验、复习、本地原文批注和基于证据的 AI 追问。

## 版本迭代

完整的 [更新记录](./CHANGELOG.md) 覆盖 v3.0.0 至 v5.1.0 的 30 次迭代；可以在 GitHub 上直接查看每一版的日期和改动。

- **v3.x**：原文工作区、PDF 阅读与本地资料归档。
- **v4.0–v4.4**：七章课程、重点批注、学习档案与 API Key 加密保护。
- **v4.5–v4.6**：项目式实践和七章知识树。
- **v5.0–v5.1**：深色研究实验室和数字实验笔记工作台。

`v5.1.0` 是本项目首次在 GitHub 建立的可下载源码快照，见 [v5.1.0 Release](https://github.com/yyc20070712eason-netizen/ai-/releases/tag/v5.1.0)。更早版本可在更新记录中查看迭代内容，但由于当时尚未建立 Git 仓库，不提供会误导下载者的“历史源码”标签。之后每个新版本都会创建真实 Git 标签和 GitHub Release。

## 下载与体验 v5.1.0

任何人都可以从 GitHub 获取这个创意和完整源码：

- 不使用 Git：在仓库页面点击 **Code → Download ZIP**，或直接[下载 v5.1.0 源码 ZIP](https://github.com/yyc20070712eason-netizen/ai-/archive/refs/tags/v5.1.0.zip)。解压后按下方步骤运行。
- 使用 Git：运行 `git clone https://github.com/yyc20070712eason-netizen/ai-.git`，再进入项目目录。
- 需要 Node.js 20+。首次运行依次执行 `npm install`、`npm run dev`，然后按终端给出的本机地址打开应用。

公开仓库只包含课程内容、源码和测试资料；个人学习记录、导入的原文、API Key 与本机构建产物均不会上传。

## 本地运行

首次开发或修改代码后：

```powershell
npm install
npm run dev
```

完整工作区（静态前端与本地 API）使用：

```powershell
npm run build
npm run serve
```

可用的质量检查：

```powershell
npm run validate:content
npm test
npm run lint
npm run build
```

`npm run test:watch` 用于开发时持续运行测试。

## Agent 章连续实践

Agent 章的 15 关围绕同一个虚拟“订单查询与退款助手”设计包展开：

- 第 1、2 关是即时反馈的概念判断，不创建正式提交。
- 第 4、5、7、8、10、11、13、14 关保存跨关项目草稿。
- 第 3、6、9、12、15 关是正式里程碑，要求结构化产物、量表证据和确定性自动检查。
- 正式里程碑区分“已提交”“建议修改”“按标准达标”；只有测验通过且实践达标才算掌握。
- AI 点评可选，不配置 API Key 也能完成全部实践和门禁。

应用提供可下载的 `agent-blueprint-starter.zip`，包含 Markdown、JSON 模板和只使用 Node.js 内置模块的测试。真实文件由学习者保存在自己选择的本机目录；应用只保存主动粘贴的答案、量表依据和测试摘要。

## 六章独立项目式实践

Agent 样板之外，其余六章也已接入同一套单人实践规则：概念关即时反馈，项目关保存到后续里程碑，正式关才要求结构化产物、量表证据和确定性检查。项目彼此独立，均使用虚拟材料，不读取任意本机路径。

| 章节 | 独立项目 | 正式关卡 | 起始包 |
|---|---|---|---|
| Vibe Coding | 个人学习任务板 | 3、6、9、12、15 | `vibe-task-board-starter.zip` |
| Transformer | 迷你注意力实验室 | 3、6、9、13、16 | `transformer-attention-lab-starter.zip` |
| RAG | 本地课程资料检索器 | 3、6、9、12、18 | `rag-course-retriever-starter.zip` |
| LangChain | 个人学习助手 | 3、6、9、12、15 | `langchain-learning-assistant-starter.zip` |
| AI Harness | 个人 AI 任务执行工作台 | 3、6、9、12 | `ai-harness-workbench-starter.zip` |
| LangGraph | 可暂停、可恢复的学习流程图 | 3、6、10、13、16 | `langgraph-study-flow-starter.zip` |

无依赖起始包使用 `node --test`；LangChain 和 LangGraph 包固定官方 JavaScript 版本并使用 Mock 模型，未配置 API Key 也能完成结构、状态和集成测试。

## 桌面式启动

桌面上的 `AI 学习计划` 快捷方式可直接打开应用；项目本体保存在同名文件夹中。

构建通过后，可运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\launch-ai-study-v2.ps1
```

启动器使用固定端口 `43118`，在后台隐藏运行只监听 `127.0.0.1` 的 Node 服务，优先以 Edge 应用模式打开，找不到 Edge 时回退到默认浏览器。重复运行会复用本项目已启动的服务；若端口被其他程序占用，它会报错而不是终止对方进程。

## 本地原文与 AI

- PDF、Markdown、HTML 会复制到 `%LOCALAPPDATA%\AIStudyPlan\data\documents`，单文件上限 50 MB。
- PDF 负责原版图文与页码阅读，Markdown 更适合全文检索和课程制作；同一资料可保留两种格式作为配对来源。
- PDF 工作区直接渲染原始页面并按视口懒加载，提取文字只用于搜索和 AI 证据，不参与视觉重排。
- 批注、问答、总结和检索索引保存在同目录的 SQLite；扫描 PDF 第一版不做 OCR。
- 设置页可在官方 OpenAI 与一个 OpenAI 兼容中转站之间切换；中转站可自动检测 Responses、Chat Completions 与 Embeddings，也允许手动填写模型名称。
- 两个提供商的 API Key 分别由 Node 服务使用 Windows DPAPI 加密，前端、SQLite、日志和导出文件均不保存明文；中转 Key 不要求使用 `sk-` 前缀。
- AI 功能按需触发。中转站缺少 Embeddings 时自动退回本地 FTS5 关键词检索；文本问答、实践点评和总结不受影响，也不会上传整份原文。
- 公网中转站必须使用 HTTPS，HTTP 仅允许本机回环地址。第三方的数据保留与隐私规则由该中转站决定。
- 学习档案使用备份格式 v4，当前承载本地学习状态 v5，包含进度、收藏、实践提交、批注、问答与总结，不包含 API Key、原文、提取文本或嵌入。

## 版本与数据格式

- 当前应用发布版本为 `v5.1.0`；应用发布版本使用语义化版本，表示应用功能与发布批次。
- 学习档案备份格式当前为 v4，对应 `release.json` 的 `dataSchemaVersion` 和导出 JSON 顶层的 `version`。
- 浏览器内的本地学习状态当前为 v5，写入存储键 `ai-study:v5`；旧版 `ai-study:v1` 至 `ai-study:v4` 只作为兼容迁移来源保留，不会在升级时删除。
- 备份格式和内部学习状态独立版本化，因此备份格式 v4 可以承载学习状态 v5。导入仍兼容历史裸学习状态及 v4 学习档案。

## 7 份个人资料归档

- 左侧“资料归档”进入固定清单；清单只保存标题、飞书链接、归档状态和本地文件元数据，不保存访问密码。
- “导入整批 PDF”会按标题匹配资料，逐份复制、校验和索引；单份失败不会中断其余文件，无法唯一匹配的文件会明确列出。
- 每份资料也可以单独导入或更新版本。相同内容按 SHA-256 去重，新内容保留为新版本。
- 七份资料都绑定正式学习章节；归档统计由清单动态计算，不显示已移除的空项目。
- 若飞书没有正常导出或打印入口，可将该项标为“需要作者操作”；应用不抓取网页，也不绕过禁止复制或下载限制。

## 接入新学习章节

每份新手册是一个独立内容包，目录为：

```text
src/content/chapters/<chapter-id>/index.ts
```

导出默认的 `ChapterPackage`，即会被目录自动发现，无需在 App 中增加章节分支。内容包必须：

- 使用稳定的 kebab-case `chapter.id`、`unit.id` 和 `stage.id`。
- 声明 `contentSchemaVersion: 1`、顺序、原文来源、单元和关卡。
- 用 `prerequisites` 表示章节依赖，不得形成循环。
- 确保每关至少 8 道题，其中至少 3 道场景题和 1 道关键场景题。
- 使用 HTTPS 原文链接；访问密码不写入源码、localStorage 或导出文件。

新章节接入后先运行 `npm run validate:content`。该命令会检查 ID 唯一性、引用关系、依赖环、题库结构、实践活动结构、跨关里程碑引用和稳定关卡导航。学习记录使用 `<chapter-id>:<stage-id>` 命名空间，因此各章可复用同名关卡而不会覆盖进度。

## 发布版本管理

`release.json` 是应用版本、发布通道、API 版本、备份格式和本版亮点的唯一发布清单；其中 `dataSchemaVersion` 表示学习档案备份格式，不表示浏览器本地学习状态版本。`package.json` 与 `CHANGELOG.md` 必须保持一致。生产构建还会生成 `dist/release-meta.json`，桌面启动器据此拒绝前端与本地服务版本不一致的构建。

准备新补丁版本：

```powershell
npm run release:prepare -- 3.0.1 "修复原文工作区页码跳转"
npm run release:package
```

`release:package` 会依次运行测试、lint、生产构建、内容校验和发布清单校验。设置页的“应用发布版本”可查看当前版本、通道、构建编号、备份格式、本地学习状态和更新说明。
