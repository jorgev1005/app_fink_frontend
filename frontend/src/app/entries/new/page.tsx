"use client";
import UnifiedEntryForm from '@/components/UnifiedEntryForm';
import { useRouter } from 'next/navigation';

export default function NewEntryPage() {
  const router = useRouter();
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Nueva entrada</h2>
        <button className="btn btn-fink" onClick={() => router.push('/invoices')}>Volver a facturas</button>
      </div>
      <UnifiedEntryForm onSaved={() => { router.push('/transactions'); }} />
    </div>
  );
}
