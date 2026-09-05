/**
 * @dsh-external/dsh-workbench-ui — client 面板（conversation.view slot）。
 * 风格：orca-link 语言——直角、黑白机械、电蓝信号；文案去 AI 味。
 *
 * 2026-09-06 简化版：
 *   - 默认“简单模式”：只显示项目、当前阶段、下一步提示、目标编辑和待办。
 *   - “完整工作台”展开搜索、冲突、决策、证据、产物、记忆等高级内容。
 *   - 科研工作台只占一个 conversation.view 标签页；轨迹、过程监视器、
 *     AI 黑盒趋势等保持为 DSH 顶部独立的标签页，不再包进左侧导航。
 *   - 不隐藏 DSH 顶部页签/输入框，也不把科研工作台强设为默认 View。
 *
 * 注意：conversation.view 的 component 必须是 React 组件函数，不能返回
 * `{ render() {} }` 这种普通对象；否则渲染器会把它当 React 组件调用，
 * 最终得到空面板。这里沿用 dsh-skill-router/dsh-skill-vault 的写法。
 */
import { createElement, useEffect, useState } from 'react'

type ClientContext = any

export const inject = ['slots']

const API = '/@dsh-external/dsh-workbench-ui/api'
const WORKBENCH_VIEW_ID = '@dsh-external/dsh-workbench-ui-panel'

const TEXT_EXTS = ['md', 'txt', 'json', 'csv', 'log', 'html', 'htm']

async function request(path: string, opts: any = {}): Promise<any> {
  const res = await fetch(API + path, {
    headers: { 'content-type': 'application/json' },
    ...opts,
  })
  return res.json()
}

async function fetchText(path: string): Promise<string> {
  const res = await fetch(API + path)
  return res.text()
}

function Section(props: any): any {
  return createElement('div', { className: 'wb-section' }, [
    createElement('div', { className: 'wb-section-title' }, [props.title]),
    props.children,
  ])
}

function Empty(props: any): any {
  return createElement('div', { className: 'wb-empty' }, [props.text])
}

function stageHint(stage: string): { step: string; title: string; text: string } {
  switch ((stage || '').trim()) {
    case '0 brief':
      return {
        step: '第 1 步',
        title: '把目标写清楚',
        text: '写下这个项目要解决什么、不做什么。目标越具体，后面越不会跑偏。',
      }
    case '1 evidence':
      return {
        step: '第 2 步',
        title: '找证据',
        text: '搜论文/资料，把关键结论记成带来源的证据。可以点“完整工作台”里的搜索。',
      }
    case '2 panel':
      return {
        step: '第 3 步',
        title: '请专家团独立表态',
        text: '让专家团对这个问题独立表态；讨论结果会出现在“过程监视器”里。',
      }
    case '3 conflict':
      return {
        step: '第 4 步',
        title: '记录分歧',
        text: '把专家们意见不一样的地方记成冲突；不用急着裁决。',
      }
    case '4 adjudicate':
      return {
        step: '第 5 步',
        title: '做裁决',
        text: '你（或主持人）拍板：采纳哪一边、合并，或者先搁置。',
      }
    case '5 plan':
      return {
        step: '第 6 步',
        title: '排计划',
        text: '把下一步拆成待办，并写明“做完的标准是什么”。',
      }
    case '6 execute':
      return {
        step: '第 7 步',
        title: '执行并落产物',
        text: '让子代理/自己干活，产物放到 artifacts 里。',
      }
    case '7 verify':
      return {
        step: '第 8 步',
        title: '验收',
        text: '对照验收项过一遍；关键证据能点回原文才算过。',
      }
    case '8 log-distill':
      return {
        step: '第 9 步',
        title: '收尾沉淀',
        text: '把结论、记忆写回项目，方便下次直接继续。',
      }
    default:
      return {
        step: '现在',
        title: '看当前状态',
        text: '不确定走到哪一步时，先把“完整工作台”打开看台账。',
      }
  }
}

