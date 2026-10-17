import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Col, Form, Row, Table } from 'react-bootstrap';
import { AttendanceBar, Avatar, PageHeader, Panel, StateView, StatusBadge, styles as s } from '../components/ui.jsx';
import { pctText } from '../components/tables.jsx';
import useFetch from '../hooks/useFetch.js';
import { instructorApi } from '../services/instructor.js';
import { useI18n } from '../i18n/index.jsx';
import progStyles from './progress.module.css';

export default function ProgressPage() {
  const { t } = useI18n();
  const [cohortId, setCohortId] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const cohorts = useFetch(() => instructorApi.cohorts());
  const { data, loading, error, reload } = useFetch(
    () => instructorApi.progress({ cohortId }),
    [cohortId]
  );

  // Compute real aggregated metrics without inventing numbers
  const stats = useMemo(() => {
    if (!data || !data.length) {
      return { total: 0, active: 0, attention: 0, avgAttendance: null, totalSubmitted: 0, totalPublished: 0 };
    }

    let total = data.length;
    let active = 0;
    let attention = 0;
    let attendanceSum = 0;
    let attendanceCount = 0;
    let totalSubmitted = 0;
    let totalPublished = 0;

    data.forEach((r) => {
      if (r.trainingStatus === 'active') active++;

      const attPct = r.attendance?.attendancePercentage;
      if (attPct != null) {
        attendanceSum += attPct;
        attendanceCount++;
        if (attPct < 75) attention++;
      }

      if (r.assessments?.pendingGrading > 0) {
        // also needs attention if pending submissions
        if (attPct == null || attPct >= 75) attention++;
      }

      totalSubmitted += r.assessments?.submitted || 0;
      totalPublished += r.assessments?.published || 0;
    });

    const avgAttendance = attendanceCount > 0 ? Math.round(attendanceSum / attendanceCount) : null;

    return { total, active, attention, avgAttendance, totalSubmitted, totalPublished };
  }, [data]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    if (!data) return [];
    return data.filter((r) => {
      const q = search.trim().toLowerCase();
      if (q) {
        const name = (r.student?.name || '').toLowerCase();
        const email = (r.student?.email || '').toLowerCase();
        const cohortName = (r.cohort?.name || '').toLowerCase();
        if (!name.includes(q) && !email.includes(q) && !cohortName.includes(q)) {
          return false;
        }
      }

      if (filter === 'all') return true;
      if (filter === 'active') return r.trainingStatus === 'active';
      if (filter === 'attention') {
        const attPct = r.attendance?.attendancePercentage;
        return (attPct != null && attPct < 75) || (r.assessments?.pendingGrading > 0);
      }
      if (filter === 'completed') return r.trainingStatus === 'completed';
      return true;
    });
  }, [data, search, filter]);

  return (
    <>
      <PageHeader
        eyebrow={t('nav.progress')}
        title={t('prog.title')}
        subtitle={t('prog.note')}
      />

      {/* Meaningful Real Metric Overview Cards */}
      <div className={progStyles.statsGrid}>
        <div className={progStyles.statCard}>
          <span className={progStyles.statNumber}>{stats.total}</span>
          <span className={progStyles.statLabel}>{t('students.title')}</span>
        </div>
        <div className={progStyles.statCard}>
          <span className={progStyles.statNumber} style={{ color: '#059669' }}>{stats.active}</span>
          <span className={progStyles.statLabel}>{t('status.active')}</span>
        </div>
        <div className={progStyles.statCard}>
          <span className={progStyles.statNumber} style={{ color: stats.attention > 0 ? '#dc2626' : '#64748b' }}>
            {stats.attention}
          </span>
          <span className={progStyles.statLabel}>Needs Attention</span>
        </div>
        <div className={progStyles.statCard}>
          <span className={progStyles.statNumber} style={{ color: '#0284c7' }}>
            {stats.avgAttendance != null ? `${stats.avgAttendance}%` : '—'}
          </span>
          <span className={progStyles.statLabel}>Avg Attendance</span>
        </div>
        <div className={progStyles.statCard}>
          <span className={progStyles.statNumber}>
            {stats.totalSubmitted}
            <span className="small text-muted fw-normal ms-1">/ {stats.totalPublished}</span>
          </span>
          <span className={progStyles.statLabel}>{t('prog.submitted')}</span>
        </div>
      </div>

      <Panel className="mb-3">
        <Row className="g-2">
          <Col md={5}>
            <Form.Label htmlFor="pc" className="small fw-semibold">{t('common.cohort')}</Form.Label>
            <Form.Select
              id="pc"
              value={cohortId}
              onChange={(e) => setCohortId(e.target.value)}
            >
              <option value="">{t('common.all')}</option>
              {cohorts.data?.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </Form.Select>
          </Col>
          <Col md={7}>
            <Form.Label htmlFor="ps" className="small fw-semibold">{t('common.search')}</Form.Label>
            <Form.Control
              id="ps"
              type="search"
              placeholder={`${t('common.search')} cadet name, email, or cohort...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Col>
        </Row>
      </Panel>

      <Panel flush>
        {/* Status Filters Toolbar */}
        <div className={progStyles.toolbar}>
          <div className={progStyles.filterPills}>
            {[
              { key: 'all', label: t('common.all'), count: stats.total },
              { key: 'active', label: t('status.active'), count: stats.active },
              { key: 'attention', label: 'Needs Attention', count: stats.attention },
              { key: 'completed', label: t('status.completed'), count: data?.filter((x) => x.trainingStatus === 'completed').length || 0 },
            ].map((f) => (
              <button
                key={f.key}
                type="button"
                className={`${progStyles.filterBtn} ${filter === f.key ? progStyles.filterBtnActive : ''}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label} <span className="opacity-75">({f.count})</span>
              </button>
            ))}
          </div>
        </div>

        <StateView
          loading={loading}
          error={error}
          onRetry={reload}
          empty={data && !data.length}
          emptyText={t('prog.empty')}
          emptyIcon="fa-chart-line"
        >
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
                  <th className="text-end">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => {
                  const studentId = r.student._id;
                  const key = `${studentId}-${r.cohort?._id || r.cohort}`;
                  const att = r.attendance || {};
                  const asm = r.assessments || {};

                  return (
                    <tr key={key}>
                      <td>
                        <Avatar user={r.student} size={34} />
                      </td>
                      <td>
                        <div className="fw-semibold text-dark">
                          <Link to={`/instructor/students/${studentId}`} className="text-decoration-none text-dark">
                            {r.student.name}
                          </Link>
                        </div>
                        <div className="small text-muted mono">{r.student.email}</div>
                      </td>
                      <td>
                        <div className="fw-medium text-dark">{r.cohort?.name || '—'}</div>
                        {r.course?.code && (
                          <div className="mono small text-muted">{r.course.code}</div>
                        )}
                      </td>
                      <td style={{ minWidth: 170 }}>
                        <div className={progStyles.progressWrap}>
                          <div className={progStyles.metaRow}>
                            <span className="mono fw-semibold">{pctText(att.attendancePercentage)}</span>
                            <span className="mono text-muted">{att.present}/{att.totalSessions} sessions</span>
                          </div>
                          <AttendanceBar
                            present={att.present}
                            late={att.late || 0}
                            excused={att.excused || 0}
                            absent={att.absent}
                            pending={att.pending}
                          />
                        </div>
                      </td>
                      <td style={{ minWidth: 160 }}>
                        <div className="d-flex flex-column gap-0.5">
                          <div className="small">
                            <span className="mono fw-semibold">{asm.submitted}</span> / <span className="mono text-muted">{asm.published}</span> {t('prog.submitted').toLowerCase()}
                          </div>
                          {asm.pendingGrading > 0 ? (
                            <span className="badge bg-warning-subtle text-warning border border-warning-subtle text-start">
                              <i className="fa-solid fa-clock me-1" aria-hidden="true" />
                              {asm.pendingGrading} {t('dash.pendingGrading').toLowerCase()}
                            </span>
                          ) : (
                            <span className="small text-muted">
                              {asm.resultsPublished || 0} {t('prog.resultsPublished').toLowerCase()}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <StatusBadge value={r.trainingStatus} />
                      </td>
                      <td className="text-end">
                        <Link to={`/instructor/students/${studentId}`} className="btn btn-sm btn-outline-secondary">
                          {t('common.view')}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {!filteredRows.length && (
                  <tr>
                    <td colSpan={7} className="text-center py-4 text-muted">
                      No cadet progress records match the current filter or search criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
        </StateView>
      </Panel>
    </>
  );
}
