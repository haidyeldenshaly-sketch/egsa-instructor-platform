import { useState, useRef, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Col, Form, Row, Spinner, Table, InputGroup, Card } from 'react-bootstrap';
import { Avatar, ConfirmModal, PageHeader, Panel, StateView, StatusBadge, FileCard, FilePreviewModal, styles as s } from '../components/ui.jsx';
import useFetch from '../hooks/useFetch.js';
import { instructorApi } from '../services/instructor.js';
import { useI18n } from '../i18n/index.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { friendlyError } from '../utils/errors.js';

export function AssessmentsPage() {
  const { t, fmtDate, lang } = useI18n();
  const [cohortId, setCohortId] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const cohorts = useFetch(() => instructorApi.cohorts());
  const { data, loading, error, reload } = useFetch(
    () => instructorApi.assessments({ cohortId, status }),
    [cohortId, status]
  );

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter((a) =>
      a.title.toLowerCase().includes(q) ||
      (a.cohort?.name && a.cohort.name.toLowerCase().includes(q)) ||
      (a.course?.name && a.course.name.toLowerCase().includes(q))
    );
  }, [data, search]);

  return (
    <>
      <PageHeader
        eyebrow={t('nav.assessments')}
        title={t('asm.title')}
        subtitle={lang === 'ar' ? 'إعداد ومتابعة التكليفات والواجبات ونشر نتائج التقييم للطلاب' : 'Manage academic assessments, upload coursework materials, and evaluate cadet submissions'}
        actions={
          cohorts.data?.length ? (
            <Link to="/instructor/assessments/new" className="btn btn-egsa">
              <i className="fa-solid fa-plus me-1.5" aria-hidden="true" />
              {t('asm.new')}
            </Link>
          ) : null
        }
      />

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-3 border shadow-sm mb-4">
        <Row className="g-3 align-items-center">
          <Col md={5}>
            <InputGroup>
              <InputGroup.Text className="bg-light border-end-0 text-muted">
                <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
              </InputGroup.Text>
              <Form.Control
                type="text"
                placeholder={lang === 'ar' ? 'البحث عن تكليف بالاسم…' : 'Search assessments…'}
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
            <Form.Select id="ac" value={cohortId} onChange={(e) => setCohortId(e.target.value)}>
              <option value="">{t('common.all')} ({t('common.cohort')})</option>
              {cohorts.data?.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} — {c.course?.name}
                </option>
              ))}
            </Form.Select>
          </Col>
          <Col md={3} lg={2}>
            <Form.Select id="as" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">{t('common.all')} ({t('common.status')})</option>
              <option value="draft">{t('status.draft')}</option>
              <option value="published">{t('status.published')}</option>
            </Form.Select>
          </Col>
          <Col md={12} lg={2} className="text-lg-end text-muted small">
            <span>{filtered.length} {t('nav.assessments')}</span>
          </Col>
        </Row>
      </div>

      <Panel flush>
        <StateView
          loading={loading}
          error={error}
          onRetry={reload}
          empty={data && !filtered.length}
          emptyText={t('asm.empty')}
          emptyIcon="fa-file-pen"
          action={cohorts.data?.length ? { to: '/instructor/assessments/new', label: t('asm.new') } : null}
        >
          <div className={s.tableWrap}>
            <Table hover className="mb-0">
              <thead>
                <tr>
                  <th>{t('common.title')}</th>
                  <th>{t('common.cohort')}</th>
                  <th>{t('common.status')}</th>
                  <th>{t('asm.dueDate')}</th>
                  <th>{t('asm.submissions')}</th>
                  <th>{t('asm.awaiting')}</th>
                  <th>{lang === 'ar' ? 'المرفقات' : 'Materials'}</th>
                  <th className="text-end">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a._id}>
                    <td>
                      <div className="fw-bold">
                        <Link to={`/instructor/assessments/${a._id}`} className="text-dark text-decoration-none">
                          {a.title}
                        </Link>
                      </div>
                      {a.course?.name && (
                        <div className="small text-muted text-truncate" style={{ maxWidth: '280px' }}>
                          {a.course.name}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="badge bg-light text-dark border mono">{a.cohort?.name}</span>
                    </td>
                    <td>
                      <StatusBadge value={a.status} />
                    </td>
                    <td className="small mono">{fmtDate(a.dueDate)}</td>
                    <td className="mono fw-semibold">{a.submissions.submitted}</td>
                    <td className="mono">
                      {a.submissions.pendingGrading > 0 ? (
                        <span className="badge bg-warning bg-opacity-10 text-dark border border-warning px-2 py-1">
                          <i className="fa-solid fa-clock me-1 text-warning" aria-hidden="true" />
                          {a.submissions.pendingGrading}
                        </span>
                      ) : (
                        <span className="text-muted">0</span>
                      )}
                    </td>
                    <td>
                      {a.attachments?.length ? (
                        <span className="badge bg-light text-secondary border px-2 py-1" title={`${a.attachments.length} attachment(s)`}>
                          <i className="fa-solid fa-paperclip me-1" aria-hidden="true" />
                          {a.attachments.length}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="text-end">
                      <Link className="btn btn-sm btn-outline-secondary" to={`/instructor/assessments/${a._id}`}>
                        {t('common.open')}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </StateView>
      </Panel>
    </>
  );
}

export function AssessmentForm() {
  const { id } = useParams();
  const editing = !!id;
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const toast = useToast();

  const cohorts = useFetch(() => instructorApi.cohorts());
  const existing = useFetch(() => instructorApi.assessment(id), [id], { enabled: editing });

  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState(null);
  const [touched, setTouched] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef(null);

  const base = editing
    ? existing.data
    : cohorts.data
    ? { cohort: { _id: cohorts.data.length === 1 ? cohorts.data[0]._id : '' } }
    : null;

  const form =
    f ||
    (base && {
      cohortId: base.cohort?._id || '',
      title: base.title || '',
      description: base.description || '',
      instructions: base.instructions || '',
      startDate: base.startDate?.slice(0, 10) || '',
      dueDate: base.dueDate?.slice(0, 10) || '',
      maxScore: base.gradingConfig?.maxScore ?? '',
      attachments: base.attachments || [],
    });

  const set = (k) => (e) => setF({ ...form, [k]: e.target.value });

  // Handle file uploads to real backend
  const handleFileUpload = async (files) => {
    if (!files || !files.length) return;
    setUploading(true);
    setErr(null);

    const newAttachments = [...(form.attachments || [])];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 25 * 1024 * 1024) {
        toast.error(`File ${file.name} exceeds the 25MB limit.`);
        continue;
      }
      try {
        const formData = new FormData();
        formData.append('file', file);
        const uploaded = await instructorApi.uploadFile(formData);
        newAttachments.push(uploaded);
        toast.success(`Attached ${file.name}`);
      } catch (x) {
        toast.error(`Failed to upload ${file.name}: ${x.message}`);
      }
    }

    setF({ ...form, attachments: newAttachments });
    setUploading(false);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  const removeAttachment = (index) => {
    const next = [...form.attachments];
    next.splice(index, 1);
    setF({ ...form, attachments: next });
  };

  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    if ((!editing && !form.cohortId) || !form.title.trim() || (form.startDate && form.dueDate && form.dueDate < form.startDate)) return;

    setBusy(true);
    setErr(null);
    const body = {
      title: form.title,
      description: form.description,
      instructions: form.instructions,
      startDate: form.startDate || null,
      dueDate: form.dueDate || null,
      gradingConfig: { maxScore: form.maxScore === '' ? null : Number(form.maxScore) },
      attachments: form.attachments.map((a) => ({ name: a.name, url: a.url })),
    };

    try {
      const r = editing
        ? await instructorApi.updateAssessment(id, body)
        : await instructorApi.createAssessment({ ...body, cohortId: form.cohortId });
      toast.success(t('asm.created'));
      nav(`/instructor/assessments/${r._id}`);
    } catch (x) {
      setErr(friendlyError(x, t));
    } finally {
      setBusy(false);
    }
  };

  const loading = cohorts.loading || (editing && existing.loading);
  const error = cohorts.error || (editing && existing.error);

  return (
    <>
      <PageHeader
        back={editing ? `/instructor/assessments/${id}` : '/instructor/assessments'}
        eyebrow={t('nav.assessments')}
        title={editing ? t('asm.edit') : t('asm.new')}
        subtitle={t('asm.draftNote')}
      />

      <StateView loading={loading} error={error} onRetry={() => { cohorts.reload(); existing.reload?.(); }}>
        {form && (
          <Panel>
            <Form onSubmit={submit} noValidate>
              {err && <Alert variant="danger" role="alert" className="mb-4">{err}</Alert>}

              <Row className="g-4">
                {/* Cohort Select (Creation only) */}
                {!editing && (
                  <Col md={12}>
                    <Form.Group controlId="af-cohort">
                      <Form.Label>{t('common.cohort')} *</Form.Label>
                      <Form.Select
                        value={form.cohortId}
                        onChange={set('cohortId')}
                        isInvalid={touched && !form.cohortId}
                        required
                      >
                        <option value="">{t('common.select')}</option>
                        {cohorts.data?.map((c) => (
                          <option key={c._id} value={c._id}>
                            {c.name} — {c.course?.name}
                          </option>
                        ))}
                      </Form.Select>
                      <Form.Control.Feedback type="invalid">{t('common.required')}</Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                )}

                {/* Title */}
                <Col md={12}>
                  <Form.Group controlId="af-title">
                    <Form.Label>{t('common.title')} *</Form.Label>
                    <Form.Control
                      value={form.title}
                      onChange={set('title')}
                      maxLength={200}
                      isInvalid={touched && !form.title.trim()}
                      placeholder="e.g. Small Satellite Power & Thermal Subsystems Report"
                      required
                    />
                    <Form.Control.Feedback type="invalid">{t('common.required')}</Form.Control.Feedback>
                  </Form.Group>
                </Col>

                {/* Description */}
                <Col md={12}>
                  <Form.Group controlId="af-desc">
                    <Form.Label>{t('common.description')}</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={2}
                      value={form.description}
                      onChange={set('description')}
                      maxLength={3000}
                      placeholder="Brief overview of the assessment objective and academic scope…"
                    />
                  </Form.Group>
                </Col>

                {/* Instructions */}
                <Col md={12}>
                  <Form.Group controlId="af-ins">
                    <Form.Label>{t('asm.instructions')}</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={4}
                      value={form.instructions}
                      onChange={set('instructions')}
                      maxLength={5000}
                      placeholder="Detailed instructions, formatting rules, calculation guidelines, and rubric criteria…"
                    />
                  </Form.Group>
                </Col>

                {/* Schedule & Score */}
                <Col md={4}>
                  <Form.Group controlId="af-sd">
                    <Form.Label>{t('asm.startDate')}</Form.Label>
                    <Form.Control type="date" value={form.startDate} onChange={set('startDate')} />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group controlId="af-dd">
                    <Form.Label>{t('asm.dueDate')}</Form.Label>
                    <Form.Control
                      type="date"
                      value={form.dueDate}
                      onChange={set('dueDate')}
                      isInvalid={touched && form.startDate && form.dueDate && form.dueDate < form.startDate}
                    />
                    <Form.Control.Feedback type="invalid">Due date must be after start date.</Form.Control.Feedback>
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group controlId="af-ms">
                    <Form.Label>{t('asm.maxScore')}</Form.Label>
                    <Form.Control
                      type="number"
                      min="0"
                      step="any"
                      placeholder="e.g. 100"
                      value={form.maxScore}
                      onChange={set('maxScore')}
                    />
                    <Form.Text>{t('asm.maxScoreHint')}</Form.Text>
                  </Form.Group>
                </Col>

                {/* Professional Drag-and-Drop Attachment Area */}
                <Col md={12}>
                  <div className="border-top pt-4">
                    <Form.Label className="d-flex justify-content-between align-items-center">
                      <span className="fw-bold">
                        <i className="fa-solid fa-paperclip me-1.5 text-primary" aria-hidden="true" />
                        {lang === 'ar' ? 'المرفقات والمواد التعليمية المرجعية' : 'Assignment Materials & Reference Attachments'}
                      </span>
                      <span className="small text-muted">PDF, Word, Excel, ZIP, TXT, Images (Max 25MB)</span>
                    </Form.Label>

                    {/* Drag and Drop Zone */}
                    <div
                      className={`${s.dropZone} ${dragActive ? s.dropZoneActive : ''}`}
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      role="button"
                      tabIndex={0}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="d-none"
                        onChange={(e) => handleFileUpload(e.target.files)}
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt,.png,.jpg,.jpeg,.webp"
                      />
                      <div className={s.dropZoneIcon}>
                        {uploading ? (
                          <Spinner animation="border" variant="primary" />
                        ) : (
                          <i className="fa-solid fa-cloud-arrow-up" aria-hidden="true" />
                        )}
                      </div>
                      <div className={s.dropZoneText}>
                        {uploading
                          ? (lang === 'ar' ? 'جارٍ رفع الملفات…' : 'Uploading files…')
                          : (lang === 'ar' ? 'اسحب الملفات هنا أو اضغط للاختيار من جهازك' : 'Drag & drop assignment files here, or click to browse')}
                      </div>
                      <div className={s.dropZoneSub}>
                        {lang === 'ar' ? 'يدعم نماذج الـ PDF ومستندات الأوفيس وملفات الأرشيف حتى 25 ميجابايت' : 'Supports project briefs, problem sets, rubrics, telemetry data, and CAD files'}
                      </div>
                    </div>

                    {/* Uploaded File Tiles */}
                    {form.attachments && form.attachments.length > 0 && (
                      <div className="mt-3 d-flex flex-column gap-2">
                        {form.attachments.map((file, idx) => (
                          <FileCard
                            key={file.url || idx}
                            file={file}
                            onRemove={() => removeAttachment(idx)}
                            onPreview={(f) => setPreviewFile(f)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </Col>
              </Row>

              <div className="mt-4 pt-3 border-top d-flex gap-2">
                <Button type="submit" className="btn-egsa" disabled={busy || uploading}>
                  {busy && <Spinner size="sm" className="me-2" />}
                  <i className="fa-solid fa-floppy-disk me-1.5" aria-hidden="true" />
                  {t('common.save')}
                </Button>
                <Button variant="outline-secondary" onClick={() => nav(-1)} disabled={busy}>
                  {t('common.cancel')}
                </Button>
              </div>
            </Form>
          </Panel>
        )}
      </StateView>

      <FilePreviewModal
        show={!!previewFile}
        file={previewFile}
        onHide={() => setPreviewFile(null)}
      />
    </>
  );
}

export function AssessmentDetail() {
  const { id } = useParams();
  const { t, fmtDate, lang } = useI18n();
  const nav = useNavigate();
  const toast = useToast();
  const { data, loading, error, reload } = useFetch(() => instructorApi.assessment(id), [id]);
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);

  const run = async (fn, okMsg, after) => {
    setBusy(true);
    try {
      await fn();
      toast.success(okMsg);
      setModal(null);
      after ? after() : reload();
    } catch (x) {
      toast.error(friendlyError(x, t));
      setModal(null);
    } finally {
      setBusy(false);
    }
  };

  const draft = data?.status === 'draft';

  return (
    <>
      <PageHeader
        back="/instructor/assessments"
        eyebrow={data?.cohort?.name}
        title={data?.title || t('asm.title')}
        subtitle={data?.course?.name}
        actions={
          data && (
            <>
              <Link className="btn btn-outline-secondary" to={`/instructor/assessments/${id}/submissions`}>
                <i className="fa-solid fa-inbox me-1.5" aria-hidden="true" />
                {t('asm.submissions')} ({data.submissions.submitted})
              </Link>
              {draft && (
                <>
                  <Link className="btn btn-outline-secondary" to={`/instructor/assessments/${id}/edit`}>
                    <i className="fa-solid fa-pen-to-square me-1.5" aria-hidden="true" />
                    {t('common.edit')}
                  </Link>
                  <Button variant="outline-danger" onClick={() => setModal('delete')}>
                    <i className="fa-solid fa-trash-can me-1.5" aria-hidden="true" />
                    {t('common.delete')}
                  </Button>
                  <Button className="btn-gold" onClick={() => setModal('publish')}>
                    <i className="fa-solid fa-paper-plane me-1.5" aria-hidden="true" />
                    {t('asm.publish')}
                  </Button>
                </>
              )}
            </>
          )
        }
      />

      <StateView loading={loading} error={error} onRetry={reload}>
        {data && (
          <Row className="g-4">
            {/* Main Assessment Content & Instructions */}
            <Col lg={8}>
              <Panel title={t('asm.instructions')} icon="fa-file-lines" className="mb-4">
                {draft && (
                  <Alert variant="secondary" className="py-2.5 mb-3">
                    <i className="fa-solid fa-eye-slash me-2" aria-hidden="true" />
                    {t('asm.draftNote')}
                  </Alert>
                )}

                <dl className={`${s.kv} mb-4`}>
                  <dt>{t('common.status')}</dt>
                  <dd><StatusBadge value={data.status} /></dd>
                  <dt>{t('common.description')}</dt>
                  <dd style={{ whiteSpace: 'pre-wrap' }}>{data.description || '—'}</dd>
                  <dt>{t('asm.instructions')}</dt>
                  <dd style={{ whiteSpace: 'pre-wrap' }} className="text-secondary">{data.instructions || '—'}</dd>
                  <dt>{t('asm.startDate')}</dt>
                  <dd className="mono">{fmtDate(data.startDate)}</dd>
                  <dt>{t('asm.dueDate')}</dt>
                  <dd className="mono fw-semibold text-danger">{fmtDate(data.dueDate)}</dd>
                  <dt>{t('asm.maxScore')}</dt>
                  <dd className="mono fw-bold">{data.gradingConfig?.maxScore ?? '—'}</dd>
                </dl>

                {/* Attached Materials Section */}
                <div className="pt-3 border-top">
                  <h3 className="h6 fw-bold mb-3 d-flex align-items-center gap-2">
                    <i className="fa-solid fa-paperclip text-primary" aria-hidden="true" />
                    <span>{lang === 'ar' ? 'المرفقات والمستندات الملحقة' : 'Attached Reference Files'}</span>
                    <span className="badge bg-light text-muted border small ms-1">
                      {data.attachments?.length || 0}
                    </span>
                  </h3>

                  {data.attachments && data.attachments.length > 0 ? (
                    <div className="d-flex flex-column gap-2">
                      {data.attachments.map((file, idx) => (
                        <FileCard
                          key={file.url || idx}
                          file={file}
                          onPreview={(f) => setPreviewFile(f)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 bg-light rounded text-center text-muted small">
                      <i className="fa-solid fa-folder-open me-1.5" aria-hidden="true" />
                      {lang === 'ar' ? 'لا توجد مرفقات مضافة لهذا التكليف.' : 'No files or attachments uploaded for this assignment.'}
                    </div>
                  )}
                </div>
              </Panel>
            </Col>

            {/* Submissions & Grading Analytics Panel */}
            <Col lg={4}>
              <Panel title={t('asm.submissions')} icon="fa-chart-pie" className="mb-4">
                <dl className={s.kv}>
                  <dt>{t('asm.submissions')}</dt>
                  <dd className="mono fw-bold">{data.submissions.submitted}</dd>
                  <dt>{t('asm.awaiting')}</dt>
                  <dd className="mono text-warning fw-bold">{data.submissions.pendingGrading}</dd>
                  <dt>{t('asm.evaluated')}</dt>
                  <dd className="mono text-info fw-bold">{data.submissions.evaluated}</dd>
                  <dt>{t('asm.resultsPublished')}</dt>
                  <dd className="mono text-success fw-bold">{data.submissions.resultsPublished}</dd>
                </dl>
                <div className="mt-3 pt-3 border-top">
                  <Link
                    to={`/instructor/assessments/${id}/submissions`}
                    className="btn btn-sm btn-egsa w-100"
                  >
                    <i className="fa-solid fa-list-check me-1.5" aria-hidden="true" />
                    {lang === 'ar' ? 'عرض وتقييم الإجابات' : 'Review & Grade Submissions'}
                  </Link>
                </div>
              </Panel>
            </Col>
          </Row>
        )}
      </StateView>

      <ConfirmModal
        show={modal === 'publish'}
        variant="primary"
        title={t('asm.publish')}
        body={t('asm.publishConfirm')}
        confirmLabel={t('asm.publish')}
        busy={busy}
        onCancel={() => setModal(null)}
        onConfirm={() => run(() => instructorApi.publishAssessment(id), t('asm.published'))}
      />
      <ConfirmModal
        show={modal === 'delete'}
        title={t('common.delete')}
        body={t('asm.deleteConfirm')}
        confirmLabel={t('common.delete')}
        busy={busy}
        onCancel={() => setModal(null)}
        onConfirm={() => run(() => instructorApi.deleteAssessment(id), t('asm.deleted'), () => nav('/instructor/assessments'))}
      />

      <FilePreviewModal
        show={!!previewFile}
        file={previewFile}
        onHide={() => setPreviewFile(null)}
      />
    </>
  );
}

export function AssessmentSubmissions() {
  const { id } = useParams();
  const { t, fmtDateTime, lang } = useI18n();
  const a = useFetch(() => instructorApi.assessment(id), [id]);
  const s = useFetch(() => instructorApi.assessmentSubmissions(id), [id]);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const subs = s.data || [];
  const assessment = a.data;

  // Real stats
  const stats = useMemo(() => {
    const total = subs.length;
    let submitted = 0, evaluated = 0, published = 0, late = 0;
    subs.forEach((sub) => {
      if (sub.status === 'submitted') submitted++;
      else if (sub.status === 'evaluated') evaluated++;
      else if (sub.status === 'result_published') published++;

      const isLate = sub.isLate || (assessment?.dueDate && new Date(sub.submittedAt) > new Date(assessment.dueDate));
      if (isLate) late++;
    });
    return {
      total,
      enrolled: assessment?.submissions?.enrolledCount || assessment?.submissions?.total || total,
      submitted,
      evaluated,
      published,
      late,
    };
  }, [subs, assessment]);

  const filteredSubs = useMemo(() => {
    return subs.filter((sub) => {
      const q = search.trim().toLowerCase();
      if (q) {
        const name = (sub.student?.name || '').toLowerCase();
        const email = (sub.student?.email || '').toLowerCase();
        if (!name.includes(q) && !email.includes(q)) return false;
      }

      if (filter === 'all') return true;
      if (filter === 'submitted') return sub.status === 'submitted';
      if (filter === 'evaluated') return sub.status === 'evaluated';
      if (filter === 'result_published') return sub.status === 'result_published';
      if (filter === 'late') {
        return sub.isLate || (assessment?.dueDate && new Date(sub.submittedAt) > new Date(assessment.dueDate));
      }
      return true;
    });
  }, [subs, search, filter, assessment]);

  return (
    <>
      <PageHeader
        back={`/instructor/assessments/${id}`}
        eyebrow={assessment?.cohort?.name}
        title={assessment?.title || t('asm.submissions')}
        subtitle={
          assessment?.dueDate
            ? `${lang === 'ar' ? 'تاريخ التسليم الأخير' : 'Due Deadline'}: ${fmtDateTime(assessment.dueDate)}`
            : (lang === 'ar' ? 'سجل تسليمات المتدربين للتكليف' : 'Cadet submission log and evaluation workspace')
        }
      />

      {/* Overview Stat Cards */}
      <Row className="g-3 mb-3">
        <Col sm={6} md={3}>
          <div className="p-3 bg-white border rounded shadow-sm">
            <div className="small text-muted text-uppercase fw-semibold" style={{ fontSize: '0.74rem' }}>
              {lang === 'ar' ? 'إجمالي التسليمات' : 'Total Submissions'}
            </div>
            <div className="h4 mb-0 fw-bold text-dark mt-1 mono">{stats.total}</div>
          </div>
        </Col>
        <Col sm={6} md={3}>
          <div className="p-3 bg-white border rounded shadow-sm">
            <div className="small text-muted text-uppercase fw-semibold" style={{ fontSize: '0.74rem' }}>
              {t('asm.awaiting')}
            </div>
            <div className="h4 mb-0 fw-bold text-warning mt-1 mono">{stats.submitted}</div>
          </div>
        </Col>
        <Col sm={6} md={3}>
          <div className="p-3 bg-white border rounded shadow-sm">
            <div className="small text-muted text-uppercase fw-semibold" style={{ fontSize: '0.74rem' }}>
              {t('asm.evaluated')}
            </div>
            <div className="h4 mb-0 fw-bold text-info mt-1 mono">{stats.evaluated}</div>
          </div>
        </Col>
        <Col sm={6} md={3}>
          <div className="p-3 bg-white border rounded shadow-sm">
            <div className="small text-muted text-uppercase fw-semibold" style={{ fontSize: '0.74rem' }}>
              {t('att.late')}
            </div>
            <div className="h4 mb-0 fw-bold text-danger mt-1 mono">{stats.late}</div>
          </div>
        </Col>
      </Row>

      <Panel flush>
        {/* Search & Filters Toolbar */}
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 p-3 bg-light border-bottom">
          <div className="position-relative" style={{ minWidth: 240 }}>
            <i className="fa-solid fa-magnifying-glass position-absolute text-muted" style={{ left: 10, top: 9 }} aria-hidden="true" />
            <Form.Control
              size="sm"
              type="search"
              placeholder={`${t('common.search')} cadet name or email...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '1.9rem', borderRadius: 9999 }}
            />
          </div>

          <div className="d-flex flex-wrap gap-1.5">
            {[
              { key: 'all', label: t('common.all') },
              { key: 'submitted', label: t('asm.awaiting') },
              { key: 'evaluated', label: t('asm.evaluated') },
              { key: 'result_published', label: t('asm.resultsPublished') },
              { key: 'late', label: t('att.late') },
            ].map((f) => (
              <Button
                key={f.key}
                size="sm"
                variant={filter === f.key ? 'primary' : 'outline-secondary'}
                className="rounded-pill py-1 px-3 text-nowrap"
                style={{ fontSize: '0.78rem' }}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>

        <StateView
          loading={s.loading || a.loading}
          error={s.error || a.error}
          onRetry={() => { a.reload(); s.reload(); }}
          empty={subs && !subs.length}
          emptyText={t('asm.noSubmissions')}
          emptyIcon="fa-inbox"
        >
          <div className="table-responsive">
            <Table hover className="mb-0 align-middle">
              <thead>
                <tr>
                  <th style={{ width: 44 }}></th>
                  <th>{t('common.student')}</th>
                  <th>{t('common.status')}</th>
                  <th>{t('common.submittedAt')}</th>
                  <th>{t('common.score')}</th>
                  <th className="text-end">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubs.map((sub) => {
                  const isLate = sub.isLate || (assessment?.dueDate && new Date(sub.submittedAt) > new Date(assessment.dueDate));
                  const max = assessment?.gradingConfig?.maxScore;
                  return (
                    <tr key={sub._id}>
                      <td>
                        <Avatar user={sub.student} size={34} />
                      </td>
                      <td>
                        <div className="fw-semibold text-dark">{sub.student?.name}</div>
                        <div className="small text-muted">{sub.student?.email}</div>
                      </td>
                      <td>
                        <StatusBadge value={sub.status} />
                      </td>
                      <td>
                        <div className="small mono text-dark">{fmtDateTime(sub.submittedAt)}</div>
                        {isLate && (
                          <span className="badge bg-danger-subtle text-danger border border-danger-subtle mt-0.5">
                            <i className="fa-solid fa-clock me-1" aria-hidden="true" />
                            {t('att.late')}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="mono fw-semibold">
                          {sub.result?.score != null ? sub.result.score : '—'}
                          {max != null && sub.result?.score != null && (
                            <span className="text-muted small fw-normal ms-1">/ {max}</span>
                          )}
                        </span>
                      </td>
                      <td className="text-end">
                        <Link
                          to={`/instructor/submissions/${sub._id}`}
                          className="btn btn-sm btn-egsa"
                        >
                          {sub.status === 'submitted' ? t('dash.grade') : t('common.view')}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {!filteredSubs.length && (
                  <tr>
                    <td colSpan={6} className="text-center py-4 text-muted">
                      No cadet submissions match the current filter.
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
