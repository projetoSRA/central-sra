import { useEffect, useState } from "react";

export type Tema = "light" | "dark";

const CHAVE = "tema";

function temaAtual(): Tema {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function aplicarTema(tema: Tema) {
  document.documentElement.setAttribute("data-theme", tema);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", tema === "dark" ? "#000000" : "#f2f2f2");
  try {
    localStorage.setItem(CHAVE, tema);
  } catch {
    // Sem acesso ao armazenamento (aba anônima etc.): o modo vale só nesta visita.
  }
  window.dispatchEvent(new CustomEvent("tema-alterado", { detail: tema }));
}

/**
 * Modo claro/escuro do sistema. O valor inicial já foi aplicado no
 * <html> pelo script de index.html; aqui só lemos e trocamos.
 */
export function useTema() {
  const [tema, setTema] = useState<Tema>(temaAtual);

  useEffect(() => {
    const sincronizar = () => setTema(temaAtual());
    window.addEventListener("tema-alterado", sincronizar);
    return () => window.removeEventListener("tema-alterado", sincronizar);
  }, []);

  /**
   * Troca o modo. Quando o navegador permite, a troca se espalha em
   * círculo a partir do botão clicado (View Transitions); sem suporte,
   * ou com animações reduzidas, a troca é imediata.
   */
  const alternar = (origem?: { x: number; y: number }) => {
    const proximo: Tema = temaAtual() === "dark" ? "light" : "dark";
    const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => { ready: Promise<void> };
    };

    if (!doc.startViewTransition || reduzido || !origem) {
      aplicarTema(proximo);
      return;
    }

    const raio = Math.hypot(
      Math.max(origem.x, window.innerWidth - origem.x),
      Math.max(origem.y, window.innerHeight - origem.y)
    );

    const transicao = doc.startViewTransition(() => aplicarTema(proximo));
    transicao.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${origem.x}px ${origem.y}px)`,
            `circle(${raio}px at ${origem.x}px ${origem.y}px)`,
          ],
        },
        {
          duration: 520,
          easing: "cubic-bezier(0.65, 0, 0.35, 1)",
          pseudoElement: "::view-transition-new(root)",
        }
      );
    });
  };

  return { tema, alternar };
}
