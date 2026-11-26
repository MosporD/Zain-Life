// Compiles and runs the plain-Java StepCheck test (needs a JDK on PATH: javac and java).
const { execFileSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const root = path.join(__dirname, '..', '..');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'stepcheck-'));
execFileSync('javac', ['-d', out, path.join(root, 'native/java/com/personal/lifeplanner/StepCheck.java'), path.join(__dirname, 'StepCheckTest.java')], { stdio: 'inherit' });
execFileSync('java', ['-cp', out, 'com.personal.lifeplanner.StepCheckTest'], { stdio: 'inherit' });
