
'use client';
import React, { useState } from 'react';

const htmlFiles = [
  { name: 'cotizacion_cores.html', path: '/cotizacion_cores.html' },
  { name: 'cotizacion_creatina.html', path: '/cotizacion_creatina.html' },
];

export default function HtmlPreviewer() {
  const [selected, setSelected] = useState(htmlFiles[0].path);

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-2">Visor de archivos HTML</h2>
      <select
        className="border p-2 mb-4"
        value={selected}
        onChange={e => setSelected(e.target.value)}
      >
        {htmlFiles.map(f => (
          <option key={f.path} value={f.path}>{f.name}</option>
        ))}
      </select>
      <div className="border rounded shadow overflow-hidden" style={{height: '80vh'}}>
        <iframe
          src={selected}
          title="HTML Preview"
          style={{ width: '100%', height: '100%', border: 'none' }}
        />
      </div>
    </div>
  );
}
