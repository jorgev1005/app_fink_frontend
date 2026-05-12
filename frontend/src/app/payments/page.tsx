"use client";
import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4002';

export default function PaymentsPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [projectId, setProjectId] = useState('');
  const [itemsText, setItemsText] = useState('');

  useEffect(() => { fetchList(); }, []);

  const fetchList = async () => {
    const res = await fetch(`${API}/api/payments`, { credentials: 'include' });
    const j = await res.json();
    setPayments(j.data || []);
  };

  const importItems = async () => {
    let items = [];
    try { items = JSON.parse(itemsText); } catch (e) { return alert('Invalid JSON'); }
    const res = await fetch(`${API}/api/payments/import`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, items }), credentials: 'include' });
    const j = await res.json();
    if (j.success) { alert('Imported'); fetchList(); } else alert(j.error?.message || 'Error');
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Pagos</h2>
      <div className="mb-4">
        <label className="block">ProjectId</label>
        <input className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)} />
      </div>
      <div className="mb-4">
        <label className="block">Import items (JSON array)</label>
        <textarea className="input h-32" value={itemsText} onChange={(e) => setItemsText(e.target.value)} />
        <button className="btn btn-fink mt-2" onClick={importItems}>Importar</button>
      </div>
      <div>
        <table className="w-full">
          <thead><tr><th>Code</th><th>Date</th><th>Amount</th><th>Currency</th></tr></thead>
          <tbody>{payments.map(p => (<tr key={p.id}><td>{p.code}</td><td>{new Date(p.date).toLocaleString()}</td><td>{p.amount}</td><td>{p.currency}</td></tr>))}</tbody>
        </table>
      </div>
    </div>
  );
}
