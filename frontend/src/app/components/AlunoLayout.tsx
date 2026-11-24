import { ReactNode, useEffect, useRef, useState } from "react";
import AlternarTema from "./AlternarTema";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { Button } from "./ui/button";
import { User } from "../utils/auth";
import { apiFetch, clearSession } from "../utils/api";
import { panelStyle } from "../../styles/uiStyles";
import { formatarCurso, formatarNome } from "../utils/formatar";
import {
  LogOut,

  Settings,
  Camera,
  House,
  Clock3,
  FileBadge2,
  CalendarDays,
} from "lucide-react";

type ActivePage = "inicio" | "horas" | "certificados" | "eventos";

type AlunoLayoutProps = {
  user: User & {
    foto_perfil_url?: string;
  };
  activePage: ActivePage;
  children: ReactNode;
  horas?: number;
  certificados?: number;
  relatorios?: number;
};

// Cartão dentro de um painel (o nome vem do visual antigo, em vidro).
export const glassCardStyle = {
  background: "var(--raised)",
  border: "1px solid var(--line)",
};

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export default function AlunoLayout({
  user,
  activePage,
  children,
  horas = 0,
  certificados,
  relatorios,
}: AlunoLayoutProps) {
  const navigate = useNavigate();

  const [modalSair, setModalSair] = useState(false);
  const [fotoPerfil, setFotoPerfil] = useState(user.foto_perfil_url || "");
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [menuMolduraAberto, setMenuMolduraAberto] = useState(false);
  const [infoAberto, setInfoAberto] = useState(false);
  const [menuConfigAberto, setMenuConfigAberto] = useState(false);
  const infoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!infoAberto) {
      setMenuMolduraAberto(false);
      return;
    }

    function handleClickFora(event: MouseEvent) {
      if (infoRef.current && !infoRef.current.contains(event.target as Node)) {
        setInfoAberto(false);
      }
    }

    document.addEventListener("mousedown", handleClickFora);
    return () => document.removeEventListener("mousedown", handleClickFora);
  }, [infoAberto]);

  const handleLogout = () => {
    setInfoAberto(false);
    setMenuConfigAberto(false);
    setModalSair(true);
  };

  const confirmarLogout = () => {
    clearSession();
    navigate("/");
  };
  const [moldura, setMoldura] = useState(
  localStorage.getItem(`moldura_aluno_${user.id}`) || "azul"
);

  const trocarFotoPerfil = async (
  event: React.ChangeEvent<HTMLInputElement>
) => {
  const file = event.target.files?.[0];

  if (!file) return;

  const tiposPermitidos = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

  if (!tiposPermitidos.includes(file.type)) {
    alert("Envie uma imagem PNG, JPG, JPEG ou WEBP.");
    return;
  }

  if (file.size > 15 * 1024 * 1024) {
    alert("A imagem deve ter no máximo 15MB.");
    return;
  }

  try {
    setEnviandoFoto(true);

    const formData = new FormData();
    formData.append("foto", file);

    const response = await apiFetch(`${API_URL}/aluno/${user.id}/foto`, {
      method: "POST",
      body: formData,
    });

    const texto = await response.text();

    let data;
    try {
      data = JSON.parse(texto);
    } catch {
      throw new Error("A rota de foto não retornou JSON. Verifique o backend.");
    }

    if (!response.ok) {
      throw new Error(data.message || "Erro ao atualizar foto.");
    }

    setFotoPerfil(data.foto_perfil_url);

    const userAtualizado = {
      ...user,
      foto_perfil_url: data.foto_perfil_url,
    };

    localStorage.setItem("user", JSON.stringify(userAtualizado));
  } catch (error: any) {
    alert(error.message || "Erro ao atualizar foto.");
  } finally {
    setEnviandoFoto(false);
  }
};

  const navProps = (page: ActivePage) => ({
    className: "app-navlink",
    "aria-current": activePage === page ? ("page" as const) : undefined,
  });

      const molduras = {
  azul: "border-blue-400 shadow-[0_0_25px_rgba(128,128,128,0.35)]",
  roxa: "border-purple-400 shadow-[0_0_25px_rgba(168,85,247,0.45)]",
  verde: "border-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.45)]",
  dourada: "border-yellow-400 shadow-[0_0_25px_rgba(250,204,21,0.45)]",
  vermelha: "border-red-400 shadow-[0_0_25px_rgba(248,113,113,0.45)]",
};

  // Sem foto cadastrada, mostra as iniciais do aluno.
  const iniciais = (user.name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((_, i, partes) => i === 0 || i === partes.length - 1)
    .map((parte) => parte.charAt(0).toUpperCase())
    .join("");

  const fotoAluno = fotoPerfil ? (
    <img
      src={fotoPerfil}
      alt="Foto do aluno"
      className="w-full h-full object-cover"
    />
  ) : (
    <span
      aria-hidden="true"
      className="flex h-full w-full items-center justify-center bg-ink/10 font-display font-semibold text-ink"
    >
      {iniciais}
    </span>
  );

  return (
    <div
      className="min-h-screen min-h-[100dvh] lg:h-screen lg:overflow-hidden p-3 pb-24 sm:p-4 sm:pb-24 md:p-6 md:pb-24 lg:px-10 lg:pb-6 relative"
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

        <main className="order-1 lg:order-2 flex-1 min-w-0 lg:overflow-hidden">
          <div className="max-w-[1760px] mx-auto lg:h-full lg:flex lg:flex-col">
            <header
              className="app-topbar flex flex-col lg:flex-row lg:items-center gap-2.5 lg:gap-4 mb-4 sm:mb-6 lg:mb-0 p-3 sm:p-4 lg:px-0 lg:pt-1 lg:pb-5"
            >
              <div className="w-full lg:w-auto flex items-center gap-3 sm:gap-4 shrink-0">
                <div className="relative" ref={infoRef}>
                  <button
                    type="button"
                    onClick={() => setInfoAberto((v) => !v)}
                    className={`w-11 h-11 rounded-full overflow-hidden border-4 cursor-pointer transition hover:scale-105 shrink-0 ${
                      molduras[moldura as keyof typeof molduras]
                    }`}
                    title="Minhas informações"
                    aria-label="Minhas informações"
                    aria-expanded={infoAberto}
                  >
                    {fotoAluno}
                  </button>

                  {infoAberto && (
                    <div
                      className="absolute left-0 top-full mt-3 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-2xl p-5 shadow-2xl border border-ink/[0.12] bg-raised max-h-[75vh] overflow-y-auto"
                      role="dialog"
                      aria-label="Minhas informações"
                    >
                      {/* Identificação: foto ao lado do nome */}
                      <div className="flex items-start gap-4">
                        <div className="relative shrink-0">
                          <button
                            type="button"
                            onClick={() => setMenuMolduraAberto(!menuMolduraAberto)}
                            className={`block w-16 h-16 rounded-full overflow-hidden border-[3px] cursor-pointer transition ${
                              molduras[moldura as keyof typeof molduras]
                            }`}
                            title="Trocar moldura"
                            aria-label="Trocar moldura da foto"
                            aria-expanded={menuMolduraAberto}
                          >
                            {fotoAluno}
                          </button>

                          <label
                            className="absolute -bottom-1 -right-1 bg-brand hover:bg-brand-hover transition p-1.5 rounded-full cursor-pointer ring-2 ring-raised"
                            title="Trocar foto"
                          >
                            <Camera className="size-3.5 text-on-brand" />
                            <input
                              type="file"
                              accept="image/*"
                              onChange={trocarFotoPerfil}
                              className="hidden"
                              disabled={enviandoFoto}
                            />
                          </label>
                        </div>

                        <div className="min-w-0 pt-0.5">
                          <p className="font-display text-base font-semibold leading-snug text-ink [text-wrap:balance]">
                            {formatarNome(user.name)}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                            <span className="text-ink-muted tabular-nums">
                              {user.nivel_ensino === "FACULDADE" ? "RA" : "RM"} {user.identifier}
                            </span>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-300">
                              <span className="size-1.5 rounded-full bg-green-400" aria-hidden="true" />
                              Ativo
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Escolha da moldura: abre ao clicar na foto */}
                      {menuMolduraAberto && (
                        <div
                          className="mt-4 flex justify-center gap-2.5 rounded-xl border border-ink/[0.12] bg-surface p-2.5"
                          role="group"
                          aria-label="Moldura da foto"
                        >
                          {Object.entries(molduras).map(([nome, classe]) => (
                            <button
                              key={nome}
                              type="button"
                              onClick={() => {
                                setMoldura(nome);
                                localStorage.setItem(`moldura_aluno_${user.id}`, nome);
                                setMenuMolduraAberto(false);
                              }}
                              className={`w-7 h-7 rounded-full border-2 transition hover:scale-110 ${
                                moldura === nome ? "ring-2 ring-ink/70 ring-offset-2 ring-offset-surface" : ""
                              } ${classe}`}
                              title={`Moldura ${nome}`}
                              aria-label={`Moldura ${nome}`}
                              aria-pressed={moldura === nome}
                            />
                          ))}
                        </div>
                      )}

                      {/* Curso */}
                      <p className="mt-4 text-sm leading-relaxed text-ink-muted">
                        {user.curso ? formatarCurso(user.curso) : "Curso não informado"}
                        {user.serie_semestre ? ` · ${formatarCurso(user.serie_semestre)}` : ""}
                      </p>

                      {/* Números: o que o aluno mais consulta, em destaque */}
                      <dl className="mt-4 grid grid-cols-3 gap-2">
                        {[
                          { rotulo: "Horas", valor: `${horas}h` },
                          ...(certificados !== undefined ? [{ rotulo: "Certificados", valor: certificados }] : []),
                          ...(relatorios !== undefined ? [{ rotulo: "Relatórios", valor: relatorios }] : []),
                        ].map((item) => (
                          <div key={item.rotulo} className="flex flex-col-reverse rounded-xl border border-ink/10 bg-surface px-2 py-3 text-center">
                            <dt className="mt-0.5 text-xs text-ink-muted">{item.rotulo}</dt>
                            <dd className="font-display text-xl font-semibold text-ink tabular-nums">{item.valor}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <h1 className="font-display text-lg sm:text-xl lg:text-2xl font-bold tracking-tight text-ink whitespace-nowrap">
                    Central SRA
                  </h1>
                </div>

                <AlternarTema className="ml-auto lg:hidden" />

                <div className="relative lg:hidden">
                  <button
                    onClick={() => setMenuConfigAberto((aberto) => !aberto)}
                    className="p-2.5 rounded-lg border border-ink/20 hover:bg-ink/[0.06] transition shrink-0"
                    type="button"
                    aria-label="Abrir menu da conta"
                  >
                    <Settings className="size-5 text-ink" />
                  </button>

                  {menuConfigAberto && (
                    <div className="absolute right-0 top-full mt-2 z-50 w-40 rounded-xl border border-ink/[0.12] bg-raised p-1.5 shadow-2xl">
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-red-300 transition hover:bg-red-500/15"
                      >
                        <LogOut className="size-4" />
                        Sair
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <nav className="hidden w-full lg:flex lg:flex-1 lg:flex-wrap lg:justify-end lg:gap-x-8 lg:gap-y-2 lg:pr-4" aria-label="Navegação do aluno">
                <button
                  onClick={() => navigate("/aluno")}
                  {...navProps("inicio")}
                >
                  Início
                </button>

                <button
                  onClick={() => navigate("/horas-ams")}
                  {...navProps("horas")}
                >
                  Horas
                </button>

                <button
                  onClick={() => navigate("/certificados")}
                  {...navProps("certificados")}
                >
                  Certificados
                </button>

                <button
                  onClick={() => navigate("/eventos")}
                  {...navProps("eventos")}
                >
                  Eventos
                </button>
              </nav>

              <AlternarTema className="hidden lg:inline-flex" />

              <div className="relative hidden lg:flex lg:w-auto justify-end shrink-0">
                <button
                  onClick={() => setMenuConfigAberto((aberto) => !aberto)}
                  className="p-2.5 rounded-lg border border-ink/20 hover:bg-ink/[0.06] transition"
                  type="button"
                  aria-label="Abrir menu da conta"
                >
                  <Settings className="size-5 text-ink" />
                </button>

                {menuConfigAberto && (
                  <div className="absolute right-0 top-full mt-2 z-50 w-40 rounded-xl border border-ink/[0.12] bg-raised p-1.5 shadow-2xl">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-red-300 transition hover:bg-red-500/15"
                    >
                      <LogOut className="size-4" />
                      Sair
                    </button>
                  </div>
                )}
              </div>
            </header>

            <div className="app-scroll-area">{children}</div>
          </div>
        </main>
      </div>

      {createPortal(<nav
        className="fixed inset-x-3 z-[100] grid grid-cols-4 rounded-2xl border border-ink/[0.12] bg-raised/95 p-1.5 shadow-2xl backdrop-blur-xl lg:hidden"
        style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        aria-label="Navegação principal"
      >
        {[
          { page: "inicio" as ActivePage, label: "Início", icon: House, path: "/aluno" },
          { page: "horas" as ActivePage, label: "Horas", icon: Clock3, path: "/horas-ams" },
          { page: "certificados" as ActivePage, label: "Arquivos", icon: FileBadge2, path: "/certificados" },
          { page: "eventos" as ActivePage, label: "Eventos", icon: CalendarDays, path: "/eventos" },
        ].map(({ page, label, icon: Icon, path }) => {
          const ativo = activePage === page;

          return (
            <button
              key={page}
              type="button"
              onClick={() => navigate(path)}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-xs font-medium transition ${
                ativo
                  ? "bg-blue-500/20 text-blue-300"
                  : "text-ink hover:bg-ink/[0.06] hover:text-ink"
              }`}
            >
              <Icon className="size-5" />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>, document.body)}

      {modalSair && (
        <div className="app-modal-overlay">
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
                className="rounded-xl bg-ink/[0.06] text-ink hover:bg-ink/10 border border-ink/[0.12]"
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
