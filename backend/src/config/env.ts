// Valida as variáveis de ambiente obrigatórias na inicialização do servidor.
// Se alguma faltar, a aplicação falha imediatamente (fail-fast) em vez de
// rodar com valores padrão inseguros (ex.: segredo de JWT previsível).
import dotenv from "dotenv";

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Variável de ambiente obrigatória ausente: ${name}. Configure o arquivo .env antes de iniciar o servidor.`
    );
  }
  return value;
}

export const JWT_SECRET = required("JWT_SECRET");
export const DATABASE_URL = required("DATABASE_URL");
export const SUPABASE_URL = required("SUPABASE_URL");
export const SUPABASE_SERVICE_ROLE_KEY = required("SUPABASE_SERVICE_ROLE_KEY");
// Senha provisória das contas de aluno criadas pela coordenação (ver
// utils/authDefaults.ts). Fica no .env para não ser publicada com o código.
export const SENHA_PADRAO_PRIMEIRO_ACESSO = required("SENHA_PADRAO_PRIMEIRO_ACESSO");
// O navegador envia a origem sem barra no fim ("http://localhost:5173"), e o
// CORS compara texto exato: uma barra final ou espaço no .env bloqueia todas
// as requisições. Por isso o valor é normalizado. Aceita várias origens
// separadas por vírgula (ex.: "http://localhost:5173,https://meusite.com").
const ORIGEM_PADRAO = "http://localhost:5173";
const origens = (process.env.FRONTEND_URL || ORIGEM_PADRAO)
  .split(",")
  .map((o) => o.trim().replace(/\/+$/, ""))
  .filter(Boolean);

if (origens.length === 0) {
  // Ex.: FRONTEND_URL=" , ". Uma lista vazia bloquearia todas as origens
  // sem aviso; melhor cair no padrão e avisar no log.
  console.warn(`FRONTEND_URL sem nenhuma origem válida; usando ${ORIGEM_PADRAO}.`);
  origens.push(ORIGEM_PADRAO);
}

export const FRONTEND_URL: string | string[] = origens.length === 1 ? origens[0] : origens;
export const PORT = process.env.PORT || 3000;
