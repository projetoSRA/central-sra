import { ReactNode, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { Button } from "./ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { User } from "../utils/auth";
import { clearSession } from "../utils/api";
import { panelStyle } from "../../styles/uiStyles";
import { FileCheck2, LogOut, LucideIcon, Settings, Users } from "lucide-react";
import ChatbotCoordenacao from "./ChatbotCoordenacao";

type ActivePage = "dashboard" | "alunos";

type CoordenacaoLayoutProps = {
  user: User;
  activePage: ActivePage;
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  headerActions?: ReactNode;
  pendentesCount?: number;
  children: ReactNode;
};

export default function CoordenacaoLayout({
  user,
  activePage,
  icon: Icon = Users,
  title,
  subtitle,
  headerActions,
  pendentesCount,
  children,
}: CoordenacaoLayoutProps) {
  const navigate = useNavigate();
  const [menuContaAberto, setMenuContaAberto] = useState(false);
  const [modalSair, setModalSair] = useState(false);

  const handleLogout = () => {
    setMenuContaAberto(false);
    setModalSair(true);
  };

  const confirmarLogout = () => {
    clearSession();
    navigate("/");
  };

  const navClass = (page: ActivePage) =>
    activePage === page
      ? "w-full h-10 flex items-center gap-2.5 px-3 rounded-lg bg-ink/[0.08] text-ink font-semibold transition"
      : "w-full h-10 flex items-center gap-2.5 px-3 rounded-lg text-ink/70 hover:bg-ink/[0.05] hover:text-ink transition";

  return (
    <div
      className="min-h-screen min-h-[100dvh] lg:h-screen lg:overflow-hidden p-3 pb-24 sm:p-4 sm:pb-24 md:p-6 md:pb-24 lg:pb-6 relative"
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

      <div className="relative grid grid-cols-1 lg:grid-cols-[17rem_1fr] lg:grid-rows-[auto_1fr] h-full gap-4 lg:gap-x-8 lg:gap-y-0">
        <header
          className="app-topbar lg:col-start-2 lg:row-start-1 flex items-center gap-3 p-3 sm:p-4 lg:px-0 lg:pt-1 lg:pb-5"
        >
          <Icon className="size-6 text-blue-400 shrink-0" />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-lg sm:text-2xl font-bold tracking-tight text-ink truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="hidden sm:block text-ink/75 text-sm">{subtitle}</p>
            )}
          </div>

          {headerActions && <div className="hidden sm:flex gap-2">{headerActions}</div>}

          <DropdownMenu open={menuContaAberto} onOpenChange={setMenuContaAberto}>
            <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="shrink-0 rounded-lg border border-ink/20 p-2.5 transition hover:bg-ink/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              aria-label="Abrir menu da conta"
            >
              <Settings className="size-5 text-ink" />
            </button>
            </DropdownMenuTrigger>

              <DropdownMenuContent align="end" sideOffset={8} collisionPadding={12} className="z-[100] w-52 max-w-[calc(100vw-1.5rem)] rounded-xl border border-ink/[0.12] bg-raised p-2 shadow-2xl">
                <div className="border-b border-ink/[0.12] px-2 pb-2 mb-1">
                  <p className="truncate text-sm font-medium text-ink">{user.name}</p>
                  <p className="truncate text-xs text-ink/60">{user.identifier}</p>
                </div>
                <DropdownMenuItem
                  onSelect={handleLogout}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-red-300 transition focus:bg-red-500/15 focus:text-red-300"
                >
                  <LogOut className="size-4 text-red-300" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <aside
          className="hidden lg:flex lg:col-start-1 lg:row-start-1 lg:row-span-2 w-full lg:h-full p-6 flex-col rounded-2xl"
          style={panelStyle}
        >
          <div>
            <h2 className="text-sm font-medium text-ink/60 mb-5">
              Minhas informações
            </h2>

            <p className="font-display text-xl font-semibold leading-snug tracking-tight text-ink">
              {user.name}
            </p>

            <p className="mt-2 mb-6 text-sm text-ink/70 tabular-nums">
              Matrícula {user.identifier}
            </p>

            <div className="space-y-1.5 mb-4">
              <button
                onClick={() => navigate("/coordenacao")}
                className={navClass("dashboard")}
                type="button"
              >
                <FileCheck2 className="size-4" />
                Certificados
              </button>

              <button
                onClick={() => navigate("/coordenacao/alunos")}
                className={navClass("alunos")}
                type="button"
              >
                <Users className="size-4" />
                Alunos
              </button>
            </div>

            {pendentesCount !== undefined && (
              <div className="flex justify-between border-y border-ink/10 py-2.5 text-sm text-ink/75">
                <span>Fila de validação</span>
                <span className="font-semibold text-blue-400">
                  {pendentesCount}
                </span>
              </div>
            )}
          </div>

        </aside>

        <main className="lg:col-start-2 lg:row-start-2 min-w-0 lg:overflow-hidden">
          <div className="app-scroll-area max-w-7xl mx-auto lg:h-full">
            {children}
          </div>
        </main>
      </div>

      <ChatbotCoordenacao />

      {createPortal(
        <nav
          className="fixed inset-x-3 z-[90] grid grid-cols-2 rounded-2xl border border-ink/[0.12] bg-raised/95 p-1.5 shadow-2xl backdrop-blur-xl lg:hidden"
          style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
          aria-label="Navegação da coordenação"
        >
          <button
            type="button"
            onClick={() => navigate("/coordenacao")}
            className={`flex min-h-14 items-center justify-center gap-2 rounded-xl text-sm font-medium transition ${
              activePage === "dashboard" ? "bg-blue-500/20 text-blue-300" : "text-ink/70"
            }`}
          >
            <FileCheck2 className="size-5" />
            Validações
          </button>
          <button
            type="button"
            onClick={() => navigate("/coordenacao/alunos")}
            className={`flex min-h-14 items-center justify-center gap-2 rounded-xl text-sm font-medium transition ${
              activePage === "alunos" ? "bg-blue-500/20 text-blue-300" : "text-ink/70"
            }`}
          >
            <Users className="size-5" />
            Alunos
          </button>
        </nav>,
        document.body
      )}

      {modalSair && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-ink/[0.12] p-6 shadow-2xl" style={panelStyle}>
            <h2 className="text-xl font-semibold text-ink">Deseja realmente sair?</h2>
            <p className="mt-2 text-sm text-ink/65">Você será redirecionado para a tela de login.</p>
            <div className="mt-5 flex justify-end gap-3">
              <Button type="button" onClick={() => setModalSair(false)} className="rounded-xl border border-ink/[0.12] bg-ink/[0.06] text-ink hover:bg-ink/10">
                Cancelar
              </Button>
              <Button type="button" onClick={confirmarLogout} className="rounded-xl bg-red-500 text-on-accent hover:bg-red-600">
                Sair
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
