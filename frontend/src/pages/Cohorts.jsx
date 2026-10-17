import { Link, useParams } from 'react-router-dom';
import { Col, Nav, Row, Table, Tab } from 'react-bootstrap';
import { AttendanceBar, PageHeader, Panel, StatCard, StateView, StatusBadge, styles as s } from '../components/ui.jsx';
import { StudentsTable, ProgressTable, pctText, useSessionLabel } from '../components/tables.jsx';
import useFetch from '../hooks/useFetch.js';
import { instructorApi } from '../services/instructor.js';
import { useI18n } from '../i18n/index.jsx';

export function CohortsPage() {
  const { t, fmtDate } = useI18n(); const label = useSessionLabel();
  const { data, loading, error, reload } = useFetch(() => instructorApi.cohorts());
  return (
    <>
      <PageHeader eyebrow={t('nav.cohorts')} title={t('cohorts.title')} />
      <StateView loading={loading} error={error} onRetry={reload} empty={data && !data.length} emptyText={t('cohorts.empty')} emptyIcon="fa-users-rectangle">
        <Row className="g-3">{data?.map((c) => (
          <Col md={6} xl={4} key={c._id}><Panel className="h-100">
            <div className="d-flex justify-content-between mb-2"><span className="mono small text-muted">{c.course?.code}</span><StatusBadge value={c.status} /></div>
            <h2 className="h5 mb-0"><Link to={`/instructor/cohorts/${c._id}`} className="text-decoration-none">{c.name}</Link></h2>
            <div className="text-muted small mb-3">{c.course?.name}</div>
            <dl className={s.kv}><dt>{t('cohorts.period')}</dt><dd className="small">{fmtDate(c.startDate)} → {fmtDate(c.endDate)}</dd>
              <dt>{t('cohorts.enrolled')}</dt><dd className="mono">{c.enrolledCount}</dd><dt>{t('cohorts.sessionsCount')}</dt><dd className="mono">{c.sessionsCount}</dd>
              <dt>{t('cohorts.nextSession')}</dt><dd className="small">{c.nextSession ? `${c.nextSession.title} · ${label(c.nextSession)}` : '—'}</dd></dl>
          </Panel></Col>))}</Row>
      </StateView>
    </>
  );
}

