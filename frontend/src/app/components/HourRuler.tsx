type HourRulerProps = {
  /** Horas já cumpridas. */
  value: number;
  /** Meta de horas (o fim da régua). */
  total?: number;
  size?: "md" | "lg";
  /** Preenche os traços em sequência ao aparecer (uso decorativo). */
  animated?: boolean;
  /** Esconde os rótulos de horas sob a régua. */
  hideLabels?: boolean;
  className?: string;
};

const SEGMENTS = 40;

/**
 * Progresso de horas desenhado como uma régua: 40 intervalos entre 0 e a
 * meta, com um traço maior a cada quarto do caminho.
 */
export default function HourRuler({
  value,
  total = 200,
  size = "md",
  animated = false,
  hideLabels = false,
  className = "",
}: HourRulerProps) {
  const step = total / SEGMENTS;
  const horas = Math.max(0, Math.min(Number(value) || 0, total));

  return (
    <div
      className={`hour-ruler ${size === "lg" ? "hour-ruler--lg" : ""} ${
        animated ? "hour-ruler--animated" : ""
      } ${className}`}
      role="img"
      aria-label={`${horas} de ${total} horas concluídas`}
    >
      <div className="hour-ruler__ticks">
        {Array.from({ length: SEGMENTS + 1 }, (_, i) => (
          <span
            key={i}
            data-major={i % 10 === 0}
            data-done={horas > 0 && i * step <= horas}
            style={{ "--i": i } as React.CSSProperties}
          />
        ))}
      </div>

      {!hideLabels && (
        <div className="hour-ruler__labels" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((q) => (
            <span key={q}>{Math.round((total / 4) * q)}h</span>
          ))}
        </div>
      )}
    </div>
  );
}
