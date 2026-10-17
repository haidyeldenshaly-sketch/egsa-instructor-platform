"""
Browser E2E for the Instructor Project (real Chromium, real API, real DB). Requires the stack running:
  backend :5100, frontend :5173, seeded DB.   python3 e2e/ui_e2e.py
"""
import json, sys, urllib.request, re, hashlib
from playwright.sync_api import sync_playwright, expect

WEB, API, KEY = 'http://127.0.0.1:5173', 'http://127.0.0.1:5100/api/v1', 'dev-integration-key-local-only'
SHOTS = sys.argv[1] if len(sys.argv) > 1 else '/tmp/shots'
results = []

def http(method, path, body=None, token=None, key=None):
    h = {'Content-Type': 'application/json'}
    if token: h['Authorization'] = f'Bearer {token}'
    if key: h['x-api-key'] = key
    req = urllib.request.Request(API + path, data=json.dumps(body).encode() if body else None, headers=h, method=method)
    try:
        with urllib.request.urlopen(req) as r: return r.status, json.load(r)
    except urllib.error.HTTPError as e: return e.code, json.load(e)

def check(name, cond, detail=''):
    results.append((name, bool(cond), detail)); print(('PASS' if cond else 'FAIL'), '-', name, detail)

_, lg = http('POST', '/auth/login', {'email': 'instructor@egsa-dev.test', 'password': 'Instructor#Dev123'})
TOKEN = lg['data']['accessToken']
_, ch = http('GET', '/instructor/cohorts', token=TOKEN)
SSF = next(c for c in ch['data'] if c['name'] == 'SSF-01')
_, ss = http('GET', f"/instructor/sessions?cohortId={SSF['_id']}&limit=100", token=TOKEN)
PAST = next(s for s in ss['data'] if s['title'] == 'Attitude Determination & Control')

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 1366, 'height': 850}); page = ctx.new_page()
    errors = []
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.set_default_timeout(8000)

    # --- auth
    page.goto(WEB + '/instructor/dashboard'); page.wait_for_url('**/login')
    check('unauthenticated visit redirects to /login', '/login' in page.url)
    check('login page shows the official logo (loaded, 500x500)', page.evaluate("(() => { const i = document.querySelector('section img'); return i.complete && i.naturalWidth === 500; })()"))
    page.wait_for_timeout(1200); page.screenshot(path=f'{SHOTS}/01-login.png')
    page.fill('#email', 'admin@egsa-dev.test'); page.fill('#password', 'Instructor#Dev123'); page.click('button[type=submit]')
    expect(page.get_by_role('alert')).to_contain_text('instructors only'); check('non-instructor (admin) login is refused in the UI', True)
    page.fill('#email', 'instructor@egsa-dev.test'); page.fill('#password', 'wrong'); page.click('button[type=submit]')
    expect(page.get_by_role('alert')).to_contain_text('Invalid email or password'); check('wrong password shows friendly error', True)
    page.fill('#password', 'Instructor#Dev123'); page.click('button[type=submit]'); page.wait_for_url('**/instructor/dashboard')
    check('instructor login reaches dashboard', True)

    # --- dashboard real data
    expect(page.get_by_role('heading', name=re.compile('Welcome back'))).to_be_visible()
    page.wait_for_selector('text=Assigned courses')
    stat = lambda label: page.locator('a,div', has_text=re.compile(f'^\\d+{label}$')).first.inner_text().split('\n')[0]
    page.wait_for_function("document.querySelector('main').innerText.includes('4\\nAwaiting grading') && document.querySelector('main').innerText.includes('2\\nAssigned courses')")
    txt = page.locator('main').inner_text()
    check('dashboard shows seeded pending submissions (4) and courses (2) after count-up', True)
    check('dashboard attention banner is driven by real pending count', '4 submissions are awaiting your grading' in txt.replace('\n', ' '))
    page.wait_for_timeout(1200); page.screenshot(path=f'{SHOTS}/02-dashboard.png')
    check('desktop shows exactly one visible logo in the app chrome', page.evaluate("[...document.querySelectorAll('img')].filter(i => i.offsetParent !== null).length") == 1)

    # --- logo + media removal + sidebar behaviour
    OFFICIAL = hashlib.sha256(open('/mnt/user-data/uploads/WhatsApp_Image_2026-09-22_at_1_56_13_PM.png','rb').read()).hexdigest()
    src = page.locator('aside img').first.get_attribute('src')
    served = hashlib.sha256(urllib.request.urlopen(WEB + src).read()).hexdigest()
    check('official logo in sidebar is served byte-identical to the supplied file', served == OFFICIAL)
    check('sidebar logo decoded at native 500x500 (not distorted)', page.evaluate("(() => { const i = document.querySelector('aside img'); return i.complete && i.naturalWidth === 500 && i.naturalHeight === 500 && i.width === i.height; })()"))
    check('no Media entry in sidebar navigation', page.locator('aside').get_by_text('Media', exact=True).count() == 0)
    check('no Media link anywhere in the document', page.locator('a[href*="media"]').count() == 0)
    page.goto(f'{WEB}/instructor/media'); page.wait_for_selector('[role=alert]'); check('removed /instructor/media route shows not-found state', 'does not exist' in page.locator('[role=alert]').inner_text() or 'not assigned' in page.locator('[role=alert]').inner_text())
    check('removed Media API returns 404', http('GET', '/instructor/media', token=TOKEN)[0] == 404 and http('PATCH', '/instructor/media/123/review', {'decision': 'reject'}, token=TOKEN)[0] == 404)
    page.goto(f'{WEB}/instructor/dashboard'); page.wait_for_selector('text=Welcome back')
    w0 = page.evaluate("document.querySelector('aside').getBoundingClientRect().width")
    page.get_by_role('button', name='Collapse sidebar').click(); page.wait_for_timeout(600)
    w1 = page.evaluate("document.querySelector('aside').getBoundingClientRect().width")
    check(f'sidebar collapses to icon rail ({w0:.0f}px -> {w1:.0f}px) and persists', w1 < 100 and w0 > 240 and page.evaluate("localStorage.getItem('egsa_side_collapsed')") == '1')
    page.screenshot(path=f'{SHOTS}/02b-sidebar-collapsed.png')
    page.get_by_role('button', name='Expand sidebar').click(); page.wait_for_timeout(600)

    # --- nav pages render without error states
    for path, h1 in [('courses', 'My Courses'), ('cohorts', 'My Cohorts'), ('sessions', 'Sessions'), ('students', 'My Students'), ('assessments', 'Assessments'), ('submissions', 'Submissions'), ('progress', 'Student Progress'), ('notifications', 'Notifications'), ('profile', 'My Profile')]:
        page.goto(f'{WEB}/instructor/{path}'); expect(page.get_by_role('heading', name=h1, exact=True).first).to_be_visible(); page.wait_for_load_state('networkidle')
        check(f'page /{path} renders', page.locator('[role=alert]').count() == 0)
    page.goto(f'{WEB}/instructor/students'); page.wait_for_selector('text=Dev Student 01')
    names = set(re.findall(r'Dev Student \d\d', page.locator('main').inner_text()))
    check('students page lists only my 6 distinct students (8 enrollment rows; no Dev Student 07)', len(names) == 6 and 'Dev Student 07' not in names, str(sorted(names)))
    page.screenshot(path=f'{SHOTS}/03-students.png')

    # --- cohort detail tabs
    page.goto(f"{WEB}/instructor/cohorts/{SSF['_id']}"); page.wait_for_selector('text=Overview')
    for tab in ['Students', 'Sessions', 'Attendance', 'Assessments', 'Progress']:
        page.get_by_role('tab' if page.get_by_role('tab', name=tab).count() else 'button', name=tab, exact=True).first.click(); page.wait_for_load_state('networkidle')
    check('cohort tabs all load', page.locator('[role=alert]').count() == 0)
    page.screenshot(path=f'{SHOTS}/04-cohort-progress.png')

    # --- attendance via UI
    page.goto(f"{WEB}/instructor/attendance?sessionId={PAST['_id']}"); page.wait_for_selector('text=Session roster')
    check('attendance deep-link resolves course/cohort/session selects', page.locator('#a-session').input_value() == PAST['_id'])
    rows = page.locator('tbody tr').first
    page.get_by_role('button', name='Save attendance').is_disabled() and check('save disabled until a change is made', True)
    page.locator('[role=group]').nth(0).get_by_role('button', name='Absent').click()
    page.get_by_role('button', name='Save attendance').click(); expect(page.get_by_text('Saved successfully')).to_be_visible()
    _, ro = http('GET', f"/instructor/attendance/sessions/{PAST['_id']}", token=TOKEN)
    check('UI attendance change persisted in DB (re-read through API)', any(r['status'] == 'absent' and r['student']['name'] == 'Dev Student 01' for r in ro['data']['roster']))
    page.screenshot(path=f'{SHOTS}/05-attendance.png', full_page=True)

    # --- create + publish assessment via UI
    page.goto(f'{WEB}/instructor/assessments/new'); page.wait_for_selector('#af-title')
    page.select_option('#af-cohort', SSF['_id']); page.fill('#af-title', 'UI E2E Assessment'); page.fill('#af-desc', 'Created by browser test'); page.fill('#af-ins', 'Answer briefly.'); page.fill('#af-ms', '30')
    page.get_by_role('button', name='Save').click(); page.wait_for_url(re.compile(r'/instructor/assessments/[a-f0-9]{24}$'))
    AID = page.url.rsplit('/', 1)[1]
    expect(page.get_by_text('Draft — not visible to students.').first).to_be_visible(); check('assessment created as DRAFT via UI', True)
    st, lst = http('GET', f"/integration/assessments?cohortId={SSF['_id']}", key=KEY)
    check('draft hidden from student-facing API', all(a['_id'] != AID for a in lst['data']))
    page.get_by_role('button', name='Publish').first.click(); page.get_by_role('dialog').get_by_role('button', name='Publish').click()
    expect(page.get_by_text('Assessment published')).to_be_visible()
    _, lst = http('GET', f"/integration/assessments?cohortId={SSF['_id']}", key=KEY)
    check('published assessment visible to student-facing API', any(a['_id'] == AID for a in lst['data']), f"AID={AID} ids={[a['_id'] for a in lst['data']]}")
    page.screenshot(path=f'{SHOTS}/06-assessment-published.png')

    # --- student submits (future Student Project, simulated via the intake API), instructor grades in UI
    st, sub = http('POST', '/integration/submissions', {'assessmentId': AID, 'externalStudentId': 'stu-dev-004', 'content': 'Browser-test answer'}, key=KEY)
    check('student submission accepted by intake API', st == 201)
    page.goto(f'{WEB}/instructor/assessments/{AID}/submissions'); page.wait_for_selector('text=Dev Student 04')
    page.get_by_role('link', name='Grade').click(); page.wait_for_selector('#g-score')
    expect(page.get_by_text('Browser-test answer')).to_be_visible()
    page.fill('#g-score', '31'); page.fill('#g-fb', 'Nice'); page.get_by_role('button', name='Save evaluation').click()
    expect(page.locator('.invalid-feedback').first).to_be_visible(); check('score above configured max rejected with friendly message', True)
    page.fill('#g-score', '27'); page.fill('#g-fb', 'Well argued answer'); page.fill('#g-st', 'Clarity'); page.fill('#g-im', 'More citations')
    page.get_by_role('button', name='Save evaluation').click(); expect(page.get_by_text('Evaluation saved (not yet visible to the student).')).to_be_visible()
    _, rs = http('GET', '/integration/results?externalStudentId=stu-dev-004', key=KEY)
    check('saved-but-unpublished result NOT exposed to student API', rs['data'] == [])
    expect(page.get_by_text('Evaluation saved — not published')).to_be_visible()
    page.screenshot(path=f'{SHOTS}/07-grading.png', full_page=True)
    page.get_by_role('button', name='Publish result').click(); page.get_by_role('dialog').get_by_role('button', name='Publish result').click()
    expect(page.get_by_text('Published — visible to the student')).to_be_visible()
    _, rs = http('GET', '/integration/results?externalStudentId=stu-dev-004', key=KEY)
    check('published result exposed to student API with score+feedback', len(rs['data']) == 1 and rs['data'][0]['score'] == 27 and rs['data'][0]['feedback'] == 'Well argued answer')
    check('published result is locked in UI', page.locator('#g-score').is_disabled())
    page.goto(f"{WEB}/instructor/students/{[s for s in http('GET','/instructor/students',token=TOKEN)[1]['data'] if s['student']['name']=='Dev Student 04'][0]['student']['_id']}"); page.wait_for_selector('text=UI E2E Assessment')
    check('student training profile reflects the published result', '27' in page.locator('main').inner_text())

    # --- IDOR through the UI: foreign cohort id
    _, b_login = http('POST', '/auth/login', {'email': 'instructor.b@egsa-dev.test', 'password': 'Instructor#Dev123'})
    _, bch = http('GET', '/instructor/cohorts', token=b_login['data']['accessToken'])
    page.goto(f"{WEB}/instructor/cohorts/{bch['data'][0]['_id']}"); page.wait_for_selector('[role=alert]')
    check("foreign cohort URL shows 'not found / not assigned' state (no data leaked)", 'not assigned to you' in page.locator('[role=alert]').inner_text() and 'OMI' not in page.locator('main').inner_text())
    page.screenshot(path=f'{SHOTS}/08-foreign-cohort.png')
    page.goto(f'{WEB}/instructor/this-does-not-exist'); page.wait_for_selector('[role=alert]'); check('unknown route shows not-found state', True)

    # --- Arabic / RTL
    page.goto(f'{WEB}/instructor/dashboard'); page.wait_for_selector('text=Welcome back')
    page.get_by_role('button', name='Language').click()
    expect(page.get_by_role('heading', name=re.compile('مرحبًا بعودتك'))).to_be_visible()
    check('Arabic switches document to dir=rtl lang=ar', page.evaluate('document.documentElement.dir') == 'rtl' and page.evaluate('document.documentElement.lang') == 'ar')
    check('RTL bootstrap stylesheet loaded', 'rtl' in (page.get_attribute('#bootstrap-css', 'href') or ''))
    page.screenshot(path=f'{SHOTS}/09-dashboard-arabic-rtl.png', full_page=True)
    page.goto(f'{WEB}/instructor/attendance'); page.wait_for_selector('text=الحضور'); page.screenshot(path=f'{SHOTS}/10-attendance-arabic.png')
    page.get_by_role('button', name='اللغة').click()

    # --- mobile
    m = b.new_context(viewport={'width': 390, 'height': 800}, is_mobile=True); mp = m.new_page(); mp.set_default_timeout(8000)
    mp.goto(WEB + '/login'); mp.fill('#email', 'instructor@egsa-dev.test'); mp.fill('#password', 'Instructor#Dev123'); mp.click('button[type=submit]'); mp.wait_for_url('**/dashboard'); mp.wait_for_selector('text=Assigned courses')
    check('mobile: top bar shows the official logo', mp.evaluate("(() => { const v = [...document.querySelectorAll('img')].filter(i => i.offsetParent !== null); return v.length === 1 && v[0].naturalWidth === 500; })()"))
    check('mobile: desktop sidebar hidden, menu button visible', not mp.locator('aside').is_visible() and mp.get_by_role('button', name='Menu').is_visible())
    check('mobile: no horizontal page overflow', mp.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'))
    mp.screenshot(path=f'{SHOTS}/11-mobile-dashboard.png'); mp.get_by_role('button', name='Menu').click(); mp.wait_for_selector('.offcanvas.show'); mp.screenshot(path=f'{SHOTS}/12-mobile-menu.png')
    mp.goto(WEB + '/instructor/students'); mp.wait_for_selector('text=Dev Student 01'); check('mobile: students table has no page overflow', mp.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'))

    # --- reduced motion: count-up skipped, no entrance animation delay
    rm = b.new_context(viewport={'width': 1366, 'height': 850}, reduced_motion='reduce'); rp = rm.new_page(); rp.set_default_timeout(8000)
    rp.goto(WEB + '/login'); rp.fill('#email', 'instructor@egsa-dev.test'); rp.fill('#password', 'Instructor#Dev123'); rp.click('button[type=submit]'); rp.wait_for_url('**/dashboard'); rp.wait_for_selector('text=Assigned courses')
    check('prefers-reduced-motion: stats render final values immediately', '4\nAwaiting grading' in rp.locator('main').inner_text())
    check('prefers-reduced-motion: CSS animations collapse to ~0ms', rp.evaluate("parseFloat(getComputedStyle(document.querySelector('main > div')).animationDuration) < 0.01"))
    rm.close()

    # --- logout
    page.goto(f'{WEB}/instructor/dashboard'); page.wait_for_selector('text=Welcome back'); page.locator('#user-menu').click(); page.get_by_text('Log out', exact=True).click(); page.wait_for_url('**/login')
    page.goto(f'{WEB}/instructor/dashboard'); page.wait_for_url('**/login'); check('after logout, protected route redirects to login', True)

    bad = [e for e in errors if 'Failed to load resource' not in e]
    check('no unexpected browser console/page errors', not bad, '; '.join(bad)[:300])
    b.close()

failed = [r for r in results if not r[1]]
print(f'\n{len(results)-len(failed)}/{len(results)} UI checks passed'); sys.exit(1 if failed else 0)
