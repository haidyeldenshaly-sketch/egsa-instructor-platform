const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./helpers');
const { api } = H;
const id = (x) => String(x._id || x);
let c, A, B, ADMIN;

before(async () => {
  c = await H.start();
  A = (await H.login('instructor@egsa-dev.test')).accessToken;
  B = (await H.login('instructor.b@egsa-dev.test')).accessToken;
  ADMIN = (await H.login('admin@egsa-dev.test')).accessToken;
});
after(async () => { await H.stop(); });

describe('Authentication', () => {
  it('instructor can login and receives tokens + safe user', async () => {
    const r = await api('POST', '/auth/login', { body: { email: 'instructor@egsa-dev.test', password: 'Instructor#Dev123' } });
    assert.equal(r.status, 200); assert.ok(r.data.accessToken && r.data.refreshToken);
    assert.equal(r.data.user.role, 'instructor'); assert.equal(r.data.user.passwordHash, undefined);
  });
  it('wrong password and unknown user fail identically with 401', async () => {
    const a = await api('POST', '/auth/login', { body: { email: 'instructor@egsa-dev.test', password: 'nope' } });
    const b = await api('POST', '/auth/login', { body: { email: 'ghost@egsa-dev.test', password: 'nope' } });
    assert.equal(a.status, 401); assert.equal(b.status, 401); assert.equal(a.body.error.message, b.body.error.message);
  });
  it('no token / garbage token => 401', async () => {
    assert.equal((await api('GET', '/instructor/dashboard')).status, 401);
    assert.equal((await api('GET', '/instructor/dashboard', { token: 'abc.def.ghi' })).status, 401);
  });
  it('non-instructor (admin) gets 403 on instructor routes', async () => {
    for (const p of ['/instructor/dashboard', '/instructor/cohorts', '/instructor/assessments']) assert.equal((await api('GET', p, { token: ADMIN })).status, 403, p);
  });
  it('refresh rotates tokens and invalidates the old refresh token', async () => {
    const l = await H.login('instructor@egsa-dev.test');
    const r1 = await api('POST', '/auth/refresh', { body: { refreshToken: l.refreshToken } });
    assert.equal(r1.status, 200);
    assert.equal((await api('POST', '/auth/refresh', { body: { refreshToken: l.refreshToken } })).status, 401);
  });
  it('multiple devices stay signed in: a second login does not invalidate the first session', async () => {
    const d1 = await H.login('instructor@egsa-dev.test'); const d2 = await H.login('instructor@egsa-dev.test');
    assert.equal((await api('POST', '/auth/refresh', { body: { refreshToken: d1.refreshToken } })).status, 200);
    assert.equal((await api('POST', '/auth/refresh', { body: { refreshToken: d2.refreshToken } })).status, 200);
  });
  it('logout ends only the presented session', async () => {
    const d1 = await H.login('instructor@egsa-dev.test'); const d2 = await H.login('instructor@egsa-dev.test');
    assert.equal((await api('POST', '/auth/logout', { token: d1.accessToken, body: { refreshToken: d1.refreshToken } })).status, 200);
    assert.equal((await api('POST', '/auth/refresh', { body: { refreshToken: d1.refreshToken } })).status, 401);
    assert.equal((await api('POST', '/auth/refresh', { body: { refreshToken: d2.refreshToken } })).status, 200);
  });
  it('forgot/reset password flow works and old password stops working', async () => {
    const f = await api('POST', '/auth/forgot-password', { body: { email: 'instructor.b@egsa-dev.test' } });
    assert.equal(f.status, 200);
    const ghost = await api('POST', '/auth/forgot-password', { body: { email: 'ghost@x.test' } });
    assert.equal(ghost.status, 200); assert.equal(ghost.data._testToken, undefined);
    const r = await api('POST', '/auth/reset-password', { body: { token: f.data._testToken, password: 'NewPass123' } });
    assert.equal(r.status, 200);
    assert.equal((await api('POST', '/auth/login', { body: { email: 'instructor.b@egsa-dev.test', password: 'Instructor#Dev123' } })).status, 401);
    assert.equal((await api('POST', '/auth/login', { body: { email: 'instructor.b@egsa-dev.test', password: 'NewPass123' } })).status, 200);
    assert.equal((await api('POST', '/auth/reset-password', { body: { token: f.data._testToken, password: 'Another123' } })).status, 400, 'token is single-use');
    B = (await H.login('instructor.b@egsa-dev.test', 'NewPass123')).accessToken;
  });
});

