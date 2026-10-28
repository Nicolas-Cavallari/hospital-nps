import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import PublicLayout from '../../components/layout/PublicLayout.jsx';
import Alert from '../../components/ui/Alert.jsx';
import Button from '../../components/ui/Button.jsx';
import Toast from '../../components/ui/Toast.jsx';
import SurveyScreen from '../../components/survey/SurveyScreen.jsx';
import * as surveyApi from '../../services/survey.js';
import CommentScreen from './screens/CommentScreen.jsx';
import ContactScreen from './screens/ContactScreen.jsx';
import NpsScreen from './screens/NpsScreen.jsx';
import ScaleQuestionScreen from './screens/ScaleQuestionScreen.jsx';
import ThanksScreen from './screens/ThanksScreen.jsx';
import VisitScreen from './screens/VisitScreen.jsx';
import WelcomeScreen from './screens/WelcomeScreen.jsx';
import { useRapidClickWarning } from './survey/useRapidClickWarning.js';

/**
 * Fluxo da pesquisa pública. Cada resposta é enviada ao servidor quando a pessoa avança; a
 * avaliação só é concluída na última etapa de dados. As validações da tela são conveniência:
 * o servidor valida tudo de novo (obrigatórias, alternativas, regras do feedback).
 * O token da avaliação fica apenas na memória: fechar a página deixa a avaliação incompleta.
 */

const EMPTY_ANSWERS = {
  visit: { date: '', time: '', shift: '' }, // shift = id do turno
  scale: {}, // { [idDaPergunta]: número | 'skipped' }
  nps: null,
  comment: { type: '', text: '' },
  contact: { choice: '', phone: '', consent: false },
};
const SKIPPED = 'skipped';

// Ignora toques repetidos logo após trocar de tela (evita responder a pergunta seguinte sem querer).
const TAP_GUARD_MS = 400;

const NETWORK_ERROR = 'Não foi possível conectar. Verifique a internet e tente novamente.';
const GENERIC_ERROR = 'Não foi possível salvar. Tente novamente.';
const LOST_ERROR = 'Não foi possível continuar esta avaliação. Atualize a página para recomeçar.';

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

function StatusScreen({ title, subtitle, action }) {
  return (
    <PublicLayout>
      <SurveyScreen title={title} subtitle={subtitle} footer={action} />
    </PublicLayout>
  );
}

