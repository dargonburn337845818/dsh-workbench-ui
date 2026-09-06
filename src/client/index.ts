/**
 * @dsh-external/dsh-workbench-ui — client 面板（conversation.view slot）。
 * 风格：orca-link 语言——直角、黑白机械、电蓝信号；文案去 AI 味。
 *
 * 2026-09-06 统一工作台重构（复刻 LightRead 的“一个工作区”心智）：
 *   - 不再区分“简单/完整”模式：目标、搜索、证据、冲突、决策、门禁、
 *     待办、记忆、产物全部常驻同一张工作区。
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

function GraphSvg(props: any): any {
  const nodes: any[] = props.nodes || []
  const edges: any[] = props.edges || []
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 })
  const [drag, setDrag] = useState<any>(null)
  if (!nodes.length) return Empty({ text: '图数据为空' })
  const size = 480
  const seed = nodes.find((n: any) => n.kind === 'seed')
  const others = nodes.filter((n: any) => n.kind !== 'seed')
  const pos: Record<string, [number, number]> = {}
  if (seed) pos[seed.id] = [size / 2, size / 2]
  others.forEach((n: any, i: number) => {
    const ang = (2 * Math.PI * i) / Math.max(1, others.length)
    pos[n.id] = [size / 2 + Math.cos(ang) * 180, size / 2 + Math.sin(ang) * 180]
  })
  const lineEls = edges.map((e: any, idx: number) => {
    const p1 = pos[e.source]
    const p2 = pos[e.target]
    if (!p1 || !p2) return null
    return createElement('line', {
      key: idx,
      x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1],
      stroke: '#086cff', strokeWidth: 1, opacity: 0.5,
    })
  })
  const nodeEls = nodes.map((n: any) => {
    const [x, y] = pos[n.id] || [size / 2, size / 2]
    return createElement('g', {
      key: n.id,
      style: { cursor: 'pointer' },
      title: `${n.title || n.id} · ${n.year || ''} · 被引 ${n.citations ?? '?'}`,
      onClick: () => window.open(`https://openalex.org/${n.id}`, '_blank'),
    }, [
      createElement('circle', {
        cx: x, cy: y, r: n.kind === 'seed' ? 9 : 5,
        fill: n.kind === 'seed' ? '#086cff' : (n.kind === 'reference' ? '#8b94a2' : '#d97706'),
      }),
      createElement('text', {
        x: x + 7, y: y + 4, fontSize: 9, fill: 'var(--text)',
      }, [String(n.title || n.id).slice(0, 26)]),
    ])
  })
  const zoom = (factor: number) => setView((v) => ({
    ...v,
    scale: Math.min(3, Math.max(0.4, v.scale * factor)),
  }))
  const reset = () => setView({ scale: 1, tx: 0, ty: 0 })
  const onDown = (e: any) => setDrag({ x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty })
  const onMove = (e: any) => {
    if (drag) setView((v) => ({ ...v, tx: drag.tx + (e.clientX - drag.x), ty: drag.ty + (e.clientY - drag.y) }))
  }
  const onUp = () => setDrag(null)
  const exportPng = () => {
    const svg = document.querySelector('[data-wb-panel] .wb-graph-svg') as any
    if (!svg) return
    const xml = new XMLSerializer().serializeToString(svg)
    const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }))
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 960
      canvas.height = 640
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob((blob: any) => {
        if (!blob) return
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `workbench-graph-${Date.now()}.png`
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 5000)
      }, 'image/png')
    }
    img.src = url
  }
  const exportJson = () => {
    const fileName = String(props.graphFile || '').split('/').pop()
    if (!fileName || !props.project) return
    window.open(`${API}/artifact/${props.project}/${encodeURIComponent(fileName)}`, '_blank')
  }
  return createElement('div', { className: 'wb-graph-wrap' }, [
    createElement('div', { className: 'wb-graph-controls' }, [
      createElement('button', { className: 'wb-btn', onClick: () => zoom(1.2) }, ['+']),
      createElement('button', { className: 'wb-btn', onClick: () => zoom(0.8) }, ['−']),
      createElement('button', { className: 'wb-btn', onClick: reset }, ['重置']),
      createElement('button', { className: 'wb-btn', onClick: exportPng }, ['PNG']),
      ...(props.graphFile ? [createElement('button', { className: 'wb-btn', onClick: exportJson }, ['JSON'])] : []),
      createElement('span', { className: 'wb-muted' }, ['拖动/缩放 · 点节点看原文']),
    ]),
    createElement('svg', {
      viewBox: `0 0 ${size} ${size}`,
      className: 'wb-graph-svg',
      width: '100%',
      height: 320,
      onMouseDown: onDown,
      onMouseMove: onMove,
      onMouseUp: onUp,
      onMouseLeave: onUp,
      onWheel: (e: any) => {
        e.preventDefault?.()
        zoom(e.deltaY < 0 ? 1.1 : 0.9)
      },
    }, [
      createElement('g', {
        transform: `translate(${view.tx} ${view.ty}) scale(${view.scale})`,
      }, [...lineEls.filter(Boolean), ...nodeEls]),
    ]),
  ])
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
        text: '搜论文/资料，把关键结论记成带来源的证据。搜索框就在工作区上方。',
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
        text: '不确定走到哪一步时，看工作区里的阶段进度条和台账。',
      }
  }
}

function nextGuide(ledger: any): { step: string; title: string; text: string } {
  if (!ledger) {
    return { step: '从这开始', title: '先建一个项目', text: '给科研任务起个名字，不用一次写完整。' }
  }
  const brief = ledger.brief ?? {}
  const goal = (brief.goal || '').trim()
  const nonGoals = (brief.non_goals || []).filter((x: any) => String(x).trim())
  const claims = (ledger.claims || []).length
  const unresolved = (ledger.conflicts || []).filter((c: any) => !c.resolution || c.resolution === 'defer').length
  const todos = (ledger.next_actions || []).filter((t: any) => !t.done).length
  const gates = ledger.gates || []
  const gatesPass = gates.filter((g: any) => g.pass).length
  if (!goal) return { step: '第 1 步', title: '写目标', text: '先写清楚这个项目要解决什么；目标越具体，后面越不容易跑偏。' }
  if (!nonGoals.length) return { step: '第 1 步', title: '写非目标', text: '明确不做什么：scope 越小，越容易出可交付结果。' }
  if (!claims) return { step: '第 2 步', title: '检索证据', text: '用上方搜索找论文/资料，先记 2-3 条带来源的 claim。' }
  if (unresolved) return { step: '第 3-4 步', title: '裁决分歧', text: `还有 ${unresolved} 条未决冲突；先记录专家分歧，再拍板或搁置。` }
  if (!todos) return { step: '第 5 步', title: '排计划', text: '把下一步拆成待办，每条写清楚“做完的标准”。' }
  if (!gates.length || gatesPass < gates.length) return { step: '第 7 步', title: '验收', text: '对照验收项过一遍；关键证据能点回原文才过。' }
  return { step: '第 8 步', title: '沉淀交付', text: '写回记忆、整理产物到 artifacts，然后可以开下一轮。' }
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
[data-wb-panel] .wb-search-row .wb-select { flex: none; width: auto; min-width: 132px; }
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
[data-wb-panel] .wb-workflow {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 2px 0;
}
[data-wb-panel] .wb-workflow-step {
  font-size: 11px;
  padding: 2px 7px;
  border: 1px solid var(--border);
  color: var(--muted);
  background: var(--panel);
}
[data-wb-panel] .wb-workflow-step.active {
  color: var(--accent);
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 8%, var(--panel));
}
[data-wb-panel] .wb-simple-title { font-size: 15px; font-weight: 700; margin-bottom: 8px; }
[data-wb-panel] .wb-graph-wrap { display: flex; flex-direction: column; gap: 4px; }
[data-wb-panel] .wb-graph-controls { display: flex; gap: 4px; align-items: center; }
[data-wb-panel] .wb-graph-svg {
  background: var(--panel);
  border: 1px solid var(--border);
  display: block;
  cursor: grab;
}
[data-wb-panel] .wb-graph-svg:active { cursor: grabbing; }
[data-wb-panel] .wb-graph-svg text {
  font-family: -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif;
}
[data-wb-panel] .wb-note-html {
  background: var(--bg);
  border: 1px solid var(--border);
  padding: 8px;
  max-height: 360px;
  overflow: auto;
  font-size: 12px;
}
[data-wb-panel] .wb-note-html h1 { font-size: 15px; margin: 4px 0; }
[data-wb-panel] .wb-note-html h2 { font-size: 13px; margin: 4px 0; }
[data-wb-panel] .wb-note-html p { margin: 4px 0; }
[data-wb-panel] .wb-note-html ul { margin: 4px 0; padding-left: 18px; }
[data-wb-panel] .wb-note-img { max-width: 100%; display: block; margin: 6px 0; border: 1px solid var(--border); }

/* Markdown 产物美化渲染 */
[data-wb-panel] .wb-md {
  grid-column: 1 / -1;
  background: var(--bg);
  border: 1px solid var(--border);
  padding: 10px 12px;
  max-height: 420px;
  overflow: auto;
  font-size: 13px;
  line-height: 1.65;
}
[data-wb-panel] .wb-md h1 { font-size: 17px; margin: 8px 0 4px; }
[data-wb-panel] .wb-md h2 { font-size: 15px; margin: 8px 0 4px; border-bottom: 1px solid var(--border); padding-bottom: 3px; }
[data-wb-panel] .wb-md h3 { font-size: 14px; margin: 6px 0 3px; }
[data-wb-panel] .wb-md h4 { font-size: 13px; margin: 6px 0 3px; }
[data-wb-panel] .wb-md p { margin: 5px 0; }
[data-wb-panel] .wb-md ul, [data-wb-panel] .wb-md ol { margin: 5px 0; padding-left: 20px; }
[data-wb-panel] .wb-md li { margin: 2px 0; }
[data-wb-panel] .wb-md code {
  background: color-mix(in srgb, var(--muted) 12%, transparent);
  padding: 1px 4px;
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
[data-wb-panel] .wb-md pre {
  background: var(--panel);
  border: 1px solid var(--border);
  padding: 8px;
  overflow: auto;
  margin: 6px 0;
}
[data-wb-panel] .wb-md pre code { background: transparent; padding: 0; }
[data-wb-panel] .wb-md table {
  border-collapse: collapse;
  margin: 6px 0;
  width: 100%;
  font-size: 12px;
}
[data-wb-panel] .wb-md th, [data-wb-panel] .wb-md td {
  border: 1px solid var(--border);
  padding: 4px 6px;
  text-align: left;
  vertical-align: top;
}
[data-wb-panel] .wb-md th { background: color-mix(in srgb, var(--accent) 6%, var(--panel)); font-weight: 600; }
[data-wb-panel] .wb-md blockquote {
  border-left: 3px solid var(--accent);
  margin: 6px 0;
  padding: 2px 8px;
  color: var(--muted);
}
[data-wb-panel] .wb-md hr { border: none; border-top: 1px solid var(--border); margin: 8px 0; }
[data-wb-panel] .wb-md a { color: var(--accent); }
[data-wb-panel] .wb-md-img { max-width: 100%; display: block; margin: 6px 0; border: 1px solid var(--border); }

/* 产物 HTML/PPT 预览 */
[data-wb-panel] .wb-artifact-frame-wrap {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
[data-wb-panel] .wb-artifact-frame-bar { display: flex; justify-content: flex-end; }
[data-wb-panel] .wb-artifact-frame {
  width: 100%;
  height: 430px;
  border: 1px solid var(--border);
  background: var(--panel);
}
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

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function inlineMd(s: string, project: string, mode: string): string {
  let out = escapeHtml(s)
  // 图片：先处理，避免与链接混淆
  out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m: string, alt: string, path: string) => {
    let src = String(path)
    if (mode === 'note') {
      const seg = String(path).split('/')
      src = `${API}/note-asset/${encodeURIComponent(project)}/${encodeURIComponent(seg[0] || '')}/${encodeURIComponent(seg[1] || '')}`
    } else if (!/^https?:\/\//i.test(src) && src) {
      src = `${API}/artifact/${encodeURIComponent(project)}/${encodeURIComponent(String(src).replace(/^\.\//, ''))}`
    }
    return `<img class="wb-md-img" src="${src}" alt="${escapeHtml(alt)}">`
  })
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a class="wb-link" href="$2" target="_blank" rel="noopener">$1</a>')
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>')
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
  return out
}

