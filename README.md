# dsh-workbench-ui

DSH 里的科研工作台面板。把 `wb` 命令管理的项目直接搬到网页上：看项目状态、记门禁、加记忆、补待办，不用切终端。

界面按当前皮肤 orca-link 的语言做的：直角、黑白机械、电蓝信号，不额外加花哨装饰。文案尽量写人话，不留“赋能”“闭环”那类空词。

## 构建

本地构建（不需要 DSH checkout）：

```bash
bash scripts/build-local.sh
```

等价手动命令：

```bash
# host 编译（tsc）
./node_modules/.bin/tsc -p tsconfig.json
# client 打包（tsdown）
./node_modules/.bin/tsdown
```

产物：

```text
lib/index.js    # host：/@dsh-external/dsh-workbench-ui/api
lib/client.js   # client：conversation.view 面板
```

## 修复记录（2026-09-06）

面板“什么都不显示”的根因：`conversation.view` 的 `component` 必须是 React 组件函数，
旧版返回了 `{ render() {} }` 普通对象，React 渲染器拿到后只能得到空槽 / 错误边界。
现已改成标准 React 函数组件（`createElement` + `useState/useEffect`），并顺手把文本产物预览改为按 `text/plain` 读取，不再误当 JSON。

## 统一工作台说明（2026-09-06 重构）

- **不再区分“简单/完整”两种模式**：所有能力（目标、搜索、证据、门禁、冲突、决策、待办、记忆、产物）都在同一张工作区里，一屏可查、可记、可搜。
- 顶部保留“当前第几步 / 下一步做什么”的引导卡，并新增九段工作流进度条。
- 搜索区常驻：输入关键词或 DOI，选择 OpenAlex+Crossref / 综合 OA 增强 / Semantic Scholar / Europe PMC / Unpaywall，结果直带 OA/PDF 链接。
- 科研工作台只占一个 conversation.view 标签页，不再把轨迹 / 过程监视器 / AI 黑盒趋势包进左侧导航。
- 不隐藏 DSH 顶部页签；轨迹、对话、过程监视器、AI 黑盒趋势等继续作为 DSH 顶部独立标签页互不干扰。
- 除对话外，进入“轨迹 / 工作台 / 过程监视器 / AI 黑盒趋势”等独立窗口时自动隐藏底部输入框与宽度拖拽把手，回到对话时恢复。
- 不把“科研工作台”强设为当前会话默认 View。
- 不依赖 DSH 弹窗提问/确认框；相关技能与领域识别默认直接继续。

## 安装

先确保 dsh web 没有 running agent，再执行：

```bash
dsh plugin --profile web add $HOME/work/dsh-workbench-ui
```

或在这个会话之外用注入器：

```bash
# 需要 DSH_CHECKOUT 环境变量
DSH_CHECKOUT=<checkout> bash scripts/build.sh
```

安装后刷新页面并重启 dsh web，对话右侧会出现“科研工作台”面板。

> 注意：如果第一次安装时插件还没有 `dsh.bundle`（会提示“installed as a plain dependency”），
> 现在仓库已经补上了 bundle 声明，请重新执行一次安装：
>
> ```bash
> dsh plugin --profile web add $HOME/work/dsh-workbench-ui
> ```
>
> 若仍显示“Already up to date”，先移除再装：
>
> ```bash
> dsh plugin --profile web remove @dsh-external/dsh-workbench-ui
> dsh plugin --profile web add $HOME/work/dsh-workbench-ui
> ```

## 面板能做什么

- 列出所有 `research-workbench/projects/` 下的项目
- 看当前阶段、门禁、决策、冲突、待办、记忆
- 新建项目
- 删除项目（带确认，删除后不可恢复）
- 加记忆、加待办
- 编辑**目标 / 非目标**
- 记录一条门禁（阶段 + 验收项 + 证据）
- 记一条带来源的 claim
- 直接搜论文（OpenAlex / Crossref / Semantic Scholar / Europe PMC / Unpaywall），结果可点开并标 OA / 元数据，OA 论文带 PDF 链接
- **PDF 精读**：选择本地 PDF，自动收录到 `evidence/`；每页渲染 PNG，提取图表对象（RapidOCR 图内文字 + 近邻 caption + 类型推断）、数学公式块（数学字体/符号识别）、表格，全部写入 Markdown
- **论文图谱**：输入 DOI/标题，用 OpenAlex 生成引用/共引图谱，落 `artifacts/`；面板内可交互 SVG（拖动/缩放/点节点跳 OpenAlex），支持导出 PNG / JSON
- **AI 上下文**：一键生成项目完整续接上下文，可复制给 AI 或下个会话
- **记忆语义搜索**：优先用本地 sentence-transformers embedding（需已缓存模型），未缓存自动回退 TF-IDF
- 看 `evidence/`、`notes/` 与 `artifacts/` 里的文件；文本产物可以面板里直接预览
- **指引式科研**：顶部根据项目状态动态提示“下一步该做什么”，不再是死板阶段

## 检索源（2026-09-06 增加）

| 源 | 用途 | 费用 | 备注 |
|---|---|---|---|
| OpenAlex | 元数据 + OA 状态/链接 | 免费 | 已自动带 `is_oa` / `oa_url` |
| Crossref | DOI / 元数据核验 | 免费 | |
| Semantic Scholar | 检索 + `openAccessPdf` | 免费 | 公共接口有限流，可设 `SEMANTIC_SCHOLAR_API_KEY` 提升 |
| Europe PMC | 生物医学 OA 全文 | 免费 | 返回全文/PDF 链接 |
| Unpaywall | DOI 查合法 OA 全文 | 免费 | 必须设 `UNPAYWALL_EMAIL` 为真实邮箱 |

Unpaywall 使用前设置：

```bash
export UNPAYWALL_EMAIL=you@example.com
```

记忆语义检索默认启用多语言 embedding（`paraphrase-multilingual-MiniLM-L12-v2`），并默认走 HF 镜像 `https://hf-mirror.com`：

```bash
# 首次使用会自动通过镜像下载；也可以手动预热
python3 -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')"

# 若想换模型
export WB_EMBED_MODEL=your-model-name

# 若不想自动下载（只回退 TF-IDF）
export WB_EMBED_DOWNLOAD=0
```

## 依赖的本地命令

面板后端直接调用：

```text
$HOME/work/skills/expert-decision-consensus/tools/workbench_cli.py
```

项目数据在：

```text
$HOME/work/research-workbench/projects/
```

如果这两个路径变了，用环境变量覆盖：

```bash
WB_SCRIPT=/path/to/workbench_cli.py
WB_PROJECTS_DIR=/path/to/projects
```
