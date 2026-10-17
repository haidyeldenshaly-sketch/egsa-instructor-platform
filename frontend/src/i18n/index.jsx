import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import en from './en.js';
import ar from './ar.js';
import ltrCss from 'bootstrap/dist/css/bootstrap.min.css?url';
import rtlCss from 'bootstrap/dist/css/bootstrap.rtl.min.css?url';

const dict = { en, ar };
const I18nCtx = createContext(null);
const get = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);

function applyDocument(lang) {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = lang; document.documentElement.dir = dir;
  let link = document.getElementById('bootstrap-css');
  if (!link) { link = document.createElement('link'); link.id = 'bootstrap-css'; link.rel = 'stylesheet'; document.head.prepend(link); }
  const href = dir === 'rtl' ? rtlCss : ltrCss;
  if (link.getAttribute('href') !== href) link.setAttribute('href', href);
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => { try { return localStorage.getItem('egsa_lang') || 'en'; } catch { return 'en'; } });
  useEffect(() => { applyDocument(lang); }, [lang]);
  const setLang = useCallback((l) => { try { localStorage.setItem('egsa_lang', l); } catch { /* ignore */ } setLangState(l); }, []);
  const t = useCallback((key, fallback) => get(dict[lang], key) ?? get(dict.en, key) ?? fallback ?? key, [lang]);
  const fmtDate = useCallback((d, opts) => (d ? new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeZone: 'UTC', ...opts }).format(new Date(d)) : '—'), [lang]);
  const fmtDateTime = useCallback((d) => (d ? new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d)) : '—'), [lang]);
  const value = useMemo(() => ({ lang, setLang, t, dir: lang === 'ar' ? 'rtl' : 'ltr', fmtDate, fmtDateTime }), [lang, setLang, t, fmtDate, fmtDateTime]);
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}
export const useI18n = () => useContext(I18nCtx);
