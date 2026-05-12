"use client";
import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import QuickTransaction from '@/components/QuickTransaction';

function NewTransactionContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId') || undefined;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <QuickTransaction defaultProjectId={projectId} />
    </div>
  );
}

export default function NewTransactionPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Cargando...</div>}>
      <NewTransactionContent />
    </Suspense>
  );
}
