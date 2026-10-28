import { ChevronLeft, Heart, Lightbulb, MessageCircle, TriangleAlert } from 'lucide-react';
import Button from '../../../components/ui/Button.jsx';
import SurveyScreen from '../../../components/survey/SurveyScreen.jsx';
import TypeChips from '../../../components/survey/TypeChips.jsx';
import './screens.css';

const MAX_LENGTH = 1000;

const TYPES = [
  { value: 'elogio', label: 'Elogio', icon: Heart },
  { value: 'reclamacao', label: 'Reclamação', icon: TriangleAlert },
  { value: 'sugestao', label: 'Sugestão', icon: Lightbulb },
  { value: 'outro', label: 'Outro', icon: MessageCircle },
];

export default function CommentScreen({ value, onChange, onContinue, onBack, disabled = false }) {
  return (
    <SurveyScreen
      title="Quer contar mais sobre sua experiência?"
      footer={
        <>
          <Button variant="secondary" size="lg" icon={ChevronLeft} onClick={onBack} disabled={disabled}>
            Voltar
          </Button>
          <Button size="lg" onClick={onContinue} disabled={disabled}>
            Continuar
          </Button>
        </>
      }
    >
      <TypeChips
        label="Tipo de manifestação"
        options={TYPES}
        value={value.type}
        onChange={(type) => onChange({ ...value, type })}
      />

      <div className="comment">
        <label className="visually-hidden" htmlFor="comment-text">
          Seu comentário
        </label>
        <textarea
          id="comment-text"
          className="comment__input"
          placeholder="Conte para nós o que aconteceu"
          maxLength={MAX_LENGTH}
          value={value.text}
          onChange={(e) => onChange({ ...value, text: e.target.value })}
        />
        <span className="comment__counter">
          {value.text.length} / {MAX_LENGTH}
        </span>
      </div>
    </SurveyScreen>
  );
}
