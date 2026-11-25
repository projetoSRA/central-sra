import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import CoordenacaoLayout from "../components/CoordenacaoLayout";
import { User } from "../utils/auth";
import { apiFetch, API_URL, lerJson, mensagemDeErro } from "../utils/api";
import { panelStyle, cardStyle } from "../../styles/uiStyles";
import { EstenderPrazoModal } from "../components/ComprovacoesEventos";
import {
  ComprovacaoInfo,
  ROTULO_SITUACAO,
  formatarDataCurta,
  situacaoComprovacao,
  textoDiasRestantes,
} from "../utils/comprovacao";
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  CalendarDays,
  Eye,
  FileBadge2,
  Mic2,
  Trash2,
  UserRound,
} from "lucide-react";
import { exigirSessao } from "../utils/sessao";
import { toast } from "sonner";
import { confirmar } from "../components/Confirmacao";


type AlunoDetalhe = {
  id_aluno: number;
  nome: string;
  email: string;
  rm: string | null;
  ra: string | null;
  curso: string | null;
  nivel_ensino: "MEDIO" | "FACULDADE" | null;
  serie_semestre: string | null;
  totalPalestrasNoAno: number;
  eventosParticipados: number;
  totalHoras: number;
  empresa_parceira_nome: string | null;
  empresa_parceira_representante: string | null;
};

type Certificado = {
  id_certificado: number;
  titulo: string;
  tipo_arquivo: "CERTIFICADO" | "RELATORIO";
  quantidade_horas: number;
  horas_aprovadas: number;
  data_emissao: string;
  status_certificado: string;
  url_publica: string | null;
};

type EventoAluno = ComprovacaoInfo & {
  id_evento: number;
  nome_empresa: string;
  titulo: string;
  tipo_evento: string | null;
  data_evento: string;
  carga_horaria: number;
  status_inscricao: string;
};

type Visita = {
  id_aluno: number;
  id_visita: number;
  local: string;
  quantidade_horas: number;
  data_visita: string;
  observacao: string | null;
};

type Aba = "certificados" | "eventos" | "visitas";
// As datas exibidas nesta tela vêm de colunas DATE (sem hora). Passar por
// new Date() converte o fuso e mostra um dia antes do cadastrado; por isso
// formata direto do texto AAAA-MM-DD.
function formatarData(dataISO: string | null) {
  return formatarDataCurta(dataISO);
}

function statusInfo(status: string) {
  const normalizado = status.toUpperCase();
  if (normalizado === "APROVADO") return { texto: "Válido", classe: "text-green-400" };
  if (normalizado === "REPROVADO") return { texto: "Inválido", classe: "text-red-400" };
  return { texto: "Pendente", classe: "text-blue-400" };
}

