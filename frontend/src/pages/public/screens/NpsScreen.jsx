import { ChevronLeft } from 'lucide-react';
import Button from '../../../components/ui/Button.jsx';
import NpsSelector from '../../../components/survey/NpsSelector.jsx';
import SurveyScreen from '../../../components/survey/SurveyScreen.jsx';

/** Pergunta final de NPS (0 a 10). Tocar em uma nota responde e avança. */
export default function NpsScreen({ nps, value, onSelect, onContinue, onBack }) {
  const answered = value !== null;

  return (
    <SurveyScreen
      title={nps.text}
      subtitle={nps.hint}
      footer={
        <>
          <Button variant="secondary" size="lg" icon={ChevronLeft} onClick={onBack}>
            Voltar
          </Button>
          {answered && (
            <Button size="lg" onClick={onContinue}>
              Continuar
            </Button>
          )}
        </>
      }
    >
      <NpsSelector value={value} onSelect={onSelect} />
    </SurveyScreen>
  );
}
