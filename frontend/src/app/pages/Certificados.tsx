import { useEffect, useMemo, useState } from "react";
import Obrigatorio from "../components/Obrigatorio";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { User } from "../utils/auth";
import { formatarDataCurta } from "../utils/comprovacao";
import { apiFetch, API_URL, lerJson, mensagemDeErro } from "../utils/api";
import AlunoLayout, { glassCardStyle } from "../components/AlunoLayout";
import { panelStyle, cardStyle, buttonGlass } from "../../styles/uiStyles";
import {
  FileText,
  Upload,
  Trash2,
  Eye,
  X,
  FileBadge2,
} from "lucide-react";
import { exigirSessao } from "../utils/sessao";
import { toast } from "sonner";
import { confirmar } from "../components/Confirmacao";

type TipoArquivo = "certificado" | "relatorio";

type ArquivoAluno = {
  id: number;
  tipo: TipoArquivo;
  titulo: string;
  quantidadeHoras: number;
  horasAprovadas: number;
  dataEmissao: string;
  arquivoNome: string;
  arquivoUrl: string;
  status: string;
};

// Formato do arquivo como vem da API (colunas do banco).
type ArquivoApi = {
  id_certificado: number;
  tipo_arquivo?: string | null;
  titulo: string;
  quantidade_horas?: number | string | null;
  horas_aprovadas?: number | string | null;
  data_emissao: string;
  nome_arquivo?: string | null;
  url_publica?: string | null;
  url_arquivo?: string | null;
  status_certificado?: string | null;
};

function paraArquivoAluno(item: ArquivoApi): ArquivoAluno {
  return {
    id: item.id_certificado,
    tipo: item.tipo_arquivo === "RELATORIO" ? "relatorio" : "certificado",
    titulo: item.titulo,
    quantidadeHoras: Number(item.quantidade_horas || 0),
    horasAprovadas: Number(item.horas_aprovadas || 0),
    dataEmissao: item.data_emissao,
    arquivoNome: item.nome_arquivo || "Arquivo",
    arquivoUrl: item.url_publica || item.url_arquivo || "",
    status: item.status_certificado || "PENDENTE",
  };
}


// As datas exibidas nesta tela vêm de colunas DATE (sem hora). Passar por
// new Date() converte o fuso e mostra um dia antes do cadastrado; por isso
// formata direto do texto AAAA-MM-DD.
function formatarData(dataISO: string) {
  return formatarDataCurta(dataISO);
}

function statusClasse(status: string) {
  const statusNormalizado = status.toUpperCase();

  if (statusNormalizado === "APROVADO") {
    return "text-green-400";
  }

  if (statusNormalizado === "REPROVADO") {
    return "text-red-400";
  }

  return "text-blue-400";
}

