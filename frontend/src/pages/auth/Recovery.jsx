import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import AuthShell from './AuthShell.jsx';
import { publicPost } from '../../services/api.js';
import { useI18n } from '../../i18n/index.jsx';
import { friendlyError } from '../../utils/errors.js';

export function ForgotPassword() {
  const { t } = useI18n();
  const [email, setEmail] = useState(''); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false); const [err, setErr] = useState(null);
  const submit = async (e) => { e.preventDefault(); if (!email.includes('@')) return; setBusy(true); setErr(null); try { await publicPost('/auth/forgot-password', { email: email.trim() }); setDone(true); } catch (x) { setErr(friendlyError(x, t)); } finally { setBusy(false); } };
  return (
    <AuthShell title={t('auth.forgotTitle')} sub={t('auth.forgotSub')}>
      {done ? <Alert variant="success">{t('auth.sentMsg')}</Alert> : (
        <Form onSubmit={submit} noValidate>
          {err && <Alert variant="danger">{err}</Alert>}
          <Form.Group className="mb-3" controlId="fe"><Form.Label>{t('common.email')}</Form.Label><Form.Control type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Form.Group>
          <Button type="submit" className="btn-egsa w-100" disabled={busy}>{busy && <Spinner size="sm" className="me-2" />}{t('auth.sendLink')}</Button>
        </Form>)}
      <div className="mt-3 text-center"><Link to="/login">{t('auth.backToLogin')}</Link></div>
    </AuthShell>
  );
}
export function ResetPassword() {
  const { t } = useI18n(); const [sp] = useSearchParams();
  const [pw, setPw] = useState(''); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false); const [err, setErr] = useState(null);
  const submit = async (e) => { e.preventDefault(); setBusy(true); setErr(null); try { await publicPost('/auth/reset-password', { token: sp.get('token') || '', password: pw }); setDone(true); } catch (x) { setErr(friendlyError(x, t)); } finally { setBusy(false); } };
  return (
    <AuthShell title={t('auth.resetTitle')} sub={t('auth.passwordHint')}>
      {done ? <Alert variant="success">{t('auth.resetDone')}</Alert> : (
        <Form onSubmit={submit}>
          {err && <Alert variant="danger" role="alert">{err}</Alert>}
          <Form.Group className="mb-3" controlId="np"><Form.Label>{t('auth.newPassword')}</Form.Label><Form.Control type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} minLength={8} required /></Form.Group>
          <Button type="submit" className="btn-egsa w-100" disabled={busy}>{busy && <Spinner size="sm" className="me-2" />}{t('auth.reset')}</Button>
        </Form>)}
      <div className="mt-3 text-center"><Link to="/login">{t('auth.backToLogin')}</Link></div>
    </AuthShell>
  );
}