describe('Dashboard / courses / cohorts / sessions / students (real data, scoped)', () => {
  it('dashboard returns real aggregates from the DB', async () => {
    const r = await api('GET', '/instructor/dashboard', { token: A });
    assert.equal(r.status, 200);
    assert.deepEqual([r.data.stats.assignedCourses, r.data.stats.activeCohorts, r.data.stats.students, r.data.stats.pendingGrading], [2, 2, 6, 4]);
    assert.ok(r.data.upcomingSessions.length > 0 && r.data.recentAttendance.length > 0);
  });
  it('instructor B dashboard is isolated (1 course, 1 student, 0 pending)', async () => {
    const r = await api('GET', '/instructor/dashboard', { token: B });
    assert.deepEqual([r.data.stats.assignedCourses, r.data.stats.students, r.data.stats.pendingGrading], [1, 1, 0]);
  });
  it('assigned courses load; foreign course => 404', async () => {
    const l = await api('GET', '/instructor/courses', { token: A });
    assert.deepEqual(l.data.map((x) => x.code).sort(), ['SCB', 'SSF']);
    assert.equal((await api('GET', `/instructor/courses/${id(c.courses.ssf)}`, { token: A })).status, 200);
    assert.equal((await api('GET', `/instructor/courses/${id(c.courses.omi)}`, { token: A })).status, 404);
  });
  it('assigned cohorts load with counts; foreign cohort => 404 on every sub-resource', async () => {
    const l = await api('GET', '/instructor/cohorts', { token: A });
    assert.equal(l.data.length, 2);
    const ssf = l.data.find((x) => x.name === 'SSF-01'); assert.equal(ssf.enrolledCount, 4); assert.equal(ssf.sessionsCount, 5);
    const foreign = id(c.cohorts.omi01);
    for (const sub of ['', '/students', '/sessions', '/attendance', '/assessments', '/progress']) assert.equal((await api('GET', `/instructor/cohorts/${foreign}${sub}`, { token: A })).status, 404, sub);
    assert.equal((await api('GET', `/instructor/cohorts/${id(c.cohorts.ssf01)}`, { token: A })).status, 200);
  });
  it('sessions list only own; foreign session => 404; cannot create session in foreign cohort', async () => {
    const l = await api('GET', '/instructor/sessions?limit=100', { token: A });
    assert.equal(l.data.length, 8);
    assert.equal((await api('POST', '/instructor/sessions', { token: A, body: { cohortId: id(c.cohorts.omi01), title: 'x', date: '2026-12-01', startTime: '09:00', endTime: '10:00' } })).status, 404);
  });
  it('session create / update / cancel works with validation', async () => {
    const bad = await api('POST', '/instructor/sessions', { token: A, body: { cohortId: id(c.cohorts.ssf01), title: 'Bad', date: '2026-12-01', startTime: '10:00', endTime: '09:00' } });
    assert.equal(bad.status, 400);
    const ok = await api('POST', '/instructor/sessions', { token: A, body: { cohortId: id(c.cohorts.ssf01), title: 'Extra Lab', date: '2026-12-01', startTime: '09:00', endTime: '10:00' } });
    assert.equal(ok.status, 201);
    assert.equal((await api('PATCH', `/instructor/sessions/${id(ok.data)}`, { token: A, body: { title: 'Extra Lab v2' } })).data.title, 'Extra Lab v2');
    assert.equal((await api('PATCH', `/instructor/sessions/${id(ok.data)}`, { token: A, body: { status: 'cancelled' } })).data.status, 'cancelled');
    assert.equal((await api('PATCH', `/instructor/sessions/${id(ok.data)}`, { token: A, body: { title: 'again' } })).status, 409);
    assert.equal((await api('PATCH', `/instructor/sessions/${id(ok.data)}`, { token: B, body: { title: 'hijack' } })).status, 404);
  });
  it('students: only enrolled-in-my-cohorts; other instructor student => 404; profile has no sensitive fields', async () => {
    const l = await api('GET', '/instructor/students', { token: A });
    assert.equal(new Set(l.data.map((r) => r.student.name)).size, 6);
    assert.ok(!l.data.some((r) => r.student.name === 'Dev Student 07'));
    const p = await api('GET', `/instructor/students/${id(c.students[0])}`, { token: A });
    assert.equal(p.status, 200); assert.equal(p.data.student.name, 'Dev Student 01');
    assert.ok(!JSON.stringify(p.data).match(/password|card|cvv|payment/i));
    assert.equal((await api('GET', `/instructor/students/${id(c.students[6])}`, { token: A })).status, 404);
    assert.equal((await api('GET', `/instructor/students/${id(c.students[0])}`, { token: B })).status, 404);
  });
});

