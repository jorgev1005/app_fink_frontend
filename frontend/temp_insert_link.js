const fs = require('fs');
let dash = fs.readFileSync('src/app/dashboard/page.tsx', 'utf8');

const linkCode = `
          {/* PRÉSTAMOS */}
          <Link href="/loans" className="block group">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md hover:border-blue-500 transition-all">
              <div className="flex items-center mb-4">
                <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-lg text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="ml-4 text-lg font-bold text-gray-800 dark:text-white group-hover:text-blue-600">Préstamos</h3>
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Registro y control de capital e intereses</p>
            </div>
          </Link>
`;

if (!dash.includes('/loans')) {
  dash = dash.replace(
    /<Link href="\/accounts" className="block group">/g,
    linkCode + '\\n          <Link href="/accounts" className="block group">'
  );
  fs.writeFileSync('src/app/dashboard/page.tsx', dash);
  console.log('Link inserted');
} else {
  console.log('Link already exists');
}
