import './NpsSelector.css';

const SCORES = Array.from({ length: 11 }, (_, i) => i);

// Faixas do NPS: 0–6 detratores, 7–8 neutros, 9–10 promotores.
function toneOf(score) {
  if (score <= 6) return 'detractor';
  if (score <= 8) return 'neutral';
  return 'promoter';
}

export default function NpsSelector({ value, onSelect }) {
  return (
    <div className="nps" role="group" aria-labelledby="screen-title">
      {SCORES.map((n) => (
        <button
          key={n}
          type="button"
          className={`nps__btn nps__btn--${toneOf(n)} ${value === n ? 'is-selected' : ''}`.trim()}
          aria-pressed={value === n}
          onClick={() => onSelect(n)}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
