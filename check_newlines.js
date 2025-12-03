const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const extensions = ['.ts', '.tsx', '.js', '.jsx', '.css', '.scss', '.json', '.md', '.env'];
const excludeDirs = ['node_modules', '.next', '.git', 'dist', 'build'];

function walk(dir) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            if (!excludeDirs.includes(file)) {
                walk(filePath);
            }
        } else if (extensions.includes(path.extname(filePath)) || file === '.env') {
            checkFile(filePath);
        }
    });
}

function checkFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        if (content.length > 0 && !content.endsWith('\n')) {
            console.log(`Missing newline: ${path.relative(rootDir, filePath)}`);
        }
    } catch (err) {
        // Ignore errors
    }
}

console.log('Checking for missing newlines...');
walk(rootDir);
console.log('Check complete.');
