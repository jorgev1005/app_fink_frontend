const fs = require('fs'); const src = fs.readFileSync('/home/fink/backend/src/index.ts', 'utf-8'); console.log(src.split('\n').filter(l => l.toLowerCase().includes('telegram')).join('\n'));
