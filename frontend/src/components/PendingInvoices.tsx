"use client";
import React from 'react';
import { CreditCard, Play, Eye, Trash2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

type Invoice = any;

export default function PendingInvoices({ invoices, onPost, onPay, onDelete }: { invoices: Invoice[]; onPost: (id: string) => void; onPay: (id: string) => void; onDelete?: (id: string) => void }) {
  // Show invoices that are NOT paid. This includes OPEN, DRAFT, PARTIALLY_PAID, POSTED.
  // Also ensure outstanding > 0 just in case, but status check should be enough if logic is correct.
  const pending = invoices.filter(i => i.status !== 'PAID' && Number(i.outstanding) > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="h-8 w-1 bg-yellow-500 rounded-full"></div>
        <h3 className="text-xl font-semibold">Facturas pendientes</h3>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
          {pending.length}
        </span>
      </div>

      {pending.length === 0 ? (
        <div className="p-8 bg-gray-50 rounded-lg border border-dashed border-gray-200 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
            <AlertCircle className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-gray-500 font-medium">No hay facturas pendientes</p>
          <p className="text-sm text-gray-400">Todas tus facturas están al día.</p>
        </div>
      ) : (
        <div className="overflow-hidden bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Tercero</th>
                  <th className="px-4 py-3">Vence</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Pendiente</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pending.map(inv => {
                  const due = inv.dueDate ? new Date(inv.dueDate) : null;
                  const age = due ? Math.ceil((Date.now() - due.getTime()) / (1000 * 60 * 60 * 24)) : null;
                  const isOverdue = age !== null && age > 0;
                  
                  return (
                    <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {inv.code}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {inv.customerName || inv.vendorName || inv.customerId || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {due ? due.toLocaleDateString() : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {inv.currency} {Number(inv.total).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">
                        {inv.currency} {Number(inv.outstanding).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          {inv.status === 'POSTED' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100 w-fit">
                              POSTEADA
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200 w-fit">
                              BORRADOR
                            </span>
                          )}
                          {isOverdue && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-100 w-fit">
                              {age}d vencida
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            className="btn btn-sm btn-primary flex items-center gap-1" 
                            onClick={() => onPay(inv.id)}
                            title="Pagar"
                          >
                            <CreditCard className="w-3 h-3" />
                            <span className="hidden sm:inline">Pagar</span>
                          </button>
                          
                          {inv.status !== 'POSTED' && (
                            <button 
                              className="btn btn-sm btn-outline text-blue-600 border-blue-200 hover:bg-blue-50 flex items-center gap-1" 
                              onClick={() => onPost(inv.id)}
                              title="Postear"
                            >
                              <Play className="w-3 h-3" />
                              <span className="hidden sm:inline">Postear</span>
                            </button>
                          )}
                          
                          <Link 
                            href={`/invoices/${inv.id}`}
                            className="btn btn-sm btn-ghost text-gray-500 hover:text-gray-700"
                            title="Ver detalle"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>

                          {onDelete && (
                            <button
                              onClick={() => onDelete(inv.id)}
                              className="btn btn-sm btn-ghost text-red-400 hover:text-red-600 hover:bg-red-50"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
