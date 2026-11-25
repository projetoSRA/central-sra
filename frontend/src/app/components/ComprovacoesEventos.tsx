import { useEffect, useMemo, useState, type FormEvent } from "react";
import Obrigatorio from "./Obrigatorio";
import { createPortal } from "react-dom";
import { Button } from "./ui/button";
import { apiFetch, API_URL, lerJson, mensagemDeErro } from "../utils/api";
import { panelStyle, cardStyle } from "../../styles/uiStyles";
import {
  ComprovacaoInfo,
  ROTULO_SITUACAO,
  formatarDataCurta,
  situacaoComprovacao,
  textoDiasRestantes,
} from "../utils/comprovacao";
import { CalendarClock, CheckCircle2, Eye, MessageSquare, Mic2, X, XCircle } from "lucide-react";
import { toast } from "sonner";

// Comprovações de participação em eventos (visão da coordenação):
// aprovar/reprovar o que os alunos enviaram e estender o prazo de quem
// não conseguiu entregar. Regras no backend: eventos.routes.ts.

export type ComprovacaoEvento = ComprovacaoInfo & {
  id_inscricao: number;
  id_aluno: number;
  nome_aluno: string;
  email_aluno: string;
  id_evento: number;
  titulo: string;
  tipo_evento: string | null;
  data_evento: string;
  carga_horaria: number;
  nome_empresa: string;
};

type AlvoPrazo = ComprovacaoInfo & {
  id_inscricao: number;
  titulo: string;
  nome_aluno?: string;
};

