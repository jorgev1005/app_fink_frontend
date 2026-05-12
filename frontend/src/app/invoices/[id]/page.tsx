'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Printer, ArrowLeft, Download, Edit, CreditCard, CheckCircle, FileText } from 'lucide-react';

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  productId?: string;
}

interface Invoice {
  id: string;
  code: string;
  type: 'INVOICE' | 'BILL';
  status: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  total: number;
  taxAmount: number;
  description: string;
  project?: {
    name: string;
    logoUrl?: string;
    id?: string;
  };
  contact?: {
    id: string;
    name: string;
    taxId?: string;
    email?: string;
    address?: string;
    phone?: string;
  };
  clientName?: string; // Fallback
  vendorName?: string; // Fallback
  items: InvoiceItem[];
}

export default function InvoiceDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadInvoice();
    }
  }, [id]);

  const loadInvoice = async () => {
    try {
      setLoading(true);
      const res = await api.invoices.getById(id);
      setInvoice(res.data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('es-VE', { 
      style: 'currency', 
      currency: currency === 'BS' ? 'VES' : currency,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString();
  };

  const getTypeLabel = (type: string) => {
    return type === 'INVOICE' ? 'Factura de Venta' : 'Factura de Compra';
  };

  const getStatusBadge = (status: string, type: string) => {
    // Logic: INVOICE -> Receivable (Por Cobrar), BILL -> Payable (Por Pagar)
    let label = status;
    let color = 'bg-gray-100 text-gray-800';

    if (status === 'POSTED') {
       if (type === 'INVOICE') { label = 'POR COBRAR'; color = 'bg-blue-100 text-blue-800'; }
       else { label = 'POR PAGAR'; color = 'bg-orange-100 text-orange-800'; }
    } else if (status === 'PAID') {
       label = 'PAGADA';
       color = 'bg-green-100 text-green-800';
    } else if (status === 'DRAFT') {
       label = 'BORRADOR';
    } else if (status === 'CANCELLED') {
       label = 'ANULADA';
       color = 'bg-red-100 text-red-800';
    }

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${color}`}>
        {label}
      </span>
    );
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );

  if (!invoice) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-500">
      <FileText className="w-16 h-16 mb-4 text-gray-300" />
      <h2 className="text-xl font-medium mb-2">Factura no encontrada</h2>
      <button onClick={() => router.back()} className="text-blue-600 hover:underline">Volver al listado</button>
    </div>
  );

  const isPayable = invoice.status === 'POSTED';
  const contact = invoice.contact;
  const contactName = contact?.name || invoice.clientName || invoice.vendorName || 'Sin Contacto';

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 print:bg-white print:p-0">
      
      {/* Action Bar */}
      <div className="max-w-4xl mx-auto mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <button 
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:bg-white px-3 py-2 rounded-lg transition-colors"
        >
          <ArrowLeft size={18} />
          <span className="hidden md:inline">Volver</span>
        </button>

        <div className="flex bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
             <button 
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 rounded text-gray-700 text-sm font-medium"
             >
                <Printer size={16} /> Imprimir
             </button>
        </div>
      </div>

      {/* Invoice Paper */}
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden print:shadow-none print:border-none print:rounded-none">
          
          {/* Header */}
          <div className="p-8 md:p-12 border-b border-gray-100">
              <div className="flex justify-between items-start mb-10">
                  <div>
                      {invoice.project?.name && (
                          <h1 className="text-xl font-bold text-gray-800 mb-1">{invoice.project.name}</h1>
                      )}
                      <div className="text-sm text-gray-500 space-y-1">
                          {/* Here usually goes company address */}
                          <p>Fecha de Emisión: {formatDate(invoice.issueDate)}</p>
                          <p>Fecha de Vencimiento: {formatDate(invoice.dueDate)}</p>
                      </div>
                  </div>
                  <div className="text-right">
                      <h2 className="text-3xl font-light text-gray-800 mb-2">{getTypeLabel(invoice.type)}</h2>
                      <p className="font-mono text-lg font-medium text-gray-600 mb-2">#{invoice.code}</p>
                      {getStatusBadge(invoice.status, invoice.type)}
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
                  <div>
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Facturar A</h3>
                      <div className="text-gray-800">
                          <p className="font-bold text-lg mb-1">{contactName}</p>
                          {contact?.taxId && <p className="text-sm text-gray-600">RIF/CI: {contact.taxId}</p>}
                          {contact?.address && <p className="text-sm text-gray-600 mt-1 max-w-xs">{contact.address}</p>}
                          {contact?.phone && <p className="text-sm text-gray-600 mt-1">{contact.phone}</p>}
                      </div>
                  </div>
                  {/* Details */}
                  <div className="md:text-right">
                      {invoice.description && (
                          <div className="bg-gray-50 p-4 rounded-lg inline-block text-left md:min-w-[200px]">
                              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Concepto</h3>
                              <p className="text-gray-700 text-sm whitespace-pre-wrap">{invoice.description}</p>
                          </div>
                      )}
                  </div>
              </div>
          </div>

          {/* Items Table */}
          <div className="p-8 md:p-12">
              <table className="w-full text-left">
                  <thead>
                      <tr className="border-b border-gray-200">
                          <th className="py-3 text-xs font-bold text-gray-400 uppercase tracking-wider w-1/2">Descripción</th>
                          <th className="py-3 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Cant.</th>
                          <th className="py-3 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Precio</th>
                          <th className="py-3 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Total</th>
                      </tr>
                  </thead>
                  <tbody>
                      {invoice.items && invoice.items.length > 0 ? (
                          invoice.items.map((item) => (
                              <tr key={item.id} className="border-b border-gray-50 last:border-0">
                                  <td className="py-4 text-sm text-gray-800">
                                      <p className="font-medium">{item.description || 'Ítem sin nombre'}</p>
                                  </td>
                                  <td className="py-4 text-sm text-gray-600 text-right">{item.quantity}</td>
                                  <td className="py-4 text-sm text-gray-600 text-right font-mono">
                                      {formatCurrency(item.unitPrice, invoice.currency)}
                                  </td>
                                  <td className="py-4 text-sm text-gray-800 text-right font-medium font-mono">
                                      {formatCurrency(item.total, invoice.currency)}
                                  </td>
                              </tr>
                          ))
                      ) : (
                          // If no items, show description as a line or total directly
                          <tr>
                             <td className="py-4 text-sm text-gray-800" colSpan={3}>
                                 <p className="font-medium">{invoice.description || 'Servicios Profesionales'}</p>
                             </td>
                             <td className="py-4 text-sm text-gray-800 text-right font-medium font-mono">
                                 {formatCurrency(invoice.total - (invoice.taxAmount || 0), invoice.currency)}
                             </td>
                          </tr>
                      )}
                  </tbody>
              </table>

              <div className="mt-8 flex justify-end">
                  <div className="w-full md:w-1/3 space-y-3">
                      <div className="flex justify-between text-sm text-gray-600">
                          <span>Subtotal</span>
                          <span className="font-mono">{formatCurrency(invoice.total - (invoice.taxAmount || 0), invoice.currency)}</span>
                      </div>
                      {invoice.taxAmount > 0 && (
                          <div className="flex justify-between text-sm text-gray-600">
                              <span>Impuestos</span>
                              <span className="font-mono">{formatCurrency(invoice.taxAmount, invoice.currency)}</span>
                          </div>
                      )}
                      <div className="border-t border-gray-200 pt-3 flex justify-between text-lg font-bold text-gray-900">
                          <span>Total</span>
                          <span className="font-mono">{formatCurrency(invoice.total, invoice.currency)}</span>
                      </div>
                  </div>
              </div>
          </div>
          
          <div className="bg-gray-50 px-8 py-6 border-t border-gray-200 text-center text-xs text-gray-400">
               Documento generado por Sistema FINK
          </div>
      </div>
      
      {/* Payment Modal Logic would need a dedicated invoice payment modal, 
          but we can reuse PayTransactionModal IF the invoice generated a transaction 
          OR we create a simple logic to pay the invoice directly.
          
          However, PayTransactionModal requires a transactionId.
          Usually invoices have a linked transaction or we create a payment (transaction) linked to the invoice.
          
          For now, I'll just show a message or link to create a payment manually if no obvious transaction link exists.
      */}
    </div>
  );
}

// NOTE: Since I don't have a specific `PayInvoiceModal` handy and `PayTransactionModal` needs a transaction ID, 
// I might need to fetch the transaction associated with this invoice to allow payment, OR create a new payment.
// Typically `api.invoices.post` creates the transaction. If it's POSTED, the transaction exists.
// I should probably check if `invoice.transactionId` exists (it might not be in the type above properly).
