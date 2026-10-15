import './ChoiceCard.css';

export default function ChoiceCard({ icon: Icon, title, description, checked, ...inputProps }) {
  return (
    <label className={`choice ${checked ? 'is-checked' : ''}`.trim()}>
      <input type="radio" className="choice__input" checked={checked} {...inputProps} />
      <Icon className="choice__icon" aria-hidden="true" size={24} />
      <span className="choice__text">
        <span className="choice__title">{title}</span>
        {description && <span className="choice__desc">{description}</span>}
      </span>
      <span className="choice__radio" aria-hidden="true" />
    </label>
  );
}
