import { useNavigate } from 'react-router-dom';
import { Button, ListGroup } from 'react-bootstrap';
import { PageHeader, Panel, StateView } from '../components/ui.jsx';
import useFetch from '../hooks/useFetch.js';
import { instructorApi } from '../services/instructor.js';
import { useI18n } from '../i18n/index.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { friendlyError } from '../utils/errors.js';

const ICON = { new_submission: 'fa-inbox', assessment_deadline: 'fa-hourglass-half', upcoming_session: 'fa-calendar-day', new_assignment: 'fa-users-rectangle', system: 'fa-circle-info' };
export default function NotificationsPage() {
  const { t, fmtDateTime } = useI18n(); const nav = useNavigate(); const toast = useToast();
  const { data, meta, loading, error, reload } = useFetch(() => instructorApi.notifications({ limit: 50 }));
  const open = async (n) => { try { if (!n.read) await instructorApi.readNotification(n._id); } catch { /* non-blocking */ } if (n.link) nav(n.link); else reload(); };
  const readAll = async () => { try { await instructorApi.readAll(); reload(); } catch (x) { toast.error(friendlyError(x, t)); } };
  return (
    <>
      <PageHeader eyebrow={t('nav.notifications')} title={t('notif.title')} subtitle={meta ? `${meta.unreadCount} ${t('notif.unread')}` : ''} actions={meta?.unreadCount > 0 && <Button variant="outline-secondary" onClick={readAll}>{t('notif.markAll')}</Button>} />
      <Panel flush><StateView loading={loading} error={error} onRetry={reload} empty={data && !data.length} emptyText={t('notif.empty')} emptyIcon="fa-bell-slash">
        <ListGroup variant="flush">{data?.map((n) => (
          <ListGroup.Item action key={n._id} onClick={() => open(n)} className="d-flex gap-3 align-items-start py-3" style={{ borderInlineStart: n.read ? '3px solid transparent' : '3px solid var(--egsa-accent)', background: n.read ? undefined : '#fbf8ef' }}>
            <i className={`fa-solid ${ICON[n.type] || ICON.system} mt-1`} style={{ color: 'var(--egsa-primary)', width: 20 }} aria-hidden="true" />
            <div className="flex-grow-1"><div className={n.read ? '' : 'fw-semibold'}>{n.title}</div><div className="small text-muted">{n.message}</div><div className="small mono text-muted mt-1">{fmtDateTime(n.createdAt)}</div></div>
          </ListGroup.Item>))}</ListGroup>
      </StateView></Panel>
    </>
  );
}
