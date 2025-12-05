const fs = require('fs');
const path = require('path');

const files = [
    'src/app/page.tsx',
    'src/app/chat/[branchId]/page.tsx',
    'src/app/conversation/[conversationId]/page.tsx',
    'src/app/layout.tsx',
    'src/app/api/analytics/route.ts',
    'src/app/api/auth/[...nextauth]/route.ts',
    'src/app/api/auth/signup/route.ts',
    'src/app/api/branches/create/route.ts',
    'src/app/api/branches/feedback/route.ts',
    'src/app/api/branches/merge/route.ts',
    'src/app/api/branches/promote/route.ts',
    'src/app/api/branches/replay/route.ts',
    'src/app/api/branches/suggest/route.ts',
    'src/app/api/conversations/[id]/route.ts',
    'src/app/api/conversations/route.ts',
    'src/app/api/memory/context/route.ts',
    'src/app/api/memory/extract/route.ts',
    'src/app/api/memory/inherit/route.ts',
    'src/app/api/memory/promote/route.ts',
    'src/app/api/memory/route.ts'
];

console.log('Starting migration...');

files.forEach(file => {
    try {
        const ext = path.extname(file);
        const name = path.basename(file, ext);
        const newName = name + '.' + name + ext;
        const dir = path.dirname(file);
        const newPath = path.join(dir, newName);

        if (fs.existsSync(file)) {
            fs.copyFileSync(file, newPath);
            console.log('Copied ' + file + ' to ' + newPath);
        } else {
            console.log('File not found: ' + file);
        }
    } catch (e) {
        console.error('Error copying ' + file + ': ' + e.message);
    }
});

console.log('Migration complete.');
