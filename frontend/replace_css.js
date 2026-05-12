const fs = require('fs');
let code = fs.readFileSync('src/components/BatchPaymentModal.tsx', 'utf-8');

// Replace standard container classes
code = code.replace('<div className="fixed inset-0 bg-black/40 flex items-center justify-center">', '<div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[50] p-4">');
code = code.replace('<div className="bg-white p-4 rounded shadow w-[720px] max-h-[80vh] overflow-auto">', '<div className="bg-white p-6 rounded-2xl shadow-2xl w-[800px] max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 border border-slate-100">');
code = code.replace('<h3 className="text-lg font-semibold mb-2">', '<h3 className="text-lg font-bold text-slate-800 mb-4">');

// Replace labels, selects, inputs
code = code.replace(/<label className="block text-sm font-medium mb-1">/g, '<label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">');
code = code.replace(/className="w-full border rounded p-2"/g, 'className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"');
code = code.replace(/className="w-full border rounded p-2 mb-4"/g, 'className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm mb-4"');
code = code.replace(/className="border rounded p-1 w-24 text-sm"/g, 'className="w-24 px-2 py-1 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm font-mono font-medium"');

// Buttons
code = code.replace(/className="px-4 py-2 border rounded text-sm"/g, 'className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-xl px-5 py-2 transition-colors"');
code = code.replace(/className="px-4 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50"/g, 'className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-md px-5 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"');

// Tr list
code = code.replace('<div className="flex flex-col gap-2 mb-4 max-h-[30vh] overflow-y-auto border p-2 bg-gray-50 rounded">', '<div className="flex flex-col gap-3 mb-6 max-h-[40vh] overflow-y-auto border border-slate-100 p-4 bg-slate-50 rounded-xl shadow-inner">');
code = code.replace(/<div key={a\.transactionId} className="flex gap-2 items-center bg-white p-2 border rounded shadow-sm">/g, '<div key={a.transactionId} className="flex gap-4 items-center justify-between bg-white p-3 border border-slate-100 rounded-xl shadow-sm hover:shadow-md transition-shadow">');

// Open Button
code = code.replace('<button onClick={handleOpen} className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm disabled:opacity-50 flex items-center gap-1">', '<button onClick={handleOpen} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">');

// Layout structure adjustments
code = code.replace('<div className="grid grid-cols-2 gap-4 mb-4">', '<div className="grid grid-cols-2 gap-5 mb-6">');
code = code.replace('<div className="flex justify-end gap-2">', '<div className="flex justify-end gap-3 mt-6 pt-6 border-t border-slate-100">');

// Item flex adjustments
code = code.replace('<div className="font-mono text-sm px-2">{a.code}</div>', '<div className="font-mono text-sm px-2 font-medium text-slate-600">{a.code}</div>');
code = code.replace('<div className="text-sm font-medium">{a.currency} {Number(a.outstanding).toFixed(2)}</div>', '<div className="text-sm font-bold text-slate-800">{a.currency} {new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2 }).format(Number(a.outstanding))}</div>');

fs.writeFileSync('src/components/BatchPaymentModal.tsx', code);
console.log("Done");