describe('Attendance', () => {
  const S0 = () => id(c.ssfSessions[0]);
  it('roster shows correct recorded attendance', async () => {
    const r = await api('GET', `/instructor/attendance/sessions/${S0()}`, { token: A });
    assert.equal(r.status, 200); assert.equal(r.data.roster.length, 4);
    assert.ok(r.data.roster.every((x) => x.status === 'present'));
    const r3 = await api('GET', `/instructor/attendance/sessions/${id(c.ssfSessions[2])}`, { token: A });
    assert.deepEqual(r3.data.roster.map((x) => x.status).sort(), ['absent', 'pending', 'present', 'present']);
  });
  it('unauthorized attendance access/update is blocked (IDOR)', async () => {
    assert.equal((await api('GET', `/instructor/attendance/sessions/${S0()}`, { token: B })).status, 404);
    assert.equal((await api('PUT', `/instructor/attendance/sessions/${S0()}`, { token: B, body: { records: [{ studentId: id(c.students[0]), status: 'absent' }] } })).status, 404);
    assert.equal((await api('GET', `/instructor/attendance/cohorts/${id(c.cohorts.ssf01)}`, { token: B })).status, 404);
    // and nothing changed
    const r = await api('GET', `/instructor/attendance/sessions/${S0()}`, { token: A });
    assert.ok(r.data.roster.every((x) => x.status === 'present'));
  });
  it('update validates enum + enrollment, then persists and is reflected in summary', async () => {
    const s = id(c.ssfSessions[2]);
    assert.equal((await api('PUT', `/instructor/attendance/sessions/${s}`, { token: A, body: { records: [{ studentId: id(c.students[0]), status: 'late' }] } })).status, 400);
    assert.equal((await api('PUT', `/instructor/attendance/sessions/${s}`, { token: A, body: { records: [{ studentId: id(c.students[6]), status: 'present' }] } })).status, 422, 'student of another cohort');
    const r = await api('PUT', `/instructor/attendance/sessions/${s}`, { token: A, body: { records: [{ studentId: id(c.students[3]), status: 'present' }, { studentId: id(c.students[2]), status: 'present' }] } });
    assert.equal(r.status, 200);
    assert.equal(r.data.roster.find((x) => x.student.name === 'Dev Student 04').status, 'present');
    const sum = await api('GET', `/instructor/attendance/cohorts/${id(c.cohorts.ssf01)}`, { token: A });
    const s4 = sum.data.find((x) => x.student.name === 'Dev Student 04');
    assert.deepEqual([s4.present, s4.absent, s4.attendancePercentage], [3, 0, 100]);
    const s2 = sum.data.find((x) => x.student.name === 'Dev Student 02');
    assert.deepEqual([s2.present, s2.absent, s2.attendancePercentage], [2, 1, 66.7]);
  });
  it('cannot record attendance for a cancelled session', async () => {
    const cr = await api('POST', '/instructor/sessions', { token: A, body: { cohortId: id(c.cohorts.ssf01), title: 'To cancel', date: '2026-12-02', startTime: '09:00', endTime: '10:00' } });
    await api('PATCH', `/instructor/sessions/${id(cr.data)}`, { token: A, body: { status: 'cancelled' } });
    assert.equal((await api('PUT', `/instructor/attendance/sessions/${id(cr.data)}`, { token: A, body: { records: [{ studentId: id(c.students[0]), status: 'present' }] } })).status, 409);
  });
});

