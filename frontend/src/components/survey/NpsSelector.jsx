import './NpsSelector.css';
<<<<<<< HEAD
=======
import { sortForDisplay } from './scaleOrder.js';
>>>>>>> fab7d68 (adicionando emojis na avaliação e corrigindo a ordem)

// Faixas do NPS: 0–6 detratores, 7–8 neutros, 9–10 promotores.
function toneOf(score) {
  if (score <= 6) return 'detractor';
  if (score <= 8) return 'neutral';
  return 'promoter';
}

<<<<<<< HEAD
export default function NpsSelector({ options, value, onSelect, disabled = false }) {
  return (
    <div className="nps" role="group" aria-labelledby="screen-title">
      {options.map(({ value: score }) => (
=======
// Maior nota à esquerda, diminuindo até 0 à direita; as notas continuam sendo números.
export default function NpsSelector({ options, value, onSelect, disabled = false }) {
  return (
    <div className="nps" role="group" aria-labelledby="screen-title">
      {sortForDisplay(options).map(({ value: score }) => (
>>>>>>> fab7d68 (adicionando emojis na avaliação e corrigindo a ordem)
        <button
          key={score}
          type="button"
          className={`nps__btn nps__btn--${toneOf(score)} ${value === score ? 'is-selected' : ''}`.trim()}
          aria-pressed={value === score}
          disabled={disabled}
          onClick={() => onSelect(score)}
        >
          {score}
        </button>
      ))}
    </div>
  );
}
