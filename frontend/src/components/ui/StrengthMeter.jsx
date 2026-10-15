const LEVELS = {
  1: { label: 'fraca', tone: 'critical' },
  2: { label: 'razoável', tone: 'warning' },
  3: { label: 'boa', tone: 'warning' },
  4: { label: 'forte', tone: 'success' },
};

/** Barras de força da senha (feedback visual; estilos em pages/admin/auth.css). */
export default function StrengthMeter({ score }) {
  const level = LEVELS[score];

  return (
    <div className="strength">
      <div className="strength__bars" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={`strength__bar ${level && i <= score ? `strength__bar--${level.tone}` : ''}`.trim()}
          />
        ))}
      </div>
      <p className={`strength__label ${level ? `strength__label--${level.tone}` : ''}`.trim()} aria-live="polite">
        {level ? `Força da senha: ${level.label}` : 'Força da senha'}
      </p>
    </div>
  );
}
