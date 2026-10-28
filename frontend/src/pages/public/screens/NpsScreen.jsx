import { ChevronLeft } from 'lucide-react';
import Button from '../../../components/ui/Button.jsx';
import NpsSelector from '../../../components/survey/NpsSelector.jsx';
import SurveyScreen from '../../../components/survey/SurveyScreen.jsx';

/** Pergunta final de NPS (0 a 10). Tocar em uma nota responde e avança. */
export default function NpsScreen({ nps, value, onSelect, onContinue, onBack, disabled = false }) {
  const answered = value !== null;

  return (
    <SurveyScreen
      title={nps.text}
      subtitle={nps.description}
      footer={
        <>
          <Button variant="secondary" size="lg" icon={ChevronLeft} onClick={onBack} disabled={disabled}>
            Voltar
          </Button>
          {answered && (
            <Button size="lg" onClick={onContinue} disabled={disabled}>
              Continuar
            </Button>
          )}
        </>
      }
    >
      <NpsSelector options={nps.options} value={value} onSelect={onSelect} disabled={disabled} />
    </SurveyScreen>
  );
}
