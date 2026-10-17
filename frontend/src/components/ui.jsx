import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Modal, Spinner } from 'react-bootstrap';
import s2 from './ui.module.css';
import useCountUp from '../hooks/useCountUp.js';
import { useI18n } from '../i18n/index.jsx';
import { friendlyError } from '../utils/errors.js';

export function PageHeader({ eyebrow, title, subtitle, actions, back }) {
  const { t } = useI18n();
  return (
    <header className={s2.pageHeader}>
      <div>
        {back && (
          <Link to={back} className="small text-decoration-none d-inline-flex align-items-center mb-2 text-muted">
            <i className="fa-solid fa-arrow-left fa-flip-horizontal-rtl me-1.5" aria-hidden="true" />
            <span className="fw-semibold">{t('common.back')}</span>
          </Link>
        )}
        {eyebrow && <div className={s2.eyebrow}><i className="fa-solid fa-satellite-dish me-1 small" aria-hidden="true" />{eyebrow}</div>}
        <h1 className={s2.title}>{title}</h1>
        {subtitle && <p className={s2.subtitle}>{subtitle}</p>}
      </div>
      {actions && <div className="d-flex flex-wrap align-items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({ title, actions, children, flush, className = '', icon }) {
  return (
    <section className={`${s2.card} ${className}`}>
      {(title || actions) && (
        <div className={s2.cardHead}>
          <h2 className={s2.cardTitle}>
            {icon && <i className={`fa-solid ${icon} text-muted me-1`} aria-hidden="true" />}
            <span>{title}</span>
          </h2>
          {actions}
        </div>
      )}
      <div className={flush ? s2.cardBodyFlush : s2.cardBody}>{children}</div>
    </section>
  );
}

export function StatCard({ icon, label, value, tone = 'var(--egsa-primary)', to, index = 0 }) {
  const shown = useCountUp(Number(value) || 0);
  const inner = (
    <>
      <div className={s2.statIcon}>
        <i className={`fa-solid ${icon}`} aria-hidden="true" />
      </div>
      <div className={s2.statContent}>
        <div className={s2.statValue} aria-label={`${value}`}>{shown}</div>
        <div className={s2.statLabel}>{label}</div>
      </div>
    </>
  );
  const props = { className: `${s2.stat} rise`, style: { '--tone': tone, '--i': index } };
  return to ? <Link to={to} {...props}>{inner}</Link> : <div {...props}>{inner}</div>;
}

const TONES = {
  active: 'ok',
  completed: 'ok',
  present: 'ok',
  published: 'ok',
  result_published: 'ok',
  upcoming: 'info',
  scheduled: 'info',
  submitted: 'info',
  evaluated: 'warn',
  late: 'warn',
  excused: 'info',
  excused_absence: 'info',
  pending: 'muted',
  draft: 'muted',
  inactive: 'muted',
  archived: 'muted',
  absent: 'danger',
  cancelled: 'danger',
  withdrawn: 'danger',
};

export function StatusBadge({ value }) {
  const { t } = useI18n();
  if (!value) return <span className="text-muted">—</span>;
  return <span className={`${s2.badge} ${s2[`tone-${TONES[value] || 'muted'}`]}`}>{t(`status.${value}`, value)}</span>;
}

export function StateView({ loading, error, empty, emptyText, emptyIcon = 'fa-satellite', action, onRetry, children }) {
  const { t } = useI18n();
  if (loading) {
    return (
      <div className={s2.skel} role="status" aria-label={t('common.loading')}>
        {[92, 100, 78, 96, 64].map((w, i) => (
          <div key={i} className={s2.skelRow} style={{ width: `${w}%` }} />
        ))}
      </div>
    );
  }
  if (error) {
    const icon = error.status === 403 ? 'fa-ban' : error.status === 404 ? 'fa-circle-question' : 'fa-triangle-exclamation';
    return (
      <div className={`${s2.state} ${s2.stateError}`} role="alert">
        <span className={s2.stateIcon}>
          <i className={`fa-solid ${icon}`} aria-hidden="true" />
        </span>
        <div className={s2.stateText}>{friendlyError(error, t)}</div>
        {error.status !== 403 && error.status !== 404 && onRetry && (
          <Button size="sm" variant="outline-secondary" onClick={onRetry}>
            <i className="fa-solid fa-rotate-right me-1" aria-hidden="true" />
            {t('common.retry')}
          </Button>
        )}
      </div>
    );
  }
  if (empty) {
    return (
      <div className={s2.state}>
        <span className={s2.stateIcon}>
          <i className={`fa-solid ${emptyIcon}`} aria-hidden="true" />
        </span>
        <div className={s2.stateText}>{emptyText}</div>
        {action && (
          <Link to={action.to} className="btn btn-sm btn-egsa">
            {action.label}
          </Link>
        )}
      </div>
    );
  }
  return children;
}

export function ConfirmModal({ show, title, body, confirmLabel, variant = 'danger', busy, onConfirm, onCancel }) {
  const { t } = useI18n();
  return (
    <Modal show={show} onHide={onCancel} centered>
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="h5 mb-0">{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>{body}</Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onCancel} disabled={busy}>
          {t('common.cancel')}
        </Button>
        <Button variant={variant} onClick={onConfirm} disabled={busy}>
          {busy && <Spinner size="sm" className="me-2" />}
          {confirmLabel || t('common.confirm')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export function AttendanceBar({ present = 0, absent = 0, pending = 0, late = 0, excused = 0 }) {
  const total = present + absent + pending + late + excused || 1;
  return (
    <div className={s2.bar} role="img" aria-label={`present ${present}, late ${late}, excused ${excused}, absent ${absent}, pending ${pending}`}>
      <div className={s2.barP} style={{ width: `${(present / total) * 100}%` }} title={`Present: ${present}`} />
      {late > 0 && <div className={s2.barLate} style={{ width: `${(late / total) * 100}%` }} title={`Late: ${late}`} />}
      {excused > 0 && <div className={s2.barExcused} style={{ width: `${(excused / total) * 100}%` }} title={`Excused: ${excused}`} />}
      <div className={s2.barA} style={{ width: `${(absent / total) * 100}%` }} title={`Absent: ${absent}`} />
    </div>
  );
}

export function Avatar({ user, size = 40, className = '', showOnline = false }) {
  const name = user?.name || '';
  const initials = name
    .replace(/^Dev\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0])
    .join('')
    .toUpperCase() || 'EG';

  return (
    <div className={`${s2.avatarWrap} ${className}`} style={{ width: size, height: size }}>
      {user?.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt={name}
          width={size}
          height={size}
          className={s2.avatar}
          onError={(e) => {
            // fallback to initials if image load fails
            e.currentTarget.style.display = 'none';
            if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = 'grid';
          }}
        />
      ) : null}
      <div
        className={s2.avatarInitials}
        style={{
          width: size,
          height: size,
          fontSize: `${Math.max(10, size * 0.38)}px`,
          display: user?.avatarUrl ? 'none' : 'grid',
        }}
        aria-hidden="true"
      >
        {initials}
      </div>
      {showOnline && <span className={s2.avatarOnline} title="Active" />}
    </div>
  );
}

export function FileCard({ file, onRemove, onPreview }) {
  const name = file.name || file.filename || 'attachment';
  const url = file.url || '#';
  const ext = (name.split('.').pop() || '').toLowerCase();

  let iconClass = 'fa-file-lines';
  let typeStyle = s2.fileIconOther;

  if (ext === 'pdf') {
    iconClass = 'fa-file-pdf';
    typeStyle = s2.fileIconPdf;
  } else if (['doc', 'docx'].includes(ext)) {
    iconClass = 'fa-file-word';
    typeStyle = s2.fileIconWord;
  } else if (['zip', 'rar', 'tar', 'gz', '7z'].includes(ext)) {
    iconClass = 'fa-file-zipper';
    typeStyle = s2.fileIconZip;
  } else if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) {
    iconClass = 'fa-file-image';
    typeStyle = s2.fileIconImg;
  }

  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isPreviewable = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'txt'].includes(ext);

  return (
    <div className={s2.fileCard}>
      <div className={`${s2.fileIcon} ${typeStyle}`}>
        <i className={`fa-solid ${iconClass}`} aria-hidden="true" />
      </div>
      <div className={s2.fileInfo}>
        <div className={s2.fileName} title={name}>{name}</div>
        <div className={s2.fileMeta}>
          <span className="text-uppercase fw-semibold me-2">{ext || 'FILE'}</span>
          {file.size ? <span>{formatSize(file.size)}</span> : null}
        </div>
      </div>
      <div className={s2.fileActions}>
        {isPreviewable && onPreview && (
          <Button
            size="sm"
            variant="outline-secondary"
            onClick={() => onPreview(file)}
            title="Preview attachment"
          >
            <i className="fa-solid fa-eye" aria-hidden="true" />
          </Button>
        )}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          download={name}
          className="btn btn-sm btn-outline-secondary"
          title="Download file"
        >
          <i className="fa-solid fa-download" aria-hidden="true" />
        </a>
        {onRemove && (
          <Button
            size="sm"
            variant="outline-danger"
            onClick={() => onRemove(file)}
            title="Remove attachment"
          >
            <i className="fa-solid fa-trash-can" aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function FilePreviewModal({ show, file, onHide }) {
  if (!file) return null;
  const name = file.name || 'File';
  const url = file.url || '';
  const ext = (name.split('.').pop() || '').toLowerCase();
  const isImage = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext);
  const isPdf = ext === 'pdf';

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="h6 mb-0 d-flex align-items-center gap-2">
          <i className="fa-solid fa-paperclip text-muted" aria-hidden="true" />
          <span className="text-truncate">{name}</span>
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-0 text-center bg-light">
        {isImage ? (
          <div className="p-4 d-flex justify-content-center">
            <img src={url} alt={name} style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }} className="rounded shadow-sm" />
          </div>
        ) : isPdf ? (
          <iframe src={url} title={name} width="100%" height="550px" style={{ border: 0 }} />
        ) : (
          <div className="p-5">
            <i className="fa-solid fa-file text-muted fa-3x mb-3" aria-hidden="true" />
            <h5>{name}</h5>
            <p className="text-muted small">Inline preview not supported for this file type.</p>
            <a href={url} download={name} className="btn btn-egsa">
              <i className="fa-solid fa-download me-2" aria-hidden="true" />
              Download File
            </a>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <a href={url} download={name} className="btn btn-sm btn-outline-secondary">
          <i className="fa-solid fa-download me-1" aria-hidden="true" /> Download
        </a>
        <Button size="sm" variant="secondary" onClick={onHide}>Close</Button>
      </Modal.Footer>
    </Modal>
  );
}

export const styles = s2;
