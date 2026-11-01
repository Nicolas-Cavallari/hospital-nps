import './ScaleSelector.css';
import { SCALE_EMOJIS } from './scaleEmojis.js';
import { sortForDisplay, usesEmojis } from './scaleOrder.js';

<<<<<<< HEAD
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
=======
/**
 * Escala de alternativas. A melhor fica à esquerda e a pior à direita. A escala padrão (1 a 5)
 * é exibida com emojis; outras escalas, com números. Os rótulos das pontas são opcionais.
 */
export default function ScaleSelector({ options, value, onSelect, disabled = false }) {
  const ordered = sortForDisplay(options);
  const emojis = usesEmojis(ordered);
  const leftLabel = ordered[0]?.label; // melhor alternativa
  const rightLabel = ordered[ordered.length - 1]?.label; // pior alternativa

  return (
    <div className="scale" role="group" aria-labelledby="screen-title">
      <div className="scale__options" style={{ '--scale-columns': ordered.length }}>
        {ordered.map(({ value: optionValue }) => {
          const emoji = emojis ? SCALE_EMOJIS[optionValue] : null;
          const selected = value === optionValue;
          return (
            <button
              key={optionValue}
              type="button"
              className={`scale__btn ${emoji ? 'scale__btn--emoji' : ''} ${selected ? 'is-selected' : ''}`.replace(/\s+/g, ' ').trim()}
              aria-pressed={selected}
              aria-label={emoji ? `${emoji.name} (${optionValue} de 5)` : undefined}
              disabled={disabled}
              onClick={() => onSelect(optionValue)}
            >
              {emoji ? (
                <img className="scale__emoji" src={emoji.src} alt="" width="96" height="96" draggable="false" />
              ) : (
                optionValue
              )}
            </button>
          );
        })}
      </div>
      {(leftLabel || rightLabel) && (
        <div className="scale__labels">
          <span>{leftLabel}</span>
          <span>{rightLabel}</span>
>>>>>>> fab7d68 (adicionando emojis na avaliação e corrigindo a ordem)
        </div>
      )}
    </div>
  );
}
