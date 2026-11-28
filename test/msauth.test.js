// Run: node test/msauth.test.js
const assert = require('assert');
const M = require('../www/msauth.js');

assert.strictEqual(M.b64url(new Uint8Array([251, 255, 191])), '-_-_');
const q = M.query('com.zainlife.app://auth?code=0.AbC-d_e%2Bf&state=xyz&session_state=1');
assert.deepStrictEqual(q, { code: '0.AbC-d_e+f', state: 'xyz', session_state: '1' });
assert.strictEqual(M.query('com.zainlife.app://auth?error=access_denied&error_description=AADSTS65004%3A+User+declined').error_description, 'AADSTS65004: User declined');
assert.deepStrictEqual(M.query('com.zainlife.app://auth'), {});

const cfg = { clientId: 'abc', tenant: 'common', redirectUri: 'com.zainlife.app://auth', scopes: 'openid profile email User.Read' };
const u = new URL(M.authorizeUrl(cfg, 'st', 'ch', 'S256'));
assert.strictEqual(u.origin + u.pathname, 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
assert.strictEqual(u.searchParams.get('redirect_uri'), 'com.zainlife.app://auth');
assert.strictEqual(u.searchParams.get('scope'), 'openid profile email User.Read');
assert.strictEqual(u.searchParams.get('code_challenge_method'), 'S256');
assert.strictEqual(u.searchParams.get('response_type'), 'code');

const enc = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const tok = enc({ alg: 'none' }) + '.' + enc({ name: 'Malek M', preferred_username: 'malek@zain.com', tid: 'zain-tid', oid: 'o1' }) + '.sig';
const claims = M.jwtClaims(tok);
assert.strictEqual(claims.preferred_username, 'malek@zain.com');
assert.deepStrictEqual(M.jwtClaims('garbage'), {});

let a = M.accountFrom(claims, { displayName: 'Malek Mohammad', mail: 'Malek.Mohammad@zain.com', jobTitle: 'RAN Engineer', department: 'Technology' });
assert.strictEqual(a.name, 'Malek Mohammad');
assert.strictEqual(a.email, 'Malek.Mohammad@zain.com');
assert.strictEqual(a.kind, 'work');
assert.strictEqual(a.title, 'RAN Engineer');
a = M.accountFrom({ name: 'Me', email: 'me@outlook.com', tid: M.PERSONAL_TENANT }, {});   // Graph call failed
assert.strictEqual(a.email, 'me@outlook.com');
assert.strictEqual(a.kind, 'personal');
assert.strictEqual(a.title, '');

assert.strictEqual(M.errorText('access_denied', 'AADSTS65004: User declined to consent'), 'Sign-in was cancelled.');
assert.strictEqual(M.errorText('invalid_grant', 'AADSTS65001: The user or administrator has not consented'), 'Your organisation needs an admin to approve Zain Life first.');
assert.strictEqual(M.errorText('unauthorized_client', 'AADSTS700016: Application not found'), 'The app ID in ms-config.js is not found. Check the client ID.');
assert.strictEqual(M.errorText('x', 'AADSTS90002: Tenant not found. Trace ID: 1'), 'Microsoft sign-in failed (AADSTS90002).');
console.log('msauth tests passed');
