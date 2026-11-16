const assert = require('node:assert/strict');
const path = require('node:path');
let calls = [];
let rows = [{ local: 'AMD', data: '30/09/2026', total_alunos: 31, horas_min: 4, horas_max: 4 }];
function mock(file, exports) {
  const id = require.resolve(path.resolve('dist', file));
  require.cache[id] = { id, filename: id, loaded: true, exports };
}
mock('db.js', { db: { query: async (sql, params) => {
  calls.push({ sql, params });
  return { rows, rowCount: rows.length };
} } });
const next = (_req, _res, next) => next();
mock('middleware/auth.js', { requireAuth: next, requireRole: () => next });
const router = require(path.resolve('dist/routes/chatbot.routes.js')).default;
const handler = router.stack.find(l => l.route?.path === '/mensagem').route.stack.at(-1).handle;
const { contextoVisita } = require(path.resolve('dist/utils/chatbotVisitas.js'));
const pergunta = 'quantos alunos participaram da visita a AMD';
const history = [{ autor: 'coordenacao', texto: pergunta }];
async function request(mensagem, historico = []) {
  calls = [];
  const res = { statusCode: 200, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } };
  await handler({ body: { mensagem, historico }, auth: { id_coordenacao: 1 } }, res);
  assert.equal(res.statusCode, 200);
  return res.body.resposta;
}
(async () => {
  assert.match(await request(pergunta), /31 aluno/);
  assert.equal(calls[0].params[0], 'amd');
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /COUNT\(DISTINCT v.id_aluno\)/);
  assert.match(await request('E quantas horas?', history), /4h por aluno/);
  assert.equal(calls[0].params[0], 'amd');
  assert.equal(contextoVisita('E quantos?', [...history, { autor: 'coordenacao', texto: 'E quantas horas?' }]), pergunta);
  assert.equal(contextoVisita('Quantos alunos cadastrados?', history), null);
  assert.equal(contextoVisita('E quantas horas Pedro tem?', history), null);
  assert.equal(contextoVisita('Quantos?', [...history, { autor: 'coordenacao', texto: 'Quais os próximos eventos?' }]), null);
  assert.match(await request('Quantos alunos na visita a AMD em 30/09/2026?'), /31 aluno/);
  assert.equal(calls[0].params[1], '2026-09-30');
  assert.match(await request('Visita a AMD em 31/02/2026'), /data válida/);
  assert.equal(calls.length, 0);
  rows = [];
  assert.match(await request(pergunta), /Não encontrei visitas/);
  rows = [{ local: 'AMD', data: '30/09/2026', total_alunos: 31 }, { local: 'AMD', data: '01/09/2026', total_alunos: 20 }];
  assert.match(await request(pergunta), /Informe o local e a data/);
  console.log('Contextos: visita específica, continuidade, mudança de assunto, data, ausência e ambiguidade verificados.');
})().catch(e => { console.error(e); process.exitCode = 1; });
