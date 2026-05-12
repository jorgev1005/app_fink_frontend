const fs = require('fs');
let code = fs.readFileSync('src/app/recurring/page.tsx', 'utf-8');

const oldGroupFragment = `const InputGroup = ({ label, icon: Icon, tip, children }: { label: string, icon?: any, tip?: string, children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 ml-1">
      {Icon && <Icon size={12} />}
      {label}
    </label>
    {children}
    {tip && <p className="px-1 text-xs leading-relaxed text-slate-500">{tip}</p>}
  </div>
);`;

const newGroupFragment = `const InputGroup = ({ label, icon: Icon, tip, children }: { label: string, icon?: any, tip?: string, children: React.ReactNode }) => (
  <div className="space-y-1.5 relative group">
    <div className="flex items-center justify-between">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 ml-1">
        {Icon && <Icon size={12} />}
        {label}
      </label>
      {tip && <Info size={14} className="text-slate-400 group-hover:text-blue-500 transition-colors cursor-help" />}
    </div>
    {children}
    {tip && (
      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 w-max max-w-[280px] z-50">
        <div className="bg-slate-800 text-white text-xs rounded-xl py-2.5 px-3.5 shadow-2xl leading-relaxed text-center">
          {tip}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-800" />
        </div>
      </div>
    )}
  </div>
);`;

code = code.replace(oldGroupFragment, newGroupFragment);

if (code.includes('RefreshCw, Calendar')) {
  code = code.replace('RefreshCw, Calendar', 'Info, RefreshCw, Calendar');
}

// Convert that free-floating auto-post tip into it's InputGroup tip
code = code.replace(
  '<p className="-mt-3 px-1 text-xs leading-relaxed text-slate-500">Si lo activas, además de generar la ocurrencia, el sistema registrará automáticamente la transacción contable asociada.</p>',
  ''
);

code = code.replace(
  '<div className="flex items-center gap-2 mb-4 bg-white/50 border border-slate-200/60 p-3 rounded-xl">',
  '<div className="flex justify-between items-center bg-white/50 border border-slate-200/60 p-3 rounded-xl relative group">\n                  <div className="flex items-center gap-2">'
);

code = code.replace(
  '<label htmlFor="autoPost" className="text-sm font-medium text-slate-700">',
  '<label htmlFor="autoPost" className="text-sm font-medium text-slate-700">\n                    Afectar saldo (Auto-post)\n                  </label>\n                  </div>\n                  <Info size={14} className="text-slate-400 group-hover:text-blue-500 transition-colors cursor-help" />\n                  <div className="absolute right-0 bottom-full mb-1 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 w-max max-w-[280px] z-50">\n                    <div className="bg-slate-800 text-white text-xs rounded-xl py-2.5 px-3.5 shadow-2xl leading-relaxed text-center">\n                      Si lo activas, el sistema registrará automáticamente la transacción contable.\n                      <div className="absolute top-full right-4 -mt-1 border-4 border-transparent border-t-slate-800" />\n                    </div>\n                  </div>\n                  <div className="hidden">'
);

fs.writeFileSync('src/app/recurring/page.tsx', code);
console.log('Success updating tips');