function css(): string {
  return `
[data-wb-panel] {
  --accent: #086cff;
  --bg: #f5f6f8;
  --panel: #ffffff;
  --text: #15181d;
  --muted: #68707c;
  --border: #d8dce2;
  --dark-bg: #0e1116;
  --dark-panel: #171b22;
  --dark-text: #e7eaef;
  --dark-muted: #8b94a2;
  --dark-border: #262d38;
  font-family: -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif;
  color: var(--text);
  background: var(--bg);
}
html.dark [data-wb-panel] {
  color: var(--dark-text);
  background: var(--dark-bg);
  --bg: var(--dark-bg);
  --panel: var(--dark-panel);
  --text: var(--dark-text);
  --muted: var(--dark-muted);
  --border: var(--dark-border);
}
[data-wb-panel] * { box-sizing: border-box; border-radius: 0 !important; }
[data-wb-panel] .wb-panel {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  padding: 10px;
  min-height: 320px;
  font-size: 13px;
  line-height: 1.5;
}
[data-wb-panel] .wb-col { min-width: 0; }
[data-wb-panel] .wb-split {
  display: grid;
  grid-template-columns: 176px 1fr;
  gap: 10px;
  min-width: 0;
}
[data-wb-panel] .wb-header {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border);
  padding-bottom: 8px;
}
[data-wb-panel] .wb-title {
  font-weight: 700;
  letter-spacing: .04em;
  font-size: 14px;
}
[data-wb-panel] .wb-title::before {
  content: '';
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 8px;
  background: var(--accent);
}
[data-wb-panel] .wb-btn {
  border: 1px solid var(--border);
  background: var(--panel);
  color: var(--text);
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
}
[data-wb-panel] .wb-btn:hover { border-color: var(--accent); color: var(--accent); }
[data-wb-panel] .wb-btn.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
[data-wb-panel] .wb-list { display: flex; flex-direction: column; gap: 4px; }
[data-wb-panel] .wb-proj {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border: 1px solid transparent;
  border-left: 3px solid transparent;
  cursor: pointer;
  background: var(--panel);
}
[data-wb-panel] .wb-proj:hover { border-color: var(--border); }
[data-wb-panel] .wb-proj.active { border-left-color: var(--accent); border-color: var(--border); }
[data-wb-panel] .wb-proj-main { flex: 1; min-width: 0; }
[data-wb-panel] .wb-proj .wb-del { flex: none; padding: 2px 5px; font-size: 11px; }
[data-wb-panel] .wb-btn.danger { color: #dc2626; border-color: #fca5a5; }
[data-wb-panel] .wb-btn.danger:hover { background: #dc2626; color: #fff; border-color: #dc2626; }
[data-wb-panel] .wb-dot { width: 7px; height: 7px; background: var(--muted); flex: none; }
[data-wb-panel] .wb-dot.ok { background: #16a34a; }
[data-wb-panel] .wb-dot.warn { background: #d97706; }
[data-wb-panel] .wb-proj-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
[data-wb-panel] .wb-proj-meta { color: var(--muted); font-size: 11px; }
[data-wb-panel] .wb-detail { background: var(--panel); border: 1px solid var(--border); padding: 10px; }
[data-wb-panel] .wb-section { margin-bottom: 12px; }
[data-wb-panel] .wb-section-title {
  font-size: 11px;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 5px;
  border-left: 3px solid var(--accent);
  padding-left: 6px;
}
[data-wb-panel] .wb-empty { color: var(--muted); font-size: 12px; }
[data-wb-panel] .wb-input, [data-wb-panel] .wb-textarea, [data-wb-panel] .wb-select {
  width: 100%;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  padding: 5px 7px;
  font-size: 12px;
  font-family: inherit;
}
[data-wb-panel] .wb-textarea { min-height: 52px; resize: vertical; }
[data-wb-panel] .wb-row { display: flex; gap: 6px; align-items: center; margin-top: 6px; }
[data-wb-panel] .wb-row > * { flex: 1; }
[data-wb-panel] .wb-row > .wb-btn { flex: none; }
[data-wb-panel] .wb-msg { color: var(--accent); font-size: 12px; min-height: 16px; margin-top: 6px; }
[data-wb-panel] .wb-kv { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; font-size: 12px; }
[data-wb-panel] .wb-kv .k { color: var(--muted); }
[data-wb-panel] .wb-list-item { font-size: 12px; padding: 2px 0; border-bottom: 1px dashed var(--border); }
[data-wb-panel] .wb-gate-pass { color: #16a34a; }
[data-wb-panel] .wb-gate-fail { color: #dc2626; }
[data-wb-panel] .wb-search-row { grid-column: 1 / -1; display: flex; gap: 6px; }
[data-wb-panel] .wb-search-row .wb-input { flex: 1; }
[data-wb-panel] .wb-search-results { grid-column: 1 / -1; max-height: 120px; overflow-y: auto; }
[data-wb-panel] .wb-link { color: var(--accent); text-decoration: none; }
[data-wb-panel] .wb-link:hover { text-decoration: underline; }
[data-wb-panel] .wb-muted { color: var(--muted); font-size: 11px; }
[data-wb-panel] .wb-artifact-row { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
[data-wb-panel] .wb-preview {
  grid-column: 1 / -1;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 240px;
  overflow: auto;
  background: var(--bg);
  border: 1px solid var(--border);
  padding: 8px;
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

/* 简易模式 + 引导 */
[data-wb-panel] .wb-guide {
  grid-column: 1 / -1;
  display: flex;
  gap: 10px;
  align-items: flex-start;
  background: var(--panel);
  border: 1px solid var(--border);
  border-left: 3px solid var(--accent);
  padding: 8px 10px;
}
[data-wb-panel] .wb-guide-step {
  flex: none;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .05em;
  color: var(--accent);
  border: 1px solid var(--accent);
  padding: 2px 6px;
  margin-top: 1px;
}
[data-wb-panel] .wb-guide-title { font-size: 13px; font-weight: 700; }
[data-wb-panel] .wb-guide-text { color: var(--muted); font-size: 12px; margin-top: 2px; }
[data-wb-panel] .wb-simple-title { font-size: 15px; font-weight: 700; margin-bottom: 8px; }
[data-wb-panel] .wb-toggle-row {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 2px;
}
[data-wb-panel] .wb-simple-goal { margin-top: 10px; }
[data-wb-panel] .wb-simple-goal .wb-label { color: var(--muted); font-size: 12px; margin-bottom: 4px; display: block; }
`
}

