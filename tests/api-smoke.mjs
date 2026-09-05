import { apply } from '../lib/index.js'

const handlers = []
const ctx = {
  effect(fn) { fn(); return () => {} },
  webServer: { register(reg) { handlers.push(reg) } },
  tools: { register() {} },
}
apply(ctx, { title: '工作台' })

const handler = handlers[0].handler

function fakeRes() {
  const res = { status: 0, body: '', writeHead(s, h) { this.status = s; this.headers = h }, end(b) { this.body = b } }
  return res
}

async function call(method, url) {
  const res = fakeRes()
  await handler({ method, url }, res)
  return res
}

const r1 = await call('GET', '/@dsh-external/dsh-workbench-ui/api/projects')
const d1 = JSON.parse(r1.body)
console.log('projects:', r1.status, d1.ok, d1.projects?.length ?? 'n/a')

const r2 = await call('GET', '/@dsh-external/dsh-workbench-ui/api/search?q=attention&source=crossref&limit=2')
const d2 = JSON.parse(r2.body)
console.log('search:', r2.status, d2.ok, Array.isArray(d2.results) ? d2.results.length : d2.error)

const r3 = await call('GET', '/@dsh-external/dsh-workbench-ui/api/nope')
console.log('unknown:', r3.status)
