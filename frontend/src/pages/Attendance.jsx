import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, Button, Col, Form, Modal, Row, Spinner, Table } from 'react-bootstrap';
import { AttendanceBar, Avatar, ConfirmModal, PageHeader, Panel, StateView, StatusBadge, styles as s } from '../components/ui.jsx';
import { pctText, useSessionLabel } from '../components/tables.jsx';
import useFetch from '../hooks/useFetch.js';
import { instructorApi } from '../services/instructor.js';
import { useI18n } from '../i18n/index.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { friendlyError } from '../utils/errors.js';
import { generateQrMatrix } from '../utils/qr.js';
import attStyles from './attendance.module.css';

// SVG QR Code Renderer
function QrSvg({ value, size = 220 }) {
  const qr = useMemo(() => {
    try {
      return generateQrMatrix(value);
    } catch {
      return null;
    }
  }, [value]);

  if (!qr) return <div className="text-muted small">QR rendering error</div>;

  const count = qr.size;
  const cellSize = size / count;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ shapeRendering: 'crispEdges' }}>
      <rect width={size} height={size} fill="#ffffff" />
      {qr.modules.map((row, r) =>
        row.map((isDark, c) => {
          if (!isDark) return null;
          return (
            <rect
              key={`${r}-${c}`}
              x={c * cellSize}
              y={r * cellSize}
              width={cellSize}
              height={cellSize}
              fill="#0e1a22"
            />
          );
        })
      )}
    </svg>
  );
}

