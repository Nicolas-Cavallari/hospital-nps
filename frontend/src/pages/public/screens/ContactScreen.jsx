import { ChevronLeft, Lock, Phone, Shield } from 'lucide-react';
import { useState } from 'react';
import Alert from '../../../components/ui/Alert.jsx';
import Button from '../../../components/ui/Button.jsx';
import Checkbox from '../../../components/ui/Checkbox.jsx';
import TextField from '../../../components/ui/TextField.jsx';
import ChoiceCard from '../../../components/survey/ChoiceCard.jsx';
import SurveyScreen from '../../../components/survey/SurveyScreen.jsx';
import { formatPhone, isValidMobile, onlyDigits } from '../survey/phone.js';
import './screens.css';

/**
 * Solicitação de retorno. Ao pedir retorno, o celular e o consentimento são obrigatórios;
 * ao optar pelo anonimato, ambos ficam escondidos.
 * O endereço do texto legal é o configurado pelo Super Admin (`privacyUrl`). Enquanto o hospital não o
 * disponibilizar, o link mostra um aviso ao ser tocado.
 */
export default function ContactScreen({
  value,
  onChange,
  onContinue,
  onBack,
  privacyUrl = null,
  disabled = false,
}) {
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [showPolicyNotice, setShowPolicyNotice] = useState(false);

  const wantsReturn = value.choice === 'return';
  const phoneValid = isValidMobile(value.phone);
  const phoneError =
    wantsReturn && phoneTouched && !phoneValid
      ? 'Informe um celular com DDD, por exemplo (51) 91234-5678.'
      : undefined;
  const canContinue = value.choice === 'anonymous' || (wantsReturn && phoneValid && value.consent);

  return (
    <SurveyScreen
      title="Você gostaria que nossa equipe entrasse em contato?"
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
      <div className="contact__choices" role="radiogroup" aria-labelledby="screen-title">
        <ChoiceCard
          icon={Phone}
          title="Sim, quero receber retorno"
          description="Seu celular ficará protegido."
          name="contact-choice"
          value="return"
          checked={wantsReturn}
          onChange={() => onChange({ ...value, choice: 'return' })}
        />
        <ChoiceCard
          icon={Shield}
          title="Não, prefiro me manter anônimo"
          name="contact-choice"
          value="anonymous"
          checked={value.choice === 'anonymous'}
          onChange={() => onChange({ ...value, choice: 'anonymous' })}
        />
      </div>

      {wantsReturn && (
        <div className="contact__details">
          <TextField
            label="Celular"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            icon={Lock}
            placeholder="(00) 00000-0000"
            value={formatPhone(value.phone)}
            onChange={(e) => onChange({ ...value, phone: onlyDigits(e.target.value) })}
            onBlur={() => setPhoneTouched(true)}
            error={phoneError}
            hint="Seu contato será utilizado somente para fins de retorno relacionados à sua manifestação."
          />
          <Checkbox
            checked={value.consent}
            onChange={(e) => onChange({ ...value, consent: e.target.checked })}
          >
            Autorizo o envio da minha manifestação à ouvidoria e o uso do meu celular apenas para o
            retorno.
          </Checkbox>
        </div>
      )}

      {privacyUrl ? (
        <a className="contact__privacy" href={privacyUrl} target="_blank" rel="noopener noreferrer">
          Leia nossa política de privacidade
        </a>
      ) : (
        <>
          <button
            type="button"
            className="contact__privacy"
            aria-expanded={showPolicyNotice}
            onClick={() => setShowPolicyNotice((open) => !open)}
          >
            Leia nossa política de privacidade
          </button>
          {showPolicyNotice && (
            <Alert variant="info">
              O texto da política de privacidade ainda não foi disponibilizado pelo hospital.
            </Alert>
          )}
        </>
      )}
    </SurveyScreen>
  );
}
