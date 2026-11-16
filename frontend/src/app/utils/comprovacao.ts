// Tipos e helpers do fluxo de comprovação de participação em eventos,
// compartilhados entre a tela do aluno e as telas da coordenação.
// Os campos vêm de backend/src/routes/eventos.routes.ts (CAMPOS_COMPROVACAO_SQL).

export type ComprovacaoInfo = {
  id_inscricao?: number;
  status_inscricao?: string | null;
  comprovacao_status?: "PENDENTE" | "APROVADO" | "REPROVADO" | null;
  comprovacao_texto?: string | null;
  comprovacao_nome_arquivo?: string | null;
  comprovacao_url?: string | null;
  comprovacao_enviada_em?: string | null;
  comprovacao_motivo_reprovacao?: string | null;
  prazo_motivo?: string | null;
  /** Mensagem do aluno pedindo reabertura do prazo, e a resposta se recusada. */
  pedido_prazo_status?: "PENDENTE" | "ATENDIDO" | "RECUSADO" | null;
  pedido_prazo_mensagem?: string | null;
  pedido_prazo_em?: string | null;
  pedido_prazo_resposta?: string | null;
  /** AAAA-MM-DD, só quando a coordenação estendeu o prazo. */
  prazo_estendido_ate?: string | null;
  /** AAAA-MM-DD: data-limite efetiva (já considerando extensão). */
  prazo_comprovacao?: string | null;
  evento_concluido?: boolean;
  prazo_aberto?: boolean;
  dias_restantes?: number;
};

export type SituacaoComprovacao =
  | "aguardando_evento"
  | "confirmado"
  | "pendente"
  | "reprovado"
  | "aberto"
  | "encerrado";

export function situacaoComprovacao(info: ComprovacaoInfo): SituacaoComprovacao {
  if (info.comprovacao_status === "APROVADO" || info.status_inscricao === "PRESENTE") {
    return "confirmado";
  }
  if (!info.evento_concluido) return "aguardando_evento";
  if (info.comprovacao_status === "PENDENTE") return "pendente";
  if (info.comprovacao_status === "REPROVADO") return "reprovado";
  return info.prazo_aberto ? "aberto" : "encerrado";
}

export const ROTULO_SITUACAO: Record<SituacaoComprovacao, { texto: string; classe: string }> = {
  aguardando_evento: { texto: "Evento ainda não ocorreu", classe: "text-white/70" },
  confirmado: { texto: "Participação confirmada", classe: "text-green-400" },
  pendente: { texto: "Aguardando validação", classe: "text-blue-400" },
  reprovado: { texto: "Comprovação reprovada", classe: "text-red-400" },
  aberto: { texto: "Prazo aberto, sem envio", classe: "text-amber-300" },
  encerrado: { texto: "Prazo encerrado sem comprovação", classe: "text-white/60" },
};

/** Formata "AAAA-MM-DD" (ou ISO completo) como DD/MM/AAAA sem deslocar o fuso. */
export function formatarDataCurta(valor?: string | null) {
  if (!valor) return "-";
  const [ano, mes, dia] = valor.slice(0, 10).split("-");
  if (!ano || !mes || !dia) return valor;
  return `${dia}/${mes}/${ano}`;
}

export function textoDiasRestantes(dias?: number) {
  if (dias === undefined || dias === null) return "";
  if (dias <= 0) return "último dia hoje";
  if (dias === 1) return "falta 1 dia";
  return `faltam ${dias} dias`;
}

/** Mesmo valor de DIAS_PRAZO_COMPROVACAO no backend (eventos.routes.ts). */
const DIAS_PRAZO_COMPROVACAO = 7;

function somarDias(dataISO: string, dias: number) {
  const data = new Date(`${dataISO.slice(0, 10)}T00:00:00Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

function hojeLocalISO() {
  const agora = new Date();
  return new Date(agora.getTime() - agora.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}

/** Dia em que a entrega da comprovação é liberada (dia seguinte ao evento). */
export function dataAberturaComprovacao(dataEvento: string) {
  return somarDias(dataEvento, 1);
}

/**
 * Garante os campos de prazo mesmo quando o backend não os envia (servidor
 * ainda sem a versão nova): calcula pela data do evento e pelo relógio do
 * navegador. É só para exibição; quem decide se o envio vale é o servidor.
 */
export function comPrazoCalculado<T extends ComprovacaoInfo>(info: T, dataEvento: string): T {
  if (info.evento_concluido !== undefined || !dataEvento) return info;

  const data = dataEvento.slice(0, 10);
  const hoje = hojeLocalISO();
  const prazo = somarDias(data, DIAS_PRAZO_COMPROVACAO);
  const concluido = hoje > data;
  const diasRestantes = Math.round(
    (Date.parse(`${prazo}T00:00:00Z`) - Date.parse(`${hoje}T00:00:00Z`)) / 86400000
  );

  return {
    ...info,
    evento_concluido: concluido,
    prazo_comprovacao: prazo,
    prazo_aberto: concluido && hoje <= prazo,
    dias_restantes: diasRestantes,
  };
}

/** Tipos aceitos pelo backend para o arquivo de comprovação. */
export const ACCEPT_COMPROVACAO = ".png,.jpg,.jpeg,.pdf,.txt,.doc,.docx";
