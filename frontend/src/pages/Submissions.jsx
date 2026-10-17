import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Alert, Button, Col, Form, Row, Spinner, Table } from 'react-bootstrap';
import { Avatar, ConfirmModal, FileCard, FilePreviewModal, PageHeader, Panel, StateView, StatusBadge, styles as s } from '../components/ui.jsx';
import useFetch from '../hooks/useFetch.js';
import { instructorApi } from '../services/instructor.js';
import { useI18n } from '../i18n/index.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { friendlyError } from '../utils/errors.js';
import subStyles from './submissions.module.css';

export function SubmissionsPage() {
  const { t, fmtDateTime } = useI18n();
  const [sp, setSp] = useSearchParams();
  const rawStatus = sp.get('status') || '';

  const { data, loading, error, reload } = useFetch(() => instructorApi.submissions({}), []);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(rawStatus || 'all');

  useEffect(() => {
    if (rawStatus) setStatusFilter(rawStatus);
  }, [rawStatus]);

  // Calculate real metrics from submissions
  const stats = useMemo(() => {
    if (!data) return { total: 0, submitted: 0, evaluated: 0, published: 0, late: 0 };
    let total = data.length;
    let submitted = 0, evaluated = 0, published = 0, late = 0;

    data.forEach((x) => {
      if (x.status === 'submitted') submitted++;
      else if (x.status === 'evaluated') evaluated++;
      else if (x.status === 'result_published') published++;

      const isLate = x.isLate || (x.assessment?.dueDate && new Date(x.submittedAt) > new Date(x.assessment.dueDate));
      if (isLate) late++;
    });

    return { total, submitted, evaluated, published, late };
  }, [data]);

  // Filtered submissions
  const filteredSubmissions = useMemo(() => {
    if (!data) return [];
    return data.filter((x) => {
      const q = search.trim().toLowerCase();
      if (q) {
        const studentName = (x.student?.name || '').toLowerCase();
        const studentEmail = (x.student?.email || '').toLowerCase();
        const asmTitle = (x.assessment?.title || '').toLowerCase();
        if (!studentName.includes(q) && !studentEmail.includes(q) && !asmTitle.includes(q)) {
          return false;
        }
      }

      if (statusFilter === 'all') return true;
      if (statusFilter === 'late') {
        return x.isLate || (x.assessment?.dueDate && new Date(x.submittedAt) > new Date(x.assessment.dueDate));
      }
      return x.status === statusFilter;
    });
  }, [data, search, statusFilter]);

  const handleFilterClick = (key) => {
    setStatusFilter(key);
    if (key === 'all') setSp({});
    else setSp({ status: key });
  };

  return (
    <>
      <PageHeader
        eyebrow={t('nav.submissions')}
        title={t('sub.title')}
        subtitle="Review submitted cadet assignments, score evaluations against grading criteria, and publish results."
      />

      {/* Metrics Overview Cards */}
      <div className={subStyles.statsGrid}>
        <div className={subStyles.statCard}>
          <span className={subStyles.statNumber}>{stats.total}</span>
          <span className={subStyles.statLabel}>{t('common.total')}</span>
        </div>
        <div className={subStyles.statCard}>
          <span className={subStyles.statNumber} style={{ color: '#d97706' }}>{stats.submitted}</span>
          <span className={subStyles.statLabel}>{t('asm.awaiting')}</span>
        </div>
        <div className={subStyles.statCard}>
          <span className={subStyles.statNumber} style={{ color: '#0284c7' }}>{stats.evaluated}</span>
          <span className={subStyles.statLabel}>{t('asm.evaluated')}</span>
        </div>
        <div className={subStyles.statCard}>
          <span className={subStyles.statNumber} style={{ color: '#059669' }}>{stats.published}</span>
          <span className={subStyles.statLabel}>{t('asm.resultsPublished')}</span>
        </div>
        <div className={subStyles.statCard}>
          <span className={subStyles.statNumber} style={{ color: '#dc2626' }}>{stats.late}</span>
          <span className={subStyles.statLabel}>{t('att.late')}</span>
        </div>
      </div>

      <Panel flush>
        {/* Search and Filters Toolbar */}
        <div className={subStyles.toolbar}>
          <div className="position-relative" style={{ minWidth: 260 }}>
            <i className="fa-solid fa-magnifying-glass position-absolute text-muted" style={{ left: 10, top: 9 }} aria-hidden="true" />
            <Form.Control
              size="sm"
              type="search"
              placeholder={`${t('common.search')} cadet or assignment...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '1.9rem', borderRadius: 9999 }}
            />
          </div>

          <div className={subStyles.filterPills}>
            {[
              { key: 'all', label: t('sub.filterAll'), count: stats.total },
              { key: 'submitted', label: t('asm.awaiting'), count: stats.submitted },
              { key: 'evaluated', label: t('asm.evaluated'), count: stats.evaluated },
              { key: 'result_published', label: t('asm.resultsPublished'), count: stats.published },
              { key: 'late', label: t('att.late'), count: stats.late },
            ].map((f) => (
              <button
                key={f.key}
                type="button"
                className={`${subStyles.filterBtn} ${statusFilter === f.key ? subStyles.filterBtnActive : ''}`}
                onClick={() => handleFilterClick(f.key)}
              >
                {f.label} <span className="opacity-75">({f.count})</span>
              </button>
            ))}
          </div>
        </div>

        <StateView loading={loading} error={error} onRetry={reload} empty={data && !data.length} emptyText={t('sub.empty')} emptyIcon="fa-inbox">
          <div className={s.tableWrap}>
            <Table hover className="mb-0 align-middle">
              <thead>
                <tr>
                  <th style={{ width: 44 }}></th>
                  <th>{t('common.student')}</th>
                  <th>{t('nav.assessments')}</th>
                  <th>{t('common.submittedAt')}</th>
                  <th>{t('common.status')}</th>
                  <th>{t('common.score')}</th>
                  <th className="text-end">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubmissions.map((x) => {
                  const isLate = x.isLate || (x.assessment?.dueDate && new Date(x.submittedAt) > new Date(x.assessment.dueDate));
                  const max = x.assessment?.gradingConfig?.maxScore;
                  return (
                    <tr key={x._id}>
                      <td>
                        <Avatar user={x.student} size={34} />
                      </td>
                      <td>
                        <div className="fw-semibold text-dark">{x.student?.name}</div>
                        <div className="small text-muted">{x.student?.email}</div>
                      </td>
                      <td>
                        <div className="fw-medium text-dark">{x.assessment?.title}</div>
                        <div className="small text-muted">
                          {x.assessment?.cohort?.name ? `${x.assessment.cohort.name} · ` : ''}
                          {x.assessment?.cohort?.course?.code || ''}
                        </div>
                      </td>
                      <td>
                        <div className="small mono text-dark">{fmtDateTime(x.submittedAt)}</div>
                        {isLate && (
                          <span className={subStyles.lateTag}>
                            <i className="fa-solid fa-clock me-1" aria-hidden="true" />
                            {t('att.late')}
                          </span>
                        )}
                      </td>
                      <td>
                        <StatusBadge value={x.status} />
                      </td>
                      <td>
                        <span className="mono fw-semibold">
                          {x.result?.score != null ? x.result.score : '—'}
                          {max != null && x.result?.score != null && (
                            <span className="text-muted small fw-normal ms-1">/ {max}</span>
                          )}
                        </span>
                      </td>
                      <td className="text-end">
                        <Link
                          className="btn btn-sm btn-egsa"
                          to={`/instructor/submissions/${x._id}`}
                        >
                          {x.status === 'submitted' ? t('dash.grade') : t('common.view')}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {!filteredSubmissions.length && (
                  <tr>
                    <td colSpan={7} className="text-center py-4 text-muted">
                      No submissions match the current filter or search criteria.
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

export function SubmissionDetail() {
  const { id } = useParams();
  const { t, fmtDateTime } = useI18n();
  const toast = useToast();
  const { data, loading, error, reload } = useFetch(() => instructorApi.submission(id), [id]);

  const [f, setF] = useState({ score: '', feedback: '', strengths: '', improvements: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [touched, setTouched] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);

  useEffect(() => {
    if (data) {
      setF({
        score: data.result?.score ?? '',
        feedback: data.result?.feedback || '',
        strengths: data.result?.strengths || '',
        improvements: data.result?.improvements || '',
      });
    }
  }, [data]);

  const max = data?.assessment?.gradingConfig?.maxScore;
  const locked = data?.result?.status === 'published';
  const evaluated = Boolean(data?.result) && !locked;

  // Validation: disallow negative or score > max
  const scoreBad = f.score !== '' && (Number(f.score) < 0 || (max != null && Number(f.score) > max));
  const empty = f.score === '' && !f.feedback.trim() && !f.strengths.trim() && !f.improvements.trim();

  const isLate = data?.isLate || (data?.assessment?.dueDate && new Date(data.submittedAt) > new Date(data.assessment.dueDate));

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setTouched(true);
    if (scoreBad || empty) return;
    setBusy(true);
    setErr(null);
    try {
      await instructorApi.grade(id, {
        score: f.score === '' ? null : Number(f.score),
        feedback: f.feedback,
        strengths: f.strengths,
        improvements: f.improvements,
      });
      toast.success(t('sub.evalSaved'));
      reload();
    } catch (x) {
      setErr(friendlyError(x, t));
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    setBusy(true);
    try {
      await instructorApi.publishResult(id);
      toast.success(t('sub.resultPublished'));
      setConfirm(false);
      reload();
    } catch (x) {
      toast.error(friendlyError(x, t));
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        back="/instructor/submissions"
        eyebrow={data?.assessment?.title}
        title={data?.student?.name || t('sub.review')}
        subtitle={data && `${t('common.submittedAt')}: ${fmtDateTime(data.submittedAt)}`}
        actions={data && <StatusBadge value={data.status} />}
      />

      <StateView loading={loading} error={error} onRetry={reload}>
        {data && (
          <>
            {/* Cadet & Mission Context Header Box */}
            <div className={subStyles.studentMetaBox}>
              <Avatar user={data.student} size={48} />
              <div className="flex-grow-1">
                <div className="d-flex align-items-center gap-2">
                  <h5 className="mb-0 fw-bold">{data.student?.name}</h5>
                  {isLate && (
                    <span className={subStyles.lateTag}>
                      <i className="fa-solid fa-clock me-1" aria-hidden="true" />
                      {t('att.late')}
                    </span>
                  )}
                </div>
                <div className="small text-muted">
                  {data.student?.email}
                  {data.assessment?.cohort?.name ? ` · Cohort: ${data.assessment.cohort.name}` : ''}
                  {data.assessment?.dueDate ? ` · Due: ${fmtDateTime(data.assessment.dueDate)}` : ''}
                </div>
              </div>
            </div>

            <Row className="g-3">
              <Col lg={6}>
                <Panel title={t('sub.content')}>
                  <div className={subStyles.contentCard}>
                    <div style={{ whiteSpace: 'pre-wrap' }}>
                      {data.content || <span className="text-muted">{t('sub.noContent')}</span>}
                    </div>
                  </div>

                  {data.attachments?.length > 0 && (
                    <div className="mt-3">
                      <div className="small fw-semibold text-muted mb-2 text-uppercase" style={{ letterSpacing: '0.04em' }}>
                        Attached Mission Submissions ({data.attachments.length})
                      </div>
                      <div className="d-flex flex-column gap-2">
                        {data.attachments.map((a, i) => (
                          <FileCard
                            key={i}
                            file={a}
                            onPreview={(file) => setPreviewFile(file)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </Panel>
              </Col>

              <Col lg={6}>
                <Panel title={t('sub.grading')}>
                  {locked ? (
                    <Alert variant="success" className="py-2">
                      <i className="fa-solid fa-lock me-2" aria-hidden="true" />
                      {t('sub.visibleToStudent')} · {t('sub.locked')}
                    </Alert>
                  ) : evaluated ? (
                    <Alert variant="warning" className="py-2">
                      <i className="fa-solid fa-eye-slash me-2" aria-hidden="true" />
                      {t('sub.notPublished')}
                    </Alert>
                  ) : null}

                  {err && <Alert variant="danger" role="alert">{err}</Alert>}

                  <Form onSubmit={save} noValidate>
                    <Form.Group className="mb-3" controlId="g-score">
                      <Form.Label>
                        {t('common.score')}
                        {max != null && <span className="text-muted ms-2 mono small">/ {max}</span>}
                      </Form.Label>
                      <Form.Control
                        type="number"
                        min="0"
                        max={max != null ? max : undefined}
                        step="any"
                        value={f.score}
                        onChange={set('score')}
                        disabled={locked}
                        isInvalid={touched && scoreBad}
                      />
                      <Form.Control.Feedback type="invalid">
                        {max != null ? `${t('sub.maxHint')}: ${max}` : t('common.error')}
                      </Form.Control.Feedback>
                    </Form.Group>

                    <Form.Group className="mb-3" controlId="g-fb">
                      <Form.Label>{t('common.feedback')}</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={4}
                        value={f.feedback}
                        onChange={set('feedback')}
                        disabled={locked}
                        maxLength={5000}
                        isInvalid={touched && empty}
                      />
                    </Form.Group>

                    <Form.Group className="mb-3" controlId="g-st">
                      <Form.Label>{t('sub.strengths')}</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={2}
                        value={f.strengths}
                        onChange={set('strengths')}
                        disabled={locked}
                        maxLength={3000}
                      />
                    </Form.Group>

                    <Form.Group className="mb-3" controlId="g-im">
                      <Form.Label>{t('sub.improvements')}</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={2}
                        value={f.improvements}
                        onChange={set('improvements')}
                        disabled={locked}
                        maxLength={3000}
                      />
                    </Form.Group>

                    {!locked && (
                      <div className="d-flex flex-wrap gap-2">
                        <Button type="submit" className="btn-egsa" disabled={busy}>
                          {busy && <Spinner size="sm" className="me-2" />}
                          {t('sub.saveEval')}
                        </Button>
                        <Button
                          variant="outline-primary"
                          className="btn-gold"
                          type="button"
                          disabled={!evaluated || busy}
                          onClick={() => setConfirm(true)}
                        >
                          <i className="fa-solid fa-paper-plane me-2" aria-hidden="true" />
                          {t('sub.publishResult')}
                        </Button>
                      </div>
                    )}
                  </Form>
                </Panel>
              </Col>
            </Row>
          </>
        )}
      </StateView>

      <ConfirmModal
        show={confirm}
        variant="primary"
        title={t('sub.publishResult')}
        body={t('sub.publishConfirm')}
        confirmLabel={t('sub.publishResult')}
        busy={busy}
        onCancel={() => setConfirm(false)}
        onConfirm={publish}
      />

      <FilePreviewModal
        show={Boolean(previewFile)}
        file={previewFile}
        onHide={() => setPreviewFile(null)}
      />
    </>
  );
}