function markdownToHtml(text: string, project: string, mode: string): string {
  let html = ''
  let inList = false
  let inOl = false
  let inTable = false
  let inCode = false
  let codeBuf: string[] = []
  const closeList = () => {
    if (inList) { html += '</ul>'; inList = false }
    if (inOl) { html += '</ol>'; inOl = false }
  }
  const closeTable = () => {
    if (inTable) { html += '</tbody></table>'; inTable = false }
  }
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd()
    const trimmed = line.trim()
    if (trimmed.startsWith('```')) {
      closeList(); closeTable()
      if (inCode) {
        html += '<code>' + escapeHtml(codeBuf.join('\n')) + '</code></pre>'
        inCode = false; codeBuf = []
      } else {
        html += '<pre class="wb-md-pre"><code>'
        inCode = true; codeBuf = []
      }
      continue
    }
    if (inCode) {
      codeBuf.push(line)
      continue
    }
    // 表格
    if (/^\|.*\|$/.test(trimmed)) {
      closeList()
      const cells = trimmed.split('|').slice(1, -1).map((c) => c.trim())
      const isSep = cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c))
      if (!inTable && !isSep) {
        html += '<table class="wb-md-table"><thead><tr>'
        for (const c of cells) html += `<th>${inlineMd(c, project, mode)}</th>`
        html += '</tr></thead><tbody>'
        inTable = true
      } else if (inTable && !isSep) {
        html += '<tr>'
        for (const c of cells) html += `<td>${inlineMd(c, project, mode)}</td>`
        html += '</tr>'
      }
      continue
    }
    if (inTable) { closeTable() }
    if (/^#{1,6}\s+/.test(trimmed)) {
      closeList()
      const level = trimmed.match(/^#+/)![0].length
      html += `<h${level}>${inlineMd(trimmed.replace(/^#+\s+/, ''), project, mode)}</h${level}>`
      continue
    }
    if (/^>\s?/.test(trimmed)) {
      closeList()
      html += `<blockquote class="wb-md-quote">${inlineMd(trimmed.replace(/^>\s?/, ''), project, mode)}</blockquote>`
      continue
    }
    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      closeList(); closeTable()
      html += '<hr class="wb-md-hr">'
      continue
    }
    if (/^[-*]\s+/.test(trimmed)) {
      closeTable()
      if (inOl) { html += '</ol>'; inOl = false }
      if (!inList) { html += '<ul>'; inList = true }
      html += `<li>${inlineMd(trimmed.replace(/^[-*]\s+/, ''), project, mode)}</li>`
      continue
    }
    if (/^\d+\.\s+/.test(trimmed)) {
      closeTable()
      if (inList) { html += '</ul>'; inList = false }
      if (!inOl) { html += '<ol>'; inOl = true }
      html += `<li>${inlineMd(trimmed.replace(/^\d+\.\s+/, ''), project, mode)}</li>`
      continue
    }
    if (!trimmed) {
      closeList(); closeTable()
      continue
    }
    closeList(); closeTable()
    html += `<p>${inlineMd(line, project, mode)}</p>`
  }
  if (inCode) {
    html += '<code>' + escapeHtml(codeBuf.join('\n')) + '</code></pre>'
  }
  closeList(); closeTable()
  return html
}

