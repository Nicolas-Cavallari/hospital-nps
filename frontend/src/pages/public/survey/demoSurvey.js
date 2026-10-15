/**
 * CONTEÚDO DE DEMONSTRAÇÃO — usado apenas para revisar a interface (Etapa 2).
 * Os textos vêm das telas do Figma. Na etapa da pesquisa, perguntas, escalas e turnos
 * passarão a vir da API, por setor, e este arquivo será removido.
 */
export const DEMO_SURVEY = {
  shifts: ['Manhã', 'Tarde', 'Noite'],
  questions: [
    {
      id: 'demo-recepcao',
      text: 'Como você avalia o atendimento na recepção?',
      required: false,
      scale: { min: 1, max: 5, lowLabel: 'Muito ruim', highLabel: 'Excelente' },
    },
  ],
  nps: {
    text: 'De 0 a 10, o quanto você recomendaria nosso hospital?',
    hint: '0 significa nada provável; 10, muito provável.',
  },
};
