import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { defineTool } from '@deepseek-ai/dsh-tools';
import z from 'schemastery';
const execFileAsync = promisify(execFile);
export const name = '@dsh-external/dsh-workbench-ui';
export const inject = ['tools', 'webServer'];
export const Config = z.object({
    title: z.string().default('工作台'),
});
const WB_SCRIPT = process.env.WB_SCRIPT
    || path.join(os.homedir(), 'work', 'skills', 'expert-decision-consensus', 'tools', 'workbench_cli.py');
const PROJECTS_DIR = process.env.WB_PROJECTS_DIR
    || path.join(os.homedir(), 'work', 'research-workbench', 'projects');
async function runWb(args) {
    return execFileAsync('python3', [WB_SCRIPT, ...args], {
        timeout: 30_000,
        maxBuffer: 1024 * 1024,
    });
}
async function readLedger(id) {
    try {
        const raw = await fs.readFile(path.join(PROJECTS_DIR, id, 'ledger.json'), 'utf8');
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
async function listProjects() {
    let names = [];
    try {
        names = (await fs.readdir(PROJECTS_DIR, { withFileTypes: true }))
            .filter((d) => d.isDirectory())
            .map((d) => d.name)
            .sort();
    }
    catch {
        names = [];
    }
    const out = [];
    for (const id of names) {
        const ledger = await readLedger(id);
        if (!ledger)
            continue;
        const conflicts = ledger.conflicts ?? [];
        const unresolved = conflicts.filter((c) => !c.resolution || c.resolution === 'defer');
        const gates = ledger.gates ?? [];
        out.push({
            id,
            title: ledger.title ?? id,
            stage: ledger.current_stage ?? '0 brief',
            gates_pass: gates.filter((g) => g.pass).length,
            gates_total: gates.length,
            claims: (ledger.claims ?? []).length,
            decisions: (ledger.decisions ?? []).length,
            conflicts: conflicts.length,
            unresolved: unresolved.length,
            updated: ledger.updated ?? '',
        });
    }
    return out;
}
function json(res, status, data) {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
}
async function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', (chunk) => { body += chunk.toString('utf8'); });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            }
            catch (e) {
                reject(e);
            }
        });
        req.on('error', reject);
    });
}
async function readRaw(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (chunk) => { chunks.push(Buffer.from(chunk)); });
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
    });
}
function safeName(name) {
    return path.basename(name);
}
function contentTypeOf(name) {
    const ext = path.extname(name).toLowerCase();
    if (ext === '.md' || ext === '.txt' || ext === '.json' || ext === '.csv' || ext === '.log')
        return 'text/plain; charset=utf-8';
    if (ext === '.html' || ext === '.htm')
        return 'text/html; charset=utf-8';
    if (ext === '.svg')
        return 'image/svg+xml';
    if (ext === '.png')
        return 'image/png';
    if (ext === '.jpg' || ext === '.jpeg')
        return 'image/jpeg';
    if (ext === '.pdf')
        return 'application/pdf';
    if (ext === '.pptx' || ext === '.docx')
        return 'application/octet-stream';
    return 'application/octet-stream';
}
export function apply(ctx, config) {
    ctx.effect(() => ctx.webServer.register({
        kind: 'prefix',
        path: '/@dsh-external/dsh-workbench-ui/api',
        handler: async (req, res) => {
            const url = new URL(req.url ?? '/', 'http://localhost');
            const parts = url.pathname.split('/').filter(Boolean);
            // parts = ['@dsh-external','dsh-workbench-ui','api', ...]
            const action = parts[3] ?? '';
            const id = parts[4] ?? '';
            try {
                if (req.method === 'GET' && action === 'projects') {
                    return json(res, 200, { ok: true, projects: await listProjects() });
                }
                if (req.method === 'GET' && action === 'project' && id) {
                    const ledger = await readLedger(id);
                    if (!ledger)
                        return json(res, 404, { ok: false, error: 'project not found' });
                    let artifacts = [];
                    let evidence = [];
                    let notes = [];
                    try {
                        artifacts = (await fs.readdir(path.join(PROJECTS_DIR, id, 'artifacts'))).sort();
                    }
                    catch { /* no artifacts yet */ }
                    try {
                        evidence = (await fs.readdir(path.join(PROJECTS_DIR, id, 'evidence'))).sort();
                    }
                    catch { /* no evidence yet */ }
                    try {
                        notes = (await fs.readdir(path.join(PROJECTS_DIR, id, 'notes'))).sort();
                    }
                    catch { /* no notes yet */ }
                    return json(res, 200, { ok: true, ledger, artifacts, evidence, notes });
                }
                if (req.method === 'GET' && action === 'search') {
                    const q = url.searchParams.get('q') ?? '';
                    const source = url.searchParams.get('source') ?? 'openalex,crossref,semantic,europepmc';
                    const limit = Number(url.searchParams.get('limit') ?? '5');
                    if (!q)
                        return json(res, 400, { ok: false, error: 'missing q' });
                    const r = await runWb(['search', q, '--source', source, '--limit', String(limit), '--format', 'json']);
                    const results = JSON.parse(r.stdout || '[]');
                    return json(res, 200, { ok: true, results });
                }
                if (req.method === 'GET' && action === 'artifact' && id && parts[5]) {
                    const name = safeName(decodeURIComponent(parts[5]));
                    const file = path.join(PROJECTS_DIR, id, 'artifacts', name);
                    try {
                        const buf = await fs.readFile(file);
                        res.writeHead(200, { 'content-type': contentTypeOf(name), 'content-length': buf.length });
                        res.end(buf);
                    }
                    catch {
                        return json(res, 404, { ok: false, error: 'artifact not found' });
                    }
                    return;
                }
                if (req.method === 'GET' && action === 'note' && id && parts[5]) {
                    const name = safeName(decodeURIComponent(parts[5]));
                    const file = path.join(PROJECTS_DIR, id, 'notes', name);
                    try {
                        const buf = await fs.readFile(file);
                        res.writeHead(200, { 'content-type': contentTypeOf(name), 'content-length': buf.length });
                        res.end(buf);
                    }
                    catch {
                        return json(res, 404, { ok: false, error: 'note not found' });
                    }
                    return;
                }
                if (req.method === 'GET' && action === 'note-asset' && id && parts[5] && parts[6]) {
                    const dir = safeName(decodeURIComponent(parts[5]));
                    const name = safeName(decodeURIComponent(parts[6]));
                    const file = path.join(PROJECTS_DIR, id, 'notes', dir, name);
                    try {
                        const buf = await fs.readFile(file);
                        res.writeHead(200, { 'content-type': contentTypeOf(name), 'content-length': buf.length });
                        res.end(buf);
                    }
                    catch {
                        return json(res, 404, { ok: false, error: 'note asset not found' });
                    }
                    return;
                }
                if (req.method === 'POST' && action === 'project') {
                    const body = await readBody(req);
                    if (!body.id)
                        return json(res, 400, { ok: false, error: 'missing id' });
                    const r = await runWb(['init', body.id, '--title', body.title ?? body.id]);
                    return json(res, 200, { ok: true, output: r.stdout.trim() });
                }
                if (req.method === 'DELETE' && action === 'project' && id) {
                    const deleteId = decodeURIComponent(id);
                    const r = await runWb(['delete', deleteId]);
                    return json(res, 200, { ok: true, output: r.stdout.trim() });
                }
                if (req.method === 'POST' && action === 'brief' && id) {
                    const body = await readBody(req);
                    const args = ['brief', id];
                    if (body.goal)
                        args.push('--goal', body.goal);
                    for (const ng of (body.non_goals ?? []))
                        args.push('--non-goal', ng);
                    const r = await runWb(args);
                    return json(res, 200, { ok: true, output: r.stdout.trim() });
                }
                if (req.method === 'POST' && action === 'memory' && id) {
                    const body = await readBody(req);
                    if (!body.text)
                        return json(res, 400, { ok: false, error: 'missing text' });
                    const r = await runWb(['memory', id, 'add', body.text]);
                    return json(res, 200, { ok: true, output: r.stdout.trim() });
                }
                if (req.method === 'POST' && action === 'todo' && id) {
                    const body = await readBody(req);
                    if (!body.text)
                        return json(res, 400, { ok: false, error: 'missing text' });
                    const r = await runWb(['todo', id, 'add', body.text]);
                    return json(res, 200, { ok: true, output: r.stdout.trim() });
                }
                if (req.method === 'POST' && action === 'claim' && id) {
                    const body = await readBody(req);
                    if (!body.text)
                        return json(res, 400, { ok: false, error: 'missing text' });
                    const args = ['claim', id, body.text];
                    if (body.source)
                        args.push('--source', body.source);
                    if (body.tag)
                        args.push('--tag', body.tag);
                    const r = await runWb(args);
                    return json(res, 200, { ok: true, output: r.stdout.trim() });
                }
                if (req.method === 'POST' && action === 'conflict' && id) {
                    const body = await readBody(req);
                    if (!body.topic || !body.claim_a || !body.claim_b)
                        return json(res, 400, { ok: false, error: 'missing topic/claims' });
                    const r = await runWb(['conflict', id, '--topic', body.topic, '--claim-a', body.claim_a, '--claim-b', body.claim_b]);
                    return json(res, 200, { ok: true, output: r.stdout.trim() });
                }
                if (req.method === 'POST' && action === 'gate' && id) {
                    const body = await readBody(req);
                    const args = ['gate', id, '--stage', body.stage ?? '', '--item', body.item ?? ''];
                    if (body.pass)
                        args.push('--pass-gate');
                    if (body.evidence)
                        args.push('--evidence', body.evidence);
                    const r = await runWb(args);
                    return json(res, 200, { ok: true, output: r.stdout.trim() });
                }
                if (req.method === 'POST' && action === 'ingest' && id) {
                    const name = safeName(decodeURIComponent(String(req.headers['x-filename'] || 'upload.pdf')));
                    const title = decodeURIComponent(String(url.searchParams.get('title') || name.replace(/\.[^/.]+$/, '')));
                    const buf = await readRaw(req);
                    const dir = path.join(PROJECTS_DIR, id, 'evidence');
                    await fs.mkdir(dir, { recursive: true });
                    const file = path.join(dir, name);
                    await fs.writeFile(file, buf);
                    const r = await runWb(['ingest', id, file, '--title', title]);
                    const out = JSON.parse(r.stdout || '{}');
                    return json(res, 200, { ok: true, ...out, output: r.stdout.trim() });
                }
                if (req.method === 'POST' && action === 'graph' && id) {
                    const body = await readBody(req);
                    if (!body.query)
                        return json(res, 400, { ok: false, error: 'missing query' });
                    const r = await runWb(['graph', id, body.query, '--top-n', String(body.top_n || 10)]);
                    const out = JSON.parse(r.stdout || '{}');
                    return json(res, 200, { ok: true, ...out, output: r.stdout.trim() });
                }
                if (req.method === 'GET' && action === 'context' && id) {
                    const r = await runWb(['context', id]);
                    return json(res, 200, { ok: true, context: r.stdout });
                }
                if (req.method === 'GET' && action === 'memory' && id && parts[5] === 'semantic') {
                    const q = url.searchParams.get('q') ?? '';
                    const limit = Number(url.searchParams.get('limit') ?? '5');
                    if (!q)
                        return json(res, 400, { ok: false, error: 'missing q' });
                    const r = await runWb(['memory', id, 'semantic', q, '--limit', String(limit), '--format', 'json']);
                    const results = JSON.parse(r.stdout || '[]');
                    return json(res, 200, { ok: true, results });
                }
                return json(res, 404, { ok: false, error: 'unknown api' });
            }
            catch (e) {
                return json(res, 500, { ok: false, error: String(e?.message ?? e) });
            }
        },
    }), '@dsh-external/dsh-workbench-ui: api');
    ctx.effect(() => ctx.tools.register(defineTool({
        name: '_dsh_external_dsh_workbench_ui_status',
        description: '查看科研工作台面板后端状态与项目数',
        parameters: {},
        output: {
            schema: { type: 'string' },
            render: (_args, value) => [{ type: 'text', text: String(value) }],
        },
        async execute() {
            const projects = await listProjects();
            return JSON.stringify({ title: config.title, projects: projects.length });
        },
    })), '@dsh-external/dsh-workbench-ui: status tool');
}
//# sourceMappingURL=index.js.map