import { AlertTriangle, RotateCw } from "lucide-react";

/**
 * Estado de erro de uma lista que não carregou: diz o que houve e oferece
 * tentar de novo, em vez de mostrar uma lista vazia como se não houvesse
 * nada.
 */
export default function ErroCarregamento({
  mensagem,
  onTentar,
}: {
  mensagem: string;
  onTentar: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-xl bg-raised border border-red-400/30 p-5 text-center sm:p-6"
    >
      <AlertTriangle className="size-8 text-red-400 mx-auto mb-2" />
      <h3 className="text-ink text-base font-semibold mb-1">Não foi possível carregar</h3>
      <p className="text-ink-muted text-sm">{mensagem}</p>
      <button
        type="button"
        onClick={onTentar}
        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-ink/20 px-4 py-2 text-sm font-medium text-ink transition hover:bg-ink/[0.06]"
      >
        <RotateCw className="size-4" />
        Tentar de novo
      </button>
    </div>
  );
}
