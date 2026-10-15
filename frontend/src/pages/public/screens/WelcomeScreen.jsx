import Button from '../../../components/ui/Button.jsx';
import SurveyScreen from '../../../components/survey/SurveyScreen.jsx';

export default function WelcomeScreen({ onStart }) {
  return (
    <SurveyScreen
      title="Sua experiência é importante para nós"
      subtitle="Leva poucos minutos. Sua participação é voluntária."
      footer={
        <Button size="lg" onClick={onStart}>
          Começar avaliação
        </Button>
      }
    />
  );
}
