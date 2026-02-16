import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { App } from './App';
import '@funnelists/ui/styles';
import './styles/portal-overrides.css';

// Use HashRouter because Salesforce Sites handles URL routing
// and we need client-side routing within the single VF page.
// e.g., /SPPortal#/login, /SPPortal#/dashboard, /SPPortal#/cases
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </HashRouter>
  </React.StrictMode>,
);
