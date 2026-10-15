import './Button.css';

/**
 * Variantes do Figma: primary (ação principal), secondary (ação secundária),
 * discrete (ação discreta), danger (excluir). "quiet" é a opção discreta em cinza
 * usada para "Pular esta pergunta".
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  icon: Icon,
  className = '',
  type = 'button',
  children,
  ...rest
}) {
  const classes = ['btn', `btn--${variant}`, `btn--${size}`, fullWidth && 'btn--full', className]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={classes} {...rest}>
      {Icon && <Icon aria-hidden="true" size={18} />}
      {children}
    </button>
  );
}