function hideDshComposer(): void {
  const seats = Array.from(document.querySelectorAll<HTMLElement>('[data-composer-seat]'))
  for (const seat of seats) seat.style.display = 'none'
}

function showDshComposer(): void {
  const seats = Array.from(document.querySelectorAll<HTMLElement>('[data-composer-seat]'))
  for (const seat of seats) seat.style.display = ''
}

function hideDshWidthHandle(): void {
  const handles = Array.from(document.querySelectorAll<HTMLElement>('[data-width-handle]'))
  for (const handle of handles) handle.style.display = 'none'
}

function showDshWidthHandle(): void {
  const handles = Array.from(document.querySelectorAll<HTMLElement>('[data-width-handle]'))
  for (const handle of handles) handle.style.display = ''
}

function isChatViewActive(): boolean {
  if (typeof document === 'undefined') return true
  const activeTab = document.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
  if (!activeTab) return true
  const label = (activeTab.textContent || '').trim()
  return /^(对话|聊天|Chat)$/i.test(label)
}

function syncIndependentChrome(): void {
  if (isChatViewActive()) {
    showDshComposer()
    showDshWidthHandle()
  } else {
    hideDshComposer()
    hideDshWidthHandle()
  }
}

function clearWorkbenchDefaultView(sessionId: string | undefined): void {
  if (!sessionId || typeof localStorage === 'undefined') return
  try {
    const key = `dsh.conversation.${sessionId}`
    const raw = localStorage.getItem(key)
    if (!raw) return
    const stored = JSON.parse(raw)
    if (stored && typeof stored === 'object' && stored.view === WORKBENCH_VIEW_ID) {
      delete stored.view
      if (Object.keys(stored).length === 0) localStorage.removeItem(key)
      else localStorage.setItem(key, JSON.stringify(stored))
    }
  } catch {
    // 忽略 localStorage 异常，不打断面板。
  }
}

