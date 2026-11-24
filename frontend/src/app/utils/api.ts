// Helper central para chamadas à API do backend.
//
// Antes desta mudança, o token JWT devolvido pelo login era descartado
// (só o objeto "user" era salvo no localStorage) e nenhuma chamada
// enviava o header Authorization — o que combinado com a ausência de
// verificação de token no backend deixava toda a API pública (achado
// crítico C1 do relatório de pentest). Agora o token é salvo e anexado
// automaticamente em toda chamada feita via apiFetch.
export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export function getToken(): string | null {
  try {
    return localStorage.getItem("token");
  } catch {
    return null;
  }
}

export function saveSession(user: unknown, token: string) {
  localStorage.setItem("user", JSON.stringify(user));
  localStorage.setItem("token", token);
}

export function clearSession() {
  try {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
  } catch {
    // Sem acesso ao armazenamento: não há sessão para limpar.
  }
}

/** Parâmetro da tela de login que avisa que a sessão expirou. */
export const PARAM_SESSAO_EXPIRADA = "sessao=expirada";

/**
 * Wrapper sobre o fetch nativo que anexa automaticamente o header
 * "Authorization: Bearer <token>" quando existe uma sessão salva.
 * Use no lugar de fetch() para todas as chamadas à API do backend.
 */
export async function apiFetch(
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(input, { ...init, headers });

  if (response.status === 401 && token) {
    // Token expirado ou inválido: limpa a sessão e volta para o login,
    // em vez de deixar a pessoa numa tela com dados vazios.
    clearSession();
    if (window.location.pathname !== "/") {
      window.location.assign(`/?${PARAM_SESSAO_EXPIRADA}`);
    }
  }

  return response;
}

/**
 * Lê o corpo JSON de uma resposta sem quebrar quando o servidor devolve
 * outra coisa (uma página HTML de erro, um proxy fora do ar...).
 *
 * - Resposta de erro sem JSON: devolve { message } com o código HTTP,
 *   para o chamador mostrar a mensagem como faz com qualquer erro.
 * - Resposta de sucesso sem JSON: lança um Error com mensagem legível,
 *   já que o chamador esperava dados.
 */
// O retorno é `any` de propósito: cada tela conhece o formato da sua rota.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function lerJson(response: Response): Promise<any> {
  const texto = await response.text();
  if (!texto) return response.ok ? null : { message: mensagemHttp(response.status) };

  try {
    return JSON.parse(texto);
  } catch {
    if (response.ok) {
      throw new Error("O servidor enviou uma resposta inesperada. Tente de novo em instantes.");
    }
    return { message: mensagemHttp(response.status) };
  }
}

function mensagemHttp(status: number) {
  if (status === 404) return "Recurso não encontrado no servidor. O backend pode estar desatualizado.";
  if (status >= 500) return "O servidor encontrou um erro. Tente de novo em instantes.";
  return `O servidor recusou a requisição (erro ${status}).`;
}

/** Mensagem legível de qualquer erro capturado em um catch. */
export function mensagemDeErro(error: unknown, padrao = "Algo deu errado. Tente de novo.") {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return padrao;
}