export default function CoordenacaoAlunoDetalhe() {
  const navigate = useNavigate();
  const { idAluno } = useParams();
  const [user, setUser] = useState<User | null>(null);

  const [aluno, setAluno] = useState<AlunoDetalhe | null>(null);
  const [carregandoAluno, setCarregandoAluno] = useState(true);

  const [aba, setAba] = useState<Aba>("certificados");

  const [certificados, setCertificados] = useState<Certificado[]>([]);
  const [eventos, setEventos] = useState<EventoAluno[]>([]);
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [carregandoAba, setCarregandoAba] = useState(false);
  // Incrementado para recarregar a aba atual (ex.: após estender um prazo).
  const [recarga, setRecarga] = useState(0);
  const [prazoAlvo, setPrazoAlvo] = useState<EventoAluno | null>(null);

  const [bimestrePortfolio, setBimestrePortfolio] = useState("1");
  const [gerandoPortfolio, setGerandoPortfolio] = useState(false);

  useEffect(() => {
    const parsedUser = exigirSessao(navigate, "coordenacao");
    if (!parsedUser) return;


    setUser(parsedUser);
  }, [navigate]);

  const carregarAluno = async () => {
    if (!idAluno) return;

    try {
      setCarregandoAluno(true);
      const response = await apiFetch(`${API_URL}/aluno/${idAluno}`);
      const data = await lerJson(response);

      if (!response.ok) {
        throw new Error(data.message || "Erro ao carregar aluno");
      }

      setAluno(data);


    } catch (error) {
      console.error("Erro ao carregar aluno:", error);
      setAluno(null);
    } finally {
      setCarregandoAluno(false);
    }
  };

  const baixarPortfolio = async () => {
    if (!idAluno) return;

    try {
      setGerandoPortfolio(true);

      const response = await apiFetch(
        `${API_URL}/portfolio/${idAluno}/bimestre/${bimestrePortfolio}`
      );

      if (!response.ok) {
        const data = await lerJson(response);
        throw new Error(data?.message || "Erro ao gerar o portfólio.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `portfolio-${aluno?.rm || aluno?.ra || idAluno}-${bimestrePortfolio}bimestre.docx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(mensagemDeErro(error, "Erro ao gerar o portfólio."));
    } finally {
      setGerandoPortfolio(false);
    }
  };

  useEffect(() => {
    if (!user || !idAluno) return;
    carregarAluno();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, idAluno]);

  useEffect(() => {
    if (!user || !idAluno) return;

    async function carregarAba() {
      try {
        setCarregandoAba(true);

        if (aba === "certificados") {
          const response = await apiFetch(`${API_URL}/certificados/aluno/${idAluno}`);
          const data = await lerJson(response);
          if (!response.ok) throw new Error(data.message);
          setCertificados(data);
        }

        if (aba === "eventos") {
          const response = await apiFetch(`${API_URL}/eventos/aluno/${idAluno}`);
          const data = await lerJson(response);
          if (!response.ok) throw new Error(data.message);
          setEventos(data);
        }

        if (aba === "visitas") {
          const response = await apiFetch(`${API_URL}/visita/aluno/${idAluno}`);
          const data = await lerJson(response);
          if (!response.ok) throw new Error(data.message);
          setVisitas(data);
        }
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
        if (aba === "certificados") setCertificados([]);
        if (aba === "eventos") setEventos([]);
        if (aba === "visitas") setVisitas([]);
      } finally {
        setCarregandoAba(false);
      }
    }

    carregarAba();
  }, [user, idAluno, aba, recarga]);

  const excluirVisita = async (idVisita: number) => {
    if (!(await confirmar({ titulo: "Excluir esta visita técnica?", descricao: "A visita e as horas dela saem do registro do aluno. Não dá para desfazer.", confirmar: "Excluir", destrutiva: true }))) return;

    try {
      const response = await apiFetch(`${API_URL}/visita/${idVisita}`, {
        method: "DELETE",
      });
      const data = await lerJson(response);

      if (!response.ok) {
        throw new Error(data.message || "Erro ao excluir visita.");
      }

      setVisitas((prev) => prev.filter((v) => v.id_visita !== idVisita));
      carregarAluno();
    } catch (error) {
      toast.error(mensagemDeErro(error, "Erro ao excluir visita."));
    }
  };

  if (!user) return null;

  return (
    <>
    <CoordenacaoLayout
      user={user}
      activePage="alunos"
      icon={UserRound}
      title={carregandoAluno ? "Carregando..." : aluno?.nome || "Aluno"}
      subtitle="Perfil de horas e participações"
      headerActions={
        <Button
          onClick={() => navigate("/coordenacao/alunos")}
          className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-xl text-ink bg-ink/[0.06] hover:bg-ink/10 border border-ink/[0.12]"
        >
          <ArrowLeft className="size-4" />
          Voltar
        </Button>
      }
    >
        {aluno && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="rounded-2xl bg-raised p-5 border border-ink/[0.12]" style={cardStyle}>
              <p className="text-sm text-ink font-medium mb-1">
                {aluno.nivel_ensino === "FACULDADE" ? "RA" : "RM"}
              </p>
              <p className="text-2xl font-semibold text-ink">
                {(aluno.nivel_ensino === "FACULDADE" ? aluno.ra : aluno.rm) || "-"}
              </p>
            </div>

            <div className="rounded-2xl bg-raised p-5 border border-ink/[0.12]" style={cardStyle}>
              <p className="text-sm text-ink font-medium mb-1">
                Total de palestras no ano
              </p>
              <p className="text-2xl font-semibold text-ink">{aluno.totalPalestrasNoAno}</p>
            </div>

            <div className="rounded-2xl bg-raised p-5 border border-ink/[0.12]" style={cardStyle}>
              <p className="text-sm text-ink font-medium mb-1">
                Palestras que participou
              </p>
              <p className="text-2xl font-semibold text-ink">{aluno.eventosParticipados}</p>
            </div>

            <div className="rounded-2xl bg-raised p-5 border border-ink/[0.12]" style={cardStyle}>
              <p className="text-sm text-ink font-medium mb-1">
                Total de horas
              </p>
              <p className="text-2xl font-semibold text-ink">{Number(aluno.totalHoras || 0)}h</p>
            </div>
          </div>
        )}

        {aluno && (
          <Card className="rounded-2xl border-0 shadow-none mb-6" style={panelStyle}>
            <CardHeader>
              <CardTitle className="text-ink flex items-center gap-2">
                <Building2 className="size-5" />
                Portfólio do Aluno
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="border-t border-ink/[0.12] pt-5 flex flex-col sm:flex-row sm:items-end gap-3">
                <div className="flex-1">
                  <label className="block text-ink text-sm mb-2">Bimestre do portfólio</label>
                  <select
                    value={bimestrePortfolio}
                    onChange={(e) => setBimestrePortfolio(e.target.value)}
                    className="w-full sm:w-48 rounded-xl bg-raised border border-ink/15 p-3 text-ink outline-none"
                  >
                    <option value="1" className="text-ink">1º Bimestre</option>
                    <option value="2" className="text-ink">2º Bimestre</option>
                    <option value="3" className="text-ink">3º Bimestre</option>
                    <option value="4" className="text-ink">4º Bimestre</option>
                  </select>
                </div>

                <Button
                  type="button"
                  onClick={baixarPortfolio}
                  disabled={gerandoPortfolio}
                  className="rounded-xl bg-brand text-on-brand hover:bg-brand-hover"
                >
                  {gerandoPortfolio ? "Gerando..." : "Baixar Portfólio (.docx)"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="rounded-2xl border-0 shadow-none" style={panelStyle}>
          <CardHeader>
            <CardTitle className="text-ink flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex gap-2 bg-ink/[0.06] p-1 rounded-xl self-start sm:self-auto">
                <button
                  onClick={() => setAba("certificados")}
                  type="button"
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1 ${
                    aba === "certificados"
                      ? "bg-brand text-on-brand"
                      : "text-ink hover:text-ink"
                  }`}
                >
                  <FileBadge2 className="size-4" />
                  Certificados
                </button>

                <button
                  onClick={() => setAba("eventos")}
                  type="button"
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1 ${
                    aba === "eventos"
                      ? "bg-brand text-on-brand"
                      : "text-ink hover:text-ink"
                  }`}
                >
                  <Mic2 className="size-4" />
                  Eventos
                </button>

                <button
                  onClick={() => setAba("visitas")}
                  type="button"
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1 ${
                    aba === "visitas"
                      ? "bg-brand text-on-brand"
                      : "text-ink hover:text-ink"
                  }`}
                >
                  <Building2 className="size-4" />
                  Visitas
                </button>
              </div>


            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {carregandoAba && (
              <div className="rounded-2xl border border-dashed border-ink/25 p-8 text-center">
                <p className="text-ink">Carregando...</p>
              </div>
            )}

            {!carregandoAba && aba === "certificados" && (
              certificados.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-ink/25 p-8 text-center">
                  <FileBadge2 className="size-10 text-ink mx-auto mb-3" />
                  <h3 className="text-ink text-lg font-semibold mb-1">
                    Nenhum certificado ou relatório
                  </h3>
                  <p className="text-ink">
                    Os arquivos enviados pelo aluno aparecerão aqui.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                  {certificados.map((item) => {
                    const status = statusInfo(item.status_certificado);
                    return (
                      <div
                        key={item.id_certificado}
                        className="rounded-2xl bg-raised p-5 border border-ink/[0.12]"
                        style={cardStyle}
                      >
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div>
                            <h3 className="text-ink font-semibold text-lg">
                              {item.titulo}
                            </h3>
                            <p className="text-ink-muted text-sm">
                              {item.tipo_arquivo === "RELATORIO" ? "Relatório" : "Certificado"}
                            </p>
                          </div>

                          {item.url_publica && (
                            <a
                              href={item.url_publica}
                              target="_blank"
                              rel="noreferrer"
                              className="p-2 rounded-xl bg-ink/[0.06] hover:bg-ink/[0.12] transition shrink-0"
                              title="Ver arquivo"
                            >
                              <Eye className="size-5 text-ink" />
                            </a>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <p className="text-ink">
                            Data:{" "}
                            <span className="text-ink">
                              {formatarData(item.data_emissao)}
                            </span>
                          </p>
                          <p className="text-ink">
                            Horas:{" "}
                            <span className="text-ink font-semibold">
                              {item.status_certificado.toUpperCase() === "APROVADO"
                                ? `${item.horas_aprovadas}h`
                                : `${item.quantidade_horas}h (solicitado)`}
                            </span>
                          </p>
                          <p className="text-ink col-span-2">
                            Status:{" "}
                            <span className={`${status.classe} font-semibold`}>
                              {status.texto}
                            </span>
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {!carregandoAba && aba === "eventos" && (
              eventos.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-ink/25 p-8 text-center">
                  <Mic2 className="size-10 text-ink mx-auto mb-3" />
                  <h3 className="text-ink text-lg font-semibold mb-1">
                    Nenhum evento
                  </h3>
                  <p className="text-ink">
                    As inscrições do aluno em eventos aparecerão aqui.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                  {eventos.map((evento) => {
                    const situacao = situacaoComprovacao(evento);
                    const rotulo = ROTULO_SITUACAO[situacao];
                    // Extensão só faz sentido para evento concluído e ainda
                    // não confirmado (id_inscricao ausente = banco sem migração).
                    const podeEstender =
                      Boolean(evento.id_inscricao) &&
                      situacao !== "aguardando_evento" &&
                      situacao !== "confirmado";

                    return (
                    <div
                      key={evento.id_evento}
                      className="rounded-2xl bg-raised p-5 border border-ink/[0.12]"
                      style={cardStyle}
                    >
                      <h3 className="text-ink font-semibold text-lg mb-1">
                        {evento.titulo}
                      </h3>
                      <p className="text-ink-muted text-sm mb-3">
                        {evento.nome_empresa} · {evento.tipo_evento || "EVENTO"}
                      </p>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <p className="text-ink">
                          Data:{" "}
                          <span className="text-ink">
                            {formatarData(evento.data_evento)}
                          </span>
                        </p>
                        <p className="text-ink">
                          Horas:{" "}
                          <span className="text-ink font-semibold">
                            {evento.carga_horaria}h
                          </span>
                        </p>
                        <p className="text-ink col-span-2">
                          Situação:{" "}
                          <span className={`${rotulo.classe} font-semibold`}>
                            {rotulo.texto}
                          </span>
                        </p>
                        {situacao !== "aguardando_evento" && situacao !== "confirmado" && (
                          <p className="text-ink col-span-2">
                            Prazo da comprovação:{" "}
                            <span className="text-ink">
                              {formatarDataCurta(evento.prazo_comprovacao)}
                              {evento.prazo_aberto
                                ? ` (${textoDiasRestantes(evento.dias_restantes)})`
                                : " (encerrado)"}
                            </span>
                          </p>
                        )}
                        {evento.prazo_estendido_ate && (
                          <p className="text-ink col-span-2 break-words">
                            Prazo estendido:{" "}
                            <span className="text-ink">
                              {evento.prazo_motivo || "sem motivo registrado"}
                            </span>
                          </p>
                        )}
                        {evento.pedido_prazo_status === "PENDENTE" && evento.pedido_prazo_mensagem && (
                          <p className="text-blue-200 col-span-2 break-words">
                            Pediu reabertura do prazo:{" "}
                            <span className="text-ink">{evento.pedido_prazo_mensagem}</span>
                          </p>
                        )}
                        {evento.comprovacao_motivo_reprovacao && (
                          <p className="text-ink col-span-2 break-words">
                            Motivo da reprovação:{" "}
                            <span className="text-ink">
                              {evento.comprovacao_motivo_reprovacao}
                            </span>
                          </p>
                        )}
                      </div>

                      {(evento.comprovacao_url || podeEstender) && (
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          {evento.comprovacao_url && (
                            <a
                              href={evento.comprovacao_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 rounded-xl bg-ink/[0.06] px-3 py-2 text-sm text-ink hover:bg-ink/[0.12] transition"
                            >
                              <Eye className="size-4" />
                              Ver comprovação
                            </a>
                          )}

                          {podeEstender && (
                            <button
                              type="button"
                              onClick={() => setPrazoAlvo(evento)}
                              className="inline-flex items-center gap-2 rounded-xl bg-ink/[0.06] px-3 py-2 text-sm text-ink hover:bg-ink/[0.12] transition"
                            >
                              <CalendarClock className="size-4" />
                              Estender prazo
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              )
            )}

            {!carregandoAba && aba === "visitas" && (
              visitas.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-ink/25 p-8 text-center">
                  <Building2 className="size-10 text-ink mx-auto mb-3" />
                  <h3 className="text-ink text-lg font-semibold mb-1">
                    Nenhuma visita registrada
                  </h3>
                  <p className="text-ink">
                    Use “Agendar Visita Técnica” na página de Alunos para registrar uma visita para toda a turma.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                  {visitas.map((visita) => (
                    <div
                      key={visita.id_visita}
                      className="rounded-2xl bg-raised p-5 border border-ink/[0.12]"
                      style={cardStyle}
                    >
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <h3 className="text-ink font-semibold text-lg">
                          {visita.local}
                        </h3>

                        <button
                          onClick={() => excluirVisita(visita.id_visita)}
                          className="p-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 transition shrink-0"
                          title="Excluir visita"
                          type="button"
                        >
                          <Trash2 className="size-5 text-red-300" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <p className="text-ink">
                          Quantidade de horas:{" "}
                          <span className="text-ink font-semibold">
                            {visita.quantidade_horas}h
                          </span>
                        </p>
                        <p className="text-ink">
                          Data:{" "}
                          <span className="text-ink">
                            {formatarData(visita.data_visita)}
                          </span>
                        </p>
                        {visita.observacao && (
                          <p className="text-ink col-span-2">
                            Observação:{" "}
                            <span className="text-ink">{visita.observacao}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </CardContent>
        </Card>
    </CoordenacaoLayout>

    {prazoAlvo && prazoAlvo.id_inscricao && (
      <EstenderPrazoModal
        alvo={{ ...prazoAlvo, id_inscricao: prazoAlvo.id_inscricao, nome_aluno: aluno?.nome }}
        onFechar={() => setPrazoAlvo(null)}
        onSalvo={() => {
          setPrazoAlvo(null);
          setRecarga((valor) => valor + 1);
        }}
      />
    )}
    </>
  );
}
