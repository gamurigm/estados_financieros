import { useEffect, useRef, useState } from 'react';
import { IonApp, IonContent, IonSpinner } from '@ionic/react';
import App from './App';
import { loginWeb, logoutWeb, refreshWebSession, subscribeToSessionExpiry } from './auth';
import LoginScreen from './LoginScreen';

type SessionState = 'checking' | 'anonymous' | 'authenticated';

export default function AuthGate() {
  const [session, setSession] = useState<SessionState>('checking');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const activeSession = useRef(false);

  useEffect(() => {
    let mounted = true;
    const unsubscribe = subscribeToSessionExpiry(() => {
      if (activeSession.current) {
        activeSession.current = false;
        setError('Tu sesión terminó. Ingresa de nuevo.');
        setSession('anonymous');
      }
    });

    void refreshWebSession().then((restored) => {
      if (!mounted) return;
      activeSession.current = restored;
      setSession(restored ? 'authenticated' : 'anonymous');
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const login = async (username: string, password: string) => {
    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      await loginWeb(username, password);
      activeSession.current = true;
      setSession('authenticated');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo iniciar sesión.');
    } finally {
      setSubmitting(false);
    }
  };

  const logout = async () => {
    setSubmitting(true);
    try {
      await logoutWeb();
      setError('');
      setNotice('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cerrar sesión.');
    } finally {
      activeSession.current = false;
      setSession('anonymous');
      setSubmitting(false);
    }
  };

  if (session === 'checking') {
    return <IonApp><IonContent fullscreen className="auth-content"><div className="auth-loading"><IonSpinner name="crescent" /><span>Revisando tu sesión…</span></div></IonContent></IonApp>;
  }

  if (session === 'anonymous') {
    return <LoginScreen error={error} notice={notice} submitting={submitting} onSubmit={login} />;
  }

  return <App onLogout={() => { void logout(); }} onPasswordChanged={() => {
    activeSession.current = false;
    setError('');
    setNotice('Contraseña actualizada. Ingresa con tu nueva contraseña.');
    setSession('anonymous');
  }} />;
}
