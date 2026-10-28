import { useEffect, useState } from 'react';
import { createRapidClickDetector } from './rapidClicks.js';

const WARNING_DURATION_MS = 5000;

/** Mostra um aviso temporário quando há mais de 5 cliques em 3 segundos. Não bloqueia a pesquisa. */
export function useRapidClickWarning() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const detector = createRapidClickDetector();
    let timer;

    const onClick = () => {
      if (!detector.register()) return;
      setVisible(true);
      clearTimeout(timer);
      timer = setTimeout(() => setVisible(false), WARNING_DURATION_MS);
    };

    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      clearTimeout(timer);
    };
  }, []);

  return visible;
}
