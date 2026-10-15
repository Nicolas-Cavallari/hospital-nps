import './ScaleSelector.css';

export default function ScaleSelector({ min = 1, max = 5, value, onSelect, lowLabel, highLabel }) {
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  return (
    <div className="scale" role="group" aria-labelledby="screen-title">
      <div className="scale__options" style={{ '--scale-columns': values.length }}>
        {values.map((n) => (
          <button
            key={n}
            type="button"
            className={`scale__btn ${value === n ? 'is-selected' : ''}`.trim()}
            aria-pressed={value === n}
            onClick={() => onSelect(n)}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="scale__labels">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}
