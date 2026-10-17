import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Dropdown, Offcanvas } from 'react-bootstrap';
import s from './Layout.module.css';
import Logo from './Logo.jsx';
import { Avatar } from './ui.jsx';
import { useI18n } from '../i18n/index.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { instructorApi } from '../services/instructor.js';

const NAV = [
  ['mission', [['dashboard', 'fa-gauge-high'], ['courses', 'fa-book-open'], ['cohorts', 'fa-users-rectangle'], ['sessions', 'fa-calendar-days']]],
  ['learners', [['students', 'fa-user-graduate'], ['messages', 'fa-comments'], ['attendance', 'fa-clipboard-user'], ['progress', 'fa-chart-line']]],
  ['assessment', [['assessments', 'fa-file-pen'], ['submissions', 'fa-inbox']]],
  ['account', [['notifications', 'fa-bell'], ['profile', 'fa-id-badge']]],
];

function Brand({ size = 56 }) {
  const { t } = useI18n();
  return (
    <div className={s.brand}>
      <Logo size={size} />
      <div className={s.brandText}>
        <div className={s.brandName}>{t('appName')}</div>
        <div className={s.brandSub}>{t('appSub')}</div>
      </div>
    </div>
  );
}

function NavList({ notifUnread = 0, msgUnread = 0, onNavigate }) {
  const { t } = useI18n();
  return (
    <ul className={s.nav}>
      {NAV.map(([group, items]) => (
        <li key={group} style={{ listStyle: 'none' }}>
          <div className={s.group} role="presentation">{t(`navGroup.${group}`)}</div>
          <ul className="list-unstyled m-0 d-flex flex-column gap-1">
            {items.map(([key, icon]) => (
              <li key={key}>
                <NavLink
                  to={`/instructor/${key}`}
                  onClick={onNavigate}
                  title={t(`nav.${key}`)}
                  className={({ isActive }) => `${s.link} ${isActive ? s.active : ''}`}
                >
                  <i className={`fa-solid ${icon}`} aria-hidden="true" />
                  <span className={s.label}>{t(`nav.${key}`)}</span>
                  {key === 'notifications' && notifUnread > 0 && (
                    <span className={s.badgeDot} aria-label={`${notifUnread} unread notifications`}>{notifUnread}</span>
                  )}
                  {key === 'messages' && msgUnread > 0 && (
                    <span className={s.badgeDot} aria-label={`${msgUnread} unread messages`}>{msgUnread}</span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

export default function Layout() {
  const { t, lang, setLang } = useI18n();
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [unreadNotif, setUnreadNotif] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('egsa_side_collapsed') === '1'; } catch { return false; }
  });

  const toggle = () => setCollapsed((c) => {
    try { localStorage.setItem('egsa_side_collapsed', c ? '0' : '1'); } catch { /* ignore */ }
    return !c;
  });

  useEffect(() => {
    let live = true;
    instructorApi.notifications({ limit: 1 }).then((r) => live && setUnreadNotif(r?.meta?.unreadCount || 0)).catch(() => {});
    instructorApi.unreadMessagesCount().then((r) => live && setUnreadMessages(r?.unreadCount ?? r?.data?.unreadCount ?? 0)).catch(() => {});
    return () => { live = false; };
  }, [loc.pathname]);

  const doLogout = async () => {
    await logout();
    nav('/login', { replace: true });
  };

  return (
    <div className={s.shell} data-collapsed={collapsed}>
      <a href="#main" className="visually-hidden-focusable">{t('nav.skip')}</a>

      {/* Main Persistent Sidebar */}
      <aside className={s.sidebar} aria-label="Primary">
        <Brand size={collapsed ? 44 : 56} />
        <NavList notifUnread={unreadNotif} msgUnread={unreadMessages} />
        <div className={s.sideFoot}>
          <Avatar user={user} size={36} showOnline />
          <div className={s.who}>
            <div className="text-white fw-semibold text-truncate small">{user?.name}</div>
            <div className="text-truncate" style={{ color: '#8daab9', fontSize: '0.72rem' }}>{user?.email}</div>
          </div>
        </div>
      </aside>

      {/* Responsive Mobile Offcanvas */}
      <Offcanvas show={open} onHide={() => setOpen(false)} className={s.offcanvas} placement={lang === 'ar' ? 'end' : 'start'}>
        <Offcanvas.Header closeButton closeVariant="white" className="p-0 pe-3">
          <div className="flex-grow-1"><Brand size={56} /></div>
        </Offcanvas.Header>
        <Offcanvas.Body className="p-0 d-flex flex-column">
          <NavList notifUnread={unreadNotif} msgUnread={unreadMessages} onNavigate={() => setOpen(false)} />
          <div className="mt-auto p-3 border-top border-dark d-flex align-items-center gap-2">
            <Avatar user={user} size={36} showOnline />
            <div className="text-truncate">
              <div className="text-white fw-semibold small">{user?.name}</div>
              <div className="small text-muted">{user?.email}</div>
            </div>
          </div>
        </Offcanvas.Body>
      </Offcanvas>

      {/* Main Content Area */}
      <div className={s.main}>
        {/* Top Flight Deck Bar */}
        <header className={s.top}>
          <button className={`${s.iconBtn} ${s.menuBtn}`} onClick={() => setOpen(true)} aria-label={t('nav.menu')} type="button">
            <i className="fa-solid fa-bars" aria-hidden="true" />
          </button>
          <button
            className={`${s.iconBtn} ${s.collapseBtn}`}
            onClick={toggle}
            aria-expanded={!collapsed}
            aria-label={collapsed ? t('nav.expand') : t('nav.collapse')}
            title={collapsed ? t('nav.expand') : t('nav.collapse')}
            type="button"
          >
            <i className="fa-solid fa-angles-left" aria-hidden="true" />
          </button>

          <Logo size={36} light className={s.mobileOnly} />

          <div className={s.telemetry}>
            <span className={s.telemetryDot} aria-hidden="true" />
            <span>EGSA // MISSION CONTROL // {new Date().toISOString().slice(0, 10)}</span>
          </div>

          <div className={s.spacer} />

          {/* Language Switcher */}
          <button
            className={s.iconBtn}
            onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
            aria-label={t('common.language')}
            title={t('common.language')}
            type="button"
          >
            <span className="fw-bold small">{lang === 'en' ? 'ع' : 'EN'}</span>
          </button>

          {/* Messages Icon */}
          <NavLink to="/instructor/messages" className={s.iconBtn} aria-label={t('nav.messages')} title={t('nav.messages')}>
            <i className="fa-solid fa-comments" aria-hidden="true" />
            {unreadMessages > 0 && <span className={s.bell}>{unreadMessages}</span>}
          </NavLink>

          {/* Notification Bell */}
          <NavLink to="/instructor/notifications" className={s.iconBtn} aria-label={t('nav.notifications')} title={t('nav.notifications')}>
            <i className="fa-solid fa-bell" aria-hidden="true" />
            {unreadNotif > 0 && <span className={s.bell}>{unreadNotif}</span>}
          </NavLink>

          {/* User Profile Dropdown */}
          <Dropdown align="end">
            <Dropdown.Toggle as="button" className={s.userMenuBtn} id="user-menu" type="button">
              <Avatar user={user} size={28} />
              <span className={`d-none d-md-inline ${s.userName}`}>
                {user?.name?.replace(/^Dev\s+/i, '').split(' ').slice(0, 2).join(' ')}
              </span>
              <i className="fa-solid fa-chevron-down text-muted small ms-1" style={{ fontSize: '0.65rem' }} aria-hidden="true" />
            </Dropdown.Toggle>
            <Dropdown.Menu>
              <div className="px-3 py-2 border-bottom mb-1 bg-light">
                <div className="fw-bold text-dark small">{user?.name}</div>
                <div className="text-muted" style={{ fontSize: '0.72rem' }}>{user?.email}</div>
              </div>
              <Dropdown.Item onClick={() => nav('/instructor/profile')}>
                <i className="fa-solid fa-id-badge me-2 text-primary" aria-hidden="true" />
                {t('nav.profile')}
              </Dropdown.Item>
              <Dropdown.Divider />
              <Dropdown.Item onClick={doLogout} className="text-danger">
                <i className="fa-solid fa-right-from-bracket me-2" aria-hidden="true" />
                {t('nav.logout')}
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        </header>

        {/* Content Outlet */}
        <main id="main" className={s.content} tabIndex={-1}>
          <div key={loc.pathname} className={s.page}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
