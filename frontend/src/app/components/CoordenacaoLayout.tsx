import { ReactNode, useState } from "react";
import AlternarTema from "./AlternarTema";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { Button } from "./ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { User } from "../utils/auth";
import { clearSession } from "../utils/api";
import { panelStyle } from "../../styles/uiStyles";
import { FileCheck2, LogOut, LucideIcon, Settings, Users } from "lucide-react";
import { formatarNome, iniciaisDoNome } from "../utils/formatar";
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

  const navProps = (page: ActivePage) => ({
    className: "app-navlink",
    "aria-current": activePage === page ? ("page" as const) : undefined,
  });

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

      <div className="relative flex h-full flex-col">
        <div className="mx-auto flex w-full max-w-[1760px] flex-col lg:h-full">
          <header className="app-topbar flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6 lg:mb-0 p-3 sm:p-4 lg:px-0 lg:pt-1 lg:pb-5">
            <span
              aria-hidden="true"
              className="flex size-11 shrink-0 items-center justify-center rounded-full border-[3px] border-blue-400 bg-ink/10 font-display text-sm font-semibold text-ink"
            >
              {iniciaisDoNome(user.name)}
            </span>

            <h1 className="font-display text-lg sm:text-xl lg:text-2xl font-bold tracking-tight text-ink whitespace-nowrap">
              Central SRA
            </h1>

            <nav
              className="hidden lg:flex lg:flex-1 lg:justify-end lg:gap-x-8 lg:pr-4"
              aria-label="Navegação da coordenação"
            >
              <button type="button" onClick={() => navigate("/coordenacao")} {...navProps("dashboard")}>
                <span className="inline-flex items-center gap-2">
                  Validações
                  {!!pendentesCount && (
                    <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-semibold text-blue-300 tabular-nums">
                      {pendentesCount}
                    </span>
                  )}
                </span>
              </button>
              <button type="button" onClick={() => navigate("/coordenacao/alunos")} {...navProps("alunos")}>
                Alunos
              </button>
            </nav>

            <AlternarTema className="ml-auto lg:ml-0" />

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

              <DropdownMenuContent align="end" sideOffset={8} collisionPadding={12} className="z-[100] w-60 max-w-[calc(100vw-1.5rem)] rounded-xl border border-ink/[0.12] bg-raised p-2 shadow-2xl">
                <div className="border-b border-ink/[0.12] px-2 pb-2 mb-1">
                  <p className="truncate text-sm font-medium text-ink">{formatarNome(user.name)}</p>
                  <p className="truncate text-xs text-ink-muted tabular-nums">Coordenação · Matrícula {user.identifier}</p>
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

          <main className="min-w-0 flex-1 lg:min-h-0 lg:overflow-hidden">
            <div className="app-scroll-area lg:h-full">
              {/* Título da página: o que antes ficava no cabeçalho */}
              <div className="mb-6 flex flex-wrap items-center gap-3">
                <Icon className="size-6 text-blue-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-ink">{title}</h2>
                  {subtitle && <p className="text-ink-muted text-sm">{subtitle}</p>}
                </div>
                {headerActions && <div className="flex flex-wrap gap-2">{headerActions}</div>}
              </div>

              {children}
            </div>
          </main>
        </div>
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
              activePage === "dashboard" ? "bg-blue-500/20 text-blue-300" : "text-ink"
            }`}
          >
            <FileCheck2 className="size-5" />
            Validações
            {!!pendentesCount && (
              <span className="rounded-full bg-blue-500/20 px-1.5 text-xs font-semibold text-blue-300 tabular-nums">
                {pendentesCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => navigate("/coordenacao/alunos")}
            className={`flex min-h-14 items-center justify-center gap-2 rounded-xl text-sm font-medium transition ${
              activePage === "alunos" ? "bg-blue-500/20 text-blue-300" : "text-ink"
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
            <p className="mt-2 text-sm text-ink-muted">Você será redirecionado para a tela de login.</p>
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