export default function Certificados() {
  const navigate = useNavigate();

  const [user, setUser] = useState<User | null>(null);
  const [arquivos, setArquivos] = useState<ArquivoAluno[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [filtro, setFiltro] = useState<TipoArquivo>("certificado");
  const [tipoSelecionado, setTipoSelecionado] =
    useState<TipoArquivo>("certificado");

  const [titulo, setTitulo] = useState("");
  const [horas, setHoras] = useState("");
  const [data, setData] = useState("");
  const [bimestre, setBimestre] = useState("");
  const [local, setLocal] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const parsedUser = exigirSessao(navigate, "aluno");
    if (!parsedUser) return;


    setUser(parsedUser);
  }, [navigate]);

  useEffect(() => {
    if (!user) return;

    async function carregarArquivos() {
      try {
        setLoading(true);

        const response = await apiFetch(`${API_URL}/certificados/aluno/${user.id}`);
        const data = await lerJson(response);

        if (!response.ok) {
          throw new Error(data.message || "Erro ao carregar arquivos");
        }

        const arquivosFormatados: ArquivoAluno[] = data.map(paraArquivoAluno);

        setArquivos(arquivosFormatados);
      } catch (error) {
        console.error("Erro ao carregar arquivos:", error);
        setArquivos([]);
      } finally {
        setLoading(false);
      }
    }

    carregarArquivos();
  }, [user]);

  const certificados = arquivos.filter((item) => item.tipo === "certificado");
  const relatorios = arquivos.filter((item) => item.tipo === "relatorio");

  const totalHoras = useMemo(() => {
    return arquivos
      .filter((item) => item.status.toUpperCase() === "APROVADO")
      .reduce((acc, item) => acc + Number(item.horasAprovadas || 0), 0);
  }, [arquivos]);

  const limparFormulario = () => {
    setTitulo("");
    setHoras("");
    setData("");
    setBimestre("");
    setLocal("");
    setConteudo("");
    setArquivo(null);
  };

  const abrirModal = (tipo: TipoArquivo) => {
    setTipoSelecionado(tipo);
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    limparFormulario();
  };

  const validarArquivo = () => {
    if (!arquivo) {
      toast.error("Selecione um arquivo.");
      return false;
    }

    const nome = arquivo.name.toLowerCase();

    const extensoesCertificado = [".png", ".jpg", ".jpeg", ".pdf"];
    const extensoesRelatorio = [".pdf", ".txt", ".doc", ".docx"];

    const extensoesPermitidas =
      tipoSelecionado === "certificado"
        ? extensoesCertificado
        : extensoesRelatorio;

    const permitido = extensoesPermitidas.some((ext) => nome.endsWith(ext));

    if (!permitido) {
      toast.error(
        tipoSelecionado === "certificado"
          ? "Certificados aceitam apenas imagem ou PDF."
          : "Relatórios aceitam apenas PDF, TXT, DOC ou DOCX."
      );
      return false;
    }

    const horasNumber = Number(horas);

    if (Number.isNaN(horasNumber) || horasNumber <= 0) {
      toast.error("Informe uma quantidade de horas válida.");
      return false;
    }

    if (
      tipoSelecionado === "relatorio" &&
      (horasNumber < 1 || horasNumber > 2)
    ) {
      toast.error("Relatórios devem ter entre 1 e 2 horas.");
      return false;
    }

    if (!bimestre) {
      toast.error("Selecione o bimestre.");
      return false;
    }

    if (tipoSelecionado === "relatorio") {
      if (!local.trim() || !conteudo.trim()) {
        toast.error(
          "Para relatórios, informe o local da atividade e o conteúdo do relato — é o texto usado para montar o Portfólio do Aluno automaticamente."
        );
        return false;
      }
    }

    return true;
  };

  const enviarArquivo = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validarArquivo() || !arquivo || !user) return;

    try {
      setSalvando(true);

      const formData = new FormData();

      formData.append("tipo", tipoSelecionado);
      formData.append("titulo", titulo);
      formData.append("horas", horas);
      formData.append("dataEmissao", data);
      formData.append("bimestre", bimestre);
      formData.append("arquivo", arquivo);

      if (tipoSelecionado === "relatorio") {
        formData.append("local", local);
        formData.append("conteudo", conteudo);
      }

      const response = await apiFetch(`${API_URL}/certificados/upload`, {
        method: "POST",
        body: formData,
      });

      const result = await lerJson(response);

      if (!response.ok) {
        throw new Error(result.message || "Erro ao enviar arquivo");
      }

      const novoArquivo = paraArquivoAluno(result.arquivo as ArquivoApi);

      setArquivos((prev) => [novoArquivo, ...prev]);
      fecharModal();
    } catch (error) {
      toast.error(mensagemDeErro(error, "Erro ao enviar arquivo."));
    } finally {
      setSalvando(false);
    }
  };

  const excluirArquivo = async (id: number) => {
    if (!(await confirmar({ titulo: "Excluir este arquivo?", descricao: "O arquivo e as horas dele saem da sua lista. Não dá para desfazer.", confirmar: "Excluir", destrutiva: true }))) return;

    try {
      const response = await apiFetch(`${API_URL}/certificados/${id}`, {
        method: "DELETE",
      });

      const data = await lerJson(response);

      if (!response.ok) {
        throw new Error(data.message || "Erro ao excluir arquivo");
      }

      setArquivos((prev) => prev.filter((item) => item.id !== id));
    } catch (error) {
      toast.error(mensagemDeErro(error, "Erro ao excluir arquivo."));
    }
  };

  if (!user) return null;

  const renderLista = (lista: ArquivoAluno[], vazio: string) => {
    if (loading) {
      return (
        <div className="rounded-2xl border border-dashed border-ink/25 p-8 text-center">
          <p className="text-ink">Carregando arquivos...</p>
        </div>
      );
    }

    if (lista.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-ink/25 p-8 text-center">
          <FileText className="size-10 text-ink mx-auto mb-3" />
          <h3 className="text-ink text-lg font-semibold mb-1">{vazio}</h3>
          <p className="text-ink">
            Clique em importar para cadastrar um novo arquivo.
          </p>
        </div>
      );
    }

    return (
      <div className="grid min-w-0 grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-5">
        {lista.map((item) => (
          <div
            key={item.id}
            className="min-w-0 overflow-hidden rounded-2xl bg-raised p-4 sm:p-5 border border-ink/[0.12]"
          >
            <div className="flex min-w-0 items-start justify-between gap-3 sm:gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="[overflow-wrap:anywhere] text-ink font-semibold text-base sm:text-lg leading-snug mb-2">
                  {item.titulo}
                </h3>

                <p className="text-ink-muted text-sm mb-1">
                  Horas:{" "}
                  <span className="text-ink font-semibold">
                    {item.status.toUpperCase() === "APROVADO"
                      ? `${item.horasAprovadas}h aprovadas (de ${item.quantidadeHoras}h)`
                      : `${item.quantidadeHoras}h solicitadas`}
                  </span>
                </p>

                <p className="text-ink-muted text-sm mb-1">
                  Data:{" "}
                  <span className="text-ink">
                    {formatarData(item.dataEmissao)}
                  </span>
                </p>

                <p className="min-w-0 text-ink-muted text-sm mb-1">
                  Arquivo:{" "}
                  <span className="[overflow-wrap:anywhere] text-ink">
                    {item.arquivoNome}
                  </span>
                </p>

                <p className="text-ink-muted text-sm">
                  Status:{" "}
                  <span className={`${statusClasse(item.status)} font-semibold`}>
                    {item.status}
                  </span>
                </p>
              </div>

              <div className="flex shrink-0 gap-2">
                <a
                  href={item.arquivoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-xl bg-ink/[0.06] hover:bg-ink/[0.12] transition"
                  title="Ver arquivo"
                >
                  <Eye className="size-5 text-ink" />
                </a>

                <button
                  onClick={() => excluirArquivo(item.id)}
                  className="p-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 transition"
                  title="Excluir arquivo"
                  type="button"
                >
                  <Trash2 className="size-5 text-red-300" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <AlunoLayout
      user={user}
      activePage="certificados"
      horas={totalHoras}
      certificados={certificados.length}
      relatorios={relatorios.length}
    >
      <Card className="rounded-2xl border-0 shadow-none mb-6" style={panelStyle}>
        <CardHeader>
          <CardTitle className="text-ink flex items-center gap-2">
            <FileBadge2 className="size-5" />
            Arquivos Acadêmicos
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex w-full gap-1 bg-ink/[0.06] p-1 rounded-xl sm:w-auto sm:gap-2">
              <button
                onClick={() => setFiltro("certificado")}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition sm:flex-none sm:px-4 ${
                  filtro === "certificado"
                    ? "bg-brand text-on-brand"
                    : "text-ink hover:text-ink"
                }`}
              >
                Certificados
              </button>

              <button
                onClick={() => setFiltro("relatorio")}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition sm:flex-none sm:px-4 ${
                  filtro === "relatorio"
                    ? "bg-brand text-on-brand"
                    : "text-ink hover:text-ink"
                }`}
              >
                Relatórios
              </button>
            </div>

            <Button
              onClick={() => abrirModal(filtro)}
              className="w-full sm:w-auto rounded-xl bg-brand text-on-brand hover:bg-brand-hover flex items-center justify-center gap-2"
            >
              <Upload className="size-4" />
              {filtro === "certificado"
                ? "Importar certificado"
                : "Importar relatório"}
            </Button>
          </div>

          {filtro === "certificado"
            ? renderLista(certificados, "Nenhum certificado encontrado")
            : renderLista(relatorios, "Nenhum relatório encontrado")}
        </CardContent>
      </Card>

      {modalAberto && createPortal(
        <div className="app-modal-overlay">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="importar-arquivo-titulo"
            className="app-modal-panel"
            style={panelStyle}
          >
            <div className="app-modal-header">
              <h2 id="importar-arquivo-titulo" className="text-xl font-semibold text-ink">
                {tipoSelecionado === "certificado"
                  ? "Importar Certificado"
                  : "Importar Relatório"}
              </h2>

              <button
                onClick={fecharModal}
                aria-label="Fechar importação"
                className="p-2 rounded-xl bg-ink/[0.06] hover:bg-ink/[0.12] transition"
                type="button"
              >
                <X className="size-5 text-ink" />
              </button>
            </div>

            <form onSubmit={enviarArquivo} className="app-modal-form">
              <div className="app-modal-fields">
              <div>
                <label className="block text-ink mb-2">
                  {tipoSelecionado === "certificado"
                    ? "Evento / Curso"
                    : "Título do relatório"}
                    <Obrigatorio />
                </label>

                <input
                  type="text"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  required
                  className="w-full rounded-xl bg-raised border border-ink/15 p-3 text-ink outline-none"
                  placeholder={
                    tipoSelecionado === "certificado"
                      ? "Ex: Semana de Tecnologia"
                      : "Ex: Relatório Interdisciplinar"
                  }
                />
              </div>

              <div>
                <label className="block text-ink mb-2">Horas<Obrigatorio /></label>

                <input
                  type="number"
                  value={horas}
                  onChange={(e) => setHoras(e.target.value)}
                  min={1}
                  max={tipoSelecionado === "relatorio" ? 2 : 50}
                  required
                  className="w-full rounded-xl bg-raised border border-ink/15 p-3 text-ink outline-none"
                  placeholder={
                    tipoSelecionado === "relatorio"
                      ? "Entre 1 e 2 horas"
                      : "Ex: 10"
                  }
                />
              </div>

              <div>
                <label className="block text-ink mb-2">Data<Obrigatorio /></label>

                <input
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  required
                  className="w-full rounded-xl bg-raised border border-ink/15 p-3 text-ink outline-none"
                />
              </div>

              <div>
                <label className="block text-ink mb-2">Bimestre<Obrigatorio /></label>

                <select
                  value={bimestre}
                  onChange={(e) => setBimestre(e.target.value)}
                  required
                  className="w-full rounded-xl bg-raised border border-ink/15 p-3 text-ink outline-none"
                >
                  <option value="" className="text-ink">
                    Selecione...
                  </option>
                  <option value="1" className="text-ink">1º Bimestre</option>
                  <option value="2" className="text-ink">2º Bimestre</option>
                  <option value="3" className="text-ink">3º Bimestre</option>
                  <option value="4" className="text-ink">4º Bimestre</option>
                </select>
              </div>

              {tipoSelecionado === "relatorio" && (
                <>
                  <div>
                    <label className="block text-ink mb-2">
                      Local da atividade
                      <Obrigatorio />
                    </label>

                    <input
                      type="text"
                      value={local}
                      onChange={(e) => setLocal(e.target.value)}
                      required
                      className="w-full rounded-xl bg-raised border border-ink/15 p-3 text-ink outline-none"
                      placeholder="Ex: Auditório Fatec Ourinhos, Online via Youtube..."
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-ink mb-2">
                      Conteúdo do relatório
                      <Obrigatorio />
                    </label>

                    <textarea
                      value={conteudo}
                      onChange={(e) => setConteudo(e.target.value)}
                      required
                      rows={4}
                      maxLength={10000}
                      className="w-full rounded-xl bg-raised border border-ink/15 p-3 text-ink outline-none resize-y"
                      placeholder="Escreva o relato da atividade (pode incluir RESULTADOS e AGRADECIMENTOS, como no portfólio bimestral)."
                    />

                    <p className="text-ink-muted text-sm mt-2">
                      Esse texto é usado depois para montar o Portfólio do Aluno automaticamente.
                    </p>
                  </div>
                </>
              )}

              <div className="sm:col-span-2 min-w-0">
                <label className="block text-ink mb-2">Arquivo<Obrigatorio /></label>

                <input
                  type="file"
                  onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
                  required
                  accept={
                    tipoSelecionado === "certificado"
                      ? "image/png, image/jpeg, application/pdf"
                      : ".pdf,.txt,.doc,.docx,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  }
                  className="w-full rounded-xl bg-raised border border-ink/15 p-3 text-ink"
                />

                <p className="text-ink-muted text-sm mt-2">
                  {tipoSelecionado === "certificado"
                    ? "Permitido: imagem ou PDF."
                    : "Permitido: PDF, TXT, DOC ou DOCX."}
                </p>
              </div>

              </div>
              <div className="app-modal-footer">
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
                  {salvando ? "Salvando..." : "Salvar"}
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
