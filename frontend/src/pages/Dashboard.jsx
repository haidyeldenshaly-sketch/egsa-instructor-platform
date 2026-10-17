import { Link } from 'react-router-dom';
import { Row, Col } from 'react-bootstrap';
import { Avatar, StateView, StatusBadge } from '../components/ui.jsx';
import { useSessionLabel, pctText } from '../components/tables.jsx';
import useFetch from '../hooks/useFetch.js';
import useCountUp from '../hooks/useCountUp.js';
import { instructorApi } from '../services/instructor.js';
import { useI18n } from '../i18n/index.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import s from './dashboard.module.css';

// Compact Dashboard Stat Card with count-up animation
function DashboardStatCard({ icon, label, value, tone = '#142a3a', to }) {
  const count = useCountUp(Number(value) || 0);
  const content = (
    <>
      <div className={s.statIconBox} style={{ '--stat-tone': tone }}>
        <i className={`fa-solid ${icon}`} aria-hidden="true" />
      </div>
      <div className={s.statData}>
        <div className={s.statNumber} aria-label={`${value}`}>{count}</div>
        <div className={s.statLabel}>{label}</div>
      </div>
    </>
  );

  return to ? (
    <Link to={to} className={s.statCard}>
      {content}
    </Link>
  ) : (
    <div className={s.statCard}>
      {content}
    </div>
  );
}

