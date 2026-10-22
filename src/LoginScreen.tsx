import { useState, type FormEvent } from 'react';
import { IonButton, IonContent, IonIcon, IonInput, IonItem, IonSpinner } from '@ionic/react';
import { lockClosedOutline } from 'ionicons/icons';
import { ThemeToggle } from './ThemeToggle';
import type { WebThemeMode } from './theme/web-theme';

type LoginScreenProps = {
  error: string;
  notice?: string;
  submitting: boolean;
  themeMode: WebThemeMode;
  onThemeToggle(): void;
  onSubmit(username: string, password: string): Promise<void>;
};

export default function LoginScreen({ error, notice, submitting, themeMode, onThemeToggle, onSubmit }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!username.trim() || !password || submitting) return;
    void onSubmit(username.trim(), password);
  };

  return (
    <IonContent fullscreen className="auth-content">
      <main className="login-layout">
        <section className="login-card" aria-labelledby="login-title">
            <div className="login-brand"><span className="brand-mark">ef</span><span>ESTADOS FINANCIEROS</span><ThemeToggle mode={themeMode} onToggle={onThemeToggle} className="login-theme-toggle" /></div>
            <p className="eyebrow login-kicker">TU ESPACIO PERSONAL</p>
            <h1 id="login-title">Ingresa a tu cuenta</h1>
            <p className="login-description">Accede a tus ingresos y gastos desde cualquier lugar.</p>

            <form className="login-form" onSubmit={submit}>
              <label className="login-field">
                <span>Usuario</span>
                <IonItem lines="none" className="form-item">
                  <IonInput
                    type="text"
                    value={username}
                    autocomplete="username"
                    autocapitalize="off"
                    required
                    onIonInput={(event) => setUsername(event.detail.value ?? '')}
                  />
                </IonItem>
              </label>
              <label className="login-field">
                <span>Contraseña</span>
                <IonItem lines="none" className="form-item">
                  <IonInput
                    type="password"
                    value={password}
                    autocomplete="current-password"
                    required
                    onIonInput={(event) => setPassword(event.detail.value ?? '')}
                  />
                </IonItem>
              </label>

              {error && <div className="login-error" role="alert">{error}</div>}
              {notice && <div className="login-notice" role="status">{notice}</div>}
              <IonButton className="login-submit" type="submit" expand="block" disabled={submitting || !username.trim() || !password}>
                {submitting ? <IonSpinner name="crescent" /> : <><IonIcon slot="start" icon={lockClosedOutline} />Ingresar</>}
              </IonButton>
            </form>

            <p className="login-footnote">Acceso privado del propietario</p>
        </section>
      </main>
    </IonContent>
  );
}