function SessionRoster({ sessionId, sessionMeta, onShowQr }) {
  const { t } = useI18n();
  const toast = useToast();
  const { data, loading, error, reload } = useFetch(() => instructorApi.roster(sessionId), [sessionId]);

  // Local state for edits
  const [localStatuses, setLocalStatuses] = useState({});
  const [localNotes, setLocalNotes] = useState({});
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Note Modal state
  const [editingNoteStudent, setEditingNoteStudent] = useState(null);
  const [tempNote, setTempNote] = useState('');

  // Bulk confirmation modal
  const [bulkModal, setBulkModal] = useState({ show: false, action: null, title: '', body: '' });

  useEffect(() => {
    if (data?.roster) {
      const statuses = {};
      const notes = {};
      data.roster.forEach((r) => {
        const id = r.student._id;
        // determine current active key: 'present', 'late', 'absent', 'excused', 'pending'
        let current = r.status;
        if (r.status === 'present' && (r.isLate || r.subStatus === 'late')) current = 'late';
        if (r.status === 'absent' && (r.excused || r.subStatus === 'excused')) current = 'excused';
        statuses[id] = current;
        notes[id] = r.notes || '';
      });
      setLocalStatuses(statuses);
      setLocalNotes(notes);
    }
  }, [data]);

  const cancelled = data?.session?.status === 'cancelled';

  // Check if modified
  const isDirty = useMemo(() => {
    if (!data?.roster) return false;
    return data.roster.some((r) => {
      const id = r.student._id;
      let orig = r.status;
      if (r.status === 'present' && (r.isLate || r.subStatus === 'late')) orig = 'late';
      if (r.status === 'absent' && (r.excused || r.subStatus === 'excused')) orig = 'excused';
      return localStatuses[id] !== orig || (localNotes[id] || '') !== (r.notes || '');
    });
  }, [data, localStatuses, localNotes]);

  // Statistics calculation
  const stats = useMemo(() => {
    if (!data?.roster) return { total: 0, present: 0, late: 0, absent: 0, excused: 0, pending: 0, qrVerified: 0, qrPending: 0 };
    let total = data.roster.length;
    let present = 0, late = 0, absent = 0, excused = 0, pending = 0;
    let qrVerified = 0, qrPending = 0;

    data.roster.forEach((r) => {
      const st = localStatuses[r.student._id] || r.status;
      if (st === 'present') present++;
      else if (st === 'late') late++;
      else if (st === 'absent') absent++;
      else if (st === 'excused') excused++;
      else pending++;

      if (r.qrCheckIn?.timestamp) {
        if (st === 'present' || st === 'late') qrVerified++;
        else qrPending++;
      }
    });

    return { total, present, late, absent, excused, pending, qrVerified, qrPending };
  }, [data, localStatuses]);

  // Save changes
  const handleSave = async () => {
    setBusy(true);
    try {
      const records = data.roster.map((r) => {
        const id = r.student._id;
        const current = localStatuses[id] || r.status;
        let baseStatus = 'present';
        let subStatus = 'none';
        let isLate = false;
        let excused = false;

        if (current === 'late') {
          baseStatus = 'present';
          subStatus = 'late';
          isLate = true;
        } else if (current === 'absent') {
          baseStatus = 'absent';
          subStatus = 'none';
        } else if (current === 'excused') {
          baseStatus = 'absent';
          subStatus = 'excused';
          excused = true;
        } else if (current === 'pending') {
          baseStatus = 'pending';
          subStatus = 'none';
        }

        return {
          studentId: id,
          status: baseStatus,
          subStatus,
          isLate,
          excused,
          notes: localNotes[id] || '',
          source: r.qrCheckIn?.timestamp ? 'qr_verified' : 'instructor_manual'
        };
      });

      await instructorApi.saveAttendance(sessionId, records);
      toast.success(t('att.saveSuccess') || t('common.saved'));
      reload();
    } catch (err) {
      toast.error(friendlyError(err, t));
    } finally {
      setBusy(false);
    }
  };

  // Bulk actions
  const applyBulkVerifyQr = () => {
    if (!data?.roster) return;
    const updated = { ...localStatuses };
    data.roster.forEach((r) => {
      if (r.qrCheckIn?.timestamp && (updated[r.student._id] === 'pending' || !updated[r.student._id])) {
        updated[r.student._id] = 'present';
      }
    });
    setLocalStatuses(updated);
    setBulkModal({ show: false, action: null });
    toast.success('Verified all scanned QR check-ins as Present.');
  };

  const applyBulkMarkAbsent = () => {
    if (!data?.roster) return;
    const updated = { ...localStatuses };
    data.roster.forEach((r) => {
      if (updated[r.student._id] === 'pending' || !updated[r.student._id]) {
        updated[r.student._id] = 'absent';
      }
    });
    setLocalStatuses(updated);
    setBulkModal({ show: false, action: null });
    toast.success('Marked all unrecorded students as Absent.');
  };

  const applyBulkMarkPresent = () => {
    if (!data?.roster) return;
    const updated = { ...localStatuses };
    data.roster.forEach((r) => {
      updated[r.student._id] = 'present';
    });
    setLocalStatuses(updated);
    setBulkModal({ show: false, action: null });
    toast.success('Marked all students as Present.');
  };

  // Open note modal
  const openNoteModal = (student) => {
    setEditingNoteStudent(student);
    setTempNote(localNotes[student._id] || '');
  };

  const saveNoteModal = () => {
    if (editingNoteStudent) {
      setLocalNotes({ ...localNotes, [editingNoteStudent._id]: tempNote });
    }
    setEditingNoteStudent(null);
  };

  // Filtered Roster
  const filteredRoster = useMemo(() => {
    if (!data?.roster) return [];
    return data.roster.filter((r) => {
      const q = search.trim().toLowerCase();
      if (q) {
        const name = (r.student.name || '').toLowerCase();
        const email = (r.student.email || '').toLowerCase();
        const code = (r.student.externalStudentId || '').toLowerCase();
        if (!name.includes(q) && !email.includes(q) && !code.includes(q)) return false;
      }

      const st = localStatuses[r.student._id] || r.status;
      if (filter === 'all') return true;
      if (filter === 'qr_awaiting') return r.qrCheckIn?.timestamp && st === 'pending';
      if (filter === 'no_qr') return !r.qrCheckIn?.timestamp;
      if (filter === 'present') return st === 'present';
      if (filter === 'late') return st === 'late';
      if (filter === 'absent') return st === 'absent';
      if (filter === 'excused') return st === 'excused';
      if (filter === 'pending') return st === 'pending';
      return true;
    });
  }, [data, localStatuses, search, filter]);

  return (
    <StateView loading={loading} error={error} onRetry={reload} empty={data && !data.roster.length} emptyText={t('att.noRoster')}>
      {data && (
        <>
          {/* Real Session Metric Stats */}
          <div className={attStyles.statsGrid}>
            <div className={attStyles.statCard}>
              <span className={attStyles.statNumber}>{stats.total}</span>
              <span className={attStyles.statLabel}>{t('att.enrolledStudents') || 'Enrolled'}</span>
            </div>
            <div className={attStyles.statCard}>
              <span className={attStyles.statNumber} style={{ color: '#059669' }}>{stats.present}</span>
              <span className={attStyles.statLabel}>{t('status.present')}</span>
            </div>
            <div className={attStyles.statCard}>
              <span className={attStyles.statNumber} style={{ color: '#d97706' }}>{stats.late}</span>
              <span className={attStyles.statLabel}>{t('att.late')}</span>
            </div>
            <div className={attStyles.statCard}>
              <span className={attStyles.statNumber} style={{ color: '#dc2626' }}>{stats.absent}</span>
              <span className={attStyles.statLabel}>{t('status.absent')}</span>
            </div>
            <div className={attStyles.statCard}>
              <span className={attStyles.statNumber} style={{ color: '#0284c7' }}>{stats.excused}</span>
              <span className={attStyles.statLabel}>{t('att.excused')}</span>
            </div>
            <div className={attStyles.statCard}>
              <span className={attStyles.statNumber} style={{ color: stats.pending > 0 ? '#b45309' : '#64748b' }}>{stats.pending}</span>
              <span className={attStyles.statLabel}>{t('att.pendingStatus') || 'Unrecorded'}</span>
            </div>
          </div>

          <Panel
            title={`${t('att.roster')} · ${data.session.title}`}
            flush
            actions={
              !cancelled && (
                <div className="d-flex align-items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline-primary"
                    onClick={onShowQr}
                    className="d-inline-flex align-items-center gap-1.5"
                  >
                    <i className="fa-solid fa-qrcode" aria-hidden="true" />
                    <span>{t('att.showQr')}</span>
                  </Button>
                  <Button
                    size="sm"
                    className="btn-egsa"
                    disabled={!isDirty || busy}
                    onClick={handleSave}
                  >
                    {busy && <Spinner size="sm" className="me-1.5" />}
                    <i className="fa-solid fa-check-double me-1.5" aria-hidden="true" />
                    {t('att.saveAtt')}
                  </Button>
                </div>
              )
            }
          >
            {cancelled && <Alert variant="warning" className="m-3">{t('att.cancelledNote')}</Alert>}

            {/* Filter and Bulk Action Toolbar */}
            {!cancelled && (
              <div className={attStyles.toolbar}>
                <div className="d-flex flex-wrap align-items-center gap-3">
                  <div className="position-relative" style={{ minWidth: 220 }}>
                    <i className="fa-solid fa-magnifying-glass position-absolute text-muted" style={{ left: 10, top: 9 }} aria-hidden="true" />
                    <Form.Control
                      size="sm"
                      type="search"
                      placeholder={t('common.search')}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      style={{ paddingLeft: '1.9rem', borderRadius: 9999 }}
                    />
                  </div>

                  <div className={attStyles.filterPills}>
                    {[
                      { key: 'all', label: t('common.all'), count: stats.total },
                      { key: 'qr_awaiting', label: t('att.filterQrPending'), count: stats.qrPending },
                      { key: 'present', label: t('status.present'), count: stats.present },
                      { key: 'late', label: t('att.late'), count: stats.late },
                      { key: 'excused', label: t('att.excused'), count: stats.excused },
                      { key: 'absent', label: t('status.absent'), count: stats.absent },
                      { key: 'pending', label: t('att.pendingStatus'), count: stats.pending },
                    ].map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        className={`${attStyles.filterBtn} ${filter === f.key ? attStyles.filterBtnActive : ''}`}
                        onClick={() => setFilter(f.key)}
                      >
                        {f.label} <span className="opacity-75">({f.count})</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bulk Actions Dropdown / Quick Buttons */}
                <div className={attStyles.bulkActions}>
                  {stats.qrPending > 0 && (
                    <Button
                      size="sm"
                      variant="outline-success"
                      onClick={() => setBulkModal({
                        show: true,
                        action: applyBulkVerifyQr,
                        title: t('att.verifyAllQr'),
                        body: 'Are you sure you want to verify all scanned QR check-ins as Present?'
                      })}
                    >
                      <i className="fa-solid fa-check me-1" aria-hidden="true" />
                      {t('att.verifyAllQr')}
                    </Button>
                  )}
                  {stats.pending > 0 && (
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      onClick={() => setBulkModal({
                        show: true,
                        action: applyBulkMarkAbsent,
                        title: t('att.markUnrecordedAbsent'),
                        body: 'Are you sure you want to mark all remaining unrecorded students as Absent?'
                      })}
                    >
                      {t('att.markUnrecordedAbsent')}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Roster Table */}
            <div className={s.tableWrap}>
              <Table hover className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th style={{ width: 44 }}></th>
                    <th>{t('common.student')}</th>
                    <th>{t('att.qrCheckIn')}</th>
                    <th>{t('common.status')}</th>
                    <th>{t('att.notes')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRoster.map((r) => {
                    const id = r.student._id;
                    const activeStatus = localStatuses[id] || r.status;
                    const hasNote = Boolean(localNotes[id]);
                    const qr = r.qrCheckIn;

                    return (
                      <tr key={id}>
                        <td>
                          <Avatar user={r.student} size={34} />
                        </td>
                        <td>
                          <div className="fw-semibold text-dark">{r.student.name}</div>
                          <div className="small text-muted mono">
                            {r.student.email}
                            {r.student.externalStudentId ? ` · ID: ${r.student.externalStudentId}` : ''}
                          </div>
                        </td>
                        <td>
                          {qr?.timestamp ? (
                            <div className="d-flex flex-column align-items-start gap-1">
                              <span className={`${attStyles.qrBadge} ${r.verified ? attStyles.qrBadgeVerified : attStyles.qrBadgeAwaiting}`}>
                                <i className="fa-solid fa-qrcode" aria-hidden="true" />
                                <span>
                                  {r.verified ? t('att.qrVerified') : t('att.qrAwaiting')} (
                                  {new Date(qr.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                                </span>
                              </span>
                              {qr.deviceInfo?.ip && (
                                <span className="small text-muted mono" style={{ fontSize: '0.7rem' }}>
                                  IP: {qr.deviceInfo.ip}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className={`${attStyles.qrBadge} ${attStyles.qrBadgeNone}`}>
                              <i className="fa-solid fa-minus" aria-hidden="true" />
                              <span>{t('att.noQr')}</span>
                            </span>
                          )}
                        </td>
                        <td>
                          {cancelled ? (
                            <StatusBadge value={r.status} />
                          ) : (
                            <div className={attStyles.statusGroup} role="group" aria-label={r.student.name}>
                              <button
                                type="button"
                                className={`${attStyles.statusBtn} ${activeStatus === 'present' ? attStyles.activePresent : ''}`}
                                onClick={() => setLocalStatuses({ ...localStatuses, [id]: 'present' })}
                                title="Mark Present"
                              >
                                <i className="fa-solid fa-check" aria-hidden="true" />
                                <span>{t('status.present')}</span>
                              </button>
                              <button
                                type="button"
                                className={`${attStyles.statusBtn} ${activeStatus === 'late' ? attStyles.activeLate : ''}`}
                                onClick={() => setLocalStatuses({ ...localStatuses, [id]: 'late' })}
                                title="Mark Late"
                              >
                                <i className="fa-solid fa-clock" aria-hidden="true" />
                                <span>{t('att.late')}</span>
                              </button>
                              <button
                                type="button"
                                className={`${attStyles.statusBtn} ${activeStatus === 'absent' ? attStyles.activeAbsent : ''}`}
                                onClick={() => setLocalStatuses({ ...localStatuses, [id]: 'absent' })}
                                title="Mark Absent"
                              >
                                <i className="fa-solid fa-xmark" aria-hidden="true" />
                                <span>{t('status.absent')}</span>
                              </button>
                              <button
                                type="button"
                                className={`${attStyles.statusBtn} ${activeStatus === 'excused' ? attStyles.activeExcused : ''}`}
                                onClick={() => {
                                  setLocalStatuses({ ...localStatuses, [id]: 'excused' });
                                  if (!localNotes[id]) openNoteModal(r.student);
                                }}
                                title="Mark Excused Absence"
                              >
                                <i className="fa-solid fa-shield-halved" aria-hidden="true" />
                                <span>{t('att.excused')}</span>
                              </button>
                            </div>
                          )}
                        </td>
                        <td>
                          <button
                            type="button"
                            className={`${attStyles.noteBtn} ${hasNote ? attStyles.noteBtnHasNote : ''}`}
                            onClick={() => openNoteModal(r.student)}
                            title="Add or edit reason / notes"
                          >
                            <i className={`fa-solid ${hasNote ? 'fa-sticky-note' : 'fa-pen-to-square'}`} aria-hidden="true" />
                            <span>{hasNote ? localNotes[id] : t('att.addNote')}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {!filteredRoster.length && (
                    <tr>
                      <td colSpan={5} className="text-center py-4 text-muted">
                        No students match the current filter or search query.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </div>
          </Panel>

          {/* Note / Reason Modal */}
          <Modal show={Boolean(editingNoteStudent)} onHide={() => setEditingNoteStudent(null)} centered>
            <Modal.Header closeButton>
              <Modal.Title as="h2" className="h6 mb-0">
                {t('att.noteModalTitle')} · {editingNoteStudent?.name}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <p className="small text-muted mb-2">{t('att.noteModalDesc')}</p>
              <Form.Group className="mb-3">
                <Form.Label className="small fw-semibold">{t('att.noteLabel')}</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  placeholder={t('att.notePlaceholder')}
                  value={tempNote}
                  onChange={(e) => setTempNote(e.target.value)}
                />
              </Form.Group>
              <div className="d-flex flex-wrap gap-1.5">
                {[
                  'Medical Certificate',
                  'Official Agency Mission',
                  'Transport Delay',
                  'Academic Exemption',
                  'Family Emergency',
                ].map((tag) => (
                  <Button
                    key={tag}
                    size="sm"
                    variant="outline-secondary"
                    className="py-0 px-2"
                    style={{ fontSize: '0.72rem' }}
                    onClick={() => setTempNote((prev) => (prev ? `${prev}; ${tag}` : tag))}
                  >
                    + {tag}
                  </Button>
                ))}
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="outline-secondary" size="sm" onClick={() => setEditingNoteStudent(null)}>
                {t('common.cancel')}
              </Button>
              <Button variant="primary" size="sm" className="btn-egsa" onClick={saveNoteModal}>
                {t('common.save')}
              </Button>
            </Modal.Footer>
          </Modal>

          {/* Bulk Confirmation Modal */}
          <ConfirmModal
            show={bulkModal.show}
            title={bulkModal.title}
            body={bulkModal.body}
            variant="primary"
            onConfirm={bulkModal.action}
            onCancel={() => setBulkModal({ show: false, action: null })}
          />
        </>
      )}
    </StateView>
  );
}

export default function AttendancePage() {
  const { t } = useI18n();
  const label = useSessionLabel();
  const [sp, setSp] = useSearchParams();
  const [courseId, setCourseId] = useState('');
  const [cohortId, setCohortId] = useState('');
  const sessionId = sp.get('sessionId') || '';

  const [showQrModal, setShowQrModal] = useState(false);

  const cohorts = useFetch(() => instructorApi.cohorts());
  const preSession = useFetch(() => instructorApi.session(sessionId), [sessionId], {
    enabled: Boolean(sessionId && !cohortId),
  });

  useEffect(() => {
    if (preSession.data && cohorts.data) {
      const c = cohorts.data.find((x) => x._id === preSession.data.cohort?._id);
      if (c) {
        setCohortId(c._id);
        setCourseId(c.course?._id);
      }
    }
  }, [preSession.data, cohorts.data]);

  const courses = useMemo(() => {
    const m = new Map();
    (cohorts.data || []).forEach((c) => c.course && m.set(c.course._id, c.course));
    return [...m.values()];
  }, [cohorts.data]);

  const cohortOpts = (cohorts.data || []).filter((c) => !courseId || c.course?._id === courseId);
  const sessions = useFetch(() => instructorApi.sessions({ cohortId, limit: 100 }), [cohortId], {
    enabled: Boolean(cohortId),
  });
  const summary = useFetch(() => instructorApi.attendanceSummary(cohortId), [cohortId, sessionId], {
    enabled: Boolean(cohortId),
  });

  const sessionList = (sessions.data || []).slice().sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  const selectedSession = sessionList.find((x) => x._id === sessionId);

  // Generate QR check-in payload for the session
  const qrPayload = useMemo(() => {
    if (!sessionId) return '';
    return JSON.stringify({
      type: 'EGSA_ATTENDANCE',
      sessionId,
      cohortId,
      ts: Date.now(),
    });
  }, [sessionId, cohortId]);

  return (
    <>
      <PageHeader
        eyebrow={t('nav.attendance')}
        title={t('att.title')}
        subtitle="Review student QR check-ins, record lateness or excused absences, and finalize attendance records."
        actions={
          sessionId && selectedSession ? (
            <Button
              className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1.5"
              onClick={() => setShowQrModal(true)}
            >
              <i className="fa-solid fa-qrcode" aria-hidden="true" />
              <span>{t('att.showQr')}</span>
            </Button>
          ) : null
        }
      />

      <StateView loading={cohorts.loading} error={cohorts.error} onRetry={cohorts.reload} empty={cohorts.data && !cohorts.data.length} emptyText={t('cohorts.empty')}>
        <Panel className="mb-3">
          <Row className="g-2">
            <Col md={4}>
              <Form.Label htmlFor="a-course" className="small fw-semibold">{t('att.selectCourse')}</Form.Label>
              <Form.Select
                id="a-course"
                value={courseId}
                onChange={(e) => {
                  setCourseId(e.target.value);
                  setCohortId('');
                  setSp({});
                }}
              >
                <option value="">{t('common.select')}</option>
                {courses.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </Form.Select>
            </Col>
            <Col md={4}>
              <Form.Label htmlFor="a-cohort" className="small fw-semibold">{t('att.selectCohort')}</Form.Label>
              <Form.Select
                id="a-cohort"
                value={cohortId}
                disabled={!courseId}
                onChange={(e) => {
                  setCohortId(e.target.value);
                  setSp({});
                }}
              >
                <option value="">{t('common.select')}</option>
                {cohortOpts.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </Form.Select>
            </Col>
            <Col md={4}>
              <Form.Label htmlFor="a-session" className="small fw-semibold">{t('att.selectSession')}</Form.Label>
              <Form.Select
                id="a-session"
                value={sessionId}
                disabled={!cohortId}
                onChange={(e) => setSp(e.target.value ? { sessionId: e.target.value } : {})}
              >
                <option value="">{t('common.select')}</option>
                {sessionList.map((x) => (
                  <option key={x._id} value={x._id}>
                    {x.title} — {label(x)} ({t(`status.${x.status}`)})
                  </option>
                ))}
              </Form.Select>
            </Col>
          </Row>
        </Panel>

        {sessionId ? (
          <SessionRoster
            key={sessionId}
            sessionId={sessionId}
            sessionMeta={selectedSession}
            onShowQr={() => setShowQrModal(true)}
          />
        ) : (
          <Panel>
            <div className="text-muted text-center py-4">
              <i className="fa-solid fa-calendar-check fa-2x mb-2 text-secondary opacity-50" aria-hidden="true" />
              <div>{t('att.pick')}</div>
            </div>
          </Panel>
        )}

        {/* Cohort Summary Records */}
        {cohortId && (
          <div className="mt-4">
            <Panel title={t('att.summary')} flush>
              <StateView loading={summary.loading} error={summary.error} onRetry={summary.reload} empty={summary.data && !summary.data.length} emptyText={t('att.noRoster')}>
                {summary.data && (
                  <>
                    <div className={s.tableWrap}>
                      <Table hover className="mb-0 align-middle">
                        <thead>
                          <tr>
                            <th>{t('common.student')}</th>
                            <th>{t('att.total')}</th>
                            <th>{t('att.present')}</th>
                            <th>{t('att.late')}</th>
                            <th>{t('att.excused')}</th>
                            <th>{t('att.absent')}</th>
                            <th>{t('att.pending')}</th>
                            <th>{t('att.percent')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summary.data.map((r) => (
                            <tr key={r.student._id}>
                              <td className="fw-semibold text-dark">{r.student.name}</td>
                              <td className="mono">{r.totalSessions}</td>
                              <td className="mono text-success">{r.present}</td>
                              <td className="mono text-warning">{r.late || 0}</td>
                              <td className="mono text-info">{r.excused || 0}</td>
                              <td className="mono text-danger">{r.absent}</td>
                              <td className="mono text-muted">{r.pending}</td>
                              <td style={{ minWidth: 160 }}>
                                <AttendanceBar
                                  present={r.present}
                                  late={r.late || 0}
                                  excused={r.excused || 0}
                                  absent={r.absent}
                                  pending={r.pending}
                                />
                                <span className="mono small">{pctText(r.attendancePercentage)}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </div>
                    <div className="small text-muted p-3">
                      {t('att.percentNote')} (Attended includes confirmed present and late arrivals; approved excused absences do not penalize student standing).
                    </div>
                  </>
                )}
              </StateView>
            </Panel>
          </div>
        )}
      </StateView>

      {/* Classroom QR Code Projection Modal */}
      <Modal show={showQrModal} onHide={() => setShowQrModal(false)} size="md" centered>
        <Modal.Header closeButton>
          <Modal.Title as="h2" className="h5 mb-0 d-flex align-items-center gap-2">
            <i className="fa-solid fa-qrcode text-primary" aria-hidden="true" />
            <span>{t('att.qrModalTitle')}</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4 text-center">
          <div className={attStyles.qrCard}>
            <div className="d-flex align-items-center justify-content-center gap-2 mb-2">
              <span className="badge bg-primary text-uppercase" style={{ letterSpacing: '0.05em' }}>
                EGSA Space Academy
              </span>
              <span className="badge bg-secondary text-uppercase">Flight Session Check-In</span>
            </div>
            <h5 className="fw-bold mb-1">{selectedSession?.title}</h5>
            <div className="small text-muted mb-3">
              {selectedSession && label(selectedSession)}
            </div>

            <div className={attStyles.qrMatrixWrap}>
              <QrSvg value={qrPayload} size={210} />
            </div>

            <div className="small text-muted mt-2">
              <i className="fa-solid fa-satellite-dish me-1" aria-hidden="true" />
              {t('att.qrModalSub')}
            </div>
            <div className="mono small text-secondary mt-1" style={{ fontSize: '0.75rem' }}>
              Session ID: {sessionId}
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button size="sm" variant="secondary" onClick={() => setShowQrModal(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            size="sm"
            className="btn-egsa"
            onClick={() => {
              navigator.clipboard?.writeText(sessionId);
              toast.success('Session ID copied for manual check-in verification.');
            }}
          >
            <i className="fa-solid fa-copy me-1.5" aria-hidden="true" />
            Copy Session ID
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
