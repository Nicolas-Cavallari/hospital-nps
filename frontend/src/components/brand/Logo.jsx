import logo from '../../assets/logo-fhdod.png';

export default function Logo({ className = '' }) {
  return (
    <img
      className={`logo ${className}`.trim()}
      src={logo}
      alt="FHDOD — Fundação Hospitalar Dr. Oswaldo Diesel"
      width="304"
      height="115"
    />
  );
}
