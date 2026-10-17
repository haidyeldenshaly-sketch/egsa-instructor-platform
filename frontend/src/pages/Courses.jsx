import { useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Col, Row, Table, Form, InputGroup } from 'react-bootstrap';
import { PageHeader, Panel, StateView, StatusBadge, styles as s } from '../components/ui.jsx';
import useFetch from '../hooks/useFetch.js';
import { instructorApi } from '../services/instructor.js';
import { useI18n } from '../i18n/index.jsx';

const COURSE_THEMES = {
  SSF: {
    gradient: 'linear-gradient(135deg, #102A3E 0%, #174866 100%)',
    icon: 'fa-shuttle-space',
    accent: '#26A5B5',
  },
  SCB: {
    gradient: 'linear-gradient(135deg, #1C2D37 0%, #294857 100%)',
    icon: 'fa-tower-broadcast',
    accent: '#D4B87C',
  },
  OMI: {
    gradient: 'linear-gradient(135deg, #0E1F2A 0%, #153B4A 100%)',
    icon: 'fa-globe',
    accent: '#38BDF8',
  },
  DEFAULT: {
    gradient: 'linear-gradient(135deg, #132530 0%, #204153 100%)',
    icon: 'fa-satellite',
    accent: '#D4B87C',
  },
};

export function CoursesPage() {
  const { t, lang } = useI18n();
  const { data, loading, error, reload } = useFetch(() => instructorApi.courses());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.filter((c) => {
      const matchSearch =
        !search ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.code.toLowerCase().includes(search.toLowerCase()) ||
        (c.description && c.description.toLowerCase().includes(search.toLowerCase()));
      const matchStatus = !statusFilter || (c.status || 'active') === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [data, search, statusFilter]);

  return (
    <>
      <PageHeader
        eyebrow={t('nav.courses')}
        title={t('courses.title')}
        subtitle={lang === 'ar' ? 'المقررات الفضائية المعتمدة والمسندة لبرنامج التدريب الأكاديمي' : 'Certified space curriculum and assigned academic training courses'}
      />

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-3 border shadow-sm mb-4">
        <Row className="g-3 align-items-center">
          <Col md={6} lg={5}>
            <InputGroup>
              <InputGroup.Text className="bg-light border-end-0 text-muted">
                <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
              </InputGroup.Text>
              <Form.Control
                type="text"
                placeholder={lang === 'ar' ? 'البحث بالاسم أو الرمز…' : 'Search by course name or code…'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border-start-0 ps-0"
              />
              {search && (
                <button className="btn btn-outline-secondary border-start-0" onClick={() => setSearch('')} type="button">
                  <i className="fa-solid fa-xmark" aria-hidden="true" />
                </button>
              )}
            </InputGroup>
          </Col>
          <Col md={4} lg={3}>
            <Form.Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">{t('common.all')} ({lang === 'ar' ? 'الحالات' : 'Statuses'})</option>
              <option value="active">{t('status.active')}</option>
              <option value="scheduled">{t('status.scheduled')}</option>
            </Form.Select>
          </Col>
          <Col md={2} lg={4} className="text-md-end text-muted small">
            <span>{filtered.length} {t('nav.courses')}</span>
          </Col>
        </Row>
      </div>

      <StateView
        loading={loading}
        error={error}
        onRetry={reload}
        empty={data && !filtered.length}
        emptyText={t('courses.empty')}
        emptyIcon="fa-book-open"
      >
        <Row className="g-4">
          {filtered.map((c, i) => {
            const theme = COURSE_THEMES[c.code] || COURSE_THEMES.DEFAULT;
            const totalEnrolled = c.assignedCohorts.reduce((acc, h) => acc + (h.enrolledCount || 0), 0);
            const totalSessions = c.assignedCohorts.reduce((acc, h) => acc + (h.sessionsCount || 0), 0);

            return (
              <Col md={6} lg={4} key={c._id} className="rise" style={{ '--i': i }}>
                <div className="card h-100 border rounded-3 overflow-hidden shadow-sm d-flex flex-column transition-all" style={{ borderTop: `4px solid ${theme.accent}` }}>
                  {/* Aerospace Visual Header / Thumbnail */}
                  <div
                    className="p-4 text-white position-relative overflow-hidden d-flex flex-column justify-content-between"
                    style={{ minHeight: '135px', background: theme.gradient }}
                  >
                    {/* SVG Orbital Background Art */}
                    <svg
                      className="position-absolute"
                      style={{ insetInlineEnd: '-20px', bottom: '-25px', width: '170px', height: '170px', opacity: 0.18, pointerEvents: 'none' }}
                      viewBox="0 0 100 100"
                      fill="none"
                      aria-hidden="true"
                    >
                      <circle cx="50" cy="50" r="45" stroke="#ffffff" strokeWidth="1" strokeDasharray="3 3" />
                      <ellipse cx="50" cy="50" rx="42" ry="18" stroke="#ffffff" strokeWidth="1.5" transform="rotate(-30 50 50)" />
                      <circle cx="50" cy="50" r="8" fill="#ffffff" />
                    </svg>

                    <div className="d-flex justify-content-between align-items-center position-relative z-1 mb-2">
                      <span className="badge rounded-pill bg-dark bg-opacity-50 text-white border border-light border-opacity-25 mono px-2.5 py-1">
                        <i className={`fa-solid ${theme.icon} me-1.5`} aria-hidden="true" />
                        {c.code}
                      </span>
                      <StatusBadge value={c.status || 'active'} />
                    </div>

                    <div className="position-relative z-1">
                      <h2 className="h5 fw-bold text-white mb-0 line-clamp-1">
                        <Link to={`/instructor/courses/${c._id}`} className="text-white text-decoration-none">
                          {c.name}
                        </Link>
                      </h2>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="card-body p-4 d-flex flex-column justify-content-between flex-grow-1">
                    <div>
                      <p className="text-muted small mb-3 line-clamp-2" style={{ minHeight: '2.5rem' }}>
                        {c.description || '—'}
                      </p>

                      {/* Course Metadata Readouts */}
                      <div className="d-flex flex-wrap gap-3 py-2 border-top border-bottom mb-3 text-secondary small">
                        <div>
                          <i className="fa-solid fa-clock me-1 text-muted" aria-hidden="true" />
                          <span>{c.durationWeeks ? `${c.durationWeeks} ${t('common.weeks')}` : '—'}</span>
                        </div>
                        <div>
                          <i className="fa-solid fa-user-graduate me-1 text-muted" aria-hidden="true" />
                          <span className="mono fw-semibold">{totalEnrolled}</span> {t('dash.students')}
                        </div>
                        <div>
                          <i className="fa-solid fa-calendar-check me-1 text-muted" aria-hidden="true" />
                          <span className="mono fw-semibold">{totalSessions}</span> {t('cohorts.sessions')}
                        </div>
                      </div>

                      {/* Assigned Cohorts */}
                      <div className="mb-3">
                        <div className="small fw-semibold text-muted mb-1.5">
                          <i className="fa-solid fa-users-rectangle me-1" aria-hidden="true" />
                          {t('courses.assignedCohorts')}:
                        </div>
                        <div className="d-flex flex-wrap gap-1.5">
                          {c.assignedCohorts.map((h) => (
                            <Link
                              key={h._id}
                              to={`/instructor/cohorts/${h._id}`}
                              className="badge bg-light text-dark border text-decoration-none px-2.5 py-1 mono small hover-shadow"
                            >
                              {h.name}
                            </Link>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Card Action Footer */}
                    <div className="pt-2">
                      <Link to={`/instructor/courses/${c._id}`} className="btn btn-sm btn-outline-secondary w-100 fw-semibold">
                        <span>{t('courses.details')}</span>
                        <i className="fa-solid fa-arrow-right ms-1 fa-flip-horizontal-rtl" aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                </div>
              </Col>
            );
          })}
        </Row>
      </StateView>
    </>
  );
}

export function CourseDetail() {
  const { id } = useParams();
  const { t, fmtDate, lang } = useI18n();
  const { data, loading, error, reload } = useFetch(() => instructorApi.course(id), [id]);

  const theme = data ? COURSE_THEMES[data.code] || COURSE_THEMES.DEFAULT : COURSE_THEMES.DEFAULT;

  return (
    <>
      <PageHeader
        back="/instructor/courses"
        eyebrow={data?.code}
        title={data?.name || t('courses.details')}
        subtitle={data?.description}
        actions={data && <StatusBadge value={data.status || 'active'} />}
      />

      <StateView loading={loading} error={error} onRetry={reload}>
        {data && (
          <>
            {/* Header Telemetry Hero */}
            <div
              className="p-4 rounded-3 text-white mb-4 position-relative overflow-hidden shadow-sm"
              style={{ background: theme.gradient }}
            >
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 position-relative z-1">
                <div>
                  <span className="badge bg-white bg-opacity-20 text-white border border-white border-opacity-25 mono mb-2">
                    {data.code} · {data.durationWeeks ? `${data.durationWeeks} ${t('common.weeks')}` : ''}
                  </span>
                  <h2 className="h4 fw-bold mb-1">{data.name}</h2>
                  <p className="small text-white-50 mb-0 max-w-prose">{data.description}</p>
                </div>
                <div className="d-flex gap-3 text-center bg-black bg-opacity-20 p-3 rounded-2 border border-white border-opacity-10">
                  <div>
                    <div className="mono h4 fw-bold mb-0">{data.assignedCohorts.length}</div>
                    <div className="small text-white-50" style={{ fontSize: '0.72rem' }}>{t('courses.assignedCohorts')}</div>
                  </div>
                  <div className="border-start border-white border-opacity-20 px-2" />
                  <div>
                    <div className="mono h4 fw-bold mb-0">
                      {data.assignedCohorts.reduce((acc, h) => acc + (h.enrolledCount || 0), 0)}
                    </div>
                    <div className="small text-white-50" style={{ fontSize: '0.72rem' }}>{t('dash.students')}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Assigned Cohorts Table */}
            <Panel title={t('courses.assignedCohorts')} icon="fa-users-rectangle" flush>
              <div className={s.tableWrap}>
                <Table hover className="mb-0">
                  <thead>
                    <tr>
                      <th>{t('common.cohort')}</th>
                      <th>{t('cohorts.period')}</th>
                      <th>{t('common.status')}</th>
                      <th>{t('cohorts.enrolled')}</th>
                      <th>{t('cohorts.sessionsCount')}</th>
                      <th className="text-end">{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.assignedCohorts.map((c) => (
                      <tr key={c._id}>
                        <td>
                          <Link to={`/instructor/cohorts/${c._id}`} className="fw-bold text-dark text-decoration-none">
                            {c.name}
                          </Link>
                        </td>
                        <td className="small text-muted mono">
                          {fmtDate(c.startDate)} &rarr; {fmtDate(c.endDate)}
                        </td>
                        <td><StatusBadge value={c.status} /></td>
                        <td className="mono fw-semibold">{c.enrolledCount}</td>
                        <td className="mono fw-semibold">{c.sessionsCount}</td>
                        <td className="text-end">
                          <Link to={`/instructor/cohorts/${c._id}`} className="btn btn-sm btn-outline-secondary">
                            {t('common.open')}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Panel>
          </>
        )}
      </StateView>
    </>
  );
}
