// Execute após o build: node tests/visita-turma.cjs (sem conexão com o banco).
const assert = require('node:assert/strict');
const path = require('node:path');
let calls = [];
let result = { rows: [], rowCount: 0 };
const mock = (file, exports) => {
  const id = require.resolve(path.resolve('dist', file));
  require.cache[id] = { id, filename: id, loaded: true, exports };
};
mock('db.js', { db: { query: async (sql, params) => {
  calls.push({ sql, params });
  return result;
} } });
const next = (_req, _res, next) => next();
mock('middleware/auth.js', {
  requireAuth: next, requireRole: () => next,
  requireSelfAlunoOrCoordenacao: () => next,
});
const router = require(path.resolve('dist/routes/visita.routes.js')).default;
const handler = router.stack.find(layer => layer.route?.methods.post).route.stack.at(-1).handle;
const turma = { curso: 'ADS', serie_semestre: '1º ADS', nivel_ensino: 'FACULDADE' };
const valid = { turma, local: 'Empresa', quantidadeHoras: 2, dataVisita: '2026-09-30', bimestre: 3,
  empresaParceiraNome: ' Empresa parceira ', empresaParceiraRepresentante: ' Responsável ' };
async function request(body) {
  calls = [];
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ body, auth: { id_coordenacao: 7 } }, res);
  return res;
}
(async () => {
  for (const body of [
    { ...valid, empresaParceiraNome: '' },
    { ...valid, empresaParceiraRepresentante: 123 },
    { ...valid, turma: undefined, idAluno: 1 },
    { ...valid, turma: { ...turma, serie_semestre: '' } },
    { ...valid, quantidadeHoras: Infinity },
    { ...valid, quantidadeHoras: 0 },
    { ...valid, bimestre: 5 },
  ]) {
    assert.equal((await request(body)).statusCode, 400);
    assert.equal(calls.length, 0);
  }
  assert.equal((await request(valid)).statusCode, 404);
  result = { rows: [{ id_visita: 1, id_aluno: 10 }, { id_visita: 2, id_aluno: 11 }], rowCount: 2 };
  const res = await request(valid);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.totalAlunos, 2);
  assert.deepEqual(res.body.visitas, result.rows);
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /INSERT INTO public.visita/);
  assert.match(calls[0].sql, /a.curso = \$7 AND a.serie_semestre = \$8/);
  assert.match(calls[0].sql, /a.nivel_ensino IS NOT DISTINCT FROM \$9/);
  assert.deepEqual(calls[0].params.slice(6), ['ADS', '1º ADS', 'FACULDADE', 'Empresa parceira', 'Responsável']);
  assert.match(calls[0].sql, /UPDATE public.aluno/);
  assert.match(calls[0].sql, /FROM turma_atualizada a/);
  assert.equal((await request({ ...valid, turma: { ...turma, nivel_ensino: null } })).statusCode, 201);
  assert.equal(calls[0].params[8], null);
  console.log('Visitas por turma: validação, turma vazia, lote e filtros verificados.');
})().catch(error => { console.error(error); process.exitCode = 1; });
