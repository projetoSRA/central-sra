import { useEffect, useState, type FormEvent } from "react";
import Obrigatorio from "../components/Obrigatorio";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { User } from "../utils/auth";
import { apiFetch, API_URL, lerJson, mensagemDeErro } from "../utils/api";
import AlunoLayout, { glassCardStyle } from "../components/AlunoLayout";
import { panelStyle, cardStyle, buttonGlass } from "../../styles/uiStyles";
import { Button } from "../components/ui/button";
import { AlertTriangle, CheckCircle2, Clock, Eye, Hourglass, MessageSquare, Mic2, Upload, X, XCircle } from "lucide-react";
import {
  ACCEPT_COMPROVACAO,
  ComprovacaoInfo,
  SituacaoComprovacao,
  comPrazoCalculado,
  dataAberturaComprovacao,
  formatarDataCurta,
  situacaoComprovacao,
  textoDiasRestantes,
} from "../utils/comprovacao";
import { exigirSessao } from "../utils/sessao";
import { toast } from "sonner";

type Inscricao = ComprovacaoInfo & { id_evento: number };

// Selo sempre visível no card do aluno inscrito: diz se a entrega da
// comprovação ainda não abriu, está disponível, já foi feita ou encerrou.
function seloEntrega(situacao: SituacaoComprovacao, prazoAberto: boolean) {
  switch (situacao) {
    case "aguardando_evento":
      return { texto: "Entrega ainda não liberada", classe: "bg-ink/[0.06] text-ink", Icone: Hourglass };
    case "aberto":
      return { texto: "Entrega disponível", classe: "bg-amber-400/15 text-amber-200", Icone: Upload };
    case "pendente":
      return { texto: "Enviada, aguardando validação", classe: "bg-blue-500/15 text-blue-300", Icone: Clock };
    case "reprovado":
      return {
        texto: prazoAberto ? "Reprovada, reenvio disponível" : "Reprovada, prazo encerrado",
        classe: "bg-red-500/15 text-red-300",
        Icone: XCircle,
      };
    case "confirmado":
      return { texto: "Participação confirmada", classe: "bg-green-500/15 text-green-300", Icone: CheckCircle2 };
    default:
      return { texto: "Prazo de entrega encerrado", classe: "bg-red-500/15 text-red-300", Icone: AlertTriangle };
  }
}

function mapearInscricoes(lista: Inscricao[]): Record<number, Inscricao> {
  return Object.fromEntries(lista.map((item) => [item.id_evento, item]));
}

type Evento = {
  id_evento: number;
  id_empresa: number;
  nome_empresa?: string;
  titulo: string;
  descricao: string | null;
  tipo_evento: string | null;
  data_evento: string;
  horario: string | null;
  carga_horaria: number;
  palestrante: string | null;
  info_palestrante: string | null;
};


function formatarData(dataISO: string) {
  if (!dataISO) return "-";

  const data = new Date(dataISO);

  if (Number.isNaN(data.getTime())) return dataISO;

  return data.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}


function formatarHorario(horario: string | null) {
  if (!horario) return "-";
  return horario.slice(0, 5);
}