function WorkbenchPanel(props: any): any {
  const [projects, setProjects] = useState<any[]>([])
  const [selected, setSelected] = useState('')
  const [ledger, setLedger] = useState<any>(null)
  const [artifacts, setArtifacts] = useState<string[]>([])
  const [evidence, setEvidence] = useState<string[]>([])
  const [searchResults, setSearchResults] = useState<any[] | null>(null)
  const [artifactPreview, setArtifactPreview] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [newId, setNewId] = useState('')
  const [searchQ, setSearchQ] = useState('')
  const [memory, setMemory] = useState('')
  const [todo, setTodo] = useState('')
  const [goalDraft, setGoalDraft] = useState('')
  const [stage, setStage] = useState('0 brief')
  const [gateItem, setGateItem] = useState('')
  const [gateEv, setGateEv] = useState('')
  const [claim, setClaim] = useState('')
  const [claimSrc, setClaimSrc] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState('')

  async function refreshProjects(keepDetail = true): Promise<void> {
    if (loading) return
    setLoading(true)
    setMsg('')
    try {
      const r = await request('/projects')
      setProjects(r.projects ?? [])
      if (keepDetail && selected) {
        const d = await request(`/project/${selected}`)
        if (d.ok) {
          setLedger(d.ledger)
          setArtifacts(d.artifacts ?? [])
          setEvidence(d.evidence ?? [])
          setGoalDraft(d.ledger?.brief?.goal ?? '')
        }
      } else {
        setLedger(null)
        setArtifacts([])
        setEvidence([])
        setGoalDraft('')
      }
    } catch (e: any) {
      setMsg('加载失败：' + String(e?.message ?? e))
    } finally {
      setLoading(false)
    }
  }

  async function loadDetail(id: string): Promise<void> {
    if (!id) {
      setLedger(null)
      setArtifacts([])
      setEvidence([])
      setArtifactPreview('')
      setGoalDraft('')
      return
    }
    try {
      const d = await request(`/project/${id}`)
      if (d.ok) {
        setLedger(d.ledger)
        setArtifacts(d.artifacts ?? [])
        setEvidence(d.evidence ?? [])
        setArtifactPreview('')
        setGoalDraft(d.ledger?.brief?.goal ?? '')
      } else {
        setLedger(null)
        setArtifacts([])
        setEvidence([])
        setGoalDraft('')
      }
    } catch (e: any) {
      setMsg('项目加载失败：' + String(e?.message ?? e))
    }
  }

  useEffect(() => {
    clearWorkbenchDefaultView(props?.sessionId)
    void refreshProjects(false)
  }, [])

  useEffect(() => {
    void loadDetail(selected)
  }, [selected])

  async function createProject(): Promise<void> {
    const id = newId.trim()
    if (!id) return
    try {
      await request('/project', { method: 'POST', body: JSON.stringify({ id, title: id }) })
      setNewId('')
      const r = await request('/projects')
      setProjects(r.projects ?? [])
      setSelected(id)
      setMsg('已创建项目。下一步：把目标写清楚。')
    } catch (e: any) {
      setMsg('新建失败：' + String(e?.message ?? e))
    }
  }

  function askDeleteProject(id: string): void {
    if (confirmDeleteId === id) {
      setConfirmDeleteId('')
      setMsg('')
    } else {
      setConfirmDeleteId(id)
      setMsg('再点一次“确认”删除该项目，删除后不可恢复。')
    }
  }

  async function deleteProject(id: string): Promise<void> {
    const target = projects.find((p: any) => p.id === id)
    const name = target?.title || id
    setConfirmDeleteId('')
    try {
      const r = await request(`/project/${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!r?.ok) throw new Error(r?.error || '删除失败')
      if (selected === id) {
        setSelected('')
        setLedger(null)
        setArtifacts([])
        setEvidence([])
        setArtifactPreview('')
        setGoalDraft('')
      }
      const list = await request('/projects')
      setProjects(list.projects ?? [])
      setMsg(`已删除项目“${name}”。`)
    } catch (e: any) {
      setMsg('删除失败：' + String(e?.message ?? e))
    }
  }

  async function saveGoal(): Promise<void> {
    const text = goalDraft.trim()
    if (!text || !selected) return
    try {
      await request(`/brief/${selected}`, { method: 'POST', body: JSON.stringify({ goal: text }) })
      await loadDetail(selected)
      setMsg('目标已保存。')
    } catch (e: any) {
      setMsg('保存目标失败：' + String(e?.message ?? e))
    }
  }

  async function runSearch(): Promise<void> {
    const q = searchQ.trim()
    if (!q) return
    try {
      const res = await request(`/search?q=${encodeURIComponent(q)}&source=openalex,crossref&limit=5`)
      setSearchResults(res.results ?? [])
    } catch (e: any) {
      setMsg('搜索失败：' + String(e?.message ?? e))
      setSearchResults([])
    }
  }

  async function addMemory(): Promise<void> {
    const text = memory.trim()
    if (!text || !selected) return
    try {
      await request(`/memory/${selected}`, { method: 'POST', body: JSON.stringify({ text }) })
      setMemory('')
      await loadDetail(selected)
    } catch (e: any) {
      setMsg('记记忆失败：' + String(e?.message ?? e))
    }
  }

  async function addTodo(): Promise<void> {
    const text = todo.trim()
    if (!text || !selected) return
    try {
      await request(`/todo/${selected}`, { method: 'POST', body: JSON.stringify({ text }) })
      setTodo('')
      await loadDetail(selected)
    } catch (e: any) {
      setMsg('加待办失败：' + String(e?.message ?? e))
    }
  }

  async function addGate(): Promise<void> {
    const item = gateItem.trim()
    if (!item || !selected) return
    try {
      await request(`/gate/${selected}`, { method: 'POST', body: JSON.stringify({ stage, item, evidence: gateEv.trim(), pass: true }) })
      setGateItem('')
      setGateEv('')
      await loadDetail(selected)
    } catch (e: any) {
      setMsg('记门禁失败：' + String(e?.message ?? e))
    }
  }

  async function addClaim(): Promise<void> {
    const text = claim.trim()
    if (!text || !selected) return
    try {
      await request(`/claim/${selected}`, { method: 'POST', body: JSON.stringify({ text, source: claimSrc.trim() }) })
      setClaim('')
      setClaimSrc('')
      await loadDetail(selected)
    } catch (e: any) {
      setMsg('记证据失败：' + String(e?.message ?? e))
    }
  }

  async function openArtifact(name: string): Promise<void> {
    const ext = name.split('.').pop()?.toLowerCase() || ''
    if (TEXT_EXTS.includes(ext)) {
      try {
        const text = await fetchText(`/artifact/${selected}/${encodeURIComponent(name)}`)
        setArtifactPreview(text)
      } catch (e: any) {
        setMsg('预览失败：' + String(e?.message ?? e))
      }
    } else {
      window.open(`${API}/artifact/${selected}/${encodeURIComponent(name)}`, '_blank')
    }
  }

  const l = ledger
  const brief = l?.brief ?? {}
  const gates = l?.gates ?? []
  const conflicts = l?.conflicts ?? []
  const decisions = l?.decisions ?? []
  const mem = l?.memory ?? []
  const claims = l?.claims ?? []
  const todos = (l?.next_actions ?? []).filter((t: any) => !t.done)
  const hint = selected
    ? stageHint(l?.current_stage ?? '0 brief')
    : {
        step: '从这开始',
        title: '先建一个项目',
        text: '给科研任务起个名字。不用一次写完整，先把项目建出来。',
      }

  const projectList = projects.map((p: any) => {
    const dotClass = p.unresolved > 0 ? 'warn' : (p.gates_total > 0 && p.gates_pass === p.gates_total ? 'ok' : '')
    return createElement('div', {
      key: p.id,
      className: 'wb-proj' + (selected === p.id ? ' active' : ''),
      onClick: () => {
        setConfirmDeleteId('')
        setSelected(p.id)
      },
    }, [
      createElement('span', { className: 'wb-dot ' + dotClass }),
      createElement('div', { className: 'wb-proj-main' }, [
        createElement('div', { className: 'wb-proj-name' }, [p.title || p.id]),
        createElement('div', { className: 'wb-proj-meta' }, [`${p.stage} · ${p.gates_pass}/${p.gates_total} 门禁`]),
      ]),
      ...(confirmDeleteId === p.id
        ? [
            createElement('button', {
              className: 'wb-btn danger wb-del',
              title: '确认删除，不可恢复',
              onClick: (ev: any) => {
                ev.stopPropagation()
                void deleteProject(p.id)
              },
            }, ['确认']),
            createElement('button', {
              className: 'wb-btn wb-del',
              title: '取消删除',
              onClick: (ev: any) => {
                ev.stopPropagation()
                setConfirmDeleteId('')
              },
            }, ['取消']),
          ]
        : [
            createElement('button', {
              className: 'wb-btn danger wb-del',
              title: '删除项目',
              onClick: (ev: any) => {
                ev.stopPropagation()
                askDeleteProject(p.id)
              },
            }, ['删除']),
          ]),
    ])
  })

  // ── 简单模式：挑选最重要的信息 + 下一步 ──
  const simpleDetail = !l
    ? Empty({ text: '选一个项目看状态；没有项目就在左边新建。' })
    : createElement('div', { className: 'wb-detail' }, [
        createElement('div', { className: 'wb-simple-title' }, [l.title || selected]),
        createElement('div', { className: 'wb-kv' }, [
          createElement('span', { className: 'k' }, ['当前阶段']),
          createElement('span', {}, [l.current_stage || '0 brief']),
          createElement('span', { className: 'k' }, ['门禁']),
          createElement('span', {}, [`${gates.filter((g: any) => g.pass).length}/${gates.length} 已过`]),
        ]),
        createElement('div', { className: 'wb-simple-goal' }, [
          createElement('label', { className: 'wb-label' }, ['项目目标']),
          createElement('div', { className: 'wb-row' }, [
            createElement('input', {
              className: 'wb-input',
              placeholder: '想解决什么问题？',
              value: goalDraft,
              onChange: (ev: any) => setGoalDraft(ev.target.value),
            }),
            createElement('button', { className: 'wb-btn primary', onClick: () => void saveGoal() }, ['保存']),
          ]),
        ]),
        Section({ title: '下一步', children: createElement('div', {}, [
          createElement('div', { className: 'wb-guide-title' }, [hint.title]),
          createElement('div', { className: 'wb-guide-text' }, [hint.text]),
        ]) }),
        Section({ title: '快速加待办', children: createElement('div', { className: 'wb-row' }, [
          createElement('input', {
            className: 'wb-input',
            placeholder: '下一步要做的事',
            value: todo,
            onChange: (ev: any) => setTodo(ev.target.value),
          }),
          createElement('button', { className: 'wb-btn', onClick: () => void addTodo() }, ['加']),
        ]) }),
        createElement('div', { className: 'wb-msg' }, [msg]),
      ])

  // ── 完整模式：原有的全量台账 ──
  const fullDetail = !l
    ? Empty({ text: '选一个项目看状态' })
    : createElement('div', { className: 'wb-detail' }, [
        Section({ title: '目标', children: createElement('div', { className: 'wb-kv' }, [
          createElement('span', { className: 'k' }, ['目标']),
          createElement('span', {}, [brief.goal || '未写']),
          createElement('span', { className: 'k' }, ['非目标']),
          createElement('span', {}, [brief.non_goals?.join('；') || '未写']),
          createElement('span', { className: 'k' }, ['当前阶段']),
          createElement('span', {}, [l.current_stage || '0 brief']),
        ]) }),
        Section({ title: '门禁', children: gates.length
          ? createElement('div', {}, gates.map((g: any) => createElement('div', { key: g.id, className: 'wb-list-item' }, [
              createElement('span', { className: g.pass ? 'wb-gate-pass' : 'wb-gate-fail' }, [g.pass ? 'PASS' : 'FAIL']),
              ` ${g.stage} / ${g.item}`,
            ])))
          : Empty({ text: '还没记门禁' }) }),
        ...(conflicts.length ? [Section({ title: '未决冲突', children: createElement('div', {}, conflicts
          .filter((c: any) => !c.resolution || c.resolution === 'defer')
          .map((c: any) => createElement('div', { key: c.id, className: 'wb-list-item' }, [`${c.id} ${c.topic}`]))) })] : []),
        ...(decisions.length ? [Section({ title: '决策', children: createElement('div', {}, decisions.map((d: any) =>
          createElement('div', { key: d.id, className: 'wb-list-item' }, [`[${d.resolution}] ${d.decision}`]))) })] : []),
        ...(todos.length ? [Section({ title: '待办', children: createElement('div', {}, todos.map((t: any) =>
          createElement('div', { key: t.text + t.ts, className: 'wb-list-item' }, [`· ${t.text}`]))) })] : []),
        Section({ title: '证据', children: createElement('div', {}, [
          ...(claims.length ? claims.map((c: any) => {
            const src = c.source || ''
            const srcEl = src.startsWith('http')
              ? createElement('a', { href: src, target: '_blank', className: 'wb-link' }, [src])
              : createElement('span', { className: 'wb-muted' }, [src || '无来源'])
            return createElement('div', { key: c.id, className: 'wb-list-item' }, [c.text, ' ', srcEl])
          }) : [Empty({ text: '还没有 claim' })]),
          ...(evidence.length ? [createElement('div', { className: 'wb-muted' }, [`evidence/：${evidence.join('、')}`])] : []),
        ]) }),
        Section({ title: '产物', children: createElement('div', {}, artifacts.length
          ? artifacts.map((name: string) => createElement('div', { key: name, className: 'wb-list-item wb-artifact-row' }, [
              createElement('span', {}, [name]),
              createElement('button', { className: 'wb-btn', onClick: () => void openArtifact(name) }, ['看']),
            ]))
          : Empty({ text: '还没有产物' }) ) }),
        ...(artifactPreview ? [createElement('pre', { className: 'wb-preview' }, [artifactPreview])] : []),
        ...(mem.length ? [Section({ title: '记忆', children: createElement('div', {}, mem.map((m: any) =>
          createElement('div', { key: m.ts + m.text, className: 'wb-list-item' }, [m.text]))) })] : []),
        Section({ title: '快速记录', children: createElement('div', {}, [
          createElement('div', { className: 'wb-row' }, [
            createElement('input', { className: 'wb-input', placeholder: '记一条记忆', value: memory, onChange: (ev: any) => setMemory(ev.target.value) }),
            createElement('button', { className: 'wb-btn', onClick: () => void addMemory() }, ['记']),
          ]),
          createElement('div', { className: 'wb-row' }, [
            createElement('input', { className: 'wb-input', placeholder: '加一条待办', value: todo, onChange: (ev: any) => setTodo(ev.target.value) }),
            createElement('button', { className: 'wb-btn', onClick: () => void addTodo() }, ['加']),
          ]),
          createElement('div', { className: 'wb-row' }, [
            createElement('select', { className: 'wb-select', value: stage, onChange: (ev: any) => setStage(ev.target.value) }, [
              '0 brief','1 evidence','2 panel','3 conflict','4 adjudicate','5 plan','6 execute','7 verify','8 log-distill',
            ].map((s) => createElement('option', { key: s, value: s }, [s]))),
            createElement('input', { className: 'wb-input', placeholder: '验收项', value: gateItem, onChange: (ev: any) => setGateItem(ev.target.value) }),
          ]),
          createElement('div', { className: 'wb-row' }, [
            createElement('input', { className: 'wb-input', placeholder: '证据（怎么证明过了）', value: gateEv, onChange: (ev: any) => setGateEv(ev.target.value) }),
            createElement('button', { className: 'wb-btn primary', onClick: () => void addGate() }, ['过']),
          ]),
          createElement('div', { className: 'wb-row' }, [
            createElement('input', { className: 'wb-input', placeholder: '结论（claim）', value: claim, onChange: (ev: any) => setClaim(ev.target.value) }),
            createElement('input', { className: 'wb-input', placeholder: '来源 URL/DOI', value: claimSrc, onChange: (ev: any) => setClaimSrc(ev.target.value) }),
            createElement('button', { className: 'wb-btn', onClick: () => void addClaim() }, ['记证据']),
          ]),
        ]) }),
        createElement('div', { className: 'wb-msg' }, [msg]),
      ])

  const workbenchContent = createElement('div', { className: 'wb-split' }, [
    createElement('div', { className: 'wb-guide' }, [
      createElement('div', { className: 'wb-guide-step' }, [hint.step]),
      createElement('div', {}, [
        createElement('div', { className: 'wb-guide-title' }, [hint.title]),
        createElement('div', { className: 'wb-guide-text' }, [hint.text]),
      ]),
    ]),
    ...(showAdvanced ? [
      createElement('div', { className: 'wb-search-row' }, [
        createElement('input', { className: 'wb-input', placeholder: '搜论文（OpenAlex / Crossref）', value: searchQ, onChange: (ev: any) => setSearchQ(ev.target.value) }),
        createElement('button', { className: 'wb-btn', onClick: () => void runSearch() }, ['搜']),
      ]),
      createElement('div', { className: 'wb-search-results' }, searchResults
        ? searchResults.map((item: any) => createElement('div', { key: item.url ?? item.title, className: 'wb-list-item' }, [
            item.url?.startsWith('http')
              ? createElement('a', { href: item.url, target: '_blank', className: 'wb-link' }, [item.title || item.url])
              : createElement('span', {}, [item.title || item.url]),
            ` [${item.source}]`,
          ]))
        : []),
    ] : []),
    createElement('div', { className: 'wb-col' }, [
      createElement('div', { className: 'wb-section-title' }, ['项目']),
      createElement('div', { className: 'wb-list' }, projectList.length ? projectList : [Empty({ text: '还没有项目' })]),
      createElement('div', { className: 'wb-row' }, [
        createElement('input', { className: 'wb-input', placeholder: '项目 id', value: newId, onChange: (ev: any) => setNewId(ev.target.value) }),
        createElement('button', { className: 'wb-btn primary', onClick: () => void createProject() }, ['新建']),
      ]),
    ]),
    createElement('div', { className: 'wb-col' }, [showAdvanced ? fullDetail : simpleDetail]),
    createElement('div', { className: 'wb-toggle-row' }, [
      createElement('button', { className: 'wb-btn', onClick: () => setShowAdvanced(!showAdvanced) }, [showAdvanced ? '简单模式' : '完整工作台']),
    ]),
  ])

  return createElement('div', { 'data-wb-panel': '' }, [
    createElement('style', { key: 'style' }, [css()]),
    createElement('div', { className: 'wb-panel' }, [
      createElement('div', { className: 'wb-header' }, [
        createElement('div', { className: 'wb-title' }, ['科研']),
        createElement('button', { className: 'wb-btn', onClick: () => void refreshProjects(true) }, ['刷新']),
      ]),
      workbenchContent,
    ]),
  ])
}

export function apply(ctx: ClientContext): void {
  ctx.effect(() => {
    syncIndependentChrome()
    const observer = new MutationObserver(() => syncIndependentChrome())
    const root = document.body ?? document.documentElement
    if (root) {
      observer.observe(root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['aria-selected'],
      })
    }
    return () => {
      observer.disconnect()
      showDshComposer()
      showDshWidthHandle()
    }
  }, '@dsh-external/dsh-workbench-ui: independent chrome')

  ctx.effect(() => ctx.slots.inject('conversation.view', () =>
    ctx.slots.register({
      name: 'conversation.view',
      id: WORKBENCH_VIEW_ID,
      label: () => '科研',
    }, WorkbenchPanel),
  ), '@dsh-external/dsh-workbench-ui: panel')
}
