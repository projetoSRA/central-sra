import { useState } from "react";
import Obrigatorio from "./Obrigatorio";
import { createPortal } from "react-dom";
import { CalendarDays, X } from "lucide-react";
import { Button } from "./ui/button";
import { apiFetch } from "../utils/api";
import { panelStyle } from "../../styles/uiStyles";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
type TurmaVisita = {
  curso: string;
  nivel_ensino: string | null;
  serie_semestre: string;
  total_alunos: number;
};

export default function AgendarVisitaTecnica({ onAgendado }: { onAgendado: () => void }) {
  const [modalVisitaAberto, setModalVisitaAberto] = useState(false);
  const [local, setLocal] = useState("");
  const [horasVisita, setHorasVisita] = useState("");
  const [dataVisita, setDataVisita] = useState("");
  const [observacao, setObservacao] = useState("");
  const [bimestreVisita, setBimestreVisita] = useState("");
  const [salvandoVisita, setSalvandoVisita] = useState(false);
  const [turmasVisita, setTurmasVisita] = useState<TurmaVisita[]>([]);
  const [turmaVisita, setTurmaVisita] = useState("");
  const [carregandoTurmas, setCarregandoTurmas] = useState(false);
  const [erroTurmas, setErroTurmas] = useState("");

  const [empresaParceiraNome, setEmpresaParceiraNome] = useState("");
  const [empresaParceiraRepresentante, setEmpresaParceiraRepresentante] = useState("");


  const abrirModalVisita = async () => {
    setTurmaVisita("");
    setTurmasVisita([]);
    setErroTurmas("");
    setCarregandoTurmas(true);
    setLocal("");
    setEmpresaParceiraNome("");
    setEmpresaParceiraRepresentante("");
    setHorasVisita("");
    setDataVisita("");
    setObservacao("");
    setBimestreVisita("");
    setModalVisitaAberto(true);
    try {
      const response = await apiFetch(`${API_URL}/visita/turmas`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Erro ao carregar turmas.");
      setTurmasVisita(data);
    } catch (error: any) {
      setErroTurmas(error.message || "Erro ao carregar turmas.");
    } finally {
      setCarregandoTurmas(false);
    }
  };

  const registrarVisita = async (event: React.FormEvent) => {
    event.preventDefault();

    const turma = turmaVisita === "" ? undefined : turmasVisita[Number(turmaVisita)];
    if (!turma || salvandoVisita) return;

    const horas = Number(horasVisita);
    if (Number.isNaN(horas) || horas <= 0) {
      alert("Informe uma quantidade de horas válida.");
      return;
    }

    if (!bimestreVisita) {
      alert("Selecione o bimestre.");
      return;
    }

    try {
      setSalvandoVisita(true);

      const response = await apiFetch(`${API_URL}/visita`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turma,
          empresaParceiraNome,
          empresaParceiraRepresentante,
          local,
          quantidadeHoras: horas,
          dataVisita,
          observacao: observacao || null,
          bimestre: bimestreVisita,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Erro ao registrar visita.");
      }


      setModalVisitaAberto(false);
      onAgendado();
      alert(data.message);
    } catch (error: any) {
      alert(error.message || "Erro ao registrar visita.");
    } finally {
      setSalvandoVisita(false);
    }
  };

  return (<>
<Button type="button" onClick={abrirModalVisita} className="flex items-center gap-2 rounded-xl text-ink bg-ink/[0.06] hover:bg-ink/10 border border-ink/[0.12]"><CalendarDays className="size-4" />Agendar Visita Técnica</Button>
    {modalVisitaAberto && createPortal(
        <div className="app-modal-overlay">
          <div className="app-modal-panel" style={panelStyle}>
            <div className="app-modal-header">
              <h2 className="text-xl font-semibold text-ink flex items-center gap-2">
                <CalendarDays className="size-5" />
                Agendar Visita Técnica
              </h2>

              <button
                onClick={() => setModalVisitaAberto(false)} disabled={salvandoVisita}
                className="p-2 rounded-xl bg-ink/[0.06] hover:bg-ink/[0.12] transition"
                type="button"
              >
                <X className="size-5 text-ink" />
              </button>
            </div>

            <form onSubmit={registrarVisita} className="app-modal-form">
              <div className="app-modal-fields">
              <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-ink/75 text-sm mb-2">Nome da empresa parceira<Obrigatorio /></label>
                  <input
                    type="text"
                    required value={empresaParceiraNome}
                    onChange={(e) => setEmpresaParceiraNome(e.target.value)}
                    maxLength={255}
                    className="w-full rounded-xl bg-raised border border-ink/15 p-3 text-ink outline-none"
                    placeholder="Ex: Tech Solutions Ltda."
                  />
                </div>

                <div>
                  <label className="block text-ink/75 text-sm mb-2">Representante da empresa</label>
                  <input
                    type="text"
                    value={empresaParceiraRepresentante}
                    onChange={(e) => setEmpresaParceiraRepresentante(e.target.value)}
                    maxLength={255}
                    className="w-full rounded-xl bg-raised border border-ink/15 p-3 text-ink outline-none"
                    placeholder="Ex: Maria Fernanda Costa"
                  />
                </div>
              </div>


              <div className="sm:col-span-2">
                <label htmlFor="turma-visita" className="block text-ink mb-2">Turma<Obrigatorio /></label>
                <select id="turma-visita" required value={turmaVisita}
                  onChange={(event) => setTurmaVisita(event.target.value)}
                  disabled={carregandoTurmas || salvandoVisita}
                  className="w-full rounded-xl border border-ink/[0.12] p-3 bg-raised text-ink">
                  <option value="">{carregandoTurmas ? "Carregando turmas..." : "Selecione a turma"}</option>
                  {turmasVisita.map((turma, index) => (
                    <option key={index} value={index}>
                      {turma.curso} · {turma.serie_semestre} · {turma.nivel_ensino === "MEDIO" ? "Ensino médio" : turma.nivel_ensino === "FACULDADE" ? "Faculdade" : "Nível não informado"} ({turma.total_alunos} alunos)
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-sm text-ink/75">
                  A visita e suas horas serão registradas para todos os alunos da turma selecionada.
                </p>
                {erroTurmas && <p role="alert" className="mt-2 text-red-300">{erroTurmas}</p>}
                {!carregandoTurmas && !erroTurmas && turmasVisita.length === 0 && <p className="mt-2 text-ink/75">Nenhuma turma disponível. Cadastre curso e série/semestre dos alunos.</p>}
              </div>
              <div>
                <label className="block text-ink mb-2">Local<Obrigatorio /></label>
                <input
                  type="text"
                  value={local}
                  onChange={(e) => setLocal(e.target.value)}
                  required
                  className="w-full rounded-xl bg-raised border border-ink/15 p-3 text-ink outline-none"
                  placeholder="Ex: Empresa / cidade visitada"
                />
              </div>

              <div>
                <label className="block text-ink mb-2">Quantidade de horas<Obrigatorio /></label>
                <input
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={horasVisita}
                  onChange={(e) => setHorasVisita(e.target.value)}
                  required
                  className="w-full rounded-xl bg-raised border border-ink/15 p-3 text-ink outline-none"
                />
              </div>

              <div>
                <label className="block text-ink mb-2">Data<Obrigatorio /></label>
                <input
                  type="date"
                  value={dataVisita}
                  onChange={(e) => setDataVisita(e.target.value)}
                  required
                  className="w-full rounded-xl bg-raised border border-ink/15 p-3 text-ink outline-none"
                />
              </div>

              <div>
                <label className="block text-ink mb-2">Bimestre<Obrigatorio /></label>
                <select
                  value={bimestreVisita}
                  onChange={(e) => setBimestreVisita(e.target.value)}
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

              <div className="sm:col-span-2">
                <label className="block text-ink mb-2">Observação (opcional)</label>
                <textarea
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl bg-raised border border-ink/15 p-3 text-ink outline-none"
                />
              </div>

              </div>
              <div className="app-modal-footer">
                <Button
                  type="button"
                  onClick={() => setModalVisitaAberto(false)} disabled={salvandoVisita}
                  variant="outline"
                  className="rounded-xl bg-transparent text-ink hover:bg-ink/[0.06]"
                  style={{ borderColor: "#7d7d7d", color: "var(--ink)" }}
                >
                  Cancelar
                </Button>

                <Button
                  type="submit"
                  disabled={salvandoVisita || carregandoTurmas || turmaVisita === ""}
                  className="rounded-xl bg-ink text-on-accent hover:bg-ink/85"
                >
                  {salvandoVisita ? "Salvando..." : "Agendar Visita Técnica"}
                </Button>
              </div>
            </form>
          </div>
        </div>, document.body
      )}
</>);
}
