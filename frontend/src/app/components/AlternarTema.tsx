import { useTema } from "../utils/tema";

/**
 * Botão de modo claro/escuro. O ícone é um disco meio tinta, meio papel:
 * a metade preenchida gira para o outro lado a cada troca, mostrando
 * qual modo está ativo.
 */
export default function AlternarTema({ className = "" }: { className?: string }) {
  const { tema, alternar } = useTema();
  const escuro = tema === "dark";
  const rotulo = escuro ? "Usar modo claro" : "Usar modo escuro";

  return (
    <button
      type="button"
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        alternar({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
      }}
      className={`alternar-tema ${className}`}
      aria-label={rotulo}
      title={rotulo}
      aria-pressed={escuro}
    >
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
        <circle cx="12" cy="12" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path
          className="alternar-tema__metade"
          d="M12 3.75a8.25 8.25 0 0 1 0 16.5Z"
          fill="currentColor"
          style={{ transform: escuro ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </svg>
    </button>
  );
}
