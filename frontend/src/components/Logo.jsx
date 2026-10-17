import s from './Logo.module.css';
import logo from '../assets/egsa-logo.png';
import { useI18n } from '../i18n/index.jsx';

// size = rendered square edge in px (native asset is 500×500, so up to 250px stays sharp on 2× screens)
export default function Logo({ size = 64, light = false, className = '' }) {
  const { t } = useI18n();
  return (
    <span className={`${s.plate} ${light ? s.light : ''} ${className}`} style={{ width: size, height: size }}>
      <img src={logo} alt={t('common.logoAlt')} width={size} height={size} decoding="async" />
    </span>
  );
}