export default function Eventos() {
  const navigate = useNavigate();

  const [horas, setHoras] = useState(0);
  const [user, setUser] = useState<User | null>(null);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [inscricoes, setInscricoes] = useState<Record<number, Inscricao>>({});
  const [loading, setLoading] = useState(true);

  const [comprovacaoAlvo, setComprovacaoAlvo] = useState<Evento | null>(null);
  const [arquivoComprovacao, setArquivoComprovacao] = useState<File | null>(null);
  const [textoComprovacao, setTextoComprovacao] = useState("");
  const [enviandoComprovacao, setEnviandoComprovacao] = useState(false);
  const [erroComprovacao, setErroComprovacao] = useState("");

  // Mensagem à coordenação quando o prazo de entrega já passou.
  const [mensagemAlvo, setMensagemAlvo] = useState<Evento | null>(null);
  const [textoMensagem, setTextoMensagem] = useState("");
  const [enviandoMensagem, setEnviandoMensagem] = useState(false);
  const [erroMensagem, setErroMensagem] = useState("");

  useEffect(() => {
    const parsedUser = exigirSessao(navigate, "aluno");
    if (!parsedUser) return;


    setUser(parsedUser);

    apiFetch(`${API_URL}/horas/aluno/${parsedUser.id}`)
    .then(lerJson)
    .then(data => setHoras(Number(data?.totalHoras) || 0))
    .catch(() => setHoras(0));
  }, [navigate]);

  useEffect(() => {
    if (!user) return;

    async function carregarEventos() {
      try {
        setLoading(true);

        const [eventosResponse, inscricoesResponse] = await Promise.all([
          apiFetch(`${API_URL}/eventos`),
          apiFetch(`${API_URL}/eventos/inscricoes/aluno/${user.id}`),
        ]);

        const eventosData = await lerJson(eventosResponse);
        const inscricoesData = await lerJson(inscricoesResponse);

        if (!eventosResponse.ok) {
          throw new Error(eventosData.message || "Erro ao carregar eventos");
        }

        setEventos(eventosData);

        if (inscricoesResponse.ok) {
          setInscricoes(mapearInscricoes(inscricoesData));
        }
      } catch (error) {
        console.error("Erro ao carregar eventos:", error);
        setEventos([]);
      } finally {
        setLoading(false);
      }
    }

    carregarEventos();
  }, [user]);

  const recarregarInscricoes = async () => {
    if (!user) return;

    try {
      const response = await apiFetch(`${API_URL}/eventos/inscricoes/aluno/${user.id}`);
      const data = await lerJson(response);
      if (response.ok) setInscricoes(mapearInscricoes(data));
    } catch (error) {
      console.error("Erro ao atualizar inscrições:", error);
    }
  };

  const abrirMensagem = (evento: Evento) => {
    setMensagemAlvo(evento);
    setTextoMensagem("");
    setErroMensagem("");
  };

  const enviarMensagem = async (event: FormEvent) => {
    event.preventDefault();
    if (!mensagemAlvo) return;

    if (textoMensagem.trim().length < 10) {
      setErroMensagem("Explique o motivo em pelo menos 10 caracteres.");
      return;
    }

    try {
      setEnviandoMensagem(true);
      setErroMensagem("");

      const response = await apiFetch(
        `${API_URL}/eventos/${mensagemAlvo.id_evento}/pedido-prazo`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mensagem: textoMensagem.trim() }),
        }
      );
      const data = await lerJson(response);

      if (!response.ok) {
        throw new Error(data?.message || "Erro ao enviar mensagem.");
      }

      setMensagemAlvo(null);
      await recarregarInscricoes();
    } catch (error) {
      setErroMensagem(mensagemDeErro(error, "Erro ao enviar mensagem."));
    } finally {
      setEnviandoMensagem(false);
    }
  };

  const abrirComprovacao = (evento: Evento) => {
    setComprovacaoAlvo(evento);
    setArquivoComprovacao(null);
    setTextoComprovacao("");
    setErroComprovacao("");
  };

  const enviarComprovacao = async (event: FormEvent) => {
    event.preventDefault();
    if (!comprovacaoAlvo) return;

    if (!arquivoComprovacao && !textoComprovacao.trim()) {
      setErroComprovacao("Anexe um arquivo ou escreva um relato da sua participação.");
      return;
    }

    try {
      setEnviandoComprovacao(true);
      setErroComprovacao("");

      const formData = new FormData();
      if (arquivoComprovacao) formData.append("arquivo", arquivoComprovacao);
      formData.append("texto", textoComprovacao.trim());

      const response = await apiFetch(
        `${API_URL}/eventos/${comprovacaoAlvo.id_evento}/comprovacao`,
        { method: "POST", body: formData }
      );
      const data = await lerJson(response);

      if (!response.ok) {
        throw new Error(data?.message || "Erro ao enviar comprovação.");
      }

      setComprovacaoAlvo(null);
      await recarregarInscricoes();
    } catch (error) {
      setErroComprovacao(mensagemDeErro(error, "Erro ao enviar comprovação."));
      // O prazo pode ter fechado enquanto o modal estava aberto.
      recarregarInscricoes();
    } finally {
      setEnviandoComprovacao(false);
    }
  };

  const inscreverEvento = async (idEvento: number) => {
    if (!user) return;

    try {
      const response = await apiFetch(`${API_URL}/eventos/${idEvento}/inscrever`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idAluno: user.id,
        }),
      });

      const data = await lerJson(response);

      if (!response.ok) {
        throw new Error(data.message || "Erro ao realizar inscrição");
      }

      setInscricoes((prev) =>
        prev[idEvento] ? prev : { ...prev, [idEvento]: { id_evento: idEvento } }
      );
      // Busca prazo/situação da comprovação (caso o evento já tenha passado).
      recarregarInscricoes();
    } catch (error) {
      toast.error(mensagemDeErro(error, "Erro ao realizar inscrição."));
    }
  };

  if (!user) return null;

  return (
    <AlunoLayout user={user} activePage="eventos" horas={horas}>
      <Card
        className="rounded-2xl border-0 shadow-none mb-6"
        style={panelStyle}
      >
        <CardHeader>
          <CardTitle className="text-ink flex items-center gap-2">
            <Mic2 className="size-5 text-blue-400" />
            Eventos disponíveis
          </CardTitle>
        </CardHeader>

        <CardContent>
  {loading ? (
    <div className="rounded-2xl border border-dashed border-ink/25 p-6 text-center">
      <p className="text-ink">Carregando eventos...</p>
    </div>
  ) : eventos.length === 0 ? (
    <div className="rounded-2xl border border-dashed border-ink/25 p-6 text-center">
      <Mic2 className="size-9 text-ink mx-auto mb-3" />
      <h3 className="text-ink text-lg font-semibold mb-1">
        Nenhum evento disponível
      </h3>
      <p className="text-ink">
        Aguarde uma empresa publicar novos eventos.
      </p>
    </div>
  ) : (
    <div className="grid grid-cols-1 gap-4">
      {eventos.map((evento) => {
        const inscricaoBruta = inscricoes[evento.id_evento];
        const inscricao = inscricaoBruta
          ? comPrazoCalculado(inscricaoBruta, evento.data_evento)
          : undefined;
        const inscrito = Boolean(inscricao);
        const situacao = inscricao ? situacaoComprovacao(inscricao) : "aguardando_evento";
        const selo = inscricao ? seloEntrega(situacao, Boolean(inscricao.prazo_aberto)) : null;
        const aberturaTexto = formatarDataCurta(dataAberturaComprovacao(evento.data_evento));
        const podeEnviar =
          Boolean(inscricao?.prazo_aberto) &&
          (situacao === "aberto" || situacao === "pendente" || situacao === "reprovado");
        const prazoTexto = formatarDataCurta(inscricao?.prazo_comprovacao);
        // Prazo perdido (sem envio, ou reprovado sem tempo de reenviar): o
        // aluno pode escrever à coordenação pedindo a reabertura.
        const prazoPerdido =
          situacao === "encerrado" || (situacao === "reprovado" && !inscricao?.prazo_aberto);
        const pedidoPendente = inscricao?.pedido_prazo_status === "PENDENTE";
        // Recusa da coordenação é definitiva: sem novas mensagens.
        const pedidoRecusado = inscricao?.pedido_prazo_status === "RECUSADO";
        const podeMandarMensagem = prazoPerdido && !pedidoPendente && !pedidoRecusado;

        return (
          <div
            key={evento.id_evento}
            className="bg-raised rounded-2xl p-4 w-full flex flex-col lg:flex-row gap-4 items-center border border-ink/[0.12]"
          >
            <div className="w-full lg:w-[220px] h-40 shrink-0 overflow-hidden rounded-xl bg-ink/[0.06] flex items-center justify-center">
              <div className="text-center">
                <Mic2 className="size-11 text-blue-400 mx-auto mb-2" />
                <p className="text-ink-muted text-xs">
                  {evento.tipo_evento || "EVENTO"}
                </p>
              </div>
            </div>

            <div className="flex-1 w-full">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex rounded-full bg-blue-500/15 px-3 py-1 text-xs font-semibold text-blue-400">
                  {evento.tipo_evento || "EVENTO"}
                </span>

                {selo && (
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${selo.classe}`}
                  >
                    <selo.Icone className="size-3.5" />
                    {selo.texto}
                  </span>
                )}
              </div>

              <h3 className="text-ink font-semibold text-xl mb-2">
                {evento.titulo}
              </h3>

              {evento.descricao && (
                <p className="text-ink-muted text-sm mb-3 line-clamp-2">
                  {evento.descricao}
                </p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-ink-muted text-sm">
                <p>
                  <strong>Empresa:</strong>{" "}
                  {evento.nome_empresa || "Empresa parceira"}
                </p>

                <p>
                  {/* Data pura (sem hora): formatar sem converter fuso, senão
                      aparece um dia antes do que a empresa cadastrou. */}
                  <strong>Data:</strong> {formatarDataCurta(evento.data_evento)}
                </p>

                <p>
                  <strong>Horário:</strong> {formatarHorario(evento.horario)}
                </p>

                <p>
                  <strong>Duração:</strong> {evento.carga_horaria}h
                </p>

                <p>
                  <strong>Palestrante:</strong> {evento.palestrante || "-"}
                </p>

                {evento.info_palestrante && (
                  <p className="md:col-span-2 line-clamp-1">
                    <strong>Sobre:</strong> {evento.info_palestrante}
                  </p>
                )}
              </div>

              {inscricao && (
                <div
                  className="mt-4 rounded-xl border border-ink/[0.12] bg-ink/[0.04] p-3 text-sm"
                  aria-label="Comprovação de participação"
                >
                  {situacao === "aguardando_evento" && (
                    <p className="flex items-start gap-2 text-ink">
                      <Hourglass className="size-4 shrink-0 mt-0.5 text-ink" />
                      <span>
                        A entrega da comprovação de participação ainda não foi liberada. Ela abre
                        em <strong>{aberturaTexto}</strong>, depois do evento, e fica disponível
                        até <strong>{prazoTexto}</strong>.
                      </span>
                    </p>
                  )}

                  {situacao === "confirmado" && (
                    <p className="flex items-start gap-2 text-green-300">
                      <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
                      <span>
                        Participação confirmada pela coordenação. {evento.carga_horaria}h
                        contabilizadas.
                      </span>
                    </p>
                  )}

                  {situacao === "aberto" && (
                    <p className="flex items-start gap-2 text-amber-200">
                      <Clock className="size-4 shrink-0 mt-0.5" />
                      <span>
                        Envie a comprovação de participação até{" "}
                        <strong>{prazoTexto}</strong> ({textoDiasRestantes(inscricao.dias_restantes)})
                        para as horas deste evento contarem.
                      </span>
                    </p>
                  )}

                  {situacao === "pendente" && (
                    <p className="flex items-start gap-2 text-blue-300">
                      <Clock className="size-4 shrink-0 mt-0.5" />
                      <span>
                        Comprovação enviada em{" "}
                        {formatarData(inscricao.comprovacao_enviada_em || "")}. Aguardando
                        validação da coordenação.
                        {inscricao.prazo_aberto && ` Você pode substituir o envio até ${prazoTexto}.`}
                      </span>
                    </p>
                  )}

                  {situacao === "reprovado" && (
                    <div className="flex items-start gap-2 text-red-300">
                      <XCircle className="size-4 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p>Comprovação reprovada pela coordenação.</p>
                        {inscricao.comprovacao_motivo_reprovacao && (
                          <p className="text-ink break-words">
                            <strong>Motivo:</strong> {inscricao.comprovacao_motivo_reprovacao}
                          </p>
                        )}
                        <p className="text-ink">
                          {inscricao.prazo_aberto
                            ? `Você pode reenviar até ${prazoTexto} (${textoDiasRestantes(inscricao.dias_restantes)}).`
                            : `O prazo terminou em ${prazoTexto}; as horas deste evento não foram contabilizadas.`}
                        </p>
                      </div>
                    </div>
                  )}

                  {situacao === "encerrado" && (
                    <p className="flex items-start gap-2 text-ink">
                      <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-300" />
                      <span>
                        O prazo para comprovar a participação terminou em {prazoTexto}. As horas
                        deste evento não foram contabilizadas.
                        {podeMandarMensagem &&
                          " Se houve um motivo válido, mande uma mensagem à coordenação pedindo a reabertura do prazo."}
                      </span>
                    </p>
                  )}

                  {inscricao.prazo_estendido_ate && inscricao.prazo_aberto && situacao !== "confirmado" && (
                    <p className="mt-2 text-ink break-words">
                      Prazo estendido pela coordenação
                      {inscricao.prazo_motivo ? `: ${inscricao.prazo_motivo}` : "."}
                    </p>
                  )}

                  {prazoPerdido && pedidoPendente && (
                    <div className="mt-3 rounded-lg bg-blue-500/10 p-3 text-blue-200">
                      <p className="flex items-start gap-2">
                        <MessageSquare className="size-4 shrink-0 mt-0.5" />
                        <span>
                          Mensagem enviada à coordenação em{" "}
                          {formatarData(inscricao.pedido_prazo_em || "")}. Aguardando resposta.
                        </span>
                      </p>
                      {inscricao.pedido_prazo_mensagem && (
                        <p className="mt-1 text-ink break-words whitespace-pre-wrap">
                          “{inscricao.pedido_prazo_mensagem}”
                        </p>
                      )}
                    </div>
                  )}

                  {prazoPerdido && inscricao.pedido_prazo_status === "RECUSADO" && (
                    <div className="mt-3 rounded-lg bg-red-500/10 p-3 text-red-200">
                      <p className="flex items-start gap-2">
                        <MessageSquare className="size-4 shrink-0 mt-0.5" />
                        <span>
                          A coordenação recusou a reabertura do prazo. Não é possível enviar
                          novas mensagens para este evento.
                        </span>
                      </p>
                      {inscricao.pedido_prazo_resposta && (
                        <p className="mt-1 text-ink break-words whitespace-pre-wrap">
                          <strong>Resposta:</strong> {inscricao.pedido_prazo_resposta}
                        </p>
                      )}
                    </div>
                  )}

                  {(inscricao.comprovacao_url || podeEnviar || podeMandarMensagem) && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {inscricao.comprovacao_url && (
                        <a
                          href={inscricao.comprovacao_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-lg bg-ink/[0.06] px-3 py-2 text-ink hover:bg-ink/[0.12] transition"
                        >
                          <Eye className="size-4" />
                          Ver arquivo enviado
                        </a>
                      )}

                      {podeEnviar && (
                        <button
                          type="button"
                          onClick={() => abrirComprovacao(evento)}
                          className="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 font-semibold text-on-brand hover:bg-brand-hover transition"
                        >
                          <Upload className="size-4" />
                          {situacao === "aberto" ? "Enviar comprovação" : "Reenviar comprovação"}
                        </button>
                      )}

                      {podeMandarMensagem && (
                        <button
                          type="button"
                          onClick={() => abrirMensagem(evento)}
                          className="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 font-semibold text-on-brand hover:bg-brand-hover transition"
                        >
                          <MessageSquare className="size-4" />
                          Enviar mensagem à coordenação
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end mt-4">
  <button
    onClick={() => inscreverEvento(evento.id_evento)}
    disabled={inscrito}
    className={`rounded-lg py-2 px-4 text-sm font-semibold transition ${
      inscrito
        ? "bg-green-500 text-on-accent cursor-default"
        : "bg-brand text-on-brand hover:bg-brand-hover"
    }`}
  >
    {inscrito ? "Inscrito" : "Inscrever-se"}
  </button>
</div>
            </div>
          </div>
        );
      })}
    </div>
  )}
</CardContent>
      </Card>

      {mensagemAlvo && createPortal(
        <div className="app-modal-overlay">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="mensagem-coordenacao-titulo"
            className="app-modal-panel"
            style={{ ...panelStyle, maxWidth: "40rem" }}
          >
            <div className="app-modal-header">
              <h2
                id="mensagem-coordenacao-titulo"
                className="text-xl font-semibold text-ink flex items-center gap-2 min-w-0"
              >
                <MessageSquare className="size-5 shrink-0" />
                Mensagem à coordenação
              </h2>

              <button
                onClick={() => setMensagemAlvo(null)}
                disabled={enviandoMensagem}
                aria-label="Fechar"
                className="p-2 rounded-xl bg-ink/[0.06] hover:bg-ink/[0.12] transition"
                type="button"
              >
                <X className="size-5 text-ink" />
              </button>
            </div>

            <form onSubmit={enviarMensagem} className="app-modal-form">
              <div className="app-modal-fields">
                <div className="sm:col-span-2">
                  <p className="text-ink font-medium break-words">{mensagemAlvo.titulo}</p>
                  <p className="text-ink-muted text-sm">
                    O prazo de entrega da comprovação deste evento já passou. Explique por que
                    você não conseguiu entregar; a coordenação pode reabrir o prazo para você.
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="mensagem-coordenacao-texto" className="block text-ink mb-2">
                    Mensagem
                    <Obrigatorio />
                  </label>
                  <textarea
                    id="mensagem-coordenacao-texto"
                    value={textoMensagem}
                    onChange={(e) => setTextoMensagem(e.target.value)}
                    rows={5}
                    maxLength={1000}
                    required
                    className="w-full rounded-xl bg-raised border border-ink/15 p-3 text-ink outline-none"
                    placeholder="Ex: estive afastado por motivo de saúde na semana do prazo..."
                  />
                  <p className="text-ink-muted text-sm mt-2">{textoMensagem.length}/1000</p>
                </div>

                {erroMensagem && (
                  <p role="alert" className="sm:col-span-2 text-red-300 text-sm">
                    {erroMensagem}
                  </p>
                )}
              </div>

              <div className="app-modal-footer">
                <Button
                  type="button"
                  onClick={() => setMensagemAlvo(null)}
                  disabled={enviandoMensagem}
                  variant="outline"
                  className="rounded-xl bg-transparent text-ink hover:bg-ink/[0.06]"
                  style={{ borderColor: "var(--taupe)", color: "var(--ink)" }}
                >
                  Cancelar
                </Button>

                <Button
                  type="submit"
                  disabled={enviandoMensagem}
                  className="rounded-xl bg-brand text-on-brand hover:bg-brand-hover"
                >
                  {enviandoMensagem ? "Enviando..." : "Enviar mensagem"}
                </Button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {comprovacaoAlvo && createPortal(
        <div className="app-modal-overlay">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="comprovacao-titulo"
            className="app-modal-panel"
            style={{ ...panelStyle, maxWidth: "40rem" }}
          >
            <div className="app-modal-header">
              <h2 id="comprovacao-titulo" className="text-xl font-semibold text-ink min-w-0 break-words">
                Comprovar participação
              </h2>

              <button
                onClick={() => setComprovacaoAlvo(null)}
                disabled={enviandoComprovacao}
                aria-label="Fechar"
                className="p-2 rounded-xl bg-ink/[0.06] hover:bg-ink/[0.12] transition"
                type="button"
              >
                <X className="size-5 text-ink" />
              </button>
            </div>

            <form onSubmit={enviarComprovacao} className="app-modal-form">
              <div className="app-modal-fields">
                <div className="sm:col-span-2">
                  <p className="text-ink font-medium break-words">{comprovacaoAlvo.titulo}</p>
                  <p className="text-ink-muted text-sm">
                    Prazo: até{" "}
                    {formatarDataCurta(inscricoes[comprovacaoAlvo.id_evento]?.prazo_comprovacao)}.
                    Envie um certificado, relatório, foto ou outro documento, e/ou escreva um
                    relato. A coordenação valida a comprovação antes de as horas contarem.
                  </p>
                  {inscricoes[comprovacaoAlvo.id_evento]?.comprovacao_status && (
                    <p className="text-amber-200 text-sm mt-2">
                      Este envio substitui a comprovação anterior (arquivo e relato).
                    </p>
                  )}
                  <p className="text-ink-muted text-sm mt-2">
                    <span className="text-red-400">*</span> Preencha pelo menos um dos dois
                    campos abaixo.
                  </p>
                </div>

                <div className="sm:col-span-2 min-w-0">
                  <label htmlFor="comprovacao-arquivo" className="block text-ink mb-2">
                    Arquivo
                    <Obrigatorio />
                  </label>
                  <input
                    id="comprovacao-arquivo"
                    type="file"
                    accept={ACCEPT_COMPROVACAO}
                    onChange={(e) => setArquivoComprovacao(e.target.files?.[0] ?? null)}
                    className="w-full rounded-xl bg-raised border border-ink/15 p-3 text-ink"
                  />
                  <p className="text-ink-muted text-sm mt-2">
                    PNG, JPG, PDF, TXT, DOC ou DOCX, até 10 MB.
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="comprovacao-texto" className="block text-ink mb-2">
                    Relato da participação
                    <Obrigatorio />
                  </label>
                  <textarea
                    id="comprovacao-texto"
                    value={textoComprovacao}
                    onChange={(e) => setTextoComprovacao(e.target.value)}
                    rows={5}
                    maxLength={10000}
                    className="w-full rounded-xl bg-raised border border-ink/15 p-3 text-ink outline-none"
                    placeholder="Conte o que foi apresentado e o que você aprendeu..."
                  />
                </div>

                {erroComprovacao && (
                  <p role="alert" className="sm:col-span-2 text-red-300 text-sm">
                    {erroComprovacao}
                  </p>
                )}
              </div>

              <div className="app-modal-footer">
                <Button
                  type="button"
                  onClick={() => setComprovacaoAlvo(null)}
                  disabled={enviandoComprovacao}
                  variant="outline"
                  className="rounded-xl bg-transparent text-ink hover:bg-ink/[0.06]"
                  style={{ borderColor: "var(--taupe)", color: "var(--ink)" }}
                >
                  Cancelar
                </Button>

                <Button
                  type="submit"
                  disabled={enviandoComprovacao}
                  className="rounded-xl bg-brand text-on-brand hover:bg-brand-hover"
                >
                  {enviandoComprovacao ? "Enviando..." : "Enviar comprovação"}
                </Button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </AlunoLayout>
  );
}