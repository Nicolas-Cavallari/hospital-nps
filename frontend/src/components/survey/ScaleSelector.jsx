import './ScaleSelector.css';

/** Escala de alternativas (ex.: 1 a 5). Os rótulos das pontas são opcionais. */
export default function ScaleSelector({ options, value, onSelect, disabled = false }) {
  const lowLabel = options[0]?.label;
  const highLabel = options[options.length - 1]?.label;

  return (
    <div className="scale" role="group" aria-labelledby="screen-title">
      <div className="scale__options" style={{ '--scale-columns': options.length }}>
        {options.map(({ value: optionValue }) => (
          <button
            key={optionValue}
            type="button"
            className={`scale__btn ${value === optionValue ? 'is-selected' : ''}`.trim()}
            aria-pressed={value === optionValue}
            disabled={disabled}
            onClick={() => onSelect(optionValue)}
          >
            {optionValue}
          </button>
        ))}
      </div>
      {(lowLabel || highLabel) && (
        <div className="scale__labels">
          <span>{lowLabel}</span>
          <span>{highLabel}</span>
        </div>
      )}
    </div>
  );
}
