// Nomes e cursos chegam em CAIXA ALTA do cadastro; em caixa alta o texto
// fica pesado e mais difícil de ler. Siglas curtas (MTEC, AMS) são mantidas.
const PREPOSICOES = new Set(["de", "da", "do", "das", "dos", "e"]);

export function formatarNome(texto: string = "") {
  return texto
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((p, i) => (i > 0 && PREPOSICOES.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}

export function formatarCurso(texto: string = "") {
  return texto
    .split(/\s+/)
    .filter(Boolean)
    .map((p, i) => {
      const min = p.toLowerCase();
      if (i > 0 && PREPOSICOES.has(min)) return min;
      if (/^[A-Z]{2,4}$/.test(p)) return p;
      return min.charAt(0).toUpperCase() + min.slice(1);
    })
    .join(" ");
}

// Máscaras de documento: aceitam o texto com ou sem pontuação e devolvem
// formatado conforme a quantidade de dígitos digitada até agora.
export function mascaraCNPJ(texto: string = "") {
  const d = texto.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function mascaraCPF(texto: string = "") {
  const d = texto.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

// Primeira e última inicial do nome, para o avatar sem foto.
export function iniciaisDoNome(texto: string = "") {
  return texto
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((_, i, partes) => i === 0 || i === partes.length - 1)
    .map((parte) => parte.charAt(0).toUpperCase())
    .join("");
}
