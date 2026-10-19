import React from 'react';
import ReactDOM from 'react-dom/client';
import { setupIonicReact } from '@ionic/react';
import AuthGate from './AuthGate';
import './theme/variables.css';
import './styles.css';

setupIonicReact({ mode: 'md' });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthGate />
  </React.StrictMode>,
);
