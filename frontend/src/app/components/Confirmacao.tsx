import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";

type Opcoes = {
  titulo: string;
  descricao?: string;
  /** Texto do botão de confirmar; diga o que acontece ("Excluir"). */
  confirmar?: string;
  cancelar?: string;
  /** Ação que apaga ou desfaz algo: botão em vermelho. */
  destrutiva?: boolean;
};

type Pedido = Opcoes & { responder: (ok: boolean) => void };

let abrirPedido: ((pedido: Pedido) => void) | null = null;

/**
 * Substitui o confirm() do navegador por um diálogo no visual do sistema.
 * Uso: `if (!(await confirmar({ titulo: "Excluir este arquivo?" }))) return;`
 * Precisa do <ConfirmacaoHost /> montado uma vez (App.tsx).
 */
export function confirmar(opcoes: Opcoes): Promise<boolean> {
  return new Promise((resolve) => {
    if (!abrirPedido) {
      // Host não montado: cai no confirm nativo para não travar a ação.
      resolve(window.confirm(opcoes.titulo));
      return;
    }
    abrirPedido({ ...opcoes, responder: resolve });
  });
}

export function ConfirmacaoHost() {
  const [pedido, setPedido] = useState<Pedido | null>(null);

  useEffect(() => {
    abrirPedido = setPedido;
    return () => {
      abrirPedido = null;
    };
  }, []);

  const fechar = (ok: boolean) => {
    pedido?.responder(ok);
    setPedido(null);
  };

  return (
    <AlertDialog open={!!pedido} onOpenChange={(aberto) => !aberto && fechar(false)}>
      <AlertDialogContent className="bg-raised border-ink/15">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-ink">{pedido?.titulo}</AlertDialogTitle>
          {pedido?.descricao && (
            <AlertDialogDescription className="text-ink-muted">
              {pedido.descricao}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={() => fechar(false)}
            className="rounded-xl border-ink/20 bg-transparent text-ink hover:bg-ink/[0.06]"
          >
            {pedido?.cancelar || "Cancelar"}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => fechar(true)}
            className={`rounded-xl ${
              pedido?.destrutiva
                ? "bg-red-500 text-on-accent hover:bg-red-600"
                : "bg-brand text-on-brand hover:bg-brand-hover"
            }`}
          >
            {pedido?.confirmar || "Confirmar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
