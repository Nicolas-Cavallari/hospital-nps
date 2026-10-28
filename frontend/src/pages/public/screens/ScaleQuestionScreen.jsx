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
  disabled = false,
}) {
  const answered = value !== undefined;

  return (
    <SurveyScreen
      title={question.text}
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
      <ScaleSelector options={question.options} value={value} onSelect={onSelect} disabled={disabled} />
      {!question.required && (
        <Button variant="quiet" className="screen__skip" onClick={onSkip} disabled={disabled}>
          Pular esta pergunta
        </Button>
      )}
    </SurveyScreen>
  );
}
