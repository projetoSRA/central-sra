import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { User } from "../utils/auth";
import { apiFetch } from "../utils/api";
import AlunoLayout from "../components/AlunoLayout";
import HourRuler from "../components/HourRuler";
import { panelStyle } from "../../styles/uiStyles";

type ResumoHoras = {
  totalCertificados: number;
  totalRelatorios: number;
  totalEventos: number;
  totalVisitas: number;
  horasVisitas: number;
  horasCertificados: number;
  horasRelatorios: number;
  horasEventos: number;
  totalHoras: number;
  totalAlvo: number;
  horasRestantes: number;
};

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const plural = (n: number, singular: string, pluralForm: string) =>
  `${n} ${n === 1 ? singular : pluralForm}`;

export default function HorasAMS() {
  const navigate = useNavigate();

  const [user, setUser] = useState<User | null>(null);
  const [resumo, setResumo] = useState<ResumoHoras | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem("user");

    if (!userData) {
      navigate("/");
      return;
    }

    const parsedUser = JSON.parse(userData) as User;

    if (parsedUser.type !== "aluno") {
      navigate("/");
      return;
    }

    if (parsedUser.precisaTrocarSenha) {
      navigate("/primeiro-acesso");
      return;
    }

    setUser(parsedUser);
  }, [navigate]);

  useEffect(() => {
    if (!user) return;

    async function carregarHoras() {
      try {
        setLoading(true);
        setErro(false);

        const response = await apiFetch(`${API_URL}/horas/aluno/${user!.id}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Erro ao buscar horas");
        }

        setResumo(data);
      } catch (error) {
        console.error("Erro ao carregar horas:", error);
        setResumo(null);
        setErro(true);
      } finally {
        setLoading(false);
      }
    }

    carregarHoras();
  }, [user]);

  const horasEventos = Number(resumo?.horasEventos ?? 0);
  const horasCertificados = Number(resumo?.horasCertificados ?? 0);
  const horasRelatorios = Number(resumo?.horasRelatorios ?? 0);
  const horasVisitas = Number(resumo?.horasVisitas ?? 0);

  const totalHoras = Number(resumo?.totalHoras ?? 0);
  const totalAlvo = Number(resumo?.totalAlvo ?? 200);
  const horasRestantes = Number(resumo?.horasRestantes ?? totalAlvo);

  const categorias = [
    {
      nome: "Eventos",
      detalhe: plural(resumo?.totalEventos ?? 0, "presença", "presenças"),
      horas: horasEventos,
    },
    {
      nome: "Certificados",
      detalhe: plural(resumo?.totalCertificados ?? 0, "arquivo enviado", "arquivos enviados"),
      horas: horasCertificados,
    },
    {
      nome: "Relatórios",
      detalhe: plural(resumo?.totalRelatorios ?? 0, "arquivo enviado", "arquivos enviados"),
      horas: horasRelatorios,
    },
    {
      nome: "Visitas técnicas",
      detalhe: plural(resumo?.totalVisitas ?? 0, "visita", "visitas"),
      horas: horasVisitas,
    },
  ];

  if (!user) return null;

  return (
    <AlunoLayout user={user} activePage="horas" horas={totalHoras}>
      <section className="rounded-2xl p-5 sm:p-8 mb-6" style={panelStyle}>
        <h2 className="text-2xl sm:text-3xl font-semibold text-ink">
          Minhas horas
        </h2>

        {loading ? (
          <p className="mt-6 text-ink/65">Carregando horas…</p>
        ) : erro ? (
          <p role="alert" className="mt-6 text-red-400">
            Não foi possível carregar suas horas. Recarregue a página para
            tentar de novo.
          </p>
        ) : (
          <>
            {/* Total: o número grande e a régua dizem a mesma coisa de dois jeitos */}
            <div className="mt-6 sm:mt-8">
              <div className="mb-8 flex flex-wrap items-end gap-x-6 gap-y-2">
                <p className="font-display font-semibold leading-none tracking-tight text-ink tabular-nums text-7xl sm:text-8xl">
                  {totalHoras}
                  <span className="text-3xl sm:text-4xl text-ink/45">h</span>
                </p>
                <p className="pb-2 text-ink/70">
                  de {totalAlvo}h.{" "}
                  {horasRestantes > 0
                    ? `Faltam ${horasRestantes}h para completar a carga total.`
                    : "Carga total completa."}
                </p>
              </div>

              <HourRuler value={totalHoras} total={totalAlvo} size="lg" />
            </div>

            {/* De onde vieram as horas */}
            <div className="mt-10 sm:mt-12">
              <h3 className="text-lg font-semibold text-ink mb-4">
                De onde vieram
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-ink/25 text-sm text-ink/60">
                      <th className="py-2.5 pr-4 font-medium">Categoria</th>
                      <th className="hidden sm:table-cell py-2.5 pr-4 font-medium">
                        Registros
                      </th>
                      <th className="hidden md:table-cell w-[38%] py-2.5 pr-4 font-medium">
                        Parte da meta
                      </th>
                      <th className="py-2.5 text-right font-medium">Horas</th>
                    </tr>
                  </thead>

                  <tbody>
                    {categorias.map((categoria) => (
                      <tr key={categoria.nome} className="border-b border-ink/10">
                        <td className="py-3.5 pr-4 text-ink">
                          <span className="font-medium">{categoria.nome}</span>
                          <span className="block sm:hidden text-sm text-ink/60">
                            {categoria.detalhe}
                          </span>
                        </td>
                        <td className="hidden sm:table-cell py-3.5 pr-4 text-ink/70">
                          {categoria.detalhe}
                        </td>
                        <td className="hidden md:table-cell py-3.5 pr-4">
                          <div className="h-1.5 rounded-full bg-ink/10 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-blue-500"
                              style={{
                                width: `${Math.min(
                                  (categoria.horas / (totalAlvo || 1)) * 100,
                                  100
                                )}%`,
                              }}
                            />
                          </div>
                        </td>
                        <td className="py-3.5 text-right font-semibold text-ink">
                          {categoria.horas}h
                        </td>
                      </tr>
                    ))}
                  </tbody>

                  <tfoot>
                    <tr>
                      <td className="pt-3.5 pr-4 font-semibold text-ink">
                        Total
                      </td>
                      <td className="hidden sm:table-cell" />
                      <td className="hidden md:table-cell" />
                      <td className="pt-3.5 text-right font-display text-xl font-semibold text-ink">
                        {totalHoras}h
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        )}
      </section>
    </AlunoLayout>
  );
}
