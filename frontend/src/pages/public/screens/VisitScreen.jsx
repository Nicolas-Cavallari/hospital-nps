import { Calendar, ChevronLeft, Clock } from 'lucide-react';
import Button from '../../../components/ui/Button.jsx';
import TextField from '../../../components/ui/TextField.jsx';
import SurveyScreen from '../../../components/survey/SurveyScreen.jsx';
import './screens.css';

export default function VisitScreen({ shifts, value, onChange, onContinue, onBack, disabled = false }) {
  const today = new Date().toLocaleDateString('en-CA'); // AAAA-MM-DD, no fuso do aparelho
  // Data é necessária, e o horário OU o turno identifica quando foi o atendimento.
  const canContinue = Boolean(value.date) && Boolean(value.time || value.shift);

  return (
    <SurveyScreen
      title="Quando você foi atendido?"
      footer={
        <>
          <Button variant="secondary" size="lg" icon={ChevronLeft} onClick={onBack} disabled={disabled}>
            Voltar
          </Button>
          <Button size="lg" disabled={!canContinue || disabled} onClick={onContinue}>
            Continuar
          </Button>
        </>
      }
    >
      <TextField
        label="Data do atendimento"
        type="date"
        max={today}
        icon={Calendar}
        value={value.date}
        onChange={(e) => onChange({ ...value, date: e.target.value })}
      />
      <TextField
        label="Horário aproximado"
        type="time"
        icon={Clock}
        value={value.time}
        onChange={(e) => onChange({ ...value, time: e.target.value })}
      />

      <div className="shifts">
        <p id="shift-label" className="field__label">
          Ou selecione o turno
        </p>
        <div className="shifts__options" role="group" aria-labelledby="shift-label">
          {shifts.map((shift) => {
            const selected = value.shift === shift.id;
            return (
              <button
                key={shift.id}
                type="button"
                className={`shift ${selected ? 'is-selected' : ''}`.trim()}
                aria-pressed={selected}
                onClick={() => onChange({ ...value, shift: selected ? '' : shift.id })}
              >
                {shift.name}
              </button>
            );
          })}
        </div>
      </div>
    </SurveyScreen>
  );
}
