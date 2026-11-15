import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import './styles.css';
import { App } from './App';
import { I18nProvider } from './lib/i18n';
import { SessionProvider } from './lib/session';
import { ToastProvider } from './components/ui';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <ToastProvider>
        <SessionProvider>
          <HashRouter>
            <App />
          </HashRouter>
        </SessionProvider>
      </ToastProvider>
    </I18nProvider>
  </React.StrictMode>,
);
