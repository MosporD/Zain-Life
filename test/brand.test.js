// Brands: one codebase, two apps. Checks that the personal app has nothing Zain in it (text, logo,
// swirl mark, step challenge), that the Zain app is unchanged, and that www/brand.js matches brands/zain.
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');
const B = require('../tools/brand.js');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'brand-test-'));
const read = (dir, f) => fs.readFileSync(path.join(dir, f), 'utf8');

// Every brand builds and has no other brand's text.
for (const id of B.ids()) {
  const dir = path.join(tmp, id);
  B.buildWeb(id, dir);
  assert.deepStrictEqual(B.leaks(id, [dir]), [], id + ' has another brand\'s text');
}

const zain = path.join(tmp, 'zain'), mine = path.join(tmp, 'personal'), P = B.load('personal');
// Zain build: the source as it is, except brand.js.
for (const f of ['index.html', 'app.js', 'ar.js', 'styles.css', 'challenge.js']) assert.strictEqual(read(zain, f), read(path.join(__dirname, '..', 'www'), f), 'zain ' + f + ' changed');
assert.ok(!fs.existsSync(path.join(zain, 'brand', 'personal')), 'personal assets in the Zain app');

// Personal build: own name, logo, colours, no challenge.
const html = read(mine, 'index.html');
assert.ok(html.includes('<title>' + P.name + '</title>'));
assert.ok(html.includes('brand/personal/logo.svg') && html.includes('brand/personal/theme.css'));
assert.ok(html.includes(P.mark), 'splash uses the personal mark');
assert.ok(!html.includes('challenge.js') && !fs.existsSync(path.join(mine, 'challenge.js')), 'challenge left in');
assert.ok(!fs.existsSync(path.join(mine, 'brand', 'zain')), 'Zain logo shipped');
assert.ok(read(mine, 'life.js').includes('Downloads/' + P.folder), 'backup folder renamed');
assert.ok(read(mine, 'ar.js').includes(P.nameAr), 'Arabic name');
// Arabic words that merely contain the letters of the short name stay intact ("تخزين" = storage).
const ar = read(path.join(__dirname, '..', 'www'), 'ar.js');
if (ar.includes('تخزين')) assert.ok(read(mine, 'ar.js').includes('تخزين'), 'Arabic word damaged');
// brand.js carries the brand's switches.
const win = {}; new Function('window', 'document', read(mine, 'brand.js'))(win, { documentElement: { setAttribute() {} } });
assert.strictEqual(win.BRAND.id, 'personal'); assert.strictEqual(win.BRAND.features.challenge, false);

// The www/brand.js default matches brands/zain/brand.json.
const src = {}; new Function('window', 'document', read(path.join(__dirname, '..', 'www'), 'brand.js'))(src, { documentElement: { setAttribute() {} } });
const Z = B.load('zain');
assert.deepStrictEqual(src.BRAND, { id: Z.id, name: Z.name, nameAr: Z.nameAr, folder: Z.folder, features: Z.features });

// Each brand has its own app id, key and APK name.
const all = B.ids().map(B.load);
for (const k of ['appId', 'apk', 'folder']) assert.strictEqual(new Set(all.map(b => b[k])).size, all.length, 'brands share ' + k);
assert.strictEqual(new Set(all.map(b => b.key.dir + '/' + b.key.file)).size, all.length, 'brands share a signing key');

fs.rmSync(tmp, { recursive: true, force: true });
console.log('brand: all passed');
