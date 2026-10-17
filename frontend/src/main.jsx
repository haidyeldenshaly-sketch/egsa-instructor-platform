import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './styles/global.css';
import { I18nProvider } from './i18n/index.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import App from './App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <I18nProvider><ToastProvider><AuthProvider><BrowserRouter><App /></BrowserRouter></AuthProvider></ToastProvider></I18nProvider>
  </React.StrictMode>,
);
