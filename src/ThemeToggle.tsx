import { IonButton, IonIcon } from '@ionic/react';
import { moonOutline, sunnyOutline } from 'ionicons/icons';
import type { WebThemeMode } from './theme/web-theme';

export function ThemeToggle({ mode, onToggle, className = '' }: {
  mode: WebThemeMode;
  onToggle: () => void;
  className?: string;
}) {
  const nextMode = mode === 'dark' ? 'light' : 'dark';
  const label = nextMode === 'light' ? 'Claro' : 'Oscuro';
  return <IonButton fill="outline" className={`theme-toggle ${className}`} aria-label={`Cambiar a tema ${label.toLowerCase()}`} onClick={onToggle}>
    <IonIcon slot="start" icon={nextMode === 'light' ? sunnyOutline : moonOutline} />
    <span>{label}</span>
  </IonButton>;
}
