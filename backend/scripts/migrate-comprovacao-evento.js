// Script de migração único: adiciona em public.inscricao as colunas usadas
// pelo fluxo de comprovação de participação em eventos (envio pelo aluno,
// validação pela coordenação e extensão de prazo por inscrição).
// Rode uma vez com:
//   node scripts/migrate-comprovacao-evento.js
//
// Não altera inscrições existentes: as que já estavam como 'PRESENTE'
// continuam contando horas normalmente.
require("dotenv/config");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Mesmo ajuste de src/db.ts e dos demais scripts de migração (pooler do
  // Supabase usa certificado autoassinado na cadeia).
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await pool.query(`
    ALTER TABLE public.inscricao
      ADD COLUMN IF NOT EXISTS comprovacao_status VARCHAR(20),
      ADD COLUMN IF NOT EXISTS comprovacao_texto TEXT,
      ADD COLUMN IF NOT EXISTS comprovacao_nome_arquivo VARCHAR(255),
      ADD COLUMN IF NOT EXISTS comprovacao_mime_type VARCHAR(120),
      ADD COLUMN IF NOT EXISTS comprovacao_storage_path TEXT,
      ADD COLUMN IF NOT EXISTS comprovacao_url TEXT,
      ADD COLUMN IF NOT EXISTS comprovacao_enviada_em TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS comprovacao_motivo_reprovacao TEXT,
      ADD COLUMN IF NOT EXISTS comprovacao_validada_em TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS comprovacao_validada_por INTEGER REFERENCES public.coordenacao(id_coordenacao),
      ADD COLUMN IF NOT EXISTS prazo_estendido_ate DATE,
      ADD COLUMN IF NOT EXISTS prazo_motivo TEXT,
      ADD COLUMN IF NOT EXISTS prazo_estendido_em TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS prazo_estendido_por INTEGER REFERENCES public.coordenacao(id_coordenacao),
      -- Mensagem do aluno pedindo reabertura do prazo (PENDENTE, ATENDIDO
      -- ou RECUSADO) e a resposta da coordenação quando recusa.
      ADD COLUMN IF NOT EXISTS pedido_prazo_status VARCHAR(20),
      ADD COLUMN IF NOT EXISTS pedido_prazo_mensagem TEXT,
      ADD COLUMN IF NOT EXISTS pedido_prazo_em TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS pedido_prazo_resposta TEXT;
  `);

  // Datas/horas com fuso (como criado_em/atualizado_em da tabela), para o
  // horário de envio não aparecer deslocado. Só converte colunas que uma
  // versão anterior deste script criou sem fuso (valores lidos como UTC);
  // rodar de novo não altera nada.
  const semFuso = await pool.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'inscricao'
      AND data_type = 'timestamp without time zone'
      AND column_name IN ('comprovacao_enviada_em', 'comprovacao_validada_em', 'prazo_estendido_em')
  `);

  for (const { column_name: coluna } of semFuso.rows) {
    await pool.query(`
      ALTER TABLE public.inscricao
        ALTER COLUMN ${coluna} TYPE TIMESTAMPTZ USING ${coluna} AT TIME ZONE 'UTC';
    `);
  }

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_inscricao_comprovacao_status
      ON public.inscricao(comprovacao_status);
  `);

  console.log("Colunas de comprovação de evento prontas em public.inscricao.");
  await pool.end();
}

main().catch((error) => {
  console.error("Erro ao migrar comprovação de eventos:", error);
  process.exit(1);
});
