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
export const FRONTEND_URL =process.env.FRONTEND_URL || "http://localhost:5173";
export const PORT = process.env.PORT || 3000;
