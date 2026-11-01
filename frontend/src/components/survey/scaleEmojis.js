import bom from '../../assets/emojis/bom.png';
import muitoBom from '../../assets/emojis/muito-bom.png';
import muitoRuim from '../../assets/emojis/muito-ruim.png';
import regular from '../../assets/emojis/regular.png';
import ruim from '../../assets/emojis/ruim.png';

/** Emoji de cada alternativa da escala padrão (1 = muito ruim, 5 = muito bom). */
export const SCALE_EMOJIS = {
  1: { name: 'Muito ruim', src: muitoRuim },
  2: { name: 'Ruim', src: ruim },
  3: { name: 'Regular', src: regular },
  4: { name: 'Bom', src: bom },
  5: { name: 'Muito bom', src: muitoBom },
};
