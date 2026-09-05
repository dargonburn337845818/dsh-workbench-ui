/**
 * @dsh-external/dsh-workbench-ui — host 侧：web API + 一个只读工具。
 * 面板数据直接读 research-workbench/projects/<id>/ledger.json；
 * 写操作调用 wb CLI（python3 tools/workbench_cli.py）。
 */
import type { Context } from 'cordis'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs/promises'
import path from 'node:path'
import { defineTool } from '@deepseek-ai/dsh-tools'
import z from 'schemastery'

const execFileAsync = promisify(execFile)

export const name = '@dsh-external/dsh-workbench-ui'
export const inject = ['tools', 'webServer']

export interface Config {
  title: string
}

export const Config = z.object({
  title: z.string().default('工作台'),
})

const WB_SCRIPT = process.env.WB_SCRIPT
  || '$HOME/work/skills/expert-decision-consensus/tools/workbench_cli.py'
const PROJECTS_DIR = process.env.WB_PROJECTS_DIR
  || '$HOME/work/research-workbench/projects'

async function runWb(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync('python3', [WB_SCRIPT, ...args], {
    timeout: 30_000,
    maxBuffer: 1024 * 1024,
  })
}

async function readLedger(id: string): Promise<any | null> {
  try {
    const raw = await fs.readFile(path.join(PROJECTS_DIR, id, 'ledger.json'), 'utf8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

async function listProjects(): Promise<any[]> {
  let names: string[] = []
  try {
    names = (await fs.readdir(PROJECTS_DIR, { withFileTypes: true }))
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()
  } catch {
    names = []
  }
  const out: any[] = []
  for (const id of names) {
    const ledger = await readLedger(id)
    if (!ledger) continue
    const conflicts = ledger.conflicts ?? []
    const unresolved = conflicts.filter((c: any) => !c.resolution || c.resolution === 'defer')
    const gates = ledger.gates ?? []
    out.push({
      id,
      title: ledger.title ?? id,
      stage: ledger.current_stage ?? '0 brief',
      gates_pass: gates.filter((g: any) => g.pass).length,
      gates_total: gates.length,
      claims: (ledger.claims ?? []).length,
      decisions: (ledger.decisions ?? []).length,
      conflicts: conflicts.length,
      unresolved: unresolved.length,
      updated: ledger.updated ?? '',
    })
  }
  return out
}

function json(res: any, status: number, data: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(data))
}

async function readBody(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk: Buffer) => { body += chunk.toString('utf8') })
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

function safeName(name: string): string {
  return path.basename(name)
}

function contentTypeOf(name: string): string {
  const ext = path.extname(name).toLowerCase()
  if (ext === '.md' || ext === '.txt' || ext === '.json' || ext === '.csv' || ext === '.log') return 'text/plain; charset=utf-8'
  if (ext === '.html' || ext === '.htm') return 'text/html; charset=utf-8'
  if (ext === '.svg') return 'image/svg+xml'
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.pdf') return 'application/pdf'
  if (ext === '.pptx' || ext === '.docx') return 'application/octet-stream'
  return 'application/octet-stream'
}

export function apply(ctx: any, config: Config): void {
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/@dsh-external/dsh-workbench-ui/api',
    handler: async (req: any, res: any) => {
      const url = new URL(req.url ?? '/', 'http://localhost')
      const parts = url.pathname.split('/').filter(Boolean)
      // parts = ['@dsh-external','dsh-workbench-ui','api', ...]
      const action = parts[3] ?? ''
      const id = parts[4] ?? ''

      try {
        if (req.method === 'GET' && action === 'projects') {
          return json(res, 200, { ok: true, projects: await listProjects() })
        }
        if (req.method === 'GET' && action === 'project' && id) {
          const ledger = await readLedger(id)
          if (!ledger) return json(res, 404, { ok: false, error: 'project not found' })
          let artifacts: string[] = []
          let evidence: string[] = []
          try {
            artifacts = (await fs.readdir(path.join(PROJECTS_DIR, id, 'artifacts'))).sort()
          } catch { /* no artifacts yet */ }
          try {
            evidence = (await fs.readdir(path.join(PROJECTS_DIR, id, 'evidence'))).sort()
          } catch { /* no evidence yet */ }
          return json(res, 200, { ok: true, ledger, artifacts, evidence })
        }
        if (req.method === 'GET' && action === 'search') {
          const q = url.searchParams.get('q') ?? ''
          const source = url.searchParams.get('source') ?? 'openalex,crossref'
          const limit = Number(url.searchParams.get('limit') ?? '5')
          if (!q) return json(res, 400, { ok: false, error: 'missing q' })
          const r = await runWb(['search', q, '--source', source, '--limit', String(limit), '--format', 'json'])
          const results = JSON.parse(r.stdout || '[]')
          return json(res, 200, { ok: true, results })
        }
        if (req.method === 'GET' && action === 'artifact' && id && parts[5]) {
          const name = safeName(parts[5])
          const file = path.join(PROJECTS_DIR, id, 'artifacts', name)
          try {
            const buf = await fs.readFile(file)
            res.writeHead(200, { 'content-type': contentTypeOf(name), 'content-length': buf.length })
            res.end(buf)
          } catch {
            return json(res, 404, { ok: false, error: 'artifact not found' })
          }
          return
        }
        if (req.method === 'POST' && action === 'project') {
          const body = await readBody(req)
          if (!body.id) return json(res, 400, { ok: false, error: 'missing id' })
          const r = await runWb(['init', body.id, '--title', body.title ?? body.id])
          return json(res, 200, { ok: true, output: r.stdout.trim() })
        }
        if (req.method === 'POST' && action === 'brief' && id) {
          const body = await readBody(req)
          const args: string[] = ['brief', id]
          if (body.goal) args.push('--goal', body.goal)
          for (const ng of (body.non_goals ?? [])) args.push('--non-goal', ng)
          const r = await runWb(args)
          return json(res, 200, { ok: true, output: r.stdout.trim() })
        }
        if (req.method === 'POST' && action === 'memory' && id) {
          const body = await readBody(req)
          if (!body.text) return json(res, 400, { ok: false, error: 'missing text' })
          const r = await runWb(['memory', id, 'add', body.text])
          return json(res, 200, { ok: true, output: r.stdout.trim() })
        }
        if (req.method === 'POST' && action === 'todo' && id) {
          const body = await readBody(req)
          if (!body.text) return json(res, 400, { ok: false, error: 'missing text' })
          const r = await runWb(['todo', id, 'add', body.text])
          return json(res, 200, { ok: true, output: r.stdout.trim() })
        }
        if (req.method === 'POST' && action === 'claim' && id) {
          const body = await readBody(req)
          if (!body.text) return json(res, 400, { ok: false, error: 'missing text' })
          const args: string[] = ['claim', id, body.text]
          if (body.source) args.push('--source', body.source)
          if (body.tag) args.push('--tag', body.tag)
          const r = await runWb(args)
          return json(res, 200, { ok: true, output: r.stdout.trim() })
        }
        if (req.method === 'POST' && action === 'conflict' && id) {
          const body = await readBody(req)
          if (!body.topic || !body.claim_a || !body.claim_b) return json(res, 400, { ok: false, error: 'missing topic/claims' })
          const r = await runWb(['conflict', id, '--topic', body.topic, '--claim-a', body.claim_a, '--claim-b', body.claim_b])
          return json(res, 200, { ok: true, output: r.stdout.trim() })
        }
        if (req.method === 'POST' && action === 'gate' && id) {
          const body = await readBody(req)
          const args: string[] = ['gate', id, '--stage', body.stage ?? '', '--item', body.item ?? '']
          if (body.pass) args.push('--pass-gate')
          if (body.evidence) args.push('--evidence', body.evidence)
          const r = await runWb(args)
          return json(res, 200, { ok: true, output: r.stdout.trim() })
        }
        return json(res, 404, { ok: false, error: 'unknown api' })
      } catch (e: any) {
        return json(res, 500, { ok: false, error: String(e?.message ?? e) })
      }
    },
  }), '@dsh-external/dsh-workbench-ui: api')

  ctx.effect(() => ctx.tools.register(defineTool({
    name: '_dsh_external_dsh_workbench_ui_status',
    description: '查看科研工作台面板后端状态与项目数',
    parameters: {},
    output: {
      schema: { type: 'string' },
      render: (_args: unknown, value: unknown) => [{ type: 'text', text: String(value) }],
    },
    async execute() {
      const projects = await listProjects()
      return JSON.stringify({ title: config.title, projects: projects.length })
    },
  })), '@dsh-external/dsh-workbench-ui: status tool')
}