function TabData({ fn, deps, empty, children }) {
  const { data, loading, error, reload } = useFetch(fn, deps);
  return <StateView loading={loading} error={error} onRetry={reload} empty={data && !data.length} emptyText={empty}>{data && children(data)}</StateView>;
}
export function CohortDetail() {
  const { id } = useParams(); const { t, fmtDate } = useI18n(); const label = useSessionLabel();
  const { data: c, loading, error, reload } = useFetch(() => instructorApi.cohort(id), [id]);
  return (
    <>
      <PageHeader back="/instructor/cohorts" eyebrow={c?.course?.code} title={c?.name || t('cohorts.title')} subtitle={c?.course?.name} actions={c && <StatusBadge value={c.status} />} />
      <StateView loading={loading} error={error} onRetry={reload}>
        {c && (
          <Tab.Container defaultActiveKey="overview" mountOnEnter unmountOnExit>
            <Nav variant="tabs" className={`${s.tabs} mb-3 flex-nowrap overflow-auto`}>
              {['overview', 'students', 'sessions', 'attendance', 'assessments', 'progress'].map((k) => <Nav.Item key={k}><Nav.Link eventKey={k} className="text-nowrap">{t(`cohorts.${k}`)}</Nav.Link></Nav.Item>)}
            </Nav>
            <Tab.Content>
              <Tab.Pane eventKey="overview">
                <Row className="g-3 mb-3">
                  <Col xs={6} md={3}><StatCard icon="fa-user-graduate" label={t('cohorts.enrolled')} value={c.enrolledCount} /></Col>
                  <Col xs={6} md={3}><StatCard icon="fa-calendar-days" label={t('cohorts.sessionsCount')} value={c.sessionsCount} tone="var(--egsa-secondary)" /></Col>
                  <Col xs={6} md={3}><StatCard icon="fa-file-pen" label={t('cohorts.assessments')} value={c.assessmentsCount} tone="var(--egsa-accent)" /></Col>
                </Row>
                <Panel><dl className={s.kv}>
                  <dt>{t('common.course')}</dt><dd><Link to={`/instructor/courses/${c.course?._id}`}>{c.course?.name}</Link></dd>
                  <dt>{t('cohorts.period')}</dt><dd>{fmtDate(c.startDate)} → {fmtDate(c.endDate)}</dd>
                  <dt>{t('cohorts.instructor')}</dt><dd>{c.instructor?.name}</dd>
                  <dt>{t('cohorts.nextSession')}</dt><dd>{c.nextSession ? `${c.nextSession.title} · ${label(c.nextSession)}` : '—'}</dd></dl></Panel>
              </Tab.Pane>
              <Tab.Pane eventKey="students"><Panel flush><TabData fn={() => instructorApi.cohortStudents(id)} deps={[id]} empty={t('cohorts.noStudents')}>{(rows) => <StudentsTable rows={rows} />}</TabData></Panel></Tab.Pane>
              <Tab.Pane eventKey="sessions"><Panel flush><TabData fn={() => instructorApi.cohortSessions(id)} deps={[id]} empty={t('cohorts.noSessions')}>{(rows) => (
                <Table hover className="mb-0"><thead><tr><th>{t('common.title')}</th><th>{t('common.date')}</th><th>{t('common.status')}</th><th /></tr></thead><tbody>{rows.map((x) => (
                  <tr key={x._id}><td className="fw-semibold">{x.title}</td><td className="small mono">{label(x)}</td><td><StatusBadge value={x.status} /></td><td className="text-end"><Link className="btn btn-sm btn-outline-secondary" to={`/instructor/sessions/${x._id}`}>{t('common.open')}</Link></td></tr>))}</tbody></Table>)}</TabData></Panel></Tab.Pane>
              <Tab.Pane eventKey="attendance"><Panel flush title={t('att.summary')}><TabData fn={() => instructorApi.cohortAttendance(id)} deps={[id]} empty={t('cohorts.noStudents')}>{(rows) => (<>
                <Table hover className="mb-0"><thead><tr><th>{t('common.student')}</th><th>{t('att.total')}</th><th>{t('att.present')}</th><th>{t('att.absent')}</th><th>{t('att.pending')}</th><th>{t('att.percent')}</th><th>{t('common.status')}</th></tr></thead><tbody>{rows.map((r) => (
                  <tr key={r.student._id}><td className="fw-semibold">{r.student.name}</td><td className="mono">{r.totalSessions}</td><td className="mono">{r.present}</td><td className="mono">{r.absent}</td><td className="mono">{r.pending}</td><td style={{ minWidth: 130 }}><AttendanceBar present={r.present} absent={r.absent} pending={r.pending} /><span className="small mono">{pctText(r.attendancePercentage)}</span></td><td><StatusBadge value={r.trainingStatus} /></td></tr>))}</tbody></Table>
                <div className="small text-muted p-3">{t('att.percentNote')}</div></>)}</TabData></Panel></Tab.Pane>
              <Tab.Pane eventKey="assessments"><Panel flush><TabData fn={() => instructorApi.cohortAssessments(id)} deps={[id]} empty={t('cohorts.noAssessments')}>{(rows) => (
                <Table hover className="mb-0"><thead><tr><th>{t('common.title')}</th><th>{t('common.status')}</th><th>{t('asm.dueDate')}</th><th>{t('asm.awaiting')}</th><th /></tr></thead><tbody>{rows.map((a) => (
                  <tr key={a._id}><td className="fw-semibold">{a.title}</td><td><StatusBadge value={a.status} /></td><td className="small">{fmtDate(a.dueDate)}</td><td className="mono">{a.submissions.pendingGrading}</td><td className="text-end"><Link className="btn btn-sm btn-outline-secondary" to={`/instructor/assessments/${a._id}`}>{t('common.open')}</Link></td></tr>))}</tbody></Table>)}</TabData></Panel></Tab.Pane>
              <Tab.Pane eventKey="progress"><Panel flush title={t('prog.title')}><TabData fn={() => instructorApi.cohortProgress(id)} deps={[id]} empty={t('prog.empty')}>{(rows) => <><ProgressTable rows={rows} /><div className="small text-muted p-3">{t('prog.note')}</div></>}</TabData></Panel></Tab.Pane>
            </Tab.Content>
          </Tab.Container>)}
      </StateView>
    </>
  );
}