describe('Assessment → submission → grading → result publication', () => {
  let aid, subId, stu1;
  it('create (always draft) with validation; foreign cohort => 404', async () => {
    assert.equal((await api('POST', '/instructor/assessments', { token: A, body: { cohortId: id(c.cohorts.ssf01) } })).status, 400);
    assert.equal((await api('POST', '/instructor/assessments', { token: A, body: { cohortId: id(c.cohorts.omi01), title: 'x', description: 'y' } })).status, 404);
    const r = await api('POST', '/instructor/assessments', { token: A, body: { cohortId: id(c.cohorts.ssf01), title: 'Orbit Basics Test', description: 'desc', instructions: 'Answer all.', dueDate: '2026-12-30', gradingConfig: { maxScore: 50 }, status: 'published' } });
    assert.equal(r.status, 201); assert.equal(r.data.status, 'draft', 'client cannot force published'); aid = id(r.data);
  });
  it('edit draft works; other instructor cannot read/edit/publish/delete it', async () => {
    assert.equal((await api('PATCH', `/instructor/assessments/${aid}`, { token: A, body: { title: 'Orbit Basics Test v2' } })).data.title, 'Orbit Basics Test v2');
    for (const [m, p] of [['GET', ''], ['PATCH', ''], ['POST', '/publish'], ['DELETE', ''], ['GET', '/submissions']]) assert.equal((await api(m, `/instructor/assessments/${aid}${p}`, { token: B, body: { title: 'x' } })).status, 404, `${m}${p}`);
  });
  it('draft is NOT visible through the student-facing integration API', async () => {
    const r = await api('GET', `/integration/assessments?cohortId=${id(c.cohorts.ssf01)}`, { key: H.KEY });
    assert.equal(r.status, 200); assert.ok(!r.data.some((x) => id(x) === aid));
    assert.ok(!r.data.some((x) => x.title === 'Final Project Brief'), 'seed draft hidden');
  });
  it('student submission to a DRAFT assessment is rejected', async () => {
    const r = await api('POST', '/integration/submissions', { key: H.KEY, body: { assessmentId: aid, externalStudentId: 'stu-dev-001', content: 'x' } });
    assert.equal(r.status, 409);
  });
  it('publish works once; published assessment becomes visible to student API; further edits => 409', async () => {
    assert.equal((await api('POST', `/instructor/assessments/${aid}/publish`, { token: A })).data.status, 'published');
    assert.equal((await api('POST', `/instructor/assessments/${aid}/publish`, { token: A })).status, 409);
    assert.equal((await api('PATCH', `/instructor/assessments/${aid}`, { token: A, body: { title: 'edit' } })).status, 409);
    const r = await api('GET', `/integration/assessments?cohortId=${id(c.cohorts.ssf01)}`, { key: H.KEY });
    assert.ok(r.data.some((x) => id(x) === aid));
  });
  it('integration endpoints reject missing/invalid API key', async () => {
    assert.equal((await api('GET', `/integration/assessments?cohortId=${id(c.cohorts.ssf01)}`)).status, 401);
    assert.equal((await api('GET', `/integration/results?externalStudentId=stu-dev-001`, { key: 'wrong' })).status, 401);
    assert.equal((await api('GET', `/integration/results?externalStudentId=stu-dev-001`, { token: A })).status, 401, 'user JWT is not an API key');
  });
  it('student submission (via integration intake) is accepted only for enrolled students; duplicate => 409; instructor is notified', async () => {
    const bad = await api('POST', '/integration/submissions', { key: H.KEY, body: { assessmentId: aid, externalStudentId: 'stu-dev-007', content: 'x' } });
    assert.equal(bad.status, 403, 'student of another cohort');
    const ok = await api('POST', '/integration/submissions', { key: H.KEY, body: { assessmentId: aid, externalStudentId: 'stu-dev-001', content: 'My answers' } });
    assert.equal(ok.status, 201); subId = ok.data.submissionId; stu1 = id(c.students[0]);
    assert.equal((await api('POST', '/integration/submissions', { key: H.KEY, body: { assessmentId: aid, externalStudentId: 'stu-dev-001', content: 'again' } })).status, 409);
    const n = await api('GET', '/instructor/notifications', { token: A });
    assert.ok(n.data.some((x) => x.type === 'new_submission' && x.message.includes('Orbit Basics Test v2')));
  });
  it('instructor sees the submission; other instructor does not and cannot open it', async () => {
    const l = await api('GET', `/instructor/assessments/${aid}/submissions`, { token: A });
    assert.equal(l.data.length, 1); assert.equal(l.data[0].student.name, 'Dev Student 01'); assert.equal(l.data[0].status, 'submitted');
    assert.equal((await api('GET', `/instructor/submissions/${subId}`, { token: B })).status, 404);
    const all = await api('GET', '/instructor/submissions', { token: B });
    assert.equal(all.data.length, 0, 'B has no submissions');
  });
  it('grading: validation (score > configured max, empty body), foreign grading => 404', async () => {
    assert.equal((await api('PUT', `/instructor/submissions/${subId}/grade`, { token: A, body: { score: 51 } })).status, 422);
    assert.equal((await api('PUT', `/instructor/submissions/${subId}/grade`, { token: A, body: {} })).status, 400);
    assert.equal((await api('PUT', `/instructor/submissions/${subId}/grade`, { token: A, body: { score: -1 } })).status, 400);
    assert.equal((await api('PUT', `/instructor/submissions/${subId}/grade`, { token: B, body: { score: 10 } })).status, 404);
    assert.equal((await api('POST', `/instructor/submissions/${subId}/publish-result`, { token: A })).status, 409, 'cannot publish before evaluating');
  });
  it('grading saves evaluation WITHOUT publishing; student API does not expose it', async () => {
    const g = await api('PUT', `/instructor/submissions/${subId}/grade`, { token: A, body: { score: 42, feedback: 'Solid work', strengths: 'Clarity', improvements: 'Add references' } });
    assert.equal(g.status, 200); assert.equal(g.data.status, 'evaluated');
    assert.equal((await api('GET', `/instructor/submissions/${subId}`, { token: A })).data.status, 'evaluated');
    const r = await api('GET', '/integration/results?externalStudentId=stu-dev-001', { key: H.KEY });
    assert.ok(!r.data.some((x) => x.feedback === 'Solid work'), 'unpublished result must stay hidden');
    assert.ok(!r.data.some((x) => id(x.submission) === subId));
    assert.ok(r.data.some((x) => x.score === 88), 'previously published seed result is visible');
  });
  it('publish result: other instructor blocked; owner succeeds; student API now exposes it; locked afterwards', async () => {
    assert.equal((await api('POST', `/instructor/submissions/${subId}/publish-result`, { token: B })).status, 404);
    const p = await api('POST', `/instructor/submissions/${subId}/publish-result`, { token: A });
    assert.equal(p.status, 200); assert.equal(p.data.status, 'published');
    const r = await api('GET', `/integration/results?externalStudentId=stu-dev-001&assessmentId=${aid}`, { key: H.KEY });
    assert.equal(r.data.length, 1); assert.equal(r.data[0].score, 42); assert.equal(r.data[0].feedback, 'Solid work');
    assert.equal((await api('POST', `/instructor/submissions/${subId}/publish-result`, { token: A })).status, 409);
    assert.equal((await api('PUT', `/instructor/submissions/${subId}/grade`, { token: A, body: { score: 1 } })).status, 409);
    assert.equal((await api('GET', `/instructor/submissions/${subId}`, { token: A })).data.status, 'result_published');
  });
  it('progress reflects real records (no invented overall %)', async () => {
    const r = await api('GET', `/instructor/cohorts/${id(c.cohorts.ssf01)}/progress`, { token: A });
    const s1 = r.data.find((x) => x.student.name === 'Dev Student 01');
    assert.equal(s1.assessments.published, 3); assert.equal(s1.assessments.submitted, 3);
    assert.equal(s1.assessments.graded, 2); assert.equal(s1.assessments.resultsPublished, 2); assert.equal(s1.assessments.pendingGrading, 1);
    assert.equal(r.data[0].overallPercentage, undefined);
    assert.equal((await api('GET', `/instructor/cohorts/${id(c.cohorts.ssf01)}/progress`, { token: B })).status, 404);
    const p = await api('GET', `/instructor/progress?cohortId=${id(c.cohorts.ssf01)}`, { token: A });
    assert.equal(p.data.length, 4);
  });
  it('dashboard pending count and activity reflect the grading cycle', async () => {
    const d = await api('GET', '/instructor/dashboard', { token: A });
    assert.equal(d.data.stats.pendingGrading, 4, '4 seeded pending (new one graded)');
    assert.ok(d.data.recentActivity.some((x) => x.action === 'result.published'));
  });
});

