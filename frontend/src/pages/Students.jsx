import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Col, Form, Row, Table } from 'react-bootstrap';
import { AttendanceBar, Avatar, PageHeader, Panel, StateView, StatusBadge, styles as s } from '../components/ui.jsx';
import { StudentsTable, pctText } from '../components/tables.jsx';
import useFetch from '../hooks/useFetch.js';
import { instructorApi } from '../services/instructor.js';
import { useI18n } from '../i18n/index.jsx';

export function StudentsPage() {
  const { t } = useI18n();
  const [cohortId, setCohortId] = useState('');
  const [search, setSearch] = useState('');
  const cohorts = useFetch(() => instructorApi.cohorts());
  const { data, loading, error, reload } = useFetch(
    () => instructorApi.students({ cohortId, search }),
    [cohortId, search]
  );

  return (
    <>
      <PageHeader
        eyebrow={t('nav.students')}
        title={t('students.title')}
        subtitle="Roster of cadets enrolled in your assigned aerospace mission cohorts."
      />
      <Panel className="mb-3">
        <Row className="g-2">
          <Col md={4}>
            <Form.Label htmlFor="sc" className="small fw-semibold">{t('common.cohort')}</Form.Label>
            <Form.Select
              id="sc"
              value={cohortId}
              onChange={(e) => setCohortId(e.target.value)}
            >
              <option value="">{t('common.all')}</option>
              {cohorts.data?.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </Form.Select>
          </Col>
          <Col md={8}>
            <Form.Label htmlFor="ss" className="small fw-semibold">{t('common.search')}</Form.Label>
            <Form.Control
              id="ss"
              type="search"
              placeholder={t('students.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Col>
        </Row>
      </Panel>
      <Panel flush>
        <StateView
          loading={loading}
          error={error}
          onRetry={reload}
          empty={data && !data.length}
          emptyText={t('students.empty')}
          emptyIcon="fa-user-graduate"
        >
          {data && <StudentsTable rows={data} />}
        </StateView>
      </Panel>
    </>
  );
}

export function StudentProfile() {
  const { id } = useParams();
  const { t, fmtDateTime, fmtDate } = useI18n();
  const { data, loading, error, reload } = useFetch(() => instructorApi.student(id), [id]);

  return (
    <>
      <PageHeader
        back="/instructor/students"
        eyebrow={t('students.profile')}
        title={data?.student?.name || t('students.profile')}
        subtitle={data?.student?.email}
      />
      <StateView loading={loading} error={error} onRetry={reload}>
        {data && (
          <>
            {/* Student Header Card */}
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 p-3 bg-white border rounded shadow-sm mb-3">
              <div className="d-flex align-items-center gap-3">
                <Avatar user={data.student} size={54} />
                <div>
                  <div className="d-flex align-items-center gap-2">
                    <h4 className="mb-0 fw-bold">{data.student?.name}</h4>
                    {data.student?.externalStudentId && (
                      <span className="badge bg-light text-dark border mono">
                        Cadet ID: {data.student.externalStudentId}
                      </span>
                    )}
                  </div>
                  <div className="small text-muted mono mt-0.5">{data.student?.email}</div>
                </div>
              </div>
              <div>
                <Link
                  to={`/instructor/messages?studentId=${data.student?._id}${data.progress?.[0]?.cohort?._id ? `&cohortId=${data.progress[0].cohort._id}` : ''}`}
                  className="btn btn-primary d-inline-flex align-items-center gap-2"
                >
                  <i className="fa-solid fa-comment-dots" />
                  <span>{t('messages.messageStudent') || 'Message Student'}</span>
                </Link>
              </div>
            </div>

            <Row className="g-3">
              {data.progress.map((p) => (
                <Col key={p.cohort._id} lg={12}>
                  <Panel
                    title={`${p.cohort.name} · ${p.course?.name || ''}`}
                    actions={<StatusBadge value={p.trainingStatus} />}
                  >
                    <Row className="g-3">
                      <Col md={6}>
                        <div className="p-3 bg-light rounded border h-100">
                          <div className="fw-semibold small text-uppercase text-muted mb-2">
                            {t('students.attendance')}
                          </div>
                          <AttendanceBar
                            present={p.attendance.present}
                            late={p.attendance.late || 0}
                            excused={p.attendance.excused || 0}
                            absent={p.attendance.absent}
                            pending={p.attendance.pending}
                          />
                          <div className="mono small mt-2 d-flex flex-wrap gap-2 text-dark">
                            <span className="text-success">{t('att.present')}: {p.attendance.present}</span>
                            <span className="text-warning">{t('att.late')}: {p.attendance.late || 0}</span>
                            <span className="text-info">{t('att.excused')}: {p.attendance.excused || 0}</span>
                            <span className="text-danger">{t('att.absent')}: {p.attendance.absent}</span>
                            <span className="text-muted">{t('att.pending')}: {p.attendance.pending}</span>
                            <span className="fw-bold ms-auto">{pctText(p.attendance.attendancePercentage)}</span>
                          </div>
                        </div>
                      </Col>
                      <Col md={6}>
                        <div className="p-3 bg-light rounded border h-100">
                          <div className="fw-semibold small text-uppercase text-muted mb-2">
                            {t('students.assessmentStatus')}
                          </div>
                          <div className="d-flex flex-column gap-1 small mono">
                            <div>{t('prog.published')}: <span className="fw-semibold">{p.assessments.published}</span></div>
                            <div>{t('prog.submitted')}: <span className="fw-semibold text-primary">{p.assessments.submitted}</span></div>
                            <div>{t('prog.graded')}: <span className="fw-semibold">{p.assessments.graded}</span></div>
                            <div>{t('prog.resultsPublished')}: <span className="fw-semibold text-success">{p.assessments.resultsPublished}</span></div>
                            {p.assessments.pendingGrading > 0 && (
                              <div className="text-warning-emphasis fw-semibold">
                                {p.assessments.pendingGrading} {t('dash.pendingGrading').toLowerCase()}
                              </div>
                            )}
                          </div>
                        </div>
                      </Col>
                    </Row>
                  </Panel>
                </Col>
              ))}

              <Col lg={6}>
                <Panel title={t('students.records')} flush>
                  <StateView empty={!data.attendanceRecords.length} emptyText={t('students.notRecorded')}>
                    <Table hover size="sm" className="mb-0 align-middle">
                      <tbody>
                        {data.attendanceRecords.map((a) => (
                          <tr key={a._id}>
                            <td>
                              <div className="fw-semibold text-dark">{a.session?.title}</div>
                              <div className="small text-muted mono">{fmtDate(a.session?.date)}</div>
                            </td>
                            <td className="text-end">
                              <StatusBadge value={a.status} />
                              {a.notes && <div className="small text-muted fst-italic mt-0.5">{a.notes}</div>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </StateView>
                </Panel>
              </Col>

              <Col lg={6}>
                <Panel title={t('students.submissions')} flush>
                  <StateView empty={!data.submissions.length} emptyText={t('sub.empty')}>
                    <Table hover size="sm" className="mb-0 align-middle">
                      <tbody>
                        {data.submissions.map((x) => (
                          <tr key={x._id}>
                            <td>
                              <Link to={`/instructor/submissions/${x._id}`} className="fw-semibold text-decoration-none">
                                {x.assessment?.title}
                              </Link>
                              <div className="small text-muted mono">{fmtDateTime(x.submittedAt)}</div>
                            </td>
                            <td className="text-end">
                              <StatusBadge value={x.status} />
                              {x.result?.status === 'published' && (
                                <div className="mono fw-bold text-success mt-0.5">
                                  {x.result.score ?? '—'}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </StateView>
                </Panel>
              </Col>
            </Row>
          </>
        )}
      </StateView>
    </>
  );
}
