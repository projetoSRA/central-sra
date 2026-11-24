import type { User } from "./auth";
import { clearSession, getToken } from "./api";

type Navegar = (para: string) => void;

/**
 * Lê o usuário salvo no navegador. Devolve null se não houver sessão ou
 * se o valor estiver corrompido (editado à mão, extensão etc.), em vez de
 * deixar o JSON.parse derrubar a página.
 */
export function lerUsuarioSalvo(): User | null {
  try {
    const bruto = localStorage.getItem("user");
    if (!bruto || !getToken()) return null;
    const usuario = JSON.parse(bruto);
    if (!usuario || typeof usuario !== "object" || typeof usuario.type !== "string") return null;
    return usuario as User;
  } catch {
    return null;
  }
}

/**
 * Proteção das telas: confere se há sessão do tipo esperado e devolve o
 * usuário, ou redireciona e devolve null. Usada no início do useEffect de
 * cada página, no lugar da checagem que era repetida em todas.
 *
 * Aluno que ainda precisa trocar a senha provisória vai para
 * /primeiro-acesso. (O backend também precisa barrar isso; ver revisão.)
 */
export function exigirSessao(navegar: Navegar, tipo: User["type"]): User | null {
  const usuario = lerUsuarioSalvo();

  if (!usuario) {
    clearSession();
    navegar("/");
    return null;
  }

  if (usuario.type !== tipo) {
    navegar("/");
    return null;
  }

  if (tipo === "aluno" && usuario.precisaTrocarSenha) {
    navegar("/primeiro-acesso");
    return null;
  }

  return usuario;
}
