import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import CoordenacaoLayout from "../components/CoordenacaoLayout";
import ComprovacoesEventos from "../components/ComprovacoesEventos";
import { User } from "../utils/auth";
import { formatarDataCurta } from "../utils/comprovacao";
import { apiFetch } from "../utils/api";
import { panelStyle, cardStyle } from "../../styles/uiStyles";
import {
  CheckCircle2,
  Clock,
  Eye,
  History,
  FileCheck2,
  FileText,
  Mic2,
  Users,
  X,
  XCircle,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

type Pendente = {
  id_certificado: number;
  id_aluno: number;
  nome_aluno: string;
  email_aluno: string;
  titulo: string;
  instituicao: string | null;
  quantidade_horas: number;
  data_emissao: string;
  tipo_arquivo: "CERTIFICADO" | "RELATORIO";
  nome_arquivo: string | null;
  mime_type: string | null;
  url_publica: string | null;
  status_certificado: string;
  criado_em: string;
};

type Historico = {
  id_validacao: number;
  id_certificado: number;
  horas_validadas: number;
  status_validacao: string;
  observacao: string | null;
  data_validacao: string;
  criado_em: string;
  titulo: string;
  id_aluno: number;
  nome_aluno: string;
  tipo_arquivo: "CERTIFICADO" | "RELATORIO";
};

// As datas exibidas nesta tela vêm de colunas DATE (sem hora). Passar por
// new Date() converte o fuso e mostra um dia antes do cadastrado; por isso
// formata direto do texto AAAA-MM-DD.
function formatarData(dataISO: string) {
  return formatarDataCurta(dataISO);
}

function statusClasse(status: string) {
  const statusNormalizado = status.toUpperCase();

  if (statusNormalizado === "APROVADO") return "text-green-400";
  if (statusNormalizado === "REPROVADO") return "text-red-400";

  return "text-blue-400";
}

export default function DashboardCoordenacao() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);

  const [aba, setAba] = useState<"pendentes" | "eventos" | "historico">("pendentes");
  // Comprovações de eventos aguardando validação (informado pelo componente).
  const [comprovacoesPendentes, setComprovacoesPendentes] = useState(0);

  const [pendentes, setPendentes] = useState<Pendente[]>([]);
  const [loadingPendentes, setLoadingPendentes] = useState(false);
  const [horasPorItem, setHorasPorItem] = useState<Record<number, string>>({});
  const [processando, setProcessando] = useState<number | null>(null);

  const [historico, setHistorico] = useState<Historico[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [historicoCarregado, setHistoricoCarregado] = useState(false);
  const [totalAlunos, setTotalAlunos] = useState(0);

  const [rejeicaoAlvo, setRejeicaoAlvo] = useState<Pendente | null>(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState("");

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) {
      navigate("/");
      return;
    }

    const parsedUser = JSON.parse(userData) as User;
    if (parsedUser.type !== "coordenacao") {
      navigate("/");
      return;
    }

    setUser(parsedUser);
  }, [navigate]);

  const carregarPendentes = async () => {
    try {
      setLoadingPendentes(true);

      const response = await apiFetch(`${API_URL}/validacao/pendentes`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Erro ao carregar pendências");
      }

      setPendentes(data);
      setHorasPorItem((prev) => {
        const novo = { ...prev };
        data.forEach((item: Pendente) => {
          if (novo[item.id_certificado] === undefined) {
            novo[item.id_certificado] = String(item.quantidade_horas);
          }
        });
        return novo;
      });
    } catch (error) {
      console.error("Erro ao carregar pendências:", error);
      setPendentes([]);
    } finally {
      setLoadingPendentes(false);
    }
  };

  const carregarHistorico = async () => {
    if (!user) return;

    try {
      setLoadingHistorico(true);

      const response = await apiFetch(
        `${API_URL}/validacao/coordenacao/${user.id}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Erro ao carregar histórico");
      }

      setHistorico(data);
      setHistoricoCarregado(true);
    } catch (error) {
      console.error("Erro ao carregar histórico:", error);
      setHistorico([]);
    } finally {
      setLoadingHistorico(false);
    }
  };

  const carregarTotalAlunos = async () => {
    try {
      const response = await apiFetch(`${API_URL}/aluno`);
      const data = await response.json();
      setTotalAlunos(response.ok && Array.isArray(data) ? data.length : 0);
    } catch {
      setTotalAlunos(0);
    }
  };

  useEffect(() => {
    if (!user) return;
    carregarPendentes();
    carregarHistorico();
    carregarTotalAlunos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (aba === "historico" && !historicoCarregado) {
      carregarHistorico();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba, user]);

  const aprovar = async (item: Pendente) => {
    if (!user) return;

    const horasInformadas = Number(
      horasPorItem[item.id_certificado] ?? item.quantidade_horas
    );

    if (
      Number.isNaN(horasInformadas) ||
      horasInformadas < 0 ||
      horasInformadas > item.quantidade_horas
    ) {
      alert(`Informe um valor entre 0 e ${item.quantidade_horas}.`);
      return;
    }

    try {
      setProcessando(item.id_certificado);

      const response = await apiFetch(`${API_URL}/validacao`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idCertificado: item.id_certificado,
          idCoordenacao: user.id,
          statusValidacao: "APROVADO",
          horasValidadas: horasInformadas,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Erro ao aprovar.");
      }

      setPendentes((prev) =>
        prev.filter((p) => p.id_certificado !== item.id_certificado)
      );
      setHistoricoCarregado(false);
      carregarHistorico();
    } catch (error: any) {
      alert(error.message || "Erro ao aprovar arquivo.");
    } finally {
      setProcessando(null);
    }
  };

  const abrirRejeicao = (item: Pendente) => {
    setRejeicaoAlvo(item);
    setMotivoRejeicao("");
  };

  const confirmarRejeicao = async () => {
    if (!rejeicaoAlvo || !user) return;

    try {
      setProcessando(rejeicaoAlvo.id_certificado);

      const response = await apiFetch(`${API_URL}/validacao`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idCertificado: rejeicaoAlvo.id_certificado,
          idCoordenacao: user.id,
          statusValidacao: "REPROVADO",
          observacao: motivoRejeicao || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Erro ao reprovar.");
      }

      setPendentes((prev) =>
        prev.filter((p) => p.id_certificado !== rejeicaoAlvo.id_certificado)
      );
      setHistoricoCarregado(false);
      carregarHistorico();
      setRejeicaoAlvo(null);
    } catch (error: any) {
      alert(error.message || "Erro ao reprovar arquivo.");
    } finally {
      setProcessando(null);
    }
  };

  if (!user) return null;

  const certificadosAprovados = historico.filter(
    (item) =>
      item.status_validacao.toUpperCase() === "APROVADO" &&
      item.tipo_arquivo === "CERTIFICADO"
  ).length;
  const relatoriosAprovados = historico.filter(
    (item) =>
      item.status_validacao.toUpperCase() === "APROVADO" &&
      item.tipo_arquivo === "RELATORIO"
  ).length;

  return (
    <>
    <CoordenacaoLayout
      user={user}
      activePage="dashboard"
      title="Dashboard da Coordenação"
      subtitle={`Bem-vindo(a), ${user.name}`}
      pendentesCount={
        loadingPendentes ? undefined : pendentes.length + comprovacoesPendentes
      }
    >
      <section className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3" aria-label="Resumo da coordenação">
        {[
          { label: "Pendências", value: pendentes.length + comprovacoesPendentes, icon: Clock, color: "text-amber-300" },
          { label: "Alunos", value: totalAlunos, icon: Users, color: "text-blue-300" },
          { label: "Certificados", value: certificadosAprovados, icon: FileCheck2, color: "text-emerald-300" },
          { label: "Relatórios", value: relatoriosAprovados, icon: FileText, color: "text-violet-300" },
        ].map(({ label, value, icon: SummaryIcon, color }) => (
          <div key={label} className="flex items-center gap-3 rounded-xl border border-ink/[0.12] bg-ink/[0.04] p-3 sm:p-4">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-ink/[0.06]">
              <SummaryIcon className={`size-5 ${color}`} />
            </div>
            <div className="min-w-0">
              <strong className="block text-xl leading-none text-ink">{value}</strong>
              <span className="mt-1 block truncate text-xs text-ink/65">{label}</span>
            </div>
          </div>
        ))}
      </section>

      <Card className="gap-2 rounded-2xl border-0 shadow-none" style={panelStyle}>
          <CardHeader className="px-4 pt-4 pb-2 sm:px-5 sm:pt-5">
            <CardTitle className="text-base sm:text-lg text-ink flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <Clock className="size-5 shrink-0" />
                Validações
              </span>

              <div className="flex w-full gap-1 bg-ink/[0.06] p-1 rounded-xl sm:w-auto sm:gap-2">
                <button
                  onClick={() => setAba("pendentes")}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition sm:flex-none sm:px-4 ${
                    aba === "pendentes"
                      ? "bg-ink text-on-accent"
                      : "text-ink/75 hover:text-ink"
                  }`}
                  type="button"
                >
                  Arquivos{pendentes.length > 0 ? ` (${pendentes.length})` : ""}
                </button>

                <button
                  onClick={() => setAba("eventos")}
                  className={`flex flex-1 items-center justify-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition sm:flex-none sm:px-4 ${
                    aba === "eventos"
                      ? "bg-ink text-on-accent"
                      : "text-ink/75 hover:text-ink"
                  }`}
                  type="button"
                >
                  <Mic2 className="size-4" />
                  Eventos{comprovacoesPendentes > 0 ? ` (${comprovacoesPendentes})` : ""}
                </button>

                <button
                  onClick={() => setAba("historico")}
                  className={`flex flex-1 items-center justify-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition sm:flex-none sm:px-4 ${
                    aba === "historico"
                      ? "bg-ink text-on-accent"
                      : "text-ink/75 hover:text-ink"
                  }`}
                  type="button"
                >
                  <History className="size-4" />
                  Histórico
                </button>
              </div>
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4 px-3 pt-1 pb-3 sm:px-5 sm:pb-5">
            {aba === "pendentes" && (
              <>
                {loadingPendentes && (
                  <div className="rounded-xl bg-raised border border-ink/[0.12] p-5 text-center sm:p-6">
                    <p className="text-ink/75">Carregando pendências...</p>
                  </div>
                )}

                {!loadingPendentes && pendentes.length === 0 && (
                  <div className="rounded-xl bg-raised border border-ink/[0.12] p-5 text-center sm:p-6">
                    <CheckCircle2 className="size-8 text-emerald-300 mx-auto mb-2" />
                    <h3 className="text-ink text-base font-semibold mb-1">
                      Nenhuma pendência
                    </h3>
                    <p className="text-ink/70 text-sm">
                      Todos os certificados e relatórios já foram avaliados.
                    </p>
                  </div>
                )}

                {!loadingPendentes && pendentes.length > 0 && (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                    {pendentes.map((item) => (
                      <div
                        key={item.id_certificado}
                        className="rounded-2xl bg-raised p-5 border border-ink/[0.12]"
                        style={cardStyle}
                      >
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="min-w-0">
                            <h3 className="text-ink font-semibold text-lg break-words">
                              {item.titulo}
                            </h3>
                            <p className="text-ink/75 text-sm break-words">
                              {item.nome_aluno} · {item.email_aluno}
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

                        <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                          <p className="text-ink/75">
                            Tipo:{" "}
                            <span className="text-ink">
                              {item.tipo_arquivo === "RELATORIO"
                                ? "Relatório"
                                : "Certificado"}
                            </span>
                          </p>
                          <p className="text-ink/75">
                            Data:{" "}
                            <span className="text-ink">
                              {formatarData(item.data_emissao)}
                            </span>
                          </p>
                          <p className="text-ink/75">
                            Horas solicitadas:{" "}
                            <span className="text-ink font-semibold">
                              {item.quantidade_horas}h
                            </span>
                          </p>
                          <p className="text-ink/75">
                            Arquivo:{" "}
                            <span className="text-ink">
                              {item.nome_arquivo || "-"}
                            </span>
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-2">
                            <label className="text-ink/75 text-sm">
                              Horas a aprovar:
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={item.quantidade_horas}
                              value={
                                horasPorItem[item.id_certificado] ??
                                String(item.quantidade_horas)
                              }
                              onChange={(e) =>
                                setHorasPorItem((prev) => ({
                                  ...prev,
                                  [item.id_certificado]: e.target.value,
                                }))
                              }
                              className="w-20 rounded-lg bg-raised border border-ink/15 p-2 text-ink outline-none"
                            />
                          </div>

                          <div className="flex gap-2 ml-auto">
                            <button
                              onClick={() => abrirRejeicao(item)}
                              disabled={processando === item.id_certificado}
                              className="p-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 transition disabled:opacity-50"
                              title="Reprovar"
                              type="button"
                            >
                              <XCircle className="size-5 text-red-300" />
                            </button>

                            <button
                              onClick={() => aprovar(item)}
                              disabled={processando === item.id_certificado}
                              className="p-2 rounded-xl bg-green-500/20 hover:bg-green-500/30 transition disabled:opacity-50"
                              title="Aprovar"
                              type="button"
                            >
                              <CheckCircle2 className="size-5 text-green-300" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Sempre montado (só oculto) para o contador de pendências
                de eventos aparecer mesmo com outra aba aberta. */}
            <div className="space-y-4" hidden={aba !== "eventos"}>
              <ComprovacoesEventos onPendentesChange={setComprovacoesPendentes} />
            </div>

            {aba === "historico" && (
              <>
                {loadingHistorico && (
                  <div className="rounded-xl bg-raised border border-ink/[0.12] p-5 text-center sm:p-6">
                    <p className="text-ink/75">Carregando histórico...</p>
                  </div>
                )}

                {!loadingHistorico && historico.length === 0 && (
                  <div className="rounded-xl bg-raised border border-ink/[0.12] p-5 text-center sm:p-6">
                    <History className="size-10 text-ink/75 mx-auto mb-3" />
                    <h3 className="text-ink text-lg font-semibold mb-1">
                      Nenhuma validação registrada
                    </h3>
                    <p className="text-ink/75">
                      As validações que você fizer aparecerão aqui.
                    </p>
                  </div>
                )}

                {!loadingHistorico && historico.length > 0 && (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                    {historico.map((item) => (
                      <div
                        key={item.id_validacao}
                        className="rounded-2xl bg-raised p-5 border border-ink/[0.12]"
                        style={cardStyle}
                      >
                        <h3 className="text-ink font-semibold text-lg mb-1 break-words">
                          {item.titulo}
                        </h3>
                        <p className="text-ink/75 text-sm mb-3 break-words">
                          {item.nome_aluno}
                        </p>

                        <p className="text-ink/75 text-sm mb-1">
                          Status:{" "}
                          <span
                            className={`${statusClasse(
                              item.status_validacao
                            )} font-semibold`}
                          >
                            {item.status_validacao}
                          </span>
                        </p>

                        <p className="text-ink/75 text-sm mb-1">
                          Horas validadas:{" "}
                          <span className="text-ink">
                            {item.horas_validadas}h
                          </span>
                        </p>

                        <p className="text-ink/75 text-sm mb-1">
                          Data:{" "}
                          <span className="text-ink">
                            {formatarData(item.data_validacao)}
                          </span>
                        </p>

                        {item.observacao && (
                          <p className="text-ink/75 text-sm break-words">
                            Observação:{" "}
                            <span className="text-ink">
                              {item.observacao}
                            </span>
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
    </CoordenacaoLayout>

    {rejeicaoAlvo && (
        <div className="app-modal-overlay">
          <div className="w-full max-w-xl max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl p-4 sm:p-6 shadow-xl" style={panelStyle}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-semibold text-ink">
                Reprovar "{rejeicaoAlvo.titulo}"
              </h2>

              <button
                onClick={() => setRejeicaoAlvo(null)}
                className="p-2 rounded-xl bg-ink/[0.06] hover:bg-ink/[0.12] transition"
                type="button"
              >
                <X className="size-5 text-ink" />
              </button>
            </div>

            <label className="block text-ink mb-2">
              Motivo (opcional)
            </label>
            <textarea
              value={motivoRejeicao}
              onChange={(e) => setMotivoRejeicao(e.target.value)}
              rows={4}
              className="w-full rounded-xl bg-raised border border-ink/15 p-3 text-ink outline-none"
              placeholder="Explique por que este arquivo está sendo reprovado..."
            />

            <div className="flex flex-wrap justify-end gap-3 pt-4">
              <Button
                type="button"
                onClick={() => setRejeicaoAlvo(null)}
                variant="outline"
                className="rounded-xl bg-transparent text-ink hover:bg-ink/[0.06]"
                style={{ borderColor: "#7d7d7d", color: "var(--ink)" }}
              >
                Cancelar
              </Button>

              <Button
                type="button"
                onClick={confirmarRejeicao}
                disabled={processando === rejeicaoAlvo.id_certificado}
                className="rounded-xl bg-red-500 text-on-accent hover:bg-red-600"
              >
                {processando === rejeicaoAlvo.id_certificado
                  ? "Enviando..."
                  : "Confirmar reprovação"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
