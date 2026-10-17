import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Col, Form, Modal, Row, Spinner } from 'react-bootstrap';
import { Avatar, PageHeader, Panel, StateView } from '../components/ui.jsx';
import useFetch from '../hooks/useFetch.js';
import { instructorApi } from '../services/instructor.js';
import { useI18n } from '../i18n/index.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { friendlyError } from '../utils/errors.js';
import s from './profile.module.css';

export default function ProfilePage() {
  const { t, setLang } = useI18n();
  const toast = useToast();
  const { user, setUser } = useAuth();
  const { data, loading, error, reload } = useFetch(() => instructorApi.profile());

  // Edit mode toggle
  const [isEditing, setIsEditing] = useState(false);

  // Form states
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  // Password state
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwErr, setPwErr] = useState(null);

  // Avatar upload modal & file state
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoErr, setPhotoErr] = useState(null);
  const fileInputRef = useRef(null);

  // Initialize or reset form values
  useEffect(() => {
    if (data) {
      setF({
        name: data.name || '',
        phone: data.phone || '',
        preferredLanguage: data.preferredLanguage || 'en',
        professional: {
          title: data.professional?.title || '',
          organization: data.professional?.organization || '',
          expertise: data.professional?.expertise || '',
        },
      });
    }
  }, [data]);

  // Clean up object preview URL
  useEffect(() => {
    return () => {
      if (photoPreview && photoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  // Track if changes were made
  const isDirty = useMemo(() => {
    if (!data || !f) return false;
    return (
      f.name !== (data.name || '') ||
      f.phone !== (data.phone || '') ||
      f.preferredLanguage !== (data.preferredLanguage || 'en') ||
      f.professional?.title !== (data.professional?.title || '') ||
      f.professional?.organization !== (data.professional?.organization || '') ||
      f.professional?.expertise !== (data.professional?.expertise || '')
    );
  }, [data, f]);

  const setP = (k) => (e) =>
    setF({ ...f, professional: { ...f.professional, [k]: e.target.value } });

  // Handle Cancel Edit
  const handleCancel = () => {
    if (isDirty) {
      if (!window.confirm(t('profile.cancelConfirm') || 'Discard unsaved profile changes?')) {
        return;
      }
    }
    // Restore original values
    if (data) {
      setF({
        name: data.name || '',
        phone: data.phone || '',
        preferredLanguage: data.preferredLanguage || 'en',
        professional: {
          title: data.professional?.title || '',
          organization: data.professional?.organization || '',
          expertise: data.professional?.expertise || '',
        },
      });
    }
    setErr(null);
    setIsEditing(false);
  };

  // Save profile changes
  const save = async (e) => {
    e.preventDefault();
    if (!f.name.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const u = await instructorApi.updateProfile(f);
      setUser(u);
      setLang(u.preferredLanguage);
      toast.success(t('profile.updated'));
      setIsEditing(false);
      reload();
    } catch (x) {
      setErr(friendlyError(x, t));
    } finally {
      setBusy(false);
    }
  };

  // Change password
  const changePw = async (e) => {
    e.preventDefault();
    setPwBusy(true);
    setPwErr(null);
    try {
      await instructorApi.changePassword(pw);
      toast.success(t('profile.pwUpdated'));
      setPw({ currentPassword: '', newPassword: '' });
    } catch (x) {
      setPwErr(friendlyError(x, t));
    } finally {
      setPwBusy(false);
    }
  };

  // Avatar file selection
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setPhotoErr('Supported image formats: JPG, PNG, WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoErr('Maximum photo size is 5MB.');
      return;
    }

    setPhotoErr(null);
    setPhotoFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPhotoPreview(objectUrl);
  };

  // Save new photo
  const savePhoto = async () => {
    if (!photoFile) return;
    setPhotoBusy(true);
    setPhotoErr(null);
    try {
      const formData = new FormData();
      formData.append('avatar', photoFile);
      const res = await instructorApi.uploadAvatar(formData);
      setUser(res.user);
      toast.success(t('profile.photoUploaded') || 'Profile photo updated successfully');
      setShowPhotoModal(false);
      setPhotoFile(null);
      setPhotoPreview(null);
      reload();
    } catch (x) {
      setPhotoErr(friendlyError(x, t));
    } finally {
      setPhotoBusy(false);
    }
  };

  // Delete photo
  const deletePhoto = async () => {
    if (!window.confirm('Are you sure you want to remove your profile photo?')) return;
    setPhotoBusy(true);
    setPhotoErr(null);
    try {
      const res = await instructorApi.deleteAvatar();
      setUser(res.user);
      toast.success(t('profile.photoRemoved') || 'Profile photo removed');
      setShowPhotoModal(false);
      reload();
    } catch (x) {
      toast.error(friendlyError(x, t));
    } finally {
      setPhotoBusy(false);
    }
  };

  // Copy helper
  const copyText = (val) => {
    if (!val) return;
    navigator.clipboard?.writeText(val);
    toast.success(t('profile.copied') || 'Copied to clipboard');
  };

  return (
    <div className={s.profileContainer}>
      <PageHeader
        eyebrow={t('nav.profile')}
        title={t('profile.title')}
        subtitle={t('profile.sub') || 'Manage your space academy credentials and flight-deck security settings.'}
        actions={
          data && !isEditing ? (
            <Button
              className="btn-egsa d-inline-flex align-items-center gap-1.5"
              onClick={() => setIsEditing(true)}
            >
              <i className="fa-solid fa-user-pen" aria-hidden="true" />
              <span>{t('profile.editProfile')}</span>
            </Button>
          ) : data && isEditing ? (
            <div className="d-flex align-items-center gap-2">
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={handleCancel}
                disabled={busy}
              >
                {t('profile.cancelEdit')}
              </Button>
              <Button
                className="btn-egsa"
                size="sm"
                type="submit"
                form="profile-form"
                disabled={busy || !f?.name?.trim()}
              >
                {busy && <Spinner size="sm" className="me-1.5" />}
                <i className="fa-solid fa-floppy-disk me-1.5" aria-hidden="true" />
                {t('profile.saveChanges')}
              </Button>
            </div>
          ) : null
        }
      />

      <StateView loading={loading} error={error} onRetry={reload}>
        {data && f && (
          <>
            {/* Premium Profile Header Card */}
            <div className={s.headerCard}>
              <div className={s.instructorIdentity}>
                <div className={s.avatarWrapper}>
                  <div className={s.avatarRing}>
                    <Avatar
                      user={{ ...data, avatarUrl: data.avatarUrl || user?.avatarUrl }}
                      size={88}
                    />
                  </div>
                  <button
                    type="button"
                    className={s.cameraTrigger}
                    onClick={() => {
                      setPhotoPreview(null);
                      setPhotoFile(null);
                      setPhotoErr(null);
                      setShowPhotoModal(true);
                    }}
                    title={t('profile.changePhoto') || 'Change profile photo'}
                    aria-label={t('profile.changePhoto') || 'Change profile photo'}
                  >
                    <i className="fa-solid fa-camera small" aria-hidden="true" />
                  </button>
                </div>

                <div className={s.identityMeta}>
                  <div className={s.statusPills}>
                    <span className={s.verifiedBadge}>
                      <i className="fa-solid fa-circle-check" aria-hidden="true" />
                      {t('profile.activeStatus') || 'Verified Instructor'}
                    </span>
                    <span className={s.roleBadge}>
                      {data.role || 'INSTRUCTOR'}
                    </span>
                  </div>

                  <h2 className={s.instructorName}>{data.name}</h2>
                  <p className={s.instructorHeadline}>
                    {data.professional?.title || 'Flight Deck Instructor'}
                    {data.professional?.organization ? ` • ${data.professional.organization}` : ' • Egyptian Space Agency'}
                  </p>

                  <div className={s.contactRow}>
                    <span className={s.contactItem}>
                      <i className="fa-solid fa-envelope text-muted" aria-hidden="true" />
                      <span className="mono">{data.email}</span>
                      <button
                        type="button"
                        className={s.detailCopyBtn}
                        onClick={() => copyText(data.email)}
                        title="Copy email address"
                      >
                        <i className="fa-solid fa-copy" aria-hidden="true" />
                      </button>
                    </span>
                    {data.phone && (
                      <span className={s.contactItem}>
                        <i className="fa-solid fa-phone text-muted" aria-hidden="true" />
                        <span className="mono">{data.phone}</span>
                        <button
                          type="button"
                          className={s.detailCopyBtn}
                          onClick={() => copyText(data.phone)}
                          title="Copy phone number"
                        >
                          <i className="fa-solid fa-copy" aria-hidden="true" />
                        </button>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className={s.headerActions}>
                <Button
                  size="sm"
                  variant="outline-secondary"
                  className="d-inline-flex align-items-center gap-1.5"
                  onClick={() => {
                    setPhotoPreview(null);
                    setPhotoFile(null);
                    setPhotoErr(null);
                    setShowPhotoModal(true);
                  }}
                >
                  <i className="fa-solid fa-image" aria-hidden="true" />
                  <span>{data.avatarUrl ? (t('profile.changePhoto') || 'Change Photo') : (t('profile.uploadPhoto') || 'Upload Photo')}</span>
                </Button>
                {data.avatarUrl && (
                  <Button
                    size="sm"
                    variant="outline-danger"
                    onClick={deletePhoto}
                    disabled={photoBusy}
                    title="Remove profile photo"
                  >
                    <i className="fa-solid fa-trash-can" aria-hidden="true" />
                  </Button>
                )}
                {!isEditing && (
                  <Button
                    size="sm"
                    className="btn-egsa d-inline-flex align-items-center gap-1.5 ms-1"
                    onClick={() => setIsEditing(true)}
                  >
                    <i className="fa-solid fa-pen-to-square" aria-hidden="true" />
                    <span>{t('profile.editProfile')}</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Main Content Layout */}
            <Row className="g-4">
              {/* Left Column: Personal & Professional Information */}
              <Col lg={7}>
                <div className={s.sectionCard}>
                  <div className={s.sectionHeader}>
                    <div className={s.sectionTitleGroup}>
                      <div className={s.sectionIcon}>
                        <i className="fa-solid fa-user" aria-hidden="true" />
                      </div>
                      <div>
                        <h3 className={s.sectionTitle}>{t('profile.personalInfo')}</h3>
                        <p className={s.sectionSubtitle}>{t('profile.personalDesc')}</p>
                      </div>
                    </div>
                    {isEditing && (
                      <span className="badge bg-warning-subtle text-warning border border-warning-subtle">
                        Editing Mode
                      </span>
                    )}
                  </div>

                  {err && <Alert variant="danger" role="alert" className="mb-3">{err}</Alert>}

                  {!isEditing ? (
                    // VIEW MODE: Clean structured presentation
                    <div className={s.detailsGrid}>
                      <div className={s.detailItem}>
                        <span className={s.detailLabel}>{t('common.name')}</span>
                        <span className={s.detailValue}>{data.name}</span>
                      </div>
                      <div className={s.detailItem}>
                        <span className={s.detailLabel}>{t('common.email')}</span>
                        <div className="d-flex align-items-center gap-1">
                          <span className={`${s.detailValue} mono`}>{data.email}</span>
                          <button
                            type="button"
                            className={s.detailCopyBtn}
                            onClick={() => copyText(data.email)}
                            title="Copy email"
                          >
                            <i className="fa-solid fa-copy" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                      <div className={s.detailItem}>
                        <span className={s.detailLabel}>{t('common.phone')}</span>
                        <span className={`${s.detailValue} mono`}>
                          {data.phone || '—'}
                          {data.phone && (
                            <button
                              type="button"
                              className={s.detailCopyBtn}
                              onClick={() => copyText(data.phone)}
                              title="Copy phone"
                            >
                              <i className="fa-solid fa-copy" aria-hidden="true" />
                            </button>
                          )}
                        </span>
                      </div>
                      <div className={s.detailItem}>
                        <span className={s.detailLabel}>{t('common.language')}</span>
                        <span className={s.detailValue}>
                          {data.preferredLanguage === 'ar' ? 'العربية (Arabic)' : 'English (US)'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    // EDIT MODE: Form inputs
                    <Form id="profile-form" onSubmit={save} noValidate>
                      <Row className="g-3">
                        <Col md={12}>
                          <div className="p-2.5 px-3 bg-light rounded border d-flex justify-content-between align-items-center mb-1">
                            <div>
                              <div className="text-muted small text-uppercase fw-semibold" style={{ fontSize: '0.72rem' }}>
                                {t('common.email')}
                              </div>
                              <div className="fw-semibold text-dark mono small">{data.email}</div>
                            </div>
                            <span className={s.readOnlyBadge}>{t('profile.readOnly')}</span>
                          </div>
                        </Col>

                        <Col md={6}>
                          <Form.Group controlId="p-name">
                            <Form.Label className={s.fieldLabel}>
                              <span>{t('common.name')} *</span>
                            </Form.Label>
                            <Form.Control
                              className={s.formControl}
                              value={f.name}
                              onChange={(e) => setF({ ...f, name: e.target.value })}
                              maxLength={120}
                              required
                              isInvalid={!f.name.trim()}
                            />
                            <Form.Control.Feedback type="invalid">
                              {t('common.required')}
                            </Form.Control.Feedback>
                          </Form.Group>
                        </Col>

                        <Col md={6}>
                          <Form.Group controlId="p-phone">
                            <Form.Label className={s.fieldLabel}>
                              <span>{t('common.phone')}</span>
                            </Form.Label>
                            <Form.Control
                              className={s.formControl}
                              value={f.phone}
                              onChange={(e) => setF({ ...f, phone: e.target.value })}
                              maxLength={30}
                              placeholder="+20 1xx xxx xxxx"
                            />
                          </Form.Group>
                        </Col>

                        <Col md={6}>
                          <Form.Group controlId="p-lang">
                            <Form.Label className={s.fieldLabel}>
                              <span>{t('common.language')}</span>
                            </Form.Label>
                            <Form.Select
                              className={s.formControl}
                              value={f.preferredLanguage}
                              onChange={(e) => setF({ ...f, preferredLanguage: e.target.value })}
                            >
                              <option value="en">English (US)</option>
                              <option value="ar">العربية (Arabic)</option>
                            </Form.Select>
                          </Form.Group>
                        </Col>

                        <Col md={6}>
                          <Form.Group controlId="p-role">
                            <Form.Label className={s.fieldLabel}>
                              <span>{t('profile.role')}</span>
                              <span className={s.readOnlyBadge}>{t('profile.readOnly')}</span>
                            </Form.Label>
                            <Form.Control
                              className={`${s.formControl} ${s.readOnlyField}`}
                              value={data.role?.toUpperCase()}
                              disabled
                              readOnly
                            />
                          </Form.Group>
                        </Col>
                      </Row>
                    </Form>
                  )}

                  {/* Professional Section */}
                  <div className="pt-4 mt-4 border-top">
                    <div className={s.sectionHeader}>
                      <div className={s.sectionTitleGroup}>
                        <div className={s.sectionIcon} style={{ background: 'rgba(2, 132, 199, 0.08)', color: '#0284c7' }}>
                          <i className="fa-solid fa-satellite" aria-hidden="true" />
                        </div>
                        <div>
                          <h3 className={s.sectionTitle}>{t('profile.info')}</h3>
                          <p className={s.sectionSubtitle}>{t('profile.professionalDesc')}</p>
                        </div>
                      </div>
                    </div>

                    {!isEditing ? (
                      // VIEW MODE: Professional details
                      <div className="d-flex flex-column gap-3">
                        <div className={s.detailsGrid}>
                          <div className={s.detailItem}>
                            <span className={s.detailLabel}>{t('profile.jobTitle')}</span>
                            <span className={s.detailValue}>{data.professional?.title || '—'}</span>
                          </div>
                          <div className={s.detailItem}>
                            <span className={s.detailLabel}>{t('profile.organization')}</span>
                            <span className={s.detailValue}>{data.professional?.organization || '—'}</span>
                          </div>
                        </div>

                        <div className={s.detailItem}>
                          <span className={s.detailLabel}>{t('profile.expertise')}</span>
                          <div className="p-3 bg-light rounded border small text-dark mt-1" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                            {data.professional?.expertise || <span className="text-muted fst-italic">No specialization details provided.</span>}
                          </div>
                        </div>
                      </div>
                    ) : (
                      // EDIT MODE: Professional inputs
                      <Row className="g-3">
                        <Col md={6}>
                          <Form.Group controlId="p-title">
                            <Form.Label className={s.fieldLabel}>{t('profile.jobTitle')}</Form.Label>
                            <Form.Control
                              form="profile-form"
                              className={s.formControl}
                              value={f.professional.title}
                              onChange={setP('title')}
                              maxLength={120}
                              placeholder="e.g. Senior Satellite Systems Specialist"
                            />
                          </Form.Group>
                        </Col>
                        <Col md={6}>
                          <Form.Group controlId="p-org">
                            <Form.Label className={s.fieldLabel}>{t('profile.organization')}</Form.Label>
                            <Form.Control
                              form="profile-form"
                              className={s.formControl}
                              value={f.professional.organization}
                              onChange={setP('organization')}
                              maxLength={160}
                              placeholder="e.g. Space Systems Engineering Division"
                            />
                          </Form.Group>
                        </Col>
                        <Col md={12}>
                          <Form.Group controlId="p-exp">
                            <Form.Label className={s.fieldLabel}>{t('profile.expertise')}</Form.Label>
                            <Form.Control
                              form="profile-form"
                              as="textarea"
                              rows={3}
                              className={s.formControl}
                              value={f.professional.expertise}
                              onChange={setP('expertise')}
                              maxLength={500}
                              placeholder="Specify your space domains, research concentrations, or training curriculum..."
                            />
                          </Form.Group>
                        </Col>
                      </Row>
                    )}
                  </div>

                  {/* Edit Mode Action Buttons */}
                  {isEditing && (
                    <div className="d-flex justify-content-end align-items-center gap-2 pt-4 mt-4 border-top">
                      <Button
                        variant="outline-secondary"
                        onClick={handleCancel}
                        disabled={busy}
                      >
                        {t('profile.cancelEdit')}
                      </Button>
                      <Button
                        type="submit"
                        form="profile-form"
                        className="btn-egsa"
                        disabled={busy || !f?.name?.trim()}
                      >
                        {busy && <Spinner size="sm" className="me-2" />}
                        <i className="fa-solid fa-floppy-disk me-1.5" aria-hidden="true" />
                        {t('profile.saveChanges')}
                      </Button>
                    </div>
                  )}
                </div>
              </Col>

              {/* Right Column: Account & Security */}
              <Col lg={5}>
                {/* Account & Institutional Access */}
                <div className={s.sectionCard}>
                  <div className={s.sectionHeader}>
                    <div className={s.sectionTitleGroup}>
                      <div className={s.sectionIcon} style={{ background: 'rgba(16, 185, 129, 0.08)', color: '#059669' }}>
                        <i className="fa-solid fa-id-badge" aria-hidden="true" />
                      </div>
                      <div>
                        <h3 className={s.sectionTitle}>{t('profile.accountInfo')}</h3>
                        <p className={s.sectionSubtitle}>{t('profile.accountDesc')}</p>
                      </div>
                    </div>
                  </div>

                  <div className="d-flex flex-column gap-2 mb-3">
                    <div className="p-2.5 px-3 bg-light rounded border d-flex justify-content-between align-items-center">
                      <span className="small text-muted">{t('profile.role')}</span>
                      <span className="badge bg-secondary-subtle text-secondary border fw-bold text-uppercase mono">
                        {data.role || 'INSTRUCTOR'}
                      </span>
                    </div>

                    <div className="p-2.5 px-3 bg-light rounded border d-flex justify-content-between align-items-center">
                      <span className="small text-muted">{t('profile.accountStatus')}</span>
                      <span className="badge bg-success-subtle text-success border fw-bold">
                        <i className="fa-solid fa-check me-1" aria-hidden="true" />
                        {t('profile.activeStatus')}
                      </span>
                    </div>

                    <div className="p-2.5 px-3 bg-light rounded border d-flex justify-content-between align-items-center">
                      <span className="small text-muted">Institutional Agency</span>
                      <span className="small fw-semibold text-dark">
                        Egyptian Space Agency (EgSA)
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-light rounded border small text-muted">
                    <div className="d-flex align-items-start gap-2">
                      <i className="fa-solid fa-shield-halved text-primary mt-1" aria-hidden="true" />
                      <span>
                        Your authenticated profile grants verified instructor access to publish flight training assessments, evaluate cadet coursework, and log classroom session attendance across your assigned academy cohorts.
                      </span>
                    </div>
                  </div>
                </div>

                {/* Password & Security Card */}
                <div className={`${s.sectionCard} mt-4`}>
                  <div className={s.sectionHeader}>
                    <div className={s.sectionTitleGroup}>
                      <div className={s.sectionIcon} style={{ background: 'rgba(217, 119, 6, 0.08)', color: '#d97706' }}>
                        <i className="fa-solid fa-key" aria-hidden="true" />
                      </div>
                      <div>
                        <h3 className={s.sectionTitle}>{t('profile.changePassword')}</h3>
                        <p className={s.sectionSubtitle}>{t('profile.security')}</p>
                      </div>
                    </div>
                  </div>

                  {pwErr && <Alert variant="danger" role="alert" className="mb-3">{pwErr}</Alert>}

                  <Form onSubmit={changePw}>
                    <Form.Group className="mb-3" controlId="pw-cur">
                      <Form.Label className={s.fieldLabel}>{t('profile.current')}</Form.Label>
                      <Form.Control
                        type="password"
                        className={s.formControl}
                        autoComplete="current-password"
                        required
                        value={pw.currentPassword}
                        onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })}
                        placeholder="••••••••••••"
                      />
                    </Form.Group>

                    <Form.Group className="mb-3" controlId="pw-new">
                      <Form.Label className={s.fieldLabel}>{t('auth.newPassword')}</Form.Label>
                      <Form.Control
                        type="password"
                        className={s.formControl}
                        autoComplete="new-password"
                        required
                        minLength={8}
                        value={pw.newPassword}
                        onChange={(e) => setPw({ ...pw, newPassword: e.target.value })}
                        placeholder="••••••••••••"
                      />
                      <div className={s.pwGuidance}>
                        <i className="fa-solid fa-circle-info" aria-hidden="true" />
                        <span>{t('auth.passwordHint')}</span>
                      </div>
                    </Form.Group>

                    <Button
                      type="submit"
                      variant="outline-dark"
                      className="w-100 mt-2 d-inline-flex align-items-center justify-content-center gap-1.5"
                      disabled={pwBusy || !pw.currentPassword || !pw.newPassword}
                    >
                      {pwBusy ? <Spinner size="sm" className="me-2" /> : <i className="fa-solid fa-lock" aria-hidden="true" />}
                      <span>{t('profile.changePassword')}</span>
                    </Button>
                  </Form>
                </div>
              </Col>
            </Row>

            {/* Profile Photo Upload Modal */}
            <Modal
              show={showPhotoModal}
              onHide={() => setShowPhotoModal(false)}
              centered
              backdrop="static"
            >
              <Modal.Header closeButton>
                <Modal.Title className="h5 fw-bold text-dark d-flex align-items-center gap-2">
                  <i className="fa-solid fa-camera text-primary" aria-hidden="true" />
                  <span>{t('profile.uploadPhoto') || 'Profile Photo Management'}</span>
                </Modal.Title>
              </Modal.Header>
              <Modal.Body className={s.avatarModalBody}>
                {photoErr && (
                  <Alert variant="danger" className="w-100 text-start py-2">
                    {photoErr}
                  </Alert>
                )}

                <div className={s.previewCircle}>
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" className={s.previewImage} />
                  ) : (
                    <Avatar
                      user={{ ...data, avatarUrl: data.avatarUrl || user?.avatarUrl }}
                      size={124}
                    />
                  )}
                </div>

                <div
                  className={s.dropArea}
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="d-none"
                    onChange={handlePhotoSelect}
                  />
                  <i className="fa-solid fa-cloud-arrow-up fa-2x text-muted mb-2" aria-hidden="true" />
                  <p className="fw-semibold mb-1 text-dark">
                    {photoFile ? photoFile.name : 'Click to select profile photo'}
                  </p>
                  <p className="small text-muted mb-0">
                    {t('profile.photoHelp')}
                  </p>
                </div>

                {data.avatarUrl && (
                  <Button
                    variant="outline-danger"
                    size="sm"
                    className="mt-1"
                    onClick={deletePhoto}
                    disabled={photoBusy}
                  >
                    <i className="fa-solid fa-trash-can me-1.5" aria-hidden="true" />
                    {t('profile.removePhoto')}
                  </Button>
                )}
              </Modal.Body>
              <Modal.Footer>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => setShowPhotoModal(false)}
                  disabled={photoBusy}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  className="btn-egsa"
                  size="sm"
                  onClick={savePhoto}
                  disabled={!photoFile || photoBusy}
                >
                  {photoBusy && <Spinner size="sm" className="me-2" />}
                  {t('common.save')}
                </Button>
              </Modal.Footer>
            </Modal>
          </>
        )}
      </StateView>
    </div>
  );
}
