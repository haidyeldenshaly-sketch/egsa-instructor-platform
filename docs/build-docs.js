const fs = require('fs'); const path = require('path');
const eps = require('./endpoints');
const root = path.join(__dirname, '..');

// ---------- API_REFERENCE.md
const groups = [...new Set(eps.map((e) => e.group))];
let md = `# API Reference — EGSA Instructor Project

Base URL: \`{{baseUrl}}/api/v1\` (dev: \`http://localhost:5100/api/v1\`). Generated from \`docs/endpoints.js\`, the same source as the Postman collection; every endpoint listed exists and is covered by \`npm test\` and/or the Postman run.

## Conventions
- Success envelope: \`{ "success": true, "data": …, "meta"?: … }\`. Error envelope: \`{ "success": false, "error": { "message": "…", "details"?: [{ "field", "message" }] } }\`.
- **Auth** — \`JWT\`: \`Authorization: Bearer <accessToken>\` (15 min). \`API key\`: \`x-api-key\` header, used only by the future Student-Project integration endpoints.
- **Authorization** — every \`/instructor/*\` route requires role \`instructor\`; the instructor identity is ALWAYS taken from the JWT (never from body/params/query). Every cohort/session/assessment/submission/student is resolved through the cohort assignment (\`Cohort.instructor\`). A resource that is missing **or** belongs to another instructor returns **404** (existence is not leaked).
- Malformed ids → 400/404, never 500. Unknown routes → 404 JSON. Server errors never leak internals.

`;
for (const g of groups) {
  md += `\n## ${g}\n`;
  for (const e of eps.filter((x) => x.group === g)) {
    md += `\n### ${e.name}\n\n\`${e.method} /api/v1${e.path}\`\n\n| | |\n|---|---|\n| Authentication | ${e.auth} |\n| Role | ${e.role} |\n`;
    if (e.query) md += `| Query | ${Object.keys(e.query).map((k) => `\`${k}\``).join(', ')} |\n`;
    md += `| Success status | ${e.expect === 404 ? '200' : e.expect} |\n\n`;
    if (e.body) md += `**Request body**\n\`\`\`json\n${JSON.stringify(e.body, null, 2)}\n\`\`\`\n\n`;
    md += `**Response** — ${e.response}\n\n**Errors**\n${Object.entries(e.errors).map(([c, m]) => `- \`${c}\` ${m}`).join('\n')}\n\n**Example**\n\`\`\`bash\ncurl -X ${e.method} "$BASE/api/v1${e.path.replace(/\{\{(\w+)\}\}/g, '<$1>')}"${e.auth.startsWith('JWT') ? ' \\\n  -H "Authorization: Bearer $TOKEN"' : e.auth.startsWith('API') ? ' \\\n  -H "x-api-key: $INTEGRATION_API_KEY"' : ''}${e.body ? ` \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(e.body)}'` : ''}\n\`\`\`\n`;
  }
}
fs.writeFileSync(path.join(root, 'API_REFERENCE.md'), md);

// ---------- Postman collection + environment
const vars = ['baseUrl', 'instructorEmail', 'instructorPassword', 'integrationApiKey', 'accessToken', 'refreshToken', 'instructorId', 'courseId', 'cohortId', 'sessionId', 'newSessionId', 'studentId', 'assessmentId', 'draftId', 'submissionId', 'notificationId'];
const req = (e) => {
  const headers = [{ key: 'Content-Type', value: 'application/json' }];
  if (e.auth.startsWith('API')) headers.push({ key: 'x-api-key', value: '{{integrationApiKey}}' });
  const url = { raw: `{{baseUrl}}/api/v1${e.path}`, host: ['{{baseUrl}}'], path: ['api', 'v1', ...e.path.split('/').filter(Boolean)] };
  if (e.query) url.query = Object.entries(e.query).map(([key, value]) => ({ key, value, disabled: value === '' }));
  const exec = [`pm.test('status is ${e.expect}', () => pm.response.to.have.status(${e.expect}));`];
  if (e.test) exec.push(e.test);
  return { name: e.name, request: { method: e.method, header: headers, ...(e.auth.startsWith('JWT') ? { auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{accessToken}}', type: 'string' }] } } : { auth: { type: 'noauth' } }), ...(e.body ? { body: { mode: 'raw', raw: JSON.stringify(e.body, null, 2), options: { raw: { language: 'json' } } } } : {}), url }, event: [{ listen: 'test', script: { type: 'text/javascript', exec } }] };
};
const collection = { info: { name: 'EGSA Instructor Project', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json', description: 'Run top-to-bottom against a freshly seeded DB (npm run seed -- --reset). The collection walks the complete instructor cycle.' }, variable: vars.map((key) => ({ key, value: key === 'baseUrl' ? 'http://localhost:5100' : '' })), item: groups.map((g) => ({ name: g, item: eps.filter((e) => e.group === g).map(req) })) };
// flow order: keep the file order (single array) — rebuild folders preserving first appearance but ordered by the mid-flow integration steps:
collection.item = []; let cur = null;
for (const e of eps) { if (!cur || cur.name !== e.group) { cur = { name: e.group, item: [] }; collection.item.push(cur); } cur.item.push(req(e)); }
fs.writeFileSync(path.join(root, 'postman', 'EGSA-Instructor.postman_collection.json'), JSON.stringify(collection, null, 2));
const env = { name: 'EGSA Instructor — Local', values: [['baseUrl', 'http://localhost:5100'], ['instructorEmail', 'instructor@egsa-dev.test'], ['instructorPassword', ''], ['integrationApiKey', '']].map(([key, value]) => ({ key, value, enabled: true, type: key.match(/Password|Key/) ? 'secret' : 'default' })), _postman_variable_scope: 'environment' };
fs.writeFileSync(path.join(root, 'postman', 'EGSA-Instructor.local.postman_environment.json'), JSON.stringify(env, null, 2));
console.log(`endpoints documented: ${eps.length}`);