export default function Dashboard() {
  const { t, fmtDateTime, lang } = useI18n();
  const { user } = useAuth();
  const label = useSessionLabel();

  // Load live dashboard metrics and assigned courses
  const { data, loading, error, reload } = useFetch(() => instructorApi.dashboard());
  const courses = useFetch(() => instructorApi.courses());

  const cleanName = user?.name ? user.name.replace(/^Dev\s+/i, '').split(' ').slice(0, 2).join(' ') : '';

  return (
    <div className={s.dashboard}>
      {/* 1. Dashboard Header */}
      <header className={s.headerCard}>
        <div className={s.instructorInfo}>
          <Avatar user={user} size={50} showOnline />
          <div className={s.headerText}>
            <div className={s.pageTitle}>
              {lang === 'ar' ? 'لوحة المتابعة · المنظومة الأكاديمية' : 'Dashboard • Space Academy'}
            </div>
            <h1 className={s.welcomeHeading}>
              {t('dash.welcome')}{cleanName ? `, ${cleanName}` : ''}
            </h1>
            <p className={s.headerSubtitle}>
              {lang === 'ar'
                ? 'متابعة البرامج التدريبية المخصصة وجلسات التأهيل الفضائي.'
                : 'Workspace for your assigned space courses and training cohorts.'}
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className={s.headerActions}>
          <Link to="/instructor/assessments/new" className={`${s.actionBtn} ${s.actionBtnPrimary}`}>
            <i className="fa-solid fa-plus" aria-hidden="true" />
            <span>{t('asm.new')}</span>
          </Link>
          <Link to="/instructor/attendance" className={`${s.actionBtn} ${s.actionBtnSecondary}`}>
            <i className="fa-solid fa-clipboard-user" aria-hidden="true" />
            <span>{t('nav.attendance')}</span>
          </Link>
          <Link to="/instructor/courses" className={`${s.actionBtn} ${s.actionBtnSecondary}`}>
            <i className="fa-solid fa-book-open" aria-hidden="true" />
            <span>{t('nav.courses')}</span>
          </Link>
        </div>
      </header>

      <StateView loading={loading} error={error} onRetry={reload}>
        {data && (
          <>
            {/* 2. Attention Banner (driven by real pending grading count) */}
            {data.stats.pendingGrading > 0 && (
              <aside className={s.attentionBanner} role="status">
                <div className={s.bannerContent}>
                  <i className={`fa-solid fa-file-circle-check ${s.bannerIcon}`} aria-hidden="true" />
                  <span>
                    <strong className="mono">{data.stats.pendingGrading}</strong> {t('dash.attention')}
                  </span>
                </div>
                <Link to="/instructor/submissions?status=submitted" className={s.bannerBtn}>
                  <span>{t('dash.review')}</span>
                  <i className="fa-solid fa-arrow-right fa-flip-horizontal-rtl" aria-hidden="true" />
                </Link>
              </aside>
            )}

            {/* 3. Statistics Grid (Compact, Real Aggregates) */}
            <section className={s.statsRow} aria-label="Key Metrics">
              <DashboardStatCard
                icon="fa-book-open"
                label={t('dash.assignedCourses')}
                value={data.stats.assignedCourses}
                tone="#142a3a"
                to="/instructor/courses"
              />
              <DashboardStatCard
                icon="fa-users-rectangle"
                label={t('dash.activeCohorts')}
                value={data.stats.activeCohorts}
                tone="#1e7c85"
                to="/instructor/cohorts"
              />
              <DashboardStatCard
                icon="fa-user-graduate"
                label={t('dash.students')}
                value={data.stats.students}
                tone="#142a3a"
                to="/instructor/students"
              />
              <DashboardStatCard
                icon="fa-file-circle-check"
                label={t('dash.pendingGrading')}
                value={data.stats.pendingGrading}
                tone="#c3a364"
                to="/instructor/submissions?status=submitted"
              />
            </section>

            {/* 4. Course Previews Section */}
            <section className={s.sectionBlock} aria-label="Course Previews">
              <div className={s.sectionHeader}>
                <h2 className={s.sectionTitle}>
                  <i className="fa-solid fa-book-open" aria-hidden="true" />
                  <span>{t('courses.title')}</span>
                </h2>
                <Link to="/instructor/courses" className={s.viewAllLink}>
                  <span>{lang === 'ar' ? 'عرض جميع الدورات' : 'View All Courses'}</span>
                  <i className="fa-solid fa-arrow-right fa-flip-horizontal-rtl" aria-hidden="true" />
                </Link>
              </div>

              <div className={s.coursesGrid}>
                {courses.data?.slice(0, 3).map((c) => (
                  <article key={c._id} className={s.courseCard}>
                    <div className={s.courseBanner}>
                      <span className={s.courseCodeBadge}>{c.code}</span>
                      <StatusBadge value={c.status} />
                    </div>
                    <div className={s.courseBody}>
                      <h3 className={s.courseTitle}>{c.name}</h3>
                      <p className={s.courseDesc}>{c.description || '—'}</p>
                      <div className={s.courseMeta}>
                        <span className={s.courseMetaItem}>
                          <i className="fa-solid fa-users text-muted" aria-hidden="true" />
                          <span>{c.assignedCohorts?.length || 0} {t('courses.assignedCohorts')}</span>
                        </span>
                        <Link to={`/instructor/courses/${c._id}`} className={s.viewCourseBtn}>
                          {t('common.view')}
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            {/* 5. Two-Column Work Queues (Upcoming Sessions & Pending Submissions) */}
            <section className={s.workGrid} aria-label="Instructor Action Queues">
              {/* Upcoming Sessions Panel */}
              <div className={s.workPanel}>
                <div className={s.panelHead}>
                  <h3 className={s.panelTitle}>
                    <i className="fa-solid fa-calendar-days" aria-hidden="true" />
                    <span>{t('dash.upcoming')}</span>
                  </h3>
                  <Link to="/instructor/sessions" className={s.viewAllLink}>
                    <span>{t('common.view')}</span>
                    <i className="fa-solid fa-arrow-right fa-flip-horizontal-rtl" aria-hidden="true" />
                  </Link>
                </div>

                {data.upcomingSessions?.length > 0 ? (
                  <div className={s.tableWrap}>
                    <table className={s.dataTable}>
                      <tbody>
                        {data.upcomingSessions.map((x) => (
                          <tr key={x._id}>
                            <td>
                              <Link to={`/instructor/sessions/${x._id}`} className={s.itemTitle}>
                                {x.title}
                              </Link>
                              <div className={s.itemSub}>
                                <span className={s.cohortTag}>{x.cohort?.name}</span>
                                <span className="mono">{label(x)}</span>
                              </div>
                            </td>
                            <td className="text-end">
                              <Link
                                to={`/instructor/attendance?sessionId=${x._id}`}
                                className={s.gradeBtn}
                                title={t('sessions.takeAttendance')}
                              >
                                <i className="fa-solid fa-clipboard-user me-1" aria-hidden="true" />
                                <span>{t('sessions.takeAttendance')}</span>
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className={s.emptyState}>
                    <i className="fa-solid fa-calendar-check" aria-hidden="true" />
                    <p className="mb-0">{t('dash.noUpcoming')}</p>
                  </div>
                )}
              </div>

              {/* Pending Submissions Panel */}
              <div className={s.workPanel}>
                <div className={s.panelHead}>
                  <h3 className={s.panelTitle}>
                    <i className="fa-solid fa-inbox" aria-hidden="true" />
                    <span>{t('dash.pendingTitle')}</span>
                  </h3>
                  <Link to="/instructor/submissions?status=submitted" className={s.viewAllLink}>
                    <span>{t('common.view')}</span>
                    <i className="fa-solid fa-arrow-right fa-flip-horizontal-rtl" aria-hidden="true" />
                  </Link>
                </div>

                {data.pendingSubmissions?.length > 0 ? (
                  <div className={s.tableWrap}>
                    <table className={s.dataTable}>
                      <tbody>
                        {data.pendingSubmissions.map((x) => (
                          <tr key={x._id}>
                            <td>
                              <div className={s.itemTitle}>{x.student?.name}</div>
                              <div className={s.itemSub}>
                                <span>{x.assessment?.title}</span>
                                <span>•</span>
                                <span className="mono">{fmtDateTime(x.submittedAt)}</span>
                              </div>
                            </td>
                            <td className="text-end">
                              <Link
                                to={`/instructor/submissions/${x._id}`}
                                className={s.gradeBtn}
                              >
                                {t('dash.grade')}
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className={s.emptyState}>
                    <i className="fa-solid fa-circle-check" aria-hidden="true" />
                    <p className="mb-0">{t('dash.noPending')}</p>
                  </div>
                )}
              </div>
            </section>

            {/* 6. Recent Attendance & Activity Summary */}
            <Row className="g-3">
              <Col lg={6}>
                <div className={s.workPanel}>
                  <div className={s.panelHead}>
                    <h3 className={s.panelTitle}>
                      <i className="fa-solid fa-clipboard-user" aria-hidden="true" />
                      <span>{t('dash.recentAttendance')}</span>
                    </h3>
                    <Link to="/instructor/attendance" className={s.viewAllLink}>
                      <span>{t('common.view')}</span>
                      <i className="fa-solid fa-arrow-right fa-flip-horizontal-rtl" aria-hidden="true" />
                    </Link>
                  </div>

                  {data.recentAttendance?.length > 0 ? (
                    <div className={s.tableWrap}>
                      <table className={s.dataTable}>
                        <tbody>
                          {data.recentAttendance.map((r) => (
                            <tr key={r.session._id}>
                              <td>
                                <Link to={`/instructor/attendance?sessionId=${r.session._id}`} className={s.itemTitle}>
                                  {r.session.title}
                                </Link>
                                <div className={s.itemSub}>
                                  <span className={s.cohortTag}>{r.session.cohort?.name}</span>
                                  <span>{label(r.session)}</span>
                                </div>
                              </td>
                              <td className="text-end">
                                {r.recorded === 0 ? (
                                  <StatusBadge value="pending" />
                                ) : (
                                  <span className="badge bg-light border px-2 py-1 text-dark">
                                    <span className="text-success fw-bold me-1">{r.present} <i className="fa-solid fa-check" aria-hidden="true" /></span>
                                    <span className="text-muted">·</span>
                                    <span className="text-danger fw-bold ms-1">{r.absent} <i className="fa-solid fa-xmark" aria-hidden="true" /></span>
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className={s.emptyState}>
                      <i className="fa-solid fa-clipboard" aria-hidden="true" />
                      <p className="mb-0">{t('dash.noAttendance')}</p>
                    </div>
                  )}
                </div>
              </Col>

              <Col lg={6}>
                <div className={s.workPanel}>
                  <div className={s.panelHead}>
                    <h3 className={s.panelTitle}>
                      <i className="fa-solid fa-clock-rotate-left" aria-hidden="true" />
                      <span>{t('dash.recentActivity')}</span>
                    </h3>
                  </div>

                  {data.recentActivity?.length > 0 ? (
                    <div className={s.tableWrap}>
                      <table className={s.dataTable}>
                        <tbody>
                          {data.recentActivity.map((a) => (
                            <tr key={a._id}>
                              <td>
                                <div className="fw-medium text-dark">{a.summary}</div>
                                <div className="small text-muted mono mt-1">{fmtDateTime(a.createdAt)}</div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className={s.emptyState}>
                      <i className="fa-solid fa-clock" aria-hidden="true" />
                      <p className="mb-0">{t('dash.noActivity')}</p>
                    </div>
                  )}
                </div>
              </Col>
            </Row>
          </>
        )}
      </StateView>
    </div>
  );
}

export { pctText };