function SurveyFlow({ slug }) {
  const navigate = useNavigate();
  const location = useLocation();
  const rapidClicks = useRapidClickWarning();

  const [survey, setSurvey] = useState({ status: 'loading', data: null });
  const [answers, setAnswers] = useState(EMPTY_ANSWERS);
  const [flow, setFlow] = useState({ started: false, finished: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sessionRef = useRef(null); // { id, token }
  const lastNavAt = useRef(0);
  const firstRender = useRef(true);

  const loadSurvey = useCallback(async () => {
    setSurvey({ status: 'loading', data: null });
    try {
      const result = await surveyApi.fetchSurvey(slug);
      if (result.ok) setSurvey({ status: 'ready', data: result.body });
      else setSurvey({ status: result.status === 404 ? 'unavailable' : 'error', data: null });
    } catch {
      setSurvey({ status: 'error', data: null });
    }
  }, [slug]);

  useEffect(() => {
    loadSurvey();
  }, [loadSurvey]);

  // A tela atual vem do histórico do navegador: o "voltar" do aparelho segue o botão Voltar.
  const requestedStep = location.state?.step ?? 'welcome';
  let step = 'welcome';
  if (flow.finished) step = 'thanks'; // concluída: não volta a editar
  else if (flow.started) step = requestedStep;

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    document.getElementById('screen-title')?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [step]);

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

  /** Executa uma ação que fala com o servidor: desabilita os botões enquanto espera e mostra falhas. */
  async function run(action) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch {
      setError(NETWORK_ERROR);
    } finally {
      setBusy(false);
    }
  }

  /** Mostra o erro do servidor e permanece na tela; devolve false. */
  function fail(result) {
    if (result.body?.code === 'SURVEY_UNAVAILABLE') {
      setSurvey({ status: 'unavailable', data: null });
    } else if (result.status === 404) {
      setError(LOST_ERROR);
    } else {
      setError(result.status === 400 || result.status === 409 ? result.body?.error ?? GENERIC_ERROR : GENERIC_ERROR);
    }
    return false;
  }

  async function save(questionId, answer) {
    const result = await surveyApi.saveAnswer(sessionRef.current, questionId, answer);
    return result.ok ? true : fail(result);
  }

  async function finish(feedback) {
    const result = await surveyApi.finishEvaluation(sessionRef.current, feedback);
    if (!result.ok) return fail(result);
    goTo('thanks');
    return true;
  }

  if (survey.status === 'loading') {
    return <StatusScreen title="Carregando…" subtitle="Só um instante." />;
  }
  if (survey.status === 'unavailable') {
    return (
      <StatusScreen
        title="Pesquisa indisponível"
        subtitle="Esta pesquisa não está disponível no momento. Procure a equipe do hospital."
      />
    );
  }
  if (survey.status === 'error') {
    return (
      <StatusScreen
        title="Não foi possível abrir a pesquisa"
        subtitle="Verifique a internet e tente novamente."
        action={
          <Button size="lg" onClick={loadSurvey}>
            Tentar novamente
          </Button>
        }
      />
    );
  }

  const { data } = survey;
  const questions = data.questions;
  const advance = (from, nextAnswers = answers) => goTo(nextStepAfter(from, nextAnswers, questions));
  const goBack = guard(() => {
    setError('');
    navigate(-1);
  });

  function renderScreen() {
    if (step === 'visit') {
      const visit = answers.visit;
      return (
        <VisitScreen
          shifts={data.shifts}
          value={visit}
          disabled={busy}
          onChange={(next) => setAnswers((a) => ({ ...a, visit: next }))}
          onBack={goBack}
          onContinue={guard(() =>
            run(async () => {
              const payload = {
                visitDate: visit.date,
                ...(visit.time ? { visitTime: visit.time } : {}),
                ...(visit.shift ? { shiftId: visit.shift } : {}),
              };
              if (sessionRef.current) {
                const result = await surveyApi.updateVisit(sessionRef.current, payload);
                if (!result.ok) return fail(result);
              } else {
                const result = await surveyApi.createEvaluation(slug, payload);
                if (!result.ok) return fail(result);
                sessionRef.current = { id: result.body.evaluation.id, token: result.body.accessToken };
              }
              advance('visit');
              return true;
            }),
          )}
        />
      );
    }

    if (step.startsWith('q:')) {
      const question = questions.find((q) => `q:${q.id}` === step);
      if (question) {
        const answerAndAdvance = (value) =>
          run(async () => {
            const saved = await save(question.id, value === SKIPPED ? { skipped: true } : { value });
            if (!saved) return;
            const next = { ...answers, scale: { ...answers.scale, [question.id]: value } };
            setAnswers(next);
            advance(step, next);
          });
        return (
          <ScaleQuestionScreen
            question={question}
            value={answers.scale[question.id]}
            disabled={busy}
            onSelect={guard(answerAndAdvance)}
            onSkip={guard(() => answerAndAdvance(SKIPPED))}
            onContinue={guard(() => advance(step))}
            onBack={goBack}
          />
        );
      }
    }

    if (step === 'nps') {
      return (
        <NpsScreen
          nps={data.nps}
          value={answers.nps}
          disabled={busy}
          onBack={goBack}
          onSelect={guard((value) =>
            run(async () => {
              if (!(await save(data.nps.id, { value }))) return;
              // Nota 7–10 não tem comentário nem contato: descarta o que tinha sido preenchido.
              const next = {
                ...answers,
                nps: value,
                ...(value > 6 ? { comment: EMPTY_ANSWERS.comment, contact: EMPTY_ANSWERS.contact } : {}),
              };
              setAnswers(next);
              if (value > 6) await finish(null);
              else advance('nps', next);
            }),
          )}
          onContinue={guard(() => advance('nps'))}
        />
      );
    }

    if (step === 'comment') {
      return (
        <CommentScreen
          value={answers.comment}
          disabled={busy}
          onChange={(comment) => setAnswers((a) => ({ ...a, comment }))}
          onBack={goBack}
          onContinue={guard(() => {
            if (answers.comment.text.trim()) {
              advance('comment');
              return;
            }
            // Feedback é opcional: sem texto, a pesquisa conclui normalmente.
            setAnswers((a) => ({ ...a, contact: EMPTY_ANSWERS.contact }));
            run(() => finish(null));
          })}
        />
      );
    }

    if (step === 'contact') {
      return (
        <ContactScreen
          value={answers.contact}
          disabled={busy}
          privacyUrl={data.privacyPolicyUrl}
          onChange={(contact) => setAnswers((a) => ({ ...a, contact }))}
          onBack={goBack}
          onContinue={guard(() =>
            run(async () => {
              const { comment, contact } = answers;
              const wantsReturn = contact.choice === 'return';
              await finish({
                ...(comment.type ? { type: comment.type } : {}),
                message: comment.text,
                contactRequested: wantsReturn,
                ...(wantsReturn ? { phone: contact.phone, consent: contact.consent } : {}),
              });
            }),
          )}
        />
      );
    }

    if (step === 'thanks') {
      return (
        <ThanksScreen
          onFinish={() => {
            lastNavAt.current = Date.now();
            sessionRef.current = null;
            setAnswers(EMPTY_ANSWERS);
            setError('');
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

  return (
    <>
      <PublicLayout notice={error ? <Alert variant="critical">{error}</Alert> : null}>{renderScreen()}</PublicLayout>
      {rapidClicks && (
        <Toast>Você clicou muitas vezes em pouco tempo. Aguarde um instante e toque com calma.</Toast>
      )}
    </>
  );
}

export default function SurveyPage() {
  const { slug } = useParams();
  // Trocar de setor (outra URL) recomeça tudo do zero.
  return <SurveyFlow key={slug} slug={slug} />;
}
