import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { User } from "../utils/auth";
import { apiFetch, API_URL, lerJson, mensagemDeErro } from "../utils/api";
import AlunoLayout, { glassCardStyle } from "../components/AlunoLayout";
import HourRuler from "../components/HourRuler";
import { panelStyle, cardStyle, buttonGlass } from "../../styles/uiStyles";

const META_HORAS = 200;

import {
  Newspaper,
  ExternalLink,
  FileBadge2,
  Download,
} from "lucide-react";
import { exigirSessao } from "../utils/sessao";
import { toast } from "sonner";

type NewsItem = {
  id: number;
  titulo: string;
  origem: string;
  data: string;
  resumo: string;
  link: string;
};

export default function DashboardAluno() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);

  const [horas, setHoras] = useState(0);
  const [certificados, setCertificados] = useState(0);
  const [relatorios, setRelatorios] = useState(0);
  const [bimestrePortfolio, setBimestrePortfolio] = useState("1");
  const [gerandoPortfolio, setGerandoPortfolio] = useState(false);
  const noticias: NewsItem[] = [
    {
      id: 1,
      titulo: "Fatecs abrem prazo para pedir isenção e desconto na taxa do Vestibular",
      origem: "Fatec / CPS",
      data: "24/03/2026",
      resumo:
        "Pedido de isenção ou redução da taxa vai até 6 de abril. A prova do Vestibular das Fatecs está marcada para 28 de junho.",
      link: "https://www.cps.sp.gov.br/fatecs-abrem-prazo-para-pedir-isencao-e-desconto-na-taxa-do-vestibular/",
    },
    {
      id: 2,
      titulo: "Centro Paula Souza leva 11 projetos de estudantes de Etecs para a Febrace 2026",
      origem: "Etec / CPS",
      data: "16/03/2026",
      resumo:
        "Projetos das Etecs foram selecionados para a Febrace em áreas como sustentabilidade, saúde, inteligência artificial e prevenção de desastres.",
      link: "https://www.cps.sp.gov.br/centro-paula-souza-leva-11-projetos-de-estudantes-de-etecs-para-a-febrace-2026/",
    },
    {
      id: 3,
      titulo: "Centro Paula Souza lança desafio de inovação para estudantes de Etecs e Fatecs",
      origem: "CPS",
      data: "18/03/2026",
      resumo:
        "Ação de inovação com participação remota e classificação das melhores propostas para intercâmbio cultural na Inglaterra.",
      link: "https://www.cps.sp.gov.br/centro-paula-souza-lanca-desafio-de-inovacao-para-estudantes-de-etecs-e-fatecs/",
    },
  ];

  useEffect(() => {
    const parsedUser = exigirSessao(navigate, "aluno");
    if (!parsedUser) return;


    setUser(parsedUser);

    apiFetch(`${API_URL}/horas/aluno/${parsedUser.id}`)
    .then(lerJson)
    .then(data => setHoras(data.totalHoras || 0))
    .catch(() => setHoras(0));

    apiFetch(`${API_URL}/certificados/aluno/${parsedUser.id}`)
      .then(lerJson)
      .then((data) => {
        if (!Array.isArray(data)) return;
        setCertificados(
          data.filter((item: { tipo_arquivo?: string }) => item.tipo_arquivo !== "RELATORIO").length
        );
        setRelatorios(
          data.filter((item: { tipo_arquivo?: string }) => item.tipo_arquivo === "RELATORIO").length
        );
      })
      .catch(() => {
        setCertificados(0);
        setRelatorios(0);
      });
  }, [navigate]);

  const baixarPortfolio = async () => {
    if (!user) return;

    try {
      setGerandoPortfolio(true);

      const response = await apiFetch(
        `${API_URL}/portfolio/${user.id}/bimestre/${bimestrePortfolio}`
      );

      if (!response.ok) {
        const data = await lerJson(response);
        throw new Error(data?.message || "Erro ao gerar o portfólio.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `portfolio-${user.identifier}-${bimestrePortfolio}bimestre.docx`;
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

  if (!user) return null;

  // "MARIA DA SILVA" -> "Maria"
  const primeiroNome = (() => {
    const nome = (user.name || "").trim().split(/\s+/)[0] || "";
    return nome.charAt(0).toUpperCase() + nome.slice(1).toLowerCase();
  })();

  return (
    <AlunoLayout
      user={user}
      activePage="inicio"
      horas={horas}
      certificados={certificados}
      relatorios={relatorios}
    >
      <section className="rounded-2xl p-5 sm:p-8 mb-4 sm:mb-6" style={panelStyle}>
        <h2 className="text-2xl sm:text-4xl font-semibold text-ink">
          Olá, {primeiroNome}.
        </h2>
        <p className="mt-2 text-ink">
          {horas > 0
            ? `Você já registrou ${horas}h das ${META_HORAS}h da carga total.`
            : `Suas horas aparecem aqui assim que a coordenação aprovar o primeiro envio. A carga total é de ${META_HORAS}h.`}
        </p>

        <button
          type="button"
          onClick={() => navigate("/horas-ams")}
          className="mt-6 sm:mt-8 block w-full text-left rounded-lg"
          aria-label="Ver detalhes das minhas horas"
        >
          <HourRuler value={horas} total={META_HORAS} />
        </button>

        <dl className="mt-6 grid grid-cols-3 border-t border-ink/15 text-ink">
          <div className="pt-4 pr-3">
            <dt className="text-sm text-ink">Horas</dt>
            <dd className="font-display text-2xl sm:text-3xl font-semibold tabular-nums">{horas}h</dd>
          </div>
          <div className="pt-4 px-3 sm:px-5 border-l border-ink/15">
            <dt className="text-sm text-ink">Certificados</dt>
            <dd className="font-display text-2xl sm:text-3xl font-semibold tabular-nums">{certificados}</dd>
          </div>
          <div className="pt-4 pl-3 sm:pl-5 border-l border-ink/15">
            <dt className="text-sm text-ink">Relatórios</dt>
            <dd className="font-display text-2xl sm:text-3xl font-semibold tabular-nums">{relatorios}</dd>
          </div>
        </dl>
      </section>
      <Card
        className="gap-2 sm:gap-3 rounded-2xl border-0 shadow-none mb-4 sm:mb-6"
        style={panelStyle}
      >
        <CardHeader className="px-4 pt-4 pb-1 sm:px-6 sm:pt-6 sm:pb-2">
          <CardTitle className="text-base sm:text-lg text-ink flex items-center gap-2">
            <FileBadge2 className="size-4 sm:size-5" />
            Portfólio do aluno
          </CardTitle>
        </CardHeader>

        <CardContent className="px-4 pt-1 pb-4 sm:px-6 sm:pt-2 sm:pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end gap-2.5 sm:gap-3">
            <div className="flex-1">
              <label className="block text-ink text-xs sm:text-sm mb-1.5">Bimestre</label>
              <select
                value={bimestrePortfolio}
                onChange={(e) => setBimestrePortfolio(e.target.value)}
                className="w-full sm:w-48 rounded-xl bg-raised border border-ink/15 px-3 py-2.5 text-sm sm:text-base text-ink outline-none"
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
              className="w-full sm:w-auto min-h-10 flex items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm sm:text-base text-on-brand hover:bg-brand-hover"
            >
              <Download className="size-4" />
              {gerandoPortfolio ? "Gerando…" : "Baixar portfólio (.docx)"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card
        className="gap-2 sm:gap-3 rounded-2xl border-0 shadow-none mb-6"
       style={panelStyle}
      >
        <CardHeader className="px-4 pt-4 pb-1 sm:px-6 sm:pt-6 sm:pb-2">
          <CardTitle className="text-base sm:text-lg leading-snug text-ink flex items-start sm:items-center gap-2">
            <Newspaper className="size-4 sm:size-5 mt-0.5 sm:mt-0 shrink-0" />
            <span className="sm:hidden">Notícias recentes</span>
            <span className="hidden sm:inline">
              Notícias recentes - Etec, Fatec e Centro Paula Souza
            </span>
          </CardTitle>
        </CardHeader>

        <CardContent className="px-3 pt-1 pb-3 sm:px-6 sm:pt-2 sm:pb-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4">
            {noticias.map((noticia) => (
              <a
                key={noticia.id}
                href={noticia.link}
                target="_blank"
                rel="noreferrer"
                className="block rounded-xl sm:rounded-2xl p-3 sm:p-4 transition hover:border-ink/30"
               style={glassCardStyle}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <span className="text-xs px-2 py-1 rounded-full bg-ink/10 text-ink-muted">
                    {noticia.origem}
                  </span>
                  <ExternalLink className="size-4 text-ink shrink-0" />
                </div>

                <h3 className="text-ink font-semibold text-sm sm:text-base leading-snug mb-1.5 sm:mb-2">
                  {noticia.titulo}
                </h3>

                <p className="line-clamp-3 text-ink-muted text-sm leading-relaxed mb-3">
                  {noticia.resumo}
                </p>

                <div className="flex items-center justify-between gap-3 border-t border-ink/[0.12] pt-2.5">
                  <p className="text-ink-muted text-xs">{noticia.data}</p>
                  <span className="text-xs font-semibold text-blue-300">Ver notícia</span>
                </div>
              </a>
            ))}
          </div>
        </CardContent>
      </Card>
    </AlunoLayout>
  );
}
