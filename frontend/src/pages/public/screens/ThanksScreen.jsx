import Button from '../../../components/ui/Button.jsx';
import SurveyScreen from '../../../components/survey/SurveyScreen.jsx';

export default function ThanksScreen({ onFinish }) {
  return (
    <SurveyScreen
      title="Obrigado por avaliar nosso atendimento!"
      subtitle="Sua opinião nos ajuda a melhorar continuamente."
      footer={
        <Button size="lg" onClick={onFinish}>
          Finalizar
        </Button>
      }
    />
  );
}
