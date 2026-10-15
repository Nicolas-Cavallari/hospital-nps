import { ChevronLeft } from 'lucide-react';
import Button from '../../../components/ui/Button.jsx';
import ScaleSelector from '../../../components/survey/ScaleSelector.jsx';
import SurveyScreen from '../../../components/survey/SurveyScreen.jsx';
import './screens.css';

/**
 * Pergunta de escala. Tocar em um número já responde e avança.
 * "Continuar" só aparece ao voltar para uma pergunta já respondida.
 */
export default function ScaleQuestionScreen({
  question,
  value,
  onSelect,
  onSkip,
  onContinue,
  onBack,
}) {
  const answered = value !== undefined;

  return (
    <SurveyScreen
      title={question.text}
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
      <ScaleSelector
        min={question.scale.min}
        max={question.scale.max}
        lowLabel={question.scale.lowLabel}
        highLabel={question.scale.highLabel}
        value={value}
        onSelect={onSelect}
      />
      {!question.required && (
        <Button variant="quiet" className="screen__skip" onClick={onSkip}>
          Pular esta pergunta
        </Button>
      )}
    </SurveyScreen>
  );
}
