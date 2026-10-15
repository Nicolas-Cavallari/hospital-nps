import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PublicLayout from '../../components/layout/PublicLayout.jsx';
import CommentScreen from './screens/CommentScreen.jsx';
import ContactScreen from './screens/ContactScreen.jsx';
import NpsScreen from './screens/NpsScreen.jsx';
import ScaleQuestionScreen from './screens/ScaleQuestionScreen.jsx';
import ThanksScreen from './screens/ThanksScreen.jsx';
import VisitScreen from './screens/VisitScreen.jsx';
import WelcomeScreen from './screens/WelcomeScreen.jsx';
import { DEMO_SURVEY } from './survey/demoSurvey.js';

/**
 * ETAPA 2 — somente interface: o fluxo navega entre as telas e guarda as escolhas em memória.
 * Nada é enviado ao backend nem gravado no banco; validações e salvamento vêm nas próximas etapas.
 */

const EMPTY_ANSWERS = {
  visit: { date: '', time: '', shift: '' },
  scale: {}, // { [idDaPergunta]: número | 'skipped' }
  nps: null,
  comment: { type: '', text: '' },
  contact: { choice: '', phone: '', consent: false },
};

// Ignora toques repetidos logo após trocar de tela (evita responder a pergunta seguinte sem querer).
const TAP_GUARD_MS = 400;

function nextStepAfter(step, answers, questions) {
  const main = ['welcome', 'visit', ...questions.map((q) => `q:${q.id}`), 'nps'];
  const index = main.indexOf(step);

  if (index !== -1 && index < main.length - 1) return main[index + 1];
  // Comentário e contato só existem para notas de 0 a 6.
  if (step === 'nps') return answers.nps <= 6 ? 'comment' : 'thanks';
  // Sem comentário, não há manifestação a encaminhar: pula a tela de contato.
  if (step === 'comment') return answers.comment.text.trim() ? 'contact' : 'thanks';
  return 'thanks';
}

export default function SurveyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const survey = DEMO_SURVEY;

  const [answers, setAnswers] = useState(EMPTY_ANSWERS);
  const [flow, setFlow] = useState({ started: false, finished: false });
  const lastNavAt = useRef(0);
  const firstRender = useRef(true);

  // A tela atual vem do histórico do navegador: o "voltar" do aparelho segue o botão Voltar.
  const requestedStep = location.state?.step ?? 'welcome';
  let step = 'welcome';
  if (flow.finished) step = 'thanks'; // concluída: não volta a editar
  else if (flow.started) step = requestedStep;

  const goTo = useCallback(
    (target) => {
      lastNavAt.current = Date.now();
      if (target === 'thanks') setFlow({ started: true, finished: true });
      navigate(location.pathname, { state: { step: target } });
    },
    [navigate, location.pathname],
  );

  const guard =
    (fn) =>
    (...args) => {
      if (Date.now() - lastNavAt.current < TAP_GUARD_MS) return;
      fn(...args);
    };

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    document.getElementById('screen-title')?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [step]);

  const goBack = guard(() => navigate(-1));
  const advanceFrom = (from, nextAnswers = answers) =>
    goTo(nextStepAfter(from, nextAnswers, survey.questions));

  function renderScreen() {
    if (step === 'visit') {
      return (
        <VisitScreen
          shifts={survey.shifts}
          value={answers.visit}
          onChange={(visit) => setAnswers((a) => ({ ...a, visit }))}
          onContinue={guard(() => advanceFrom('visit'))}
          onBack={goBack}
        />
      );
    }

    if (step.startsWith('q:')) {
      const question = survey.questions.find((q) => `q:${q.id}` === step);
      if (question) {
        const answerAndAdvance = (value) => {
          const next = { ...answers, scale: { ...answers.scale, [question.id]: value } };
          setAnswers(next);
          advanceFrom(step, next);
        };
        return (
          <ScaleQuestionScreen
            question={question}
            value={answers.scale[question.id]}
            onSelect={guard(answerAndAdvance)}
            onSkip={guard(() => answerAndAdvance('skipped'))}
            onContinue={guard(() => advanceFrom(step))}
            onBack={goBack}
          />
        );
      }
    }

    if (step === 'nps') {
      return (
        <NpsScreen
          nps={survey.nps}
          value={answers.nps}
          onSelect={guard((value) => {
            // Nota 7–10 não tem comentário nem contato: descarta o que tinha sido preenchido.
            const next = {
              ...answers,
              nps: value,
              ...(value > 6
                ? { comment: EMPTY_ANSWERS.comment, contact: EMPTY_ANSWERS.contact }
                : {}),
            };
            setAnswers(next);
            advanceFrom('nps', next);
          })}
          onContinue={guard(() => advanceFrom('nps'))}
          onBack={goBack}
        />
      );
    }

    if (step === 'comment') {
      return (
        <CommentScreen
          value={answers.comment}
          onChange={(comment) => setAnswers((a) => ({ ...a, comment }))}
          onContinue={guard(() => {
            const hasText = answers.comment.text.trim() !== '';
            const next = hasText ? answers : { ...answers, contact: EMPTY_ANSWERS.contact };
            setAnswers(next);
            advanceFrom('comment', next);
          })}
          onBack={goBack}
        />
      );
    }

    if (step === 'contact') {
      return (
        <ContactScreen
          value={answers.contact}
          onChange={(contact) => setAnswers((a) => ({ ...a, contact }))}
          onContinue={guard(() => {
            // Anônimo: não guarda celular nem consentimento.
            if (answers.contact.choice === 'anonymous') {
              setAnswers((a) => ({ ...a, contact: { choice: 'anonymous', phone: '', consent: false } }));
            }
            goTo('thanks');
          })}
          onBack={goBack}
        />
      );
    }

    if (step === 'thanks') {
      return (
        <ThanksScreen
          onFinish={() => {
            lastNavAt.current = Date.now();
            setAnswers(EMPTY_ANSWERS);
            setFlow({ started: false, finished: false });
            navigate(location.pathname, { replace: true, state: null });
          }}
        />
      );
    }

    return (
      <WelcomeScreen
        onStart={guard(() => {
          setFlow({ started: true, finished: false });
          goTo('visit');
        })}
      />
    );
  }

  return <PublicLayout>{renderScreen()}</PublicLayout>;
}
