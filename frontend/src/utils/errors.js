// Never show raw backend errors. Map to translated, user-safe messages.
export function friendlyError(e, t) {
  if (!e) return null;
  if (e.status === 400 || e.status === 422 || e.status === 409) {
    const d = Array.isArray(e.details) && e.details.length ? e.details.map((x) => x.message).join(' · ') : null;
    return d || e.message || t('common.error');
  }
  if (e.status === 401) return t('common.unauthorized');
  if (e.status === 403) return t('common.forbidden');
  if (e.status === 404) return t('common.notFoundMsg');
  return t('common.error');
}