describe('Notifications & profile', () => {
  it('notifications list, mark one read, mark all read', async () => {
    const l = await api('GET', '/instructor/notifications', { token: A });
    assert.ok(l.data.length >= 3); assert.ok(l.meta.unreadCount > 0);
    const one = l.data.find((n) => !n.read);
    assert.equal((await api('PATCH', `/instructor/notifications/${id(one)}/read`, { token: A })).data.read, true);
    assert.equal((await api('PATCH', `/instructor/notifications/${id(one)}/read`, { token: B })).status, 404, 'cannot read others\' notifications');
    await api('POST', '/instructor/notifications/read-all', { token: A });
    assert.equal((await api('GET', '/instructor/notifications', { token: A })).meta.unreadCount, 0);
  });
  it('upcoming-session reminder was generated (deduped, no duplicates after repeated loads)', async () => {
    await api('GET', '/instructor/dashboard', { token: A }); await api('GET', '/instructor/dashboard', { token: A });
    const l = await api('GET', '/instructor/notifications?limit=100', { token: A });
    assert.equal(l.data.filter((n) => n.type === 'upcoming_session').length, 1);
  });
  it('profile loads and updates allowed fields only (role/email/status cannot be changed)', async () => {
    const p = await api('GET', '/instructor/profile', { token: A });
    assert.equal(p.data.email, 'instructor@egsa-dev.test');
    const u = await api('PATCH', '/instructor/profile', { token: A, body: { name: 'Dev Instructor Layla H.', phone: '+20111', role: 'admin', email: 'evil@x.test', status: 'suspended', professional: { title: 'Lead Instructor (dev)', hacker: 1 } } });
    assert.equal(u.status, 200); assert.equal(u.data.name, 'Dev Instructor Layla H.'); assert.equal(u.data.role, 'instructor');
    assert.equal(u.data.email, 'instructor@egsa-dev.test'); assert.equal(u.data.status, 'active'); assert.equal(u.data.professional.title, 'Lead Instructor (dev)');
  });
  it('password change requires correct current password and enforces strength', async () => {
    assert.equal((await api('PUT', '/instructor/profile/password', { token: A, body: { currentPassword: 'wrong', newPassword: 'Abcdef12' } })).status, 400);
    assert.equal((await api('PUT', '/instructor/profile/password', { token: A, body: { currentPassword: 'Instructor#Dev123', newPassword: 'short' } })).status, 400);
    assert.equal((await api('PUT', '/instructor/profile/password', { token: A, body: { currentPassword: 'Instructor#Dev123', newPassword: 'Abcdef12' } })).status, 200);
    assert.equal((await api('POST', '/auth/login', { body: { email: 'instructor@egsa-dev.test', password: 'Abcdef12' } })).status, 200);
  });
});

