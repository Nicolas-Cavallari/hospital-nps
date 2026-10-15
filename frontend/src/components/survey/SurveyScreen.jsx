import './SurveyScreen.css';

/** Estrutura comum das telas da pesquisa: título, subtítulo, conteúdo e rodapé de ações. */
export default function SurveyScreen({ title, subtitle, children, footer }) {
  return (
    <>
      <div className="screen__body">
        <h1 id="screen-title" tabIndex={-1} className="screen__title">
          {title}
        </h1>
        {subtitle && <p className="screen__subtitle">{subtitle}</p>}
        {children}
      </div>
      {footer && <div className="screen__footer">{footer}</div>}
    </>
  );
}
