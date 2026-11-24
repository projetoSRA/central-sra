import { RouterProvider } from "react-router";
import { router } from "./routes";
import { Toaster } from "./components/ui/sonner";
import { ConfirmacaoHost } from "./components/Confirmacao";

// Avisos (toasts) e o diálogo de confirmação ficam montados uma vez só,
// para qualquer tela usar `toast(...)` e `confirmar(...)`.
export default function App() {
  return (
    <>
      {/* Antes das rotas: o Toaster precisa estar ouvindo quando uma tela
          dispara um aviso logo ao abrir (ex.: "sessão expirada"). */}
      <Toaster />
      <ConfirmacaoHost />
      <RouterProvider router={router} />
    </>
  );
}
