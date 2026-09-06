# dsh-workbench-ui

> DSH 插件：把 `wb` 命令管理的科研项目搬到网页端，集中查看项目状态、门禁、证据、记忆与待办。

**中文** | [English](README.en.md)

[![License: BSD-3-Clause](https://img.shields.io/badge/License-BSD--3--Clause-blue.svg)](LICENSE)

## 简介

dsh-workbench-ui 是 DSH（DeepSeek Harness）生态中的科研工作台插件。它读取 `research-workbench/projects/` 下的项目台账，并在 DSH 对话侧边提供网页面板，让你不用切到终端就能看项目、记门禁、加记忆和补待办。

项目数据默认保存在本机；面板本身不改变 DSH 的项目管理方式，只提供网页化入口。

## 功能

- **项目总览**：列出本地科研项目，显示当前阶段、门禁通过数、声明/决策/冲突数量与更新时间。
- **项目详情**：查看阶段、门禁、决策、冲突、待办、记忆，以及 `evidence/`、`notes/`、`artifacts/` 下的文件。
- **项目操作**：新建项目、删除项目（带确认）、编辑目标与非目标、添加记忆和待办。
- **门禁与声明**：记录门禁（阶段 + 验收项 + 证据），记录带来源的 claim。
- **论文检索**：支持 OpenAlex、Crossref、Semantic Scholar、Europe PMC、Unpaywall，直接展示 OA/PDF 链接。
- **PDF 精读**：选择本地 PDF，自动收录到 `evidence/`；按页渲染 PNG，提取图表、公式与表格并写入 Markdown。
- **论文图谱**：输入 DOI 或标题，用 OpenAlex 生成引用/共引图谱，保存到 `artifacts/`；面板内支持交互 SVG 与 PNG/JSON 导出。
- **AI 上下文**：一键生成项目续接上下文，可复制给 AI 或下一会话。
- **记忆语义搜索**：优先使用本地 sentence-transformers embedding，未缓存模型时回退 TF-IDF。
- **文件预览**：面板内直接查看文本类产物。
- **指引式科研**：顶部根据项目状态提示“下一步该做什么”。

## 安装

安装前请确认 dsh web 没有正在运行的 agent：

```bash
dsh plugin --profile web add $HOME/work/dsh-workbench-ui
```

安装后刷新页面并重启 dsh web，对话右侧会出现“科研”面板。

本地构建（不需要 DSH checkout）：

```bash
bash scripts/build-local.sh
```

等价手动命令：

```bash
./node_modules/.bin/tsc -p tsconfig.json
./node_modules/.bin/tsdown
```

产物：

```text
lib/index.js    # host：/@dsh-external/dsh-workbench-ui/api
lib/client.js   # client：conversation.view 面板
```

## 依赖与配置

面板后端调用：

```text
$HOME/work/skills/expert-decision-consensus/tools/workbench_cli.py
```

项目数据默认位于：

```text
$HOME/work/research-workbench/projects/
```

路径变化时用环境变量覆盖：

```bash
export WB_SCRIPT=/path/to/workbench_cli.py
export WB_PROJECTS_DIR=/path/to/projects
```

Unpaywall 检索需要真实邮箱：

```bash
export UNPAYWALL_EMAIL=you@example.com
```

记忆语义检索默认使用多语言 embedding（`paraphrase-multilingual-MiniLM-L12-v2`），通过 HF 镜像下载：

```bash
python3 -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')"

# 可选：指定其他模型
export WB_EMBED_MODEL=your-model-name

# 可选：禁用自动下载，只回退 TF-IDF
export WB_EMBED_DOWNLOAD=0
```

## 开发与验证

```bash
npm run typecheck
npm run build:client
bash scripts/build-local.sh
node tests/api-smoke.mjs
```

修改源码后请同步 `lib/`，保证 clone 后可直接安装。

## 隐私与安全

- 项目与个人数据保存在本机工作区，不进入公开仓库。
- 论文检索会调用第三方公开接口；API Key 等敏感值应通过环境变量提供，不写入仓库。
- 公开 Issue/PR 请勿附带个人路径、密钥或真实账号信息。

## 贡献

欢迎提交 Issue 与 Pull Request。提交前请运行上述验证命令，并在 PR 中说明改动与验证结果。

## 许可证

[BSD-3-Clause](LICENSE)
