import { mascaraCNPJ } from "../utils/formatar";
import AlternarTema from "../components/AlternarTema";
import { useEffect, useMemo, useState } from "react";
import Obrigatorio from "../components/Obrigatorio";
import { useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { User } from "../utils/auth";
import { formatarDataCurta } from "../utils/comprovacao";
import { apiFetch, clearSession, API_URL, lerJson, mensagemDeErro } from "../utils/api";
import { panelStyle, cardStyle, buttonGlass } from "../../styles/uiStyles";
import {
  Building2,
  CalendarDays,
  Eye,
  LogOut,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { exigirSessao } from "../utils/sessao";
import { toast } from "sonner";
import { confirmar } from "../components/Confirmacao";

type EventoEmpresa = {
  id_evento: number;
  id_empresa: number;
  titulo: string;
  descricao: string | null;
  tipo_evento: string | null;
  data_evento: string;
  horario: string | null;
  carga_horaria: number;
  palestrante: string | null;
  info_palestrante: string | null;
  criado_em: string;
};

type AlunoInscrito = {
  id_aluno: number;
  nome: string;
  email?: string;
  curso?: string;
  rm?: string;
  status_inscricao?: string;
};


// As datas exibidas nesta tela vêm de colunas DATE (sem hora). Passar por
// new Date() converte o fuso e mostra um dia antes do cadastrado; por isso
// formata direto do texto AAAA-MM-DD.
function formatarData(dataISO: string) {
  return formatarDataCurta(dataISO);
}

function formatarHorario(horario: string | null) {
  if (!horario) return "-";
  return horario.slice(0, 5);
}

export default function DashboardEmpresa() {
  const navigate = useNavigate();

  const [user, setUser] = useState<User | null>(null);
  const [eventos, setEventos] = useState<EventoEmpresa[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [modalSair, setModalSair] = useState(false);

  const [modalInscritos, setModalInscritos] = useState(false);
  const [loadingInscritos, setLoadingInscritos] = useState(false);
  const [inscritos, setInscritos] = useState<AlunoInscrito[]>([]);
  const [eventoSelecionado, setEventoSelecionado] =
    useState<EventoEmpresa | null>(null);

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipoEvento, setTipoEvento] = useState("PALESTRA");
  const [dataEvento, setDataEvento] = useState("");
  const [horario, setHorario] = useState("");
  const [cargaHoraria, setCargaHoraria] = useState("");
  const [palestrante, setPalestrante] = useState("");
  const [infoPalestrante, setInfoPalestrante] = useState("");

  useEffect(() => {
    const parsedUser = exigirSessao(navigate, "empresa");
    if (!parsedUser) return;


    setUser(parsedUser);
  }, [navigate]);

  useEffect(() => {
    if (!user) return;

    async function carregarEventos() {
      try {
        setLoading(true);

        const response = await apiFetch(`${API_URL}/eventos/empresa/${user.id}`);
        const data = await lerJson(response);

        if (!response.ok) {
          throw new Error(data.message || "Erro ao carregar eventos");
        }

        setEventos(data);
      } catch (error) {
        console.error("Erro ao carregar eventos:", error);
        setEventos([]);
      } finally {
        setLoading(false);
      }
    }

    carregarEventos();
  }, [user]);

  const totalHoras = useMemo(() => {
    return eventos.reduce(
      (acc, item) => acc + Number(item.carga_horaria || 0),
      0,
    );
  }, [eventos]);

  const limparFormulario = () => {
    setTitulo("");
    setDescricao("");
    setTipoEvento("PALESTRA");
    setDataEvento("");
    setHorario("");
    setCargaHoraria("");
    setPalestrante("");
    setInfoPalestrante("");
  };

  const fecharModal = () => {
    setModalAberto(false);
    limparFormulario();
  };

  const criarEvento = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!user) return;

    try {
      setSalvando(true);

      const response = await apiFetch(`${API_URL}/eventos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idEmpresa: user.id,
          titulo,
          descricao,
          tipoEvento,
          dataEvento,
          horario,
          cargaHoraria,
          palestrante,
          infoPalestrante,
        }),
      });

      const result = await lerJson(response);

      if (!response.ok) {
        throw new Error(result.message || "Erro ao criar evento");
      }

      setEventos((prev) => [result.evento, ...prev]);
      fecharModal();
    } catch (error) {
      toast.error(mensagemDeErro(error, "Erro ao criar evento."));
    } finally {
      setSalvando(false);
    }
  };

  const excluirEvento = async (idEvento: number) => {
    if (!(await confirmar({ titulo: "Excluir este evento?", descricao: "O evento sai da lista e as inscrições dele são canceladas. Não dá para desfazer.", confirmar: "Excluir", destrutiva: true }))) return;

    try {
      const response = await apiFetch(`${API_URL}/eventos/${idEvento}`, {
        method: "DELETE",
      });

      const data = await lerJson(response);

      if (!response.ok) {
        throw new Error(data.message || "Erro ao excluir evento");
      }

      setEventos((prev) => prev.filter((item) => item.id_evento !== idEvento));
    } catch (error) {
      toast.error(mensagemDeErro(error, "Erro ao excluir evento."));
    }
  };

  const verInscritos = async (evento: EventoEmpresa) => {
    try {
      setEventoSelecionado(evento);
      setModalInscritos(true);
      setLoadingInscritos(true);
      setInscritos([]);

      const response = await apiFetch(
        `${API_URL}/eventos/${evento.id_evento}/inscritos`,
      );

      const texto = await response.text();

      let data;
      try {
        data = JSON.parse(texto);
      } catch {
        throw new Error(
          "A rota de inscritos não retornou JSON. Verifique o backend.",
        );
      }

      if (!response.ok) {
        throw new Error(data.message || "Erro ao buscar inscritos");
      }

      setInscritos(data);
    } catch (error) {
      toast.error(mensagemDeErro(error, "Erro ao carregar inscritos."));
    } finally {
      setLoadingInscritos(false);
    }
  };

  const fecharModalInscritos = () => {
    setModalInscritos(false);
    setEventoSelecionado(null);
    setInscritos([]);
  };

  const handleLogout = () => {
  setModalSair(true);
};

const confirmarLogout = () => {
  clearSession();
  navigate("/");
};

  if (!user) return null;

  return (
    <div
      className="min-h-screen lg:h-screen lg:overflow-hidden p-3 sm:p-4 md:p-6 lg:px-10 relative"
      style={{
        background:
          "var(--paper)",
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "none",
        }}
      />

      <div className="relative flex flex-col lg:flex-row h-full gap-4 lg:gap-8">
        <aside
          className="order-2 lg:order-1 w-full lg:w-80 lg:shrink-0 lg:min-h-full p-4 sm:p-6 flex flex-col justify-between rounded-2xl"
          style={panelStyle}
        >
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="size-12 rounded-2xl bg-blue-500/15 flex items-center justify-center">
                <Building2 className="size-7 text-blue-400" />
              </div>

              <div>
                <h2 className="text-2xl font-semibold text-ink">Empresa</h2>
                <p className="text-ink-muted text-sm">Painel corporativo</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl p-4" style={cardStyle}>
                <p className="text-ink-muted text-sm mb-1">Nome</p>
                <p className="text-ink font-semibold">{user.name}</p>
              </div>

              <div className="rounded-2xl p-4" style={cardStyle}>
                <p className="text-ink-muted text-sm mb-1">CNPJ</p>
                <p className="text-ink font-semibold">{mascaraCNPJ(user.identifier)}</p>
              </div>
            </div>
          </div>

          <Button
            onClick={handleLogout}
            style={buttonGlass}
            className="w-full h-12 flex items-center justify-center gap-2 rounded-xl text-ink bg-ink/[0.06] hover:bg-ink/10 mt-8 border border-ink/[0.12]"
          >
            <LogOut className="size-4" />
            Sair
          </Button>
        </aside>

        <main className="order-1 lg:order-2 flex-1 min-w-0 lg:overflow-hidden">
          <div className="max-w-[1760px] mx-auto lg:h-full lg:flex lg:flex-col">
            <header
              className="app-topbar flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 lg:mb-0 p-4 lg:px-0 lg:pt-1 lg:pb-5"
            >
              <div className="flex items-center gap-4">
                <Building2 className="size-6 text-blue-400 shrink-0" />
                <div>
                  <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-ink">
                    Central SRA
                  </h1>
                  <p className="text-ink-muted text-sm">
                    Bem-vindo(a), {user.name}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                onClick={() => setModalAberto(true)}
                className="flex-1 sm:flex-none sm:w-auto rounded-xl bg-brand text-on-brand hover:bg-brand-hover flex items-center justify-center gap-2 px-5 py-2"
              >
                <Plus className="size-4" />
                Novo evento
              </Button>
              <AlternarTema />
              </div>
            </header>

            <div className="app-scroll-area">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-raised border border-ink/[0.12] rounded-2xl p-5">
                <p className="text-ink-muted text-sm">Eventos publicados</p>
                <h2 className="text-ink text-2xl font-semibold mt-1">
                  {eventos.length}
                </h2>
              </div>

              <div className="bg-raised border border-ink/[0.12] rounded-2xl p-5">
                <p className="text-ink-muted text-sm">Horas ofertadas</p>
                <h2 className="text-ink text-2xl font-semibold mt-1">
                  {totalHoras}h
                </h2>
              </div>
            </div>

            <Card className="rounded-3xl border-0 mb-6" style={panelStyle}>
              <CardHeader>
                <CardTitle className="text-ink flex items-center gap-2">
                  <CalendarDays className="size-5 text-blue-400" />
                  Meus eventos
                </CardTitle>
              </CardHeader>

              <CardContent>
                {loading ? (
                  <div
                    className="rounded-2xl p-8 text-center"
                    style={cardStyle}
                  >
                    <p className="text-ink">Carregando eventos...</p>
                  </div>
                ) : eventos.length === 0 ? (
                  <div
                    className="rounded-2xl p-8 text-center"
                    style={cardStyle}
                  >
                    <CalendarDays className="size-10 text-ink mx-auto mb-3" />
                    <h3 className="text-ink text-lg font-semibold mb-1">
                      Nenhum evento publicado
                    </h3>
                    <p className="text-ink">
                      Clique em novo evento para criar sua primeira publicação.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                    {eventos.map((evento) => (
                      <div
                        key={evento.id_evento}
                        className="rounded-2xl p-5 border border-ink/[0.12]"
                        style={cardStyle}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <span className="inline-flex rounded-full bg-blue-500/15 px-3 py-1 text-xs font-semibold text-blue-400 mb-3">
                              {evento.tipo_evento || "EVENTO"}
                            </span>

                            <h3 className="text-ink font-semibold text-xl mb-2">
                              {evento.titulo}
                            </h3>

                            <p className="text-ink-muted text-sm mb-3 line-clamp-3">
                              {evento.descricao || "Sem descrição informada."}
                            </p>

                            <div className="space-y-1 text-sm text-ink-muted">
                              <p>
                                Data:{" "}
                                <span className="text-ink">
                                  {formatarData(evento.data_evento)}
                                </span>
                              </p>

                              <p>
                                Horário:{" "}
                                <span className="text-ink">
                                  {formatarHorario(evento.horario)}
                                </span>
                              </p>

                              <p>
                                Carga horária:{" "}
                                <span className="text-ink font-semibold">
                                  {evento.carga_horaria}h
                                </span>
                              </p>

                              <p>
                                Palestrante:{" "}
                                <span className="text-ink">
                                  {evento.palestrante || "-"}
                                </span>
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <button
                              onClick={() => verInscritos(evento)}
                              className="px-3 py-2 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-sm flex items-center gap-2"
                              type="button"
                            >
                              <Eye className="size-4" />
                              Inscritos
                            </button>

                            <button
                              onClick={() => excluirEvento(evento.id_evento)}
                              className="p-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 transition"
                              title="Excluir evento"
                              type="button"
                            >
                              <Trash2 className="size-5 text-red-300" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            </div>
          </div>
        </main>
      </div>

      {modalAberto && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3 sm:p-5">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="novo-evento-titulo"
            className="flex max-h-[calc(100dvh-2.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl shadow-xl"
            style={panelStyle}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-ink/[0.12] px-4 py-3 sm:px-6">
              <h2 id="novo-evento-titulo" className="text-xl font-semibold text-ink">Novo evento</h2>

              <button
                onClick={fecharModal}
                className="p-2 rounded-xl bg-ink/[0.06] hover:bg-ink/[0.12] transition"
                type="button"
                aria-label="Fechar novo evento"
              >
                <X className="size-5 text-ink" />
              </button>
            </div>

            <form
              onSubmit={criarEvento}
              className="flex min-h-0 flex-col"
            >
              <div className="grid min-h-0 grid-cols-1 gap-4 overflow-y-auto p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
              <div className="sm:col-span-2">
                <label className="block text-ink mb-2">Título<Obrigatorio /></label>
                <input
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  required
                  className="w-full rounded-xl bg-raised border border-ink/15 p-3 text-ink outline-none"
                  placeholder="Ex: Palestra de Tecnologia"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-ink mb-2">Descrição</label>
                <textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl bg-raised border border-ink/15 p-3 text-ink outline-none resize-none"
                  placeholder="Descreva o evento..."
                />
              </div>

              <div>
                <label className="block text-ink mb-2">Tipo</label>
                <select
                  value={tipoEvento}
                  onChange={(e) => setTipoEvento(e.target.value)}
                  className="w-full rounded-xl border border-ink/[0.12] p-3 outline-none bg-raised text-ink focus:border-blue-400"
                >
                  <option className="bg-raised text-ink" value="PALESTRA">
                    Palestra
                  </option>
                  <option className="bg-raised text-ink" value="WORKSHOP">
                    Workshop
                  </option>
                  <option className="bg-raised text-ink" value="FEIRA">
                    Feira
                  </option>
                  <option className="bg-raised text-ink" value="CURSO">
                    Curso
                  </option>
                  <option className="bg-raised text-ink" value="OUTRO">
                    Outro
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-ink mb-2">Carga horária<Obrigatorio /></label>
                <input
                  type="number"
                  min={1}
                  value={cargaHoraria}
                  onChange={(e) => setCargaHoraria(e.target.value)}
                  required
                  className="w-full rounded-xl bg-raised border border-ink/15 p-3 text-ink outline-none"
                  placeholder="Ex: 4"
                />
              </div>

              <div>
                <label className="block text-ink mb-2">Data<Obrigatorio /></label>
                <input
                  type="date"
                  value={dataEvento}
                  onChange={(e) => setDataEvento(e.target.value)}
                  required
                  className="w-full rounded-xl bg-raised border border-ink/15 p-3 text-ink outline-none"
                />
              </div>

              <div>
                <label className="block text-ink mb-2">Horário</label>
                <input
                  type="time"
                  value={horario}
                  onChange={(e) => setHorario(e.target.value)}
                  className="w-full rounded-xl bg-raised border border-ink/15 p-3 text-ink outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-ink mb-2">Palestrante</label>
                <input
                  value={palestrante}
                  onChange={(e) => setPalestrante(e.target.value)}
                  className="w-full rounded-xl bg-raised border border-ink/15 p-3 text-ink outline-none"
                  placeholder="Nome do palestrante"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-ink mb-2">
                  Info palestrante
                </label>
                <input
                  value={infoPalestrante}
                  onChange={(e) => setInfoPalestrante(e.target.value)}
                  className="w-full rounded-xl bg-raised border border-ink/15 p-3 text-ink outline-none"
                  placeholder="Ex: Especialista em tecnologia"
                />
              </div>

              </div>

              <div className="flex shrink-0 flex-wrap justify-end gap-3 border-t border-ink/[0.12] px-4 py-3 sm:px-6">
                <Button
                  type="button"
                  onClick={fecharModal}
                  variant="outline"
                  className="rounded-xl bg-transparent text-ink hover:bg-ink/[0.06]"
                  style={{
                    borderColor: "var(--taupe)",
                    color: "var(--ink)",
                  }}
                >
                  Cancelar
                </Button>

                <Button
                  type="submit"
                  disabled={salvando}
                  className="rounded-xl bg-brand text-on-brand hover:bg-brand-hover"
                >
                  {salvando ? "Salvando..." : "Publicar evento"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalInscritos && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div
            className="flex w-full max-w-4xl max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-2xl p-4 sm:p-6 shadow-xl border border-ink/[0.12]"
            style={panelStyle}
          >
            {/* HEADER */}
            <div className="flex shrink-0 items-start justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-ink">
                  Alunos inscritos
                </h2>
                <p className="text-ink-muted text-sm mt-1">
                  {eventoSelecionado?.titulo}
                </p>
              </div>

              <button
                onClick={fecharModalInscritos}
                className="p-2 rounded-xl bg-ink/[0.06] hover:bg-ink/[0.12] transition"
                type="button"
              >
                <X className="size-5 text-ink" />
              </button>
            </div>

            {/* TOTAL */}
            <div className="shrink-0 rounded-xl bg-raised p-4 mb-5 border border-ink/[0.12]">
              <p className="text-ink-muted text-xs uppercase tracking-wide">
                Total de inscritos
              </p>
              <p className="text-ink text-3xl font-semibold">
                {inscritos.length}
              </p>
            </div>

            {/* LISTA */}
            <div className="grid min-h-0 grid-cols-1 gap-3 overflow-y-auto custom-scroll pr-2 sm:grid-cols-2">
              {loadingInscritos ? (
                <p className="text-ink text-center py-4">
                  Carregando inscritos...
                </p>
              ) : inscritos.length === 0 ? (
                <p className="text-ink text-center py-4">
                  Nenhum aluno inscrito ainda.
                </p>
              ) : (
                inscritos.map((item) => (
                  <div
                    key={item.id_aluno}
                    className="rounded-xl bg-ink/[0.03] p-4 border border-ink/[0.12] hover:bg-ink/[0.06] transition"
                  >
                    <p className="text-ink font-semibold">{item.nome}</p>

                    <div className="mt-1 space-y-1 text-sm text-ink-muted">
                      <p>
                        {item.curso || "Análise e Desenvolvimento de Sistemas"}
                      </p>

                      {item.rm && <p>RM: {item.rm}</p>}
                    </div>

                    {/* STATUS */}
                    {item.status_inscricao && (
                      <div className="mt-2">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400">
                          {item.status_inscricao}
                        </span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* FOOTER */}
            <Button
              onClick={fecharModalInscritos}
              className="w-full shrink-0 mt-6 rounded-xl bg-brand text-on-brand hover:bg-brand-hover"
            >
              Fechar
            </Button>
          </div>
        </div>
      )}
      {modalSair && (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div
      className="w-full max-w-xl max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl p-4 sm:p-6 border border-ink/[0.12] shadow-2xl"
      style={panelStyle}
    >
      <div className="mb-5">
        <h2 className="text-ink text-xl font-semibold">
          Deseja realmente sair?
        </h2>
        <p className="text-ink-muted text-sm mt-2">
          Você será redirecionado para a tela de login.
        </p>
      </div>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          onClick={() => setModalSair(false)}
          style={buttonGlass}
          className="rounded-xl text-ink hover:bg-ink/10 border border-ink/[0.12]"
        >
          Cancelar
        </Button>

        <Button
          type="button"
          onClick={confirmarLogout}
          className="rounded-xl bg-red-500/90 text-on-accent hover:bg-red-600"
        >
          Sair
        </Button>
      </div>
    </div>
  </div>
)}
    </div>
  );
}