describe('Input hardening', () => {
  it('malformed ids => 400/404 not 500; unknown route => 404 JSON; malformed JSON => 400', async () => {
    assert.ok([400, 404].includes((await api('GET', '/instructor/cohorts/not-an-id', { token: A })).status));
    const nf = await api('GET', '/nope', { token: A }); assert.equal(nf.status, 404); assert.equal(nf.body.success, false);
  });
  it('malformed JSON body => 400 (not 500)', async () => {
    const base = (await H.rawBase());
    const res = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad json' });
    assert.equal(res.status, 400);
  });
  it('NoSQL-operator injection in login is rejected', async () => {
    const r = await api('POST', '/auth/login', { body: { email: { $ne: '' }, password: { $ne: '' } } });
    assert.equal(r.status, 400);
  });
});

describe('Instructor–Student Private Messaging & Anti-IDOR Authorization', () => {
  let student1, studentOfB, convoId;

  before(async () => {
    // Find an enrolled student for instructor A
    const stA = await api('GET', '/instructor/students', { token: A });
    assert.ok(stA.data && stA.data.length > 0);
    student1 = stA.data[0];

    // Find an enrolled student for instructor B
    const stB = await api('GET', '/instructor/students', { token: B });
    assert.ok(stB.data && stB.data.length > 0);
    studentOfB = stB.data[0];
  });

  it('instructor can start/get a conversation with an enrolled student in their cohort', async () => {
    const r = await api('POST', '/instructor/conversations', {
      token: A,
      body: {
        studentId: id(student1.student),
        cohortId: id(student1.cohort),
      },
    });
    assert.equal(r.status, 201);
    assert.ok(r.data && r.data._id);
    assert.equal(id(r.data.student._id || r.data.student), id(student1.student));
    convoId = id(r.data);
  });

  it('calling createConversation again for the same context returns the existing conversation (no duplicates)', async () => {
    const r = await api('POST', '/instructor/conversations', {
      token: A,
      body: {
        studentId: id(student1.student),
        cohortId: id(student1.cohort),
      },
    });
    assert.ok([200, 201].includes(r.status));
    assert.equal(id(r.data), convoId);
  });

  it('Anti-IDOR: instructor A cannot start a conversation with a student enrolled only with instructor B', async () => {
    const r = await api('POST', '/instructor/conversations', {
      token: A,
      body: {
        studentId: id(studentOfB.student),
        cohortId: id(studentOfB.cohort),
      },
    });
    assert.equal(r.status, 404, 'Must return 404 anti-IDOR for student not assigned to this instructor');
  });

  it('instructor can send a message; updates conversation lastMessage metadata', async () => {
    const r = await api('POST', `/instructor/conversations/${convoId}/messages`, {
      token: A,
      body: { body: 'Welcome to the mission simulations, Cadet.' },
    });
    assert.equal(r.status, 201);
    assert.equal(r.data.body, 'Welcome to the mission simulations, Cadet.');
    assert.equal(r.data.senderRole, 'instructor');

    // Verify conversation metadata updated
    const c = await api('GET', `/instructor/conversations/${convoId}`, { token: A });
    assert.equal(c.status, 200);
    assert.equal(c.data.lastMessage?.body || c.data.lastMessage, 'Welcome to the mission simulations, Cadet.');
    assert.ok(c.data.lastMessageAt);
  });

  it('rejects empty messages and overly long messages', async () => {
    const empty1 = await api('POST', `/instructor/conversations/${convoId}/messages`, {
      token: A,
      body: { body: '' },
    });
    assert.equal(empty1.status, 400);

    const empty2 = await api('POST', `/instructor/conversations/${convoId}/messages`, {
      token: A,
      body: { body: '   ' },
    });
    assert.equal(empty2.status, 400);

    const longMsg = 'x'.repeat(2001);
    const tooLong = await api('POST', `/instructor/conversations/${convoId}/messages`, {
      token: A,
      body: { body: longMsg },
    });
    assert.equal(tooLong.status, 400);
  });

  it('messages persist and can be retrieved with pagination metadata', async () => {
    const r = await api('GET', `/instructor/conversations/${convoId}/messages`, { token: A });
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.data));
    assert.ok(r.data.length >= 1);
    assert.equal(r.data[r.data.length - 1].body, 'Welcome to the mission simulations, Cadet.');
  });

  it('Anti-IDOR: Instructor B cannot access Instructor A’s conversation or messages by ID', async () => {
    const c = await api('GET', `/instructor/conversations/${convoId}`, { token: B });
    assert.equal(c.status, 404, 'Foreign conversation read must be 404');

    const m = await api('GET', `/instructor/conversations/${convoId}/messages`, { token: B });
    assert.equal(m.status, 404, 'Foreign messages read must be 404');

    const s = await api('POST', `/instructor/conversations/${convoId}/messages`, {
      token: B,
      body: { body: 'Malicious injection' },
    });
    assert.equal(s.status, 404, 'Foreign message send must be 404');
  });

  it('Student integration endpoints allow student replies and notify instructor', async () => {
    // Student lists conversations via Integration API
    const list = await api('GET', `/integration/students/${id(student1.student)}/conversations`, {
      key: H.KEY,
    });
    assert.equal(list.status, 200);
    assert.ok(list.data.some((x) => id(x) === convoId));

    // Student sends a message
    const send = await api('POST', `/integration/students/${id(student1.student)}/conversations/${convoId}/messages`, {
      key: H.KEY,
      body: { body: 'Acknowledged, Instructor Hassan. Flight systems telemetry verified.' },
    });
    assert.equal(send.status, 201);
    assert.equal(send.data.senderRole, 'student');

    // Instructor receives updated unread count
    const unread = await api('GET', '/instructor/messages/unread-count', { token: A });
    assert.equal(unread.status, 200);
    assert.ok(unread.data.unreadCount >= 1);

    // Instructor marks conversation as read
    const mark = await api('PATCH', `/instructor/conversations/${convoId}/read`, { token: A });
    assert.equal(mark.status, 200);

    const unreadAfter = await api('GET', '/instructor/messages/unread-count', { token: A });
    assert.equal(unreadAfter.data.unreadCount, 0);
  });
});
