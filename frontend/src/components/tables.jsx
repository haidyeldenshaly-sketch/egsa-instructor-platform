import { Link } from 'react-router-dom';
import { Table } from 'react-bootstrap';
import { AttendanceBar, Avatar, StatusBadge, styles as s } from './ui.jsx';
import { useI18n } from '../i18n/index.jsx';

export const pctText = (p) => (p === null || p === undefined ? '—' : `${p}%`);

export function StudentsTable({ rows }) {
  const { t } = useI18n();
  return (
    <div className={s.tableWrap}>
      <Table hover className="mb-0 align-middle">
        <thead>
          <tr>
            <th style={{ width: 44 }}></th>
            <th>{t('common.student')}</th>
            <th>{t('common.cohort')}</th>
            <th>{t('students.attendance')}</th>
            <th>{t('students.assessmentStatus')}</th>
            <th>{t('students.trainingStatus')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.student._id}-${r.cohort?._id || r.cohort}`}>
              <td>
                <Avatar user={r.student} size={34} />
              </td>
              <td>
                <div className="fw-semibold text-dark">
                  <Link to={`/instructor/students/${r.student._id}`} className="text-decoration-none text-dark">
                    {r.student.name}
                  </Link>
                </div>
                <div className="small text-muted mono">{r.student.email}</div>
              </td>
              <td>
                <div className="fw-medium text-dark">{r.cohort?.name || '—'}</div>
                {r.course?.code && <span className="mono small text-muted">{r.course.code}</span>}
              </td>
              <td style={{ minWidth: 160 }}>
                <AttendanceBar
                  present={r.attendance.present}
                  late={r.attendance.late || 0}
                  excused={r.attendance.excused || 0}
                  absent={r.attendance.absent}
                  pending={r.attendance.pending}
                />
                <div className="small text-muted mono mt-1">
                  {r.attendance.present}/{r.attendance.totalSessions} · {pctText(r.attendance.attendancePercentage)}
                </div>
              </td>
              <td className="small">
                <span className="mono fw-semibold">{r.assessments.submitted}/{r.assessments.published}</span> {t('prog.submitted').toLowerCase()}
                {r.assessments.pendingGrading > 0 && (
                  <div className="text-warning-emphasis fw-semibold">
                    {r.assessments.pendingGrading} {t('dash.pendingGrading').toLowerCase()}
                  </div>
                )}
              </td>
              <td><StatusBadge value={r.trainingStatus} /></td>
              <td className="text-end text-nowrap">
                <div className="d-inline-flex gap-1">
                  <Link
                    to={`/instructor/messages?studentId=${r.student?._id || r.student}${r.cohort?._id || r.cohort ? `&cohortId=${r.cohort?._id || r.cohort}` : ''}`}
                    className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
                    title={t('messages.messageStudent') || 'Message Student'}
                    aria-label={t('messages.messageStudent') || 'Message Student'}
                  >
                    <i className="fa-solid fa-comment-dots" />
                    <span>{t('messages.message') || 'Message'}</span>
                  </Link>
                  <Link to={`/instructor/students/${r.student?._id || r.student}`} className="btn btn-sm btn-outline-secondary">
                    {t('common.view')}
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
export function ProgressTable({ rows }) {
  const { t } = useI18n();
  return (
    <div className={s.tableWrap}>
      <Table hover size="sm" className="mb-0 align-middle">
        <thead><tr><th>{t('common.student')}</th><th>{t('common.cohort')}</th><th>{t('att.present')}</th><th>{t('att.absent')}</th><th>{t('att.pending')}</th><th>{t('att.percent')}</th><th>{t('prog.published')}</th><th>{t('prog.submitted')}</th><th>{t('prog.graded')}</th><th>{t('prog.resultsPublished')}</th><th>{t('prog.pendingGrading')}</th><th>{t('students.trainingStatus')}</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.student._id}-${r.cohort?._id || r.cohort}`} className="mono small">
              <td className="fw-semibold" style={{ fontFamily: 'var(--font-sans)' }}><Link to={`/instructor/students/${r.student._id}`}>{r.student.name}</Link></td>
              <td style={{ fontFamily: 'var(--font-sans)' }}>{r.cohort?.name || '—'}</td>
              <td>{r.attendance.present}</td><td>{r.attendance.absent}</td><td>{r.attendance.pending}</td><td>{pctText(r.attendance.attendancePercentage)}</td>
              <td>{r.assessments.published}</td><td>{r.assessments.submitted}</td><td>{r.assessments.graded}</td><td>{r.assessments.resultsPublished}</td><td>{r.assessments.pendingGrading}</td>
              <td style={{ fontFamily: 'var(--font-sans)' }}><StatusBadge value={r.trainingStatus} /></td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
export function useSessionLabel() {
  const { fmtDate } = useI18n();
  // LTR isolate keeps "09:00–11:00" in order inside RTL (Arabic) text
  return (x) => `${fmtDate(x.date)} · \u2066${x.startTime}–${x.endTime}\u2069`;
}