function hojeISO() {
  const agora = new Date();
  const local = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function diaSeguinte(dataISO: string) {
  const data = new Date(`${dataISO}T00:00:00Z`);
  data.setUTCDate(data.getUTCDate() + 1);
  return data.toISOString().slice(0, 10);
}

/** Modal para a coordenação estender o prazo de comprovação de um aluno. */
export function EstenderPrazoModal({
  alvo,
  onFechar,
  onSalvo,
}: {
  alvo: AlvoPrazo;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const minimo = useMemo(() => {
    const hoje = hojeISO();
    const aposPrazo = alvo.prazo_comprovacao ? diaSeguinte(alvo.prazo_comprovacao) : hoje;
    return aposPrazo > hoje ? aposPrazo : hoje;
  }, [alvo.prazo_comprovacao]);

  const [novaData, setNovaData] = useState(minimo);
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const salvar = async (event: FormEvent) => {
    event.preventDefault();

    if (!motivo.trim()) {
      setErro("Informe o motivo da extensão.");
      return;
    }

    try {
      setSalvando(true);
      setErro("");

      const response = await apiFetch(
        `${API_URL}/eventos/inscricoes/${alvo.id_inscricao}/prazo`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ novaData, motivo: motivo.trim() }),
        }
      );
      const data = await lerJson(response);

      if (!response.ok) {
        throw new Error(data?.message || "Erro ao estender prazo.");
      }

      onSalvo();
    } catch (error) {
      setErro(mensagemDeErro(error, "Erro ao estender prazo."));
    } finally {
      setSalvando(false);
    }
  };

  return createPortal(
    <div className="app-modal-overlay">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="estender-prazo-titulo"
        className="app-modal-panel"
        style={{ ...panelStyle, maxWidth: "36rem" }}
      >
        <div className="app-modal-header">
          <h2
            id="estender-prazo-titulo"
            className="text-xl font-semibold text-ink flex items-center gap-2 min-w-0"
          >
            <CalendarClock className="size-5 shrink-0" />
            Estender prazo
          </h2>

          <button
            onClick={onFechar}
            disabled={salvando}
            aria-label="Fechar"
            className="p-2 rounded-xl bg-ink/[0.06] hover:bg-ink/[0.12] transition"
            type="button"
          >
            <X className="size-5 text-ink" />
          </button>
        </div>

        <form onSubmit={salvar} className="app-modal-form">
          <div className="app-modal-fields">
            <div className="sm:col-span-2">
              <p className="text-ink font-medium break-words">{alvo.titulo}</p>
              <p className="text-ink-muted text-sm break-words">
                {alvo.nome_aluno ? `${alvo.nome_aluno} · ` : ""}
                Prazo atual: {formatarDataCurta(alvo.prazo_comprovacao)}
              </p>
              <p className="text-ink-muted text-sm mt-1">
                O aluno poderá enviar (ou reenviar) a comprovação até o fim da nova data.
              </p>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="prazo-nova-data" className="block text-ink mb-2">
                Nova data-limite
                <Obrigatorio />
              </label>
              <input
                id="prazo-nova-data"
                type="date"
                required
                min={minimo}
                value={novaData}
                onChange={(e) => setNovaData(e.target.value)}
                className="w-full rounded-xl bg-raised border border-ink/15 p-3 text-ink outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="prazo-motivo" className="block text-ink mb-2">
                Motivo
                <Obrigatorio />
              </label>
              <textarea
                id="prazo-motivo"
                required
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={3}
                maxLength={1000}
                className="w-full rounded-xl bg-raised border border-ink/15 p-3 text-ink outline-none"
                placeholder="Ex: aluno apresentou atestado médico."
              />
            </div>

            {erro && (
              <p role="alert" className="sm:col-span-2 text-red-300 text-sm">
                {erro}
              </p>
            )}
          </div>

          <div className="app-modal-footer">
            <Button
              type="button"
              onClick={onFechar}
              disabled={salvando}
              variant="outline"
              className="rounded-xl bg-transparent text-ink hover:bg-ink/[0.06]"
              style={{ borderColor: "var(--taupe)", color: "var(--ink)" }}
            >
              Cancelar
            </Button>

            <Button
              type="submit"
              disabled={salvando}
              className="rounded-xl bg-brand text-on-brand hover:bg-brand-hover"
            >
              {salvando ? "Salvando..." : "Estender prazo"}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

type Filtro = "pendentes" | "pedidos" | "sem_envio" | "avaliadas";

export default function ComprovacoesEventos({
  onPendentesChange,
}: {
  onPendentesChange?: (total: number) => void;
}) {
  const [itens, setItens] = useState<ComprovacaoEvento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("pendentes");
  const [processando, setProcessando] = useState<number | null>(null);

  const [reprovacaoAlvo, setReprovacaoAlvo] = useState<ComprovacaoEvento | null>(null);
  const [motivoReprovacao, setMotivoReprovacao] = useState("");
  const [erroReprovacao, setErroReprovacao] = useState("");
  const [prazoAlvo, setPrazoAlvo] = useState<ComprovacaoEvento | null>(null);

  // Recusa de um pedido de reabertura de prazo enviado pelo aluno.
  const [recusaAlvo, setRecusaAlvo] = useState<ComprovacaoEvento | null>(null);
  const [respostaRecusa, setRespostaRecusa] = useState("");
  const [erroRecusa, setErroRecusa] = useState("");
  const [recusando, setRecusando] = useState(false);

  const carregar = async () => {
    try {
      setErro("");
      const response = await apiFetch(`${API_URL}/eventos/comprovacoes`);
      const data = await lerJson(response);

      if (!response.ok) {
        throw new Error(data.message || "Erro ao carregar comprovações.");
      }

      setItens(data);
    } catch (error) {
      console.error("Erro ao carregar comprovações:", error);
      setItens([]);
      setErro(mensagemDeErro(error, "Erro ao carregar comprovações."));
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const grupos = useMemo(() => {
    const resultado: Record<Filtro, ComprovacaoEvento[]> = {
      pendentes: [],
      pedidos: [],
      sem_envio: [],
      avaliadas: [],
    };

    itens.forEach((item) => {
      const situacao = situacaoComprovacao(item);
      if (situacao === "pendente") resultado.pendentes.push(item);
      // Aluno perdeu o prazo e escreveu pedindo a reabertura.
      else if (item.pedido_prazo_status === "PENDENTE" && situacao !== "confirmado")
        resultado.pedidos.push(item);
      else if (situacao === "aberto" || situacao === "encerrado") resultado.sem_envio.push(item);
      else resultado.avaliadas.push(item);
    });

    return resultado;
  }, [itens]);

  // O que espera ação da coordenação: validar comprovação ou responder pedido.
  const totalPendentes = grupos.pendentes.length + grupos.pedidos.length;

  useEffect(() => {
    if (!carregando) onPendentesChange?.(totalPendentes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPendentes, carregando]);

  const validar = async (item: ComprovacaoEvento, status: "APROVADO" | "REPROVADO", motivo?: string) => {
    try {
      setProcessando(item.id_inscricao);

      const response = await apiFetch(
        `${API_URL}/eventos/inscricoes/${item.id_inscricao}/validar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, motivo: motivo || null }),
        }
      );
      const data = await lerJson(response);

      if (!response.ok) {
        throw new Error(data?.message || "Erro ao validar comprovação.");
      }

      await carregar();
      return true;
    } catch (error) {
      if (status === "REPROVADO") {
        setErroReprovacao(mensagemDeErro(error, "Erro ao reprovar comprovação."));
      } else {
        toast.error(mensagemDeErro(error, "Erro ao aprovar comprovação."));
      }
      return false;
    } finally {
      setProcessando(null);
    }
  };

  const confirmarReprovacao = async () => {
    if (!reprovacaoAlvo) return;

    if (!motivoReprovacao.trim()) {
      setErroReprovacao("Informe o motivo da reprovação.");
      return;
    }

    const ok = await validar(reprovacaoAlvo, "REPROVADO", motivoReprovacao.trim());
    if (ok) setReprovacaoAlvo(null);
  };

  const confirmarRecusa = async () => {
    if (!recusaAlvo) return;

    if (!respostaRecusa.trim()) {
      setErroRecusa("Escreva uma resposta para o aluno.");
      return;
    }

    try {
      setRecusando(true);
      setErroRecusa("");

      const response = await apiFetch(
        `${API_URL}/eventos/inscricoes/${recusaAlvo.id_inscricao}/pedido-prazo/recusar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resposta: respostaRecusa.trim() }),
        }
      );
      const data = await lerJson(response);

      if (!response.ok) {
        throw new Error(data?.message || "Erro ao recusar pedido.");
      }

      setRecusaAlvo(null);
      await carregar();
    } catch (error) {
      setErroRecusa(mensagemDeErro(error, "Erro ao recusar pedido."));
    } finally {
      setRecusando(false);
    }
  };

  const lista = grupos[filtro];

  const filtros: { chave: Filtro; rotulo: string }[] = [
    { chave: "pendentes", rotulo: "Aguardando validação" },
    { chave: "pedidos", rotulo: "Pedidos de prazo" },
    { chave: "sem_envio", rotulo: "Sem envio" },
    { chave: "avaliadas", rotulo: "Avaliadas" },
  ];

  const vazio: Record<Filtro, string> = {
    pendentes: "Nenhuma comprovação de evento aguardando validação.",
    pedidos: "Nenhum aluno pediu reabertura de prazo.",
    sem_envio: "Nenhum aluno inscrito em evento concluído está sem comprovação.",
    avaliadas: "Nenhuma comprovação avaliada ainda.",
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {filtros.map(({ chave, rotulo }) => (
          <button
            key={chave}
            type="button"
            onClick={() => setFiltro(chave)}
            aria-pressed={filtro === chave}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              filtro === chave
                ? "bg-brand text-on-brand"
                : "bg-ink/[0.06] text-ink hover:text-ink"
            }`}
          >
            {rotulo} ({grupos[chave].length})
          </button>
        ))}
      </div>

      <p className="text-ink-muted text-sm">
        As horas de um evento só contam para o aluno depois que a comprovação enviada dentro do
        prazo for aprovada aqui.
      </p>

      {carregando && (
        <div className="rounded-xl bg-raised border border-ink/[0.12] p-5 text-center sm:p-6">
          <p className="text-ink">Carregando comprovações...</p>
        </div>
      )}

      {!carregando && erro && (
        <div className="rounded-xl bg-raised border border-ink/[0.12] p-5 text-center sm:p-6">
          <p role="alert" className="text-red-300">{erro}</p>
        </div>
      )}

      {!carregando && !erro && lista.length === 0 && (
        <div className="rounded-xl bg-raised border border-ink/[0.12] p-5 text-center sm:p-6">
          <Mic2 className="size-8 text-ink mx-auto mb-2" />
          <p className="text-ink-muted text-sm">{vazio[filtro]}</p>
        </div>
      )}

      {!carregando && !erro && lista.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {lista.map((item) => {
            const situacao = situacaoComprovacao(item);
            const rotulo = ROTULO_SITUACAO[situacao];
            const ocupado = processando === item.id_inscricao;

            return (
              <div
                key={item.id_inscricao}
                className="rounded-2xl bg-raised p-5 border border-ink/[0.12]"
                style={cardStyle}
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="min-w-0">
                    <h3 className="text-ink font-semibold text-lg break-words">{item.titulo}</h3>
                    <p className="text-ink-muted text-sm break-words">
                      {item.nome_aluno} · {item.email_aluno}
                    </p>
                  </div>

                  {item.comprovacao_url && (
                    <a
                      href={item.comprovacao_url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 rounded-xl bg-ink/[0.06] hover:bg-ink/[0.12] transition shrink-0"
                      title="Ver arquivo"
                      aria-label="Ver arquivo da comprovação"
                    >
                      <Eye className="size-5 text-ink" />
                    </a>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                  <p className="text-ink">
                    Evento em: <span className="text-ink">{formatarDataCurta(item.data_evento)}</span>
                  </p>
                  <p className="text-ink">
                    Horas: <span className="text-ink font-semibold">{item.carga_horaria}h</span>
                  </p>
                  <p className="text-ink">
                    Prazo:{" "}
                    <span className="text-ink">
                      {formatarDataCurta(item.prazo_comprovacao)}
                      {item.prazo_aberto
                        ? ` (${textoDiasRestantes(item.dias_restantes)})`
                        : " (encerrado)"}
                    </span>
                  </p>
                  <p className="text-ink">
                    Situação: <span className={`${rotulo.classe} font-semibold`}>{rotulo.texto}</span>
                  </p>
                  {item.comprovacao_enviada_em && (
                    <p className="text-ink col-span-2 break-words">
                      Enviado em:{" "}
                      <span className="text-ink">
                        {new Date(item.comprovacao_enviada_em).toLocaleString("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>
                      {item.comprovacao_nome_arquivo ? ` · ${item.comprovacao_nome_arquivo}` : ""}
                    </p>
                  )}
                  {item.prazo_estendido_ate && (
                    <p className="text-ink col-span-2 break-words">
                      Prazo estendido:{" "}
                      <span className="text-ink">{item.prazo_motivo || "sem motivo registrado"}</span>
                    </p>
                  )}
                  {item.comprovacao_motivo_reprovacao && (
                    <p className="text-ink col-span-2 break-words">
                      Motivo da reprovação:{" "}
                      <span className="text-ink">{item.comprovacao_motivo_reprovacao}</span>
                    </p>
                  )}
                </div>

                {item.pedido_prazo_mensagem && item.pedido_prazo_status && (
                  <div className="mb-3 rounded-xl bg-blue-500/10 p-3 text-sm">
                    <p className="flex items-center gap-2 font-semibold text-blue-200">
                      <MessageSquare className="size-4 shrink-0" />
                      {item.pedido_prazo_status === "PENDENTE"
                        ? "Mensagem do aluno pedindo reabertura do prazo"
                        : item.pedido_prazo_status === "ATENDIDO"
                          ? "Pedido de prazo atendido"
                          : "Pedido de prazo recusado"}
                      {item.pedido_prazo_em
                        ? ` · ${new Date(item.pedido_prazo_em).toLocaleDateString("pt-BR")}`
                        : ""}
                    </p>
                    <p className="mt-1 max-h-32 overflow-y-auto text-ink whitespace-pre-wrap break-words">
                      {item.pedido_prazo_mensagem}
                    </p>
                    {item.pedido_prazo_status === "RECUSADO" && item.pedido_prazo_resposta && (
                      <p className="mt-2 text-ink break-words">
                        Resposta: <span className="text-ink">{item.pedido_prazo_resposta}</span>
                      </p>
                    )}
                  </div>
                )}

                {item.comprovacao_texto && (
                  <div className="mb-3 max-h-40 overflow-y-auto rounded-xl bg-ink/[0.04] p-3 text-sm text-ink-muted whitespace-pre-wrap break-words">
                    {item.comprovacao_texto}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-end gap-2">
                  {situacao !== "confirmado" && (
                    <button
                      type="button"
                      onClick={() => setPrazoAlvo(item)}
                      disabled={ocupado}
                      className="mr-auto inline-flex items-center gap-2 rounded-xl bg-ink/[0.06] px-3 py-2 text-sm text-ink hover:bg-ink/[0.12] transition disabled:opacity-50"
                    >
                      <CalendarClock className="size-4" />
                      Estender prazo
                    </button>
                  )}

                  {item.pedido_prazo_status === "PENDENTE" && situacao !== "confirmado" && (
                    <button
                      type="button"
                      onClick={() => {
                        setRecusaAlvo(item);
                        setRespostaRecusa("");
                        setErroRecusa("");
                      }}
                      disabled={ocupado}
                      className="inline-flex items-center gap-2 rounded-xl bg-red-500/20 px-3 py-2 text-sm text-red-200 hover:bg-red-500/30 transition disabled:opacity-50"
                    >
                      <XCircle className="size-4" />
                      Recusar pedido
                    </button>
                  )}

                  {situacao === "pendente" && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setReprovacaoAlvo(item);
                          setMotivoReprovacao("");
                          setErroReprovacao("");
                        }}
                        disabled={ocupado}
                        className="inline-flex items-center gap-2 rounded-xl bg-red-500/20 px-3 py-2 text-sm text-red-200 hover:bg-red-500/30 transition disabled:opacity-50"
                      >
                        <XCircle className="size-4" />
                        Reprovar
                      </button>

                      <button
                        type="button"
                        onClick={() => validar(item, "APROVADO")}
                        disabled={ocupado}
                        className="inline-flex items-center gap-2 rounded-xl bg-green-500/20 px-3 py-2 text-sm text-green-200 hover:bg-green-500/30 transition disabled:opacity-50"
                      >
                        <CheckCircle2 className="size-4" />
                        {ocupado ? "Salvando..." : "Aprovar"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {reprovacaoAlvo &&
        createPortal(
          <div className="app-modal-overlay">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="reprovar-comprovacao-titulo"
              className="app-modal-panel"
              style={{ ...panelStyle, maxWidth: "36rem" }}
            >
              <div className="app-modal-header">
                <h2
                  id="reprovar-comprovacao-titulo"
                  className="text-xl font-semibold text-ink min-w-0 break-words"
                >
                  Reprovar comprovação
                </h2>

                <button
                  onClick={() => setReprovacaoAlvo(null)}
                  aria-label="Fechar"
                  className="p-2 rounded-xl bg-ink/[0.06] hover:bg-ink/[0.12] transition"
                  type="button"
                >
                  <X className="size-5 text-ink" />
                </button>
              </div>

              <div className="app-modal-fields">
                <div className="sm:col-span-2">
                  <p className="text-ink font-medium break-words">{reprovacaoAlvo.titulo}</p>
                  <p className="text-ink-muted text-sm break-words">{reprovacaoAlvo.nome_aluno}</p>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="reprovar-motivo" className="block text-ink mb-2">
                    Motivo
                    <Obrigatorio />
                  </label>
                  <textarea
                    id="reprovar-motivo"
                    value={motivoReprovacao}
                    onChange={(e) => setMotivoReprovacao(e.target.value)}
                    rows={4}
                    maxLength={1000}
                    className="w-full rounded-xl bg-raised border border-ink/15 p-3 text-ink outline-none"
                    placeholder="Explique ao aluno por que a comprovação não foi aceita..."
                  />
                  <p className="text-ink-muted text-sm mt-2">
                    O aluno vê este motivo e pode reenviar enquanto o prazo estiver aberto.
                  </p>
                </div>

                {erroReprovacao && (
                  <p role="alert" className="sm:col-span-2 text-red-300 text-sm">
                    {erroReprovacao}
                  </p>
                )}
              </div>

              <div className="app-modal-footer">
                <Button
                  type="button"
                  onClick={() => setReprovacaoAlvo(null)}
                  variant="outline"
                  className="rounded-xl bg-transparent text-ink hover:bg-ink/[0.06]"
                  style={{ borderColor: "var(--taupe)", color: "var(--ink)" }}
                >
                  Cancelar
                </Button>

                <Button
                  type="button"
                  onClick={confirmarReprovacao}
                  disabled={processando === reprovacaoAlvo.id_inscricao}
                  className="rounded-xl bg-red-500 text-on-accent hover:bg-red-600"
                >
                  {processando === reprovacaoAlvo.id_inscricao
                    ? "Enviando..."
                    : "Confirmar reprovação"}
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {recusaAlvo &&
        createPortal(
          <div className="app-modal-overlay">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="recusar-pedido-titulo"
              className="app-modal-panel"
              style={{ ...panelStyle, maxWidth: "36rem" }}
            >
              <div className="app-modal-header">
                <h2
                  id="recusar-pedido-titulo"
                  className="text-xl font-semibold text-ink min-w-0 break-words"
                >
                  Recusar pedido de prazo
                </h2>

                <button
                  onClick={() => setRecusaAlvo(null)}
                  disabled={recusando}
                  aria-label="Fechar"
                  className="p-2 rounded-xl bg-ink/[0.06] hover:bg-ink/[0.12] transition"
                  type="button"
                >
                  <X className="size-5 text-ink" />
                </button>
              </div>

              <div className="app-modal-fields">
                <div className="sm:col-span-2">
                  <p className="text-ink font-medium break-words">{recusaAlvo.titulo}</p>
                  <p className="text-ink-muted text-sm break-words">{recusaAlvo.nome_aluno}</p>
                  {recusaAlvo.pedido_prazo_mensagem && (
                    <p className="mt-2 rounded-xl bg-ink/[0.04] p-3 text-sm text-ink-muted whitespace-pre-wrap break-words">
                      {recusaAlvo.pedido_prazo_mensagem}
                    </p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="recusar-pedido-resposta" className="block text-ink mb-2">
                    Resposta ao aluno
                    <Obrigatorio />
                  </label>
                  <textarea
                    id="recusar-pedido-resposta"
                    value={respostaRecusa}
                    onChange={(e) => setRespostaRecusa(e.target.value)}
                    rows={4}
                    maxLength={1000}
                    className="w-full rounded-xl bg-raised border border-ink/15 p-3 text-ink outline-none"
                    placeholder="Explique por que o prazo não será reaberto..."
                  />
                  <p className="text-ink-muted text-sm mt-2">
                    Para aceitar o pedido, feche esta janela e use “Estender prazo”.
                  </p>
                </div>

                {erroRecusa && (
                  <p role="alert" className="sm:col-span-2 text-red-300 text-sm">
                    {erroRecusa}
                  </p>
                )}
              </div>

              <div className="app-modal-footer">
                <Button
                  type="button"
                  onClick={() => setRecusaAlvo(null)}
                  disabled={recusando}
                  variant="outline"
                  className="rounded-xl bg-transparent text-ink hover:bg-ink/[0.06]"
                  style={{ borderColor: "var(--taupe)", color: "var(--ink)" }}
                >
                  Cancelar
                </Button>

                <Button
                  type="button"
                  onClick={confirmarRecusa}
                  disabled={recusando}
                  className="rounded-xl bg-red-500 text-on-accent hover:bg-red-600"
                >
                  {recusando ? "Enviando..." : "Recusar pedido"}
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {prazoAlvo && (
        <EstenderPrazoModal
          alvo={prazoAlvo}
          onFechar={() => setPrazoAlvo(null)}
          onSalvo={() => {
            setPrazoAlvo(null);
            carregar();
          }}
        />
      )}
    </>
  );
}
