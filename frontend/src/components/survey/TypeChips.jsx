import './TypeChips.css';

export default function TypeChips({ options, value, onChange, label }) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map(({ value: optionValue, label: optionLabel, icon: Icon }) => {
        const selected = value === optionValue;
        return (
          <button
            key={optionValue}
            type="button"
            className={`chip chip--${optionValue} ${selected ? 'is-selected' : ''}`.trim()}
            aria-pressed={selected}
            onClick={() => onChange(selected ? '' : optionValue)}
          >
            <Icon
              aria-hidden="true"
              size={16}
              className="chip__icon"
              fill={optionValue === 'elogio' ? 'currentColor' : 'none'}
            />
            {optionLabel}
          </button>
        );
      })}
    </div>
  );
}