function noteToHtml(text: string, project: string): string {
  return markdownToHtml(text, project, 'note')
}

function WorkbenchPanel(props: any): any {
  const [projects, setProjects] = useState<any[]>([])
  const [selected, setSelected] = useState('')
  const [ledger, setLedger] = useState<any>(null)
  const [artifacts, setArtifacts] = useState<string[]>([])
  const [evidence, setEvidence] = useState<string[]>([])
  const [notes, setNotes] = useState<string[]>([])
  const [searchResults, setSearchResults] = useState<any[] | null>(null)
  const [artifactPreview, setArtifactPreview] = useState('')
  const [artifactHtml, setArtifactHtml] = useState('')
  const [artifactFrame, setArtifactFrame] = useState('')
  const [notePreview, setNotePreview] = useState('')
  const [noteHtml, setNoteHtml] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [newId, setNewId] = useState('')
  const [searchQ, setSearchQ] = useState('')
  const [searchSource, setSearchSource] = useState('openalex,crossref,semantic,europepmc')
  const [memory, setMemory] = useState('')
  const [memQuery, setMemQuery] = useState('')
  const [memResults, setMemResults] = useState<any[] | null>(null)
  const [todo, setTodo] = useState('')
  const [goalDraft, setGoalDraft] = useState('')
  const [nonGoalsDraft, setNonGoalsDraft] = useState('')
  const [stage, setStage] = useState('0 brief')
  const [gateItem, setGateItem] = useState('')
  const [gateEv, setGateEv] = useState('')
  const [claim, setClaim] = useState('')
  const [claimSrc, setClaimSrc] = useState('')
  const [graphQ, setGraphQ] = useState('')
  const [graphResult, setGraphResult] = useState<any>(null)
  const [graphing, setGraphing] = useState(false)
  const [ingesting, setIngesting] = useState(false)
  const [ingestMsg, setIngestMsg] = useState('')
  const [memSearching, setMemSearching] = useState(false)
  const [contextText, setContextText] = useState('')
  const [contextLoading, setContextLoading] = useState(false)
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
          setNotes(d.notes ?? [])
          setGoalDraft(d.ledger?.brief?.goal ?? '')
          setNonGoalsDraft((d.ledger?.brief?.non_goals ?? []).join('\n'))
        }
      } else {
        setLedger(null)
        setArtifacts([])
        setEvidence([])
        setNotes([])
        setGoalDraft('')
        setNonGoalsDraft('')
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
      setNotes([])
      setArtifactPreview('')
      setArtifactHtml('')
      setArtifactFrame('')
      setNotePreview('')
      setNoteHtml('')
      setContextText('')
      setGoalDraft('')
      setNonGoalsDraft('')
      return
    }
    try {
      const d = await request(`/project/${id}`)
      if (d.ok) {
        setLedger(d.ledger)
        setArtifacts(d.artifacts ?? [])
        setEvidence(d.evidence ?? [])
        setNotes(d.notes ?? [])
        setArtifactPreview('')
        setArtifactHtml('')
        setArtifactFrame('')
        setNotePreview('')
        setNoteHtml('')
        setContextText('')
        setGoalDraft(d.ledger?.brief?.goal ?? '')
        setNonGoalsDraft((d.ledger?.brief?.non_goals ?? []).join('\n'))
      } else {
        setLedger(null)
        setArtifacts([])
        setEvidence([])
        setNotes([])
        setGoalDraft('')
        setNonGoalsDraft('')
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
        setArtifactHtml('')
        setArtifactFrame('')
        setNotePreview('')
        setNoteHtml('')
        setContextText('')
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
    if (!selected) return
    const nonGoals = nonGoalsDraft.split('\n').map((s: string) => s.trim()).filter(Boolean)
    try {
      await request(`/brief/${selected}`, { method: 'POST', body: JSON.stringify({ goal: text, non_goals: nonGoals }) })
      await loadDetail(selected)
      setMsg('目标/非目标已保存。')
    } catch (e: any) {
      setMsg('保存目标失败：' + String(e?.message ?? e))
    }
  }

  async function runSearch(): Promise<void> {
    const q = searchQ.trim()
    if (!q) return
    try {
      const src = searchSource || 'openalex,crossref'
      const res = await request(`/search?q=${encodeURIComponent(q)}&source=${encodeURIComponent(src)}&limit=5`)
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

  async function ingestPdf(file: File): Promise<void> {
    if (!selected || !file) return
    setIngesting(true)
    setIngestMsg('')
    try {
      const title = file.name.replace(/\.[^.]+$/, '')
      const res = await fetch(`${API}/ingest/${selected}?title=${encodeURIComponent(title)}`, {
        method: 'POST',
        headers: { 'x-filename': encodeURIComponent(file.name), 'content-type': file.type || 'application/pdf' },
        body: file,
      })
      const d = await res.json()
      setIngestMsg(d.ok ? `已收录《${d.title}》，提取 ${d.chars ?? 0} 字；笔记在 notes/` : ('收录失败：' + (d.error || '')))
      await loadDetail(selected)
    } catch (e: any) {
      setIngestMsg('PDF 上传失败：' + String(e?.message ?? e))
    } finally {
      setIngesting(false)
    }
  }

  async function buildGraph(): Promise<void> {
    const q = graphQ.trim()
    if (!q || !selected) return
    setGraphing(true)
    setGraphResult(null)
    try {
      const res = await fetch(`${API}/graph/${selected}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: q, top_n: 10 }),
      })
      const d = await res.json()
      setGraphResult(d)
      await loadDetail(selected)
    } catch (e: any) {
      setGraphResult({ ok: false, error: String(e?.message ?? e) })
    } finally {
      setGraphing(false)
    }
  }

  async function searchMemorySemantic(): Promise<void> {
    const q = memQuery.trim()
    if (!q || !selected) return
    setMemSearching(true)
    try {
      const res = await fetch(`${API}/memory/${selected}/semantic?q=${encodeURIComponent(q)}&limit=5`)
      const d = await res.json()
      setMemResults(d.results ?? [])
    } catch (e: any) {
      setMemResults([])
      setMsg('语义搜索失败：' + String(e?.message ?? e))
    } finally {
      setMemSearching(false)
    }
  }

  async function loadContext(): Promise<void> {
    if (!selected) return
    setContextLoading(true)
    try {
      const d = await request(`/context/${selected}`)
      setContextText(d.context ?? '')
    } catch (e: any) {
      setMsg('上下文生成失败：' + String(e?.message ?? e))
    } finally {
      setContextLoading(false)
    }
  }

  async function copyContext(): Promise<void> {
    if (!contextText) return
    try {
      await navigator.clipboard.writeText(contextText)
      setMsg('上下文已复制，可直接粘贴给 AI。')
    } catch (e: any) {
      setMsg('复制失败：' + String(e?.message ?? e))
    }
  }

  async function openNote(name: string): Promise<void> {
    if (!selected) return
    try {
      const text = await fetchText(`/note/${selected}/${encodeURIComponent(name)}`)
      setNotePreview(text)
      setNoteHtml(noteToHtml(text, selected))
    } catch (e: any) {
      setMsg('笔记预览失败：' + String(e?.message ?? e))
    }
  }

  async function openArtifact(name: string): Promise<void> {
    const ext = name.split('.').pop()?.toLowerCase() || ''
    setArtifactPreview('')
    setArtifactHtml('')
    setArtifactFrame('')
    if (ext === 'md' || ext === 'markdown') {
      try {
        const text = await fetchText(`/artifact/${selected}/${encodeURIComponent(name)}`)
        setArtifactHtml(markdownToHtml(text, selected, 'artifact'))
      } catch (e: any) {
        setMsg('预览失败：' + String(e?.message ?? e))
      }
      return
    }
    if (ext === 'html' || ext === 'htm') {
      setArtifactFrame(`${API}/artifact/${selected}/${encodeURIComponent(name)}`)
      return
    }
    if (TEXT_EXTS.includes(ext)) {
      try {
        const text = await fetchText(`/artifact/${selected}/${encodeURIComponent(name)}`)
        setArtifactPreview(text)
      } catch (e: any) {
        setMsg('预览失败：' + String(e?.message ?? e))
      }
      return
    }
    // 非文本：PPT 等。优先找同名 HTML 版做面板内预览
    const stem = name.replace(/\.[^.]+$/, '')
    const htmlCandidate = stem + '.html'
    if (artifacts.includes(htmlCandidate)) {
      setArtifactFrame(`${API}/artifact/${selected}/${encodeURIComponent(htmlCandidate)}`)
      setMsg(`“${name}”不支持在线预览，已自动打开同目录 HTML 版：${htmlCandidate}`)
    } else {
      window.open(`${API}/artifact/${selected}/${encodeURIComponent(name)}`, '_blank')
      setMsg('该文件无法在面板内预览，已在新标签页打开/下载。')
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
  const hint = selected ? nextGuide(l) : {
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

  // ── 统一工作台：单页呈现全部能力，不再分“简单/完整” ──
  const fullDetail = !l
    ? Empty({ text: '选一个项目看状态' })
    : createElement('div', { className: 'wb-detail' }, [
        Section({ title: '目标 / 非目标', children: createElement('div', {}, [
          createElement('div', { className: 'wb-row' }, [
            createElement('input', {
              className: 'wb-input',
              placeholder: '想解决什么问题？',
              value: goalDraft,
              onChange: (ev: any) => setGoalDraft(ev.target.value),
            }),
            createElement('button', { className: 'wb-btn primary', onClick: () => void saveGoal() }, ['保存']),
          ]),
          createElement('textarea', {
            className: 'wb-textarea',
            placeholder: '非目标（每行一条，明确“不做”）',
            value: nonGoalsDraft,
            onChange: (ev: any) => setNonGoalsDraft(ev.target.value),
          }),
          createElement('div', { className: 'wb-muted' }, [
            `当前阶段：${l.current_stage || '0 brief'} · 门禁：${gates.filter((g: any) => g.pass).length}/${gates.length}`,
          ]),
        ]) }),
        Section({ title: 'AI 上下文', children: createElement('div', {}, [
          createElement('div', { className: 'wb-row' }, [
            createElement('button', { className: 'wb-btn', onClick: () => void loadContext() }, [contextLoading ? '生成中…' : '生成上下文']),
            createElement('button', { className: 'wb-btn', onClick: () => void copyContext() }, ['复制']),
          ]),
          createElement('textarea', {
            className: 'wb-textarea',
            readOnly: true,
            placeholder: '生成后这里显示可直接给 AI 的续接上下文',
            value: contextText,
            style: { minHeight: '120px' },
          }),
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
        Section({ title: 'PDF 精读', children: createElement('div', {}, [
          createElement('div', { className: 'wb-row' }, [
            createElement('input', {
              type: 'file',
              className: 'wb-input',
              accept: 'application/pdf,.pdf',
              onChange: (ev: any) => {
                const f = ev.target.files?.[0]
                if (f) void ingestPdf(f)
              },
            }),
            createElement('span', { className: 'wb-muted' }, [ingesting ? '处理中…' : '选择 PDF，自动收录并提取正文到 notes/']),
          ]),
          createElement('div', { className: 'wb-muted' }, [ingestMsg]),
          ...(notes.length ? [createElement('div', {}, notes.map((name: string) =>
            createElement('div', { key: name, className: 'wb-list-item wb-artifact-row' }, [
              createElement('span', {}, [name]),
              createElement('button', { className: 'wb-btn', onClick: () => void openNote(name) }, ['看']),
            ]))) ] : []),
          ...(noteHtml
            ? [createElement('div', { className: 'wb-note-html', dangerouslySetInnerHTML: { __html: noteHtml } })]
            : (notePreview ? [createElement('pre', { className: 'wb-preview' }, [notePreview])] : [])),
        ]) }),
        Section({ title: '产物', children: createElement('div', {}, artifacts.length
          ? artifacts.map((name: string) => createElement('div', { key: name, className: 'wb-list-item wb-artifact-row' }, [
              createElement('span', {}, [name]),
              createElement('button', { className: 'wb-btn', onClick: () => void openArtifact(name) }, ['看']),
            ]))
          : Empty({ text: '还没有产物' }) ) }),
        ...(artifactHtml ? [createElement('div', { className: 'wb-md', dangerouslySetInnerHTML: { __html: artifactHtml } })] : []),
        ...(artifactFrame ? [createElement('div', { className: 'wb-artifact-frame-wrap' }, [
          createElement('div', { className: 'wb-artifact-frame-bar' }, [
            createElement('a', { className: 'wb-btn', href: artifactFrame, target: '_blank', rel: 'noopener' }, ['新标签打开']),
          ]),
          createElement('iframe', { className: 'wb-artifact-frame', src: artifactFrame, title: '产物预览' }),
        ])] : []),
        ...(artifactPreview ? [createElement('pre', { className: 'wb-preview' }, [artifactPreview])] : []),
        Section({ title: '论文图谱', children: createElement('div', {}, [
          createElement('div', { className: 'wb-row' }, [
            createElement('input', {
              className: 'wb-input',
              placeholder: 'DOI 或标题，生成引用/共引图谱',
              value: graphQ,
              onChange: (ev: any) => setGraphQ(ev.target.value),
            }),
            createElement('button', { className: 'wb-btn', onClick: () => void buildGraph() }, [graphing ? '生成中…' : '生成图谱']),
          ]),
          ...(graphResult ? [createElement('div', { className: 'wb-muted' }, [
            graphResult.ok
              ? `${graphResult.seed} · 节点 ${graphResult.nodes_count ?? (graphResult.nodes?.length ?? 0)} / 边 ${graphResult.edges_count ?? (graphResult.edges?.length ?? 0)}`
              : `图谱失败：${graphResult.error || '未知错误'}`,
          ])] : []),
          ...(graphResult?.ok && graphResult.nodes?.length ? [GraphSvg({
            nodes: graphResult.nodes,
            edges: graphResult.edges || [],
            project: selected,
            graphFile: graphResult.graph,
          })] : []),
          ...(graphResult?.ok ? (graphResult.nodes || []).slice(0, 30).map((n: any) =>
            createElement('div', { key: n.id, className: 'wb-list-item' }, [`${n.kind}: ${n.title} (${n.year || '?'})`])
          ) : []),
        ]) }),
        Section({ title: '记忆', children: createElement('div', {}, [
          ...(mem.length ? mem.map((m: any) =>
            createElement('div', { key: m.ts + m.text, className: 'wb-list-item' }, [m.text])) : [Empty({ text: '还没有记忆' })]),
          createElement('div', { className: 'wb-row' }, [
            createElement('input', {
              className: 'wb-input',
              placeholder: '语义搜索记忆…',
              value: memQuery,
              onChange: (ev: any) => setMemQuery(ev.target.value),
            }),
            createElement('button', { className: 'wb-btn', onClick: () => void searchMemorySemantic() }, [memSearching ? '搜…' : '语义搜']),
          ]),
          ...(memResults ? memResults.map((m: any) =>
            createElement('div', { key: m.ts + m.text, className: 'wb-list-item' }, [`[${m.score}] ${m.text}`])) : []),
        ]) }),
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

  const stageSteps = [
    ['0 brief', '目标'], ['1 evidence', '证据'], ['2 panel', '专家'], ['3 conflict', '冲突'],
    ['4 adjudicate', '裁决'], ['5 plan', '计划'], ['6 execute', '执行'], ['7 verify', '验证'],
    ['8 log-distill', '沉淀'],
  ] as const
  const currentStage = l?.current_stage ?? '0 brief'
  const workflowStrip = createElement('div', { className: 'wb-workflow' }, stageSteps.map(([id, label]) =>
    createElement('span', { key: id, className: 'wb-workflow-step' + (id === currentStage ? ' active' : '') }, [label])
  ))

  const workbenchContent = createElement('div', { className: 'wb-split' }, [
    createElement('div', { className: 'wb-guide' }, [
      createElement('div', { className: 'wb-guide-step' }, [hint.step]),
      createElement('div', {}, [
        createElement('div', { className: 'wb-guide-title' }, [hint.title]),
        createElement('div', { className: 'wb-guide-text' }, [hint.text]),
      ]),
    ]),
    workflowStrip,
    createElement('div', { className: 'wb-search-row' }, [
      createElement('input', { className: 'wb-input', placeholder: '搜论文 / 输入 DOI', value: searchQ, onChange: (ev: any) => setSearchQ(ev.target.value) }),
      createElement('select', {
        className: 'wb-select',
        value: searchSource,
        onChange: (ev: any) => setSearchSource(ev.target.value),
      }, [
        createElement('option', { value: 'openalex,crossref' }, ['OpenAlex+Crossref']),
        createElement('option', { value: 'openalex,crossref,semantic,europepmc' }, ['综合（OA 增强）']),
        createElement('option', { value: 'semantic' }, ['Semantic Scholar']),
        createElement('option', { value: 'europepmc' }, ['Europe PMC']),
        createElement('option', { value: 'unpaywall' }, ['Unpaywall（DOI）']),
      ]),
      createElement('button', { className: 'wb-btn', onClick: () => void runSearch() }, ['搜']),
    ]),
    createElement('div', { className: 'wb-search-results' }, searchResults
      ? searchResults.map((item: any) => {
          const oa = item.is_oa || item.pdf_url ? 'OA' : '元数据'
          const titleEl = item.url?.startsWith('http')
            ? createElement('a', { href: item.url, target: '_blank', className: 'wb-link' }, [item.title || item.url])
            : createElement('span', {}, [item.title || item.url])
          const pdfEl = item.pdf_url
            ? createElement('a', { href: item.pdf_url, target: '_blank', className: 'wb-link' }, [' PDF↓'])
            : null
          return createElement('div', { key: item.url ?? item.title, className: 'wb-list-item' }, [
            titleEl,
            ` [${item.source} · ${oa}]`,
            pdfEl,
          ])
        })
      : []),
    createElement('div', { className: 'wb-col' }, [
      createElement('div', { className: 'wb-section-title' }, ['项目']),
      createElement('div', { className: 'wb-list' }, projectList.length ? projectList : [Empty({ text: '还没有项目' })]),
      createElement('div', { className: 'wb-row' }, [
        createElement('input', { className: 'wb-input', placeholder: '项目 id', value: newId, onChange: (ev: any) => setNewId(ev.target.value) }),
        createElement('button', { className: 'wb-btn primary', onClick: () => void createProject() }, ['新建']),
      ]),
    ]),
    createElement('div', { className: 'wb-col' }, [fullDetail]),
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
