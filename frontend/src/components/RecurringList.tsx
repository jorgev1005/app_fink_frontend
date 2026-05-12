"use client";
import React from 'react';
import { Zap, Edit, Trash2, Calendar, Repeat, DollarSign, PlayCircle, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import api from '../lib/api';

type Rule = any;

export default function RecurringList({ rules, onTrigger, onDelete }: { rules: Rule[]; onTrigger: (id: string) => void; onDelete?: (id: string) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="h-8 w-1 bg-blue-500 rounded-full"></div>
        <h3 className="text-xl font-semibold">Facturas periódicas / Recurrentes</h3>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
          {rules.length}
        </span>
      </div>

      {rules.length === 0 ? (
        <div className="p-8 bg-gray-50 rounded-lg border border-dashed border-gray-200 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
            <Repeat className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-gray-500 font-medium">No hay reglas de recurrencia</p>
          <p className="text-sm text-gray-400">Configura pagos automáticos para ahorrar tiempo.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rules.map((r: any) => (
            <div key={r.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex flex-col justify-between hover:shadow-md transition-shadow">
              <div className="mb-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="font-semibold text-lg truncate pr-2" title={r.name || r.id}>
                    {r.name || 'Sin nombre'}
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100 uppercase">
                    {r.frequency}
                  </span>
                </div>
                
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-gray-400" />
                    <span className="font-medium text-gray-900">{r.currency} {Number(r.amount).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Repeat className="w-4 h-4 text-gray-400" />
                    <span>Cada {r.interval} {r.frequency === 'MONTHLY' ? 'mes(es)' : r.frequency === 'WEEKLY' ? 'semana(s)' : 'días'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span>Próxima: {r.nextRunAt ? new Date(r.nextRunAt).toLocaleDateString() : '-'}</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    className="btn btn-sm btn-outline flex items-center justify-center gap-1 w-full" 
                    onClick={() => onTrigger(r.id)}
                    title="Ejecutar regla ahora"
                  >
                    <Zap className="w-3 h-3" />
                    Trigger
                  </button>
                  
                  <button
                    className="btn btn-sm btn-primary flex items-center justify-center gap-1 w-full"
                    onClick={async () => {
                      if(!confirm('¿Generar factura y marcar como pagada inmediatamente?')) return;
                      try {
                        const trig = await api.recurring.trigger(r.id);
                        const occ = trig.data?.data?.occurrence;
                        if (!occ) {
                          alert('No occurrence returned');
                          return;
                        }
                        await api.recurring.markPaidOccurrence(occ.id);
                        // Refresh logic should be passed down or handled via context/reload
                        window.location.reload(); 
                      } catch (e: any) {
                        console.error(e);
                        alert('Error: ' + (e?.message || JSON.stringify(e)));
                      }
                    }}
                    title="Trigger y Pagar"
                  >
                    <CheckCircle className="w-3 h-3" />
                    Pagar
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2 mt-1">
                  <Link 
                    href={`/recurring/${r.id}`} 
                    className="btn btn-sm btn-ghost text-gray-500 hover:text-blue-600 flex-1 flex items-center justify-center gap-1"
                  >
                    <Edit className="w-3 h-3" />
                    Editar
                  </Link>
                  
                  {onDelete && (
                    <button 
                      className="btn btn-sm btn-ghost text-gray-400 hover:text-red-600 flex-1 flex items-center justify-center gap-1"
                      onClick={() => onDelete(r.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
