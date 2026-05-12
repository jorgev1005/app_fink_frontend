import React from 'react';
import BankImportWizard from '@/components/BankImportWizard';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ImportPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/transactions" className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-slate-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Importar Movimientos Bancarios</h1>
          <p className="text-slate-500">Sube tus estados de cuenta (Excel/CSV) y regístralos masivamente.</p>
        </div>
      </div>
      
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <BankImportWizard />
      </div>
    </div>
  );
}
