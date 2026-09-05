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

## 简化版说明（2026-09-06）

- 默认“简单模式”：只显示项目、当前阶段、下一步提示、项目目标编辑和快捷待办；搜索、冲突、决策、证据、产物、记忆等折叠到“完整工作台”。
- 顶部新增“当前第几步 / 下一步做什么”的引导卡，按九段决策环逐步提示。
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
- 加记忆、加待办
- 记录一条门禁（阶段 + 验收项 + 证据）
- 记一条带来源的 claim
- 直接搜论文（OpenAlex / Crossref），结果可点开
- 看 `evidence/` 与 `artifacts/` 里的文件；文本产物可以面板里直接预览

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
