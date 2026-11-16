import { db } from "../db";

type Historico = { autor: "coordenacao" | "bot"; texto: string }[];
const normalizar = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export const mencionaVisita = (texto: string) => /\bvisitas?\b/.test(normalizar(texto));

function destino(texto: string): string {
  return normalizar(texto)
    .replace(/\b\d{2}\/\d{2}\/\d{4}\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(p => p && !new Set([
      "quantos", "quantas", "quais", "qual", "quem", "quando", "onde", "quanto",
      "alunos", "alunas", "aluno", "aluna", "estudantes", "participaram", "participou",
      "participantes", "participacao", "presentes", "presenca", "foram", "foi", "ira", "irao",
      "visita", "visitas", "tecnica", "tecnicas", "empresa", "parceira", "registrados", "registradas",
      "agendada", "agendadas", "agendados", "agendamento", "proxima", "proximas", "ultima", "ultimas",
      "nomes", "nome", "liste", "listar", "lista", "mostre", "mostrar", "me", "diga", "fale",
      "horas", "hora", "carga", "horaria", "data", "dia", "total", "tem", "teve", "sao", "estao",
      "essa", "esse", "dessa", "desse", "nela", "dela", "eles", "delas", "dessas", "essas",
      "e", "a", "o", "as", "os", "de", "da", "do", "das", "dos", "na", "no", "nas", "nos",
      "em", "ao", "para", "por", "favor", "sobre", "com", "que", "eu", "quero", "saber",
    ]).has(p))
    .join(" ");
}

// Só retoma o tópico imediatamente anterior: não ressuscita visitas antigas após mudar de assunto.
export function contextoVisita(texto: string, historico: Historico): string | null {
  const mensagens = historico.filter(m => m.autor === "coordenacao").slice(-6);
  const ultima = mensagens.at(-1)?.texto;
  const anterior = ultima ? contextoVisita(ultima, mensagens.slice(0, -1)) : null;
  if (mencionaVisita(texto)) {
    if (destino(texto)) return texto;
    if (/\b(essa|dessa|nela|dela)\b/.test(normalizar(texto)) && anterior && mencionaVisita(anterior)) return anterior;
    return texto;
  }
  if (anterior && mencionaVisita(anterior)
    && /^(e\s+)?(quantos( alunos| estudantes)?( participaram| foram)?|quantas horas|quais( alunos| nomes| estudantes)?|quem( participou| foi)?|quando( foi| sera)?|qual a data|qual a carga horaria|mostre os nomes|liste os nomes)[?!.\s]*$/.test(normalizar(texto))
    && !/\b(eventos?|certificados?|relatorios?|meta|pendentes?|rm|ra|cadastrados?|validacoes)\b/.test(normalizar(texto))) {
    return anterior;
  }
  return null;
}

export async function responderVisitas(pergunta: string, contexto: string) {
  const termo = destino(contexto);
  const data = (pergunta.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/) || contexto.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/));
  const dataISO = data ? `${data[3]}-${data[2]}-${data[1]}` : null;
  if (dataISO && (Number.isNaN(Date.parse(dataISO)) || new Date(dataISO).toISOString().slice(0, 10) !== dataISO)) {
    return { resposta: "Informe uma data válida no formato DD/MM/AAAA.", sugestoes: [] };
  }
  const futuras = /\b(proxima|proximas|futuras)\b/.test(normalizar(pergunta));
  const result = await db.query(`
    SELECT v.local, TO_CHAR(v.data_visita, 'DD/MM/YYYY') AS data,
      COUNT(DISTINCT v.id_aluno)::int AS total_alunos,
      MIN(v.quantidade_horas) AS horas_min, MAX(v.quantidade_horas) AS horas_max
    FROM public.visita v
    WHERE ($1 = '' OR POSITION(unaccent(lower($1)) IN unaccent(lower(v.local))) > 0)
      AND ($2::date IS NULL OR v.data_visita = $2::date)
      AND (NOT $3::boolean OR v.data_visita >= CURRENT_DATE)
    GROUP BY v.local, v.data_visita
    ORDER BY v.data_visita DESC, v.local
    LIMIT 21
  `, [termo, dataISO, futuras]);
  const sugestoes = ["Quais visitas técnicas estão registradas?", "Quais as próximas visitas técnicas?"];
  if (!result.rows.length) return {
    resposta: `Não encontrei visitas técnicas${termo ? ` para "${termo}"` : ""}${data ? ` em ${data[0]}` : ""}${futuras ? " futuras" : ""}. A busca usa o local registrado no agendamento.`, sugestoes,
  };
  if (result.rows.length > 1) return {
    resposta: `Encontrei estas visitas. Informe o local e a data para consultar uma delas:\n${result.rows.slice(0, 20).map(v => `• ${v.local} — ${v.data}: ${v.total_alunos} aluno(s) registrado(s)`).join("\n")}${result.rows.length > 20 ? "\nHá mais resultados; especifique o local." : ""}`,
    sugestoes: result.rows.slice(0, 3).map(v => `Quantos alunos na visita a ${v.local} em ${v.data}?`),
  };
  const visita = result.rows[0];
  if (/\b(quem|nomes|quais alunos|quais alunas|quais estudantes)\b/.test(normalizar(pergunta))) {
    const alunos = await db.query(`
      SELECT DISTINCT a.id_aluno, a.nome
      FROM public.visita v JOIN public.aluno a ON a.id_aluno = v.id_aluno
      WHERE v.local = $1 AND TO_CHAR(v.data_visita, 'DD/MM/YYYY') = $2
      ORDER BY a.nome, a.id_aluno LIMIT 51
    `, [visita.local, visita.data]);
    return {
      resposta: `Alunos registrados na visita a ${visita.local}, em ${visita.data}:\n${alunos.rows.slice(0, 50).map(a => `• ${a.nome}`).join("\n")}${alunos.rows.length > 50 ? "\nExibindo os primeiros 50 alunos." : ""}\nO registro por turma não confirma presença individual.`, sugestoes,
    };
  }
  const horas = Number(visita.horas_min) === Number(visita.horas_max)
    ? `${Number(visita.horas_min)}h por aluno` : `${Number(visita.horas_min)}h a ${Number(visita.horas_max)}h por aluno`;
  return {
    resposta: `A visita a ${visita.local}, em ${visita.data}, tem ${visita.total_alunos} aluno(s) registrado(s), com ${horas}. O registro é feito por turma; esse total não confirma presença individual.`,
    sugestoes,
  };
}
