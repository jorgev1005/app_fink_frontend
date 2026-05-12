'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { formatDateForDisplay } from '@/lib/dateUtils';
import { Printer, ArrowLeft, MessageCircle } from 'lucide-react';

export default function TransactionReceiptPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [transaction, setTransaction] = useState<any>(null);
  const [paymentRecord, setPaymentRecord] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadTransaction();
    }
  }, [id]);

  const loadTransaction = async () => {
    try {
      const res = await api.transactions.getById(id);
      const transactionData = res.data.data;
      setTransaction(transactionData);

      if (transactionData?.projectId) {
        const paymentsRes = await api.payments.getAll({ projectId: transactionData.projectId, limit: 1000 });
        const relatedPayment = (paymentsRes.data?.data || []).find((payment: any) => payment.transactionId === transactionData.id);
        setPaymentRecord(relatedPayment || null);
      } else {
        setPaymentRecord(null);
      }
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

  const formatPaymentMethod = (method?: string | null) => {
    switch (method) {
      case 'BANK_TRANSFER':
        return 'Transferencia';
      case 'MOBILE_PAYMENT':
        return 'Pago Móvil';
      case 'CASH':
        return 'Efectivo';
      case 'CARD':
        return 'Tarjeta';
      case 'CHEQUE':
        return 'Cheque';
      case 'OTHER':
        return 'Otro';
      default:
        return method || 'Otros';
    }
  };

  const receiptReference = paymentRecord?.reference || transaction?.reference || null;
  const receiptMethod = paymentRecord?.method || transaction?.paymentMethod || null;

  const shareViaWhatsApp = () => {
    if (!transaction) return;
    
    // User terminology: INCOME/COLLECTION = Cobro, EXPENSE/PAYMENT = Pago
    const isIncome = ['INCOME', 'COLLECTION'].includes(transaction.type);
    const amountStr = formatCurrency(transaction.amount, transaction.currency);
    const dateStr = formatDateForDisplay(transaction.date);
    
    const company = transaction.project?.name || 'Nosotros';
    const counterparty = transaction.contactPerson?.name || transaction.recipientName || 'Cliente/Proveedor';

    // Tailor message based on type
    let header = '';
    let direction = '';
    
    if (isIncome) {
      header = 'RECIBO DE COBRO';
      direction = `*Recibimos de:* ${counterparty}`;
    } else {
      header = 'COMPROBANTE DE PAGO';
      direction = `*Pagado a:* ${counterparty}`;
    }

    // Construct the message
    const text = 
`*${header}*
${direction}
*Monto:* ${amountStr}

*Concepto:* ${transaction.description || 'Sin descripción'}
*Fecha:* ${dateStr}
*Ref:* ${receiptReference || transaction.code}

*Emitido por:* ${company}

_Generado en App Fink_`;

    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  if (loading) return <div className="p-10 text-center">Cargando recibo...</div>;
  if (!transaction) return <div className="p-10 text-center text-red-500">Transacción no encontrada</div>;

  return (
    <div className="min-h-screen bg-slate-100 p-8 print:bg-white print:p-0">
      {/* Controls - Hidden on Print */}
      <div className="max-w-3xl mx-auto mb-6 flex justify-between items-center print:hidden">
        <button 
          onClick={() => router.back()}
          className="flex items-center gap-2 text-slate-600 hover:bg-white px-4 py-2 rounded-lg transition-colors"
        >
          <ArrowLeft size={18} />
          Volver
        </button>

        <div className="flex gap-3">
          <button 
            onClick={shareViaWhatsApp}
            className="flex items-center gap-2 bg-[#25D366] text-white px-6 py-2 rounded-lg hover:bg-[#128C7E] transition-colors shadow-lg font-medium"
          >
            <MessageCircle size={18} />
            Enviar por WhatsApp
          </button>

          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2 rounded-lg hover:bg-slate-800 transition-colors shadow-lg"
          >
            <Printer size={18} />
            Imprimir Recibo
          </button>
        </div>
      </div>

      {/* Ticket / Receipt Container */}
      <div className="max-w-3xl mx-auto bg-white p-12 rounded-xl shadow-sm border border-slate-200 print:shadow-none print:border-none print:w-full">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-slate-100 pb-8 mb-8">
            <div>
                {/* Logo or Placeholder */}
                {transaction.project?.logoUrl ? (
                     <img 
                        src={`/backend-api${transaction.project.logoUrl}`} 
                        alt="Logo Empresa" 
                        className="h-16 w-auto object-contain mb-4" 
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                     />
                ) : (
                    <div className="w-12 h-12 bg-slate-900 rounded-lg flex items-center justify-center text-white font-bold mb-4">
                        F
                    </div>
                )}
                
                <h1 className="text-2xl font-bold text-slate-800">
                  {['INCOME', 'COLLECTION'].includes(transaction.type) ? 'Recibo de Cobro' : 'Recibo de Pago'}
                </h1>
                <p className="text-slate-500">Nro. {receiptReference || transaction.code}</p>
            </div>
            <div className="text-right">
                <h2 className="font-bold text-slate-800 text-lg">{transaction.project?.name || 'Empresa'}</h2>
                <p className="text-slate-500 text-sm">Fecha: {formatDateForDisplay(transaction.date)}</p>
                <div className="mt-2 inline-block px-3 py-1 bg-slate-50 rounded text-sm font-medium text-slate-600">
                    Estado: {transaction.status === 'COMPLETED' ? 'Completado' : transaction.status}
                </div>
            </div>
        </div>

        {/* Content */}
        <div className="space-y-8">
            {/* Amount Box */}
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 text-center">
                <p className="text-slate-500 text-sm uppercase tracking-wider font-semibold mb-1">Monto Total</p>
                <div className="text-4xl font-bold text-slate-900">
                    {formatCurrency(transaction.amount, transaction.currency)}
                </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-8">
                <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                        {['INCOME', 'COLLECTION'].includes(transaction.type) ? 'Recibido De' : 'Pagado A'}
                    </h3>
                    <p className="text-lg font-medium text-slate-800">
                        {transaction.contactPerson?.name || transaction.recipientName || 'Sin Contacto'}
                    </p>
                    {transaction.contactPerson?.taxId && (
                         <p className="text-slate-500 text-sm">{transaction.contactPerson.taxId}</p>
                    )}
                </div>
                <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                        Método de Pago
                    </h3>
                    <p className="text-lg font-medium text-slate-800">
                      {formatPaymentMethod(receiptMethod)}
                    </p>
                    {receiptReference && (
                      <p className="text-slate-500 text-sm">Ref: {receiptReference}</p>
                    )}
                </div>
            </div>

            {/* Description */}
            <div>
                 <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Concepto / Descripción
                </h3>
                <div className="p-4 bg-white border border-slate-200 rounded-lg text-slate-700">
                    {transaction.description || 'Sin descripción'}
                </div>
            </div>
        </div>

        {/* Footer / Signature Area */}
        <div className="mt-20 pt-8 border-t border-slate-100 grid grid-cols-2 gap-20">
            <div className="text-center">
                <div className="border-b border-slate-300 mb-2 w-3/4 mx-auto"></div>
                <p className="text-xs text-slate-500 uppercase">Recibí Conforme</p>
            </div>
            <div className="text-center">
                <div className="border-b border-slate-300 mb-2 w-3/4 mx-auto"></div>
                <p className="text-xs text-slate-500 uppercase">Por {transaction.project?.name || 'Administración'}</p>
            </div>
        </div>
        
        <div className="mt-12 text-center text-xs text-slate-400 print:mt-8">
            Documento generado electrónicamente por Sistema FINK
        </div>
      </div>

      <style jsx global>{`
        @media print {
            @page { margin: 2cm; }
        }
      `}</style>
    </div>
  );
}

