const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));
const deps = Object.keys(pkg.dependencies || {});

function readFiles(dir, exts = ['.js', '.jsx', '.ts', '.tsx']) {
    let results = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
            if (e.name === 'node_modules' || e.name === '.git') continue;
            results = results.concat(readFiles(full, exts));
        } else {
            if (exts.includes(path.extname(e.name))) results.push(full);
        }
    }
    return results;
}

const files = readFiles(root);

function used(pkgName) {
    const re = new RegExp(pkgName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'));
    for (const f of files) {
        const content = fs.readFileSync(f, 'utf8');
        if (re.test(content)) return true;
    }
    return false;
}

const unused = [];
for (const d of deps) {
    if (!used(d)) unused.push(d);
}

console.log('Declared dependencies:', deps.length);
if (unused.length === 0) console.log('No unused top-level dependencies detected.');
else {
    console.log('Unused dependencies (caution: dynamic imports/strings may hide usage):');
    unused.forEach(u => console.log('-', u));
}
