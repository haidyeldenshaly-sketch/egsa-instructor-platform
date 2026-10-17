import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import AuthShell from './AuthShell.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useI18n } from '../../i18n/index.jsx';
import s from './auth.module.css';

export default function Login() {
  const { t, lang } = useI18n();
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ email: '', password: '' });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (user?.role === 'instructor') return <Navigate to="/instructor/dashboard" replace />;

  const invalid = !f.email.includes('@') || !f.password;

  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    if (busy || invalid) return;
    setBusy(true);
    setErr(null);
    try {
      await login(f.email.trim(), f.password);
      nav('/instructor/dashboard', { replace: true });
    } catch (x) {
      setErr(
        x.code === 'NOT_INSTRUCTOR'
          ? t('auth.notInstructor')
          : x.status === 429
          ? (x.message || t('common.error'))
          : x.status === 401 || x.status === 400
          ? t('auth.invalid')
          : t('common.error')
      );
    } finally {
      setBusy(false);
    }
  };

  const titleText = lang === 'ar' ? 'مرحبًا بعودتك' : 'Welcome Back';
  const subText = lang === 'ar' ? 'سجّل الدخول إلى حسابك التدريبي.' : 'Sign in to your instructor account.';

  return (
    <AuthShell title={titleText} sub={subText}>
      {err && (
        <Alert variant="danger" role="alert" className="py-2 px-3 mb-3 small d-flex align-items-center">
          <i className="fa-solid fa-circle-exclamation me-2 flex-shrink-0" aria-hidden="true" />
          <div>{err}</div>
        </Alert>
      )}

      <Form onSubmit={submit} noValidate>
        <Form.Group className="mb-3" controlId="email">
          <Form.Label className="small fw-semibold text-secondary mb-1">
            {t('common.email')}
          </Form.Label>
          <div className={s.inputGroupWrap}>
            <i className={`fa-solid fa-envelope ${s.inputIcon}`} aria-hidden="true" />
            <Form.Control
              type="email"
              autoComplete="username"
              placeholder="instructor@egsa-dev.test"
              value={f.email}
              onChange={(e) => setF({ ...f, email: e.target.value })}
              isInvalid={touched && !f.email.includes('@')}
              className={s.controlWithIcon}
              required
            />
          </div>
          <Form.Control.Feedback type="invalid">{t('common.required')}</Form.Control.Feedback>
        </Form.Group>

        <Form.Group className="mb-3" controlId="password">
          <div className="d-flex justify-content-between align-items-center mb-1">
            <Form.Label className="small fw-semibold text-secondary mb-0">
              {t('auth.password')}
            </Form.Label>
            <Link to="/forgot-password" className="small text-muted text-decoration-none">
              {t('auth.forgot')}
            </Link>
          </div>
          <div className={s.inputGroupWrap}>
            <i className={`fa-solid fa-lock ${s.inputIcon}`} aria-hidden="true" />
            <Form.Control
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••••••"
              value={f.password}
              onChange={(e) => setF({ ...f, password: e.target.value })}
              isInvalid={touched && !f.password}
              className={s.controlWithIcon}
              required
            />
            <button
              type="button"
              className={s.togglePassBtn}
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              <i className={showPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'} aria-hidden="true" />
            </button>
          </div>
          <Form.Control.Feedback type="invalid">{t('common.required')}</Form.Control.Feedback>
        </Form.Group>

        <Button type="submit" className={`btn-egsa ${s.submitBtn}`} disabled={busy}>
          {busy ? (
            <>
              <Spinner size="sm" className="me-2" />
              <span>{lang === 'ar' ? 'جارٍ التحقق…' : 'Authenticating…'}</span>
            </>
          ) : (
            <span>{lang === 'ar' ? 'تسجيل الدخول' : 'Sign In'}</span>
          )}
        </Button>
      </Form>
    </AuthShell>
  );
}
