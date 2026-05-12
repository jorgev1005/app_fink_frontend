
export interface StandardAccount {
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  subType: string;
  description?: string;
}

export const STANDARD_ACCOUNTS: StandardAccount[] = [
  // ACTIVOS
  { code: '1.0.00.000', name: 'ACTIVO', type: 'ASSET', subType: 'OTHER', description: 'Cuenta raíz de activos' },
  { code: '1.1.00.000', name: 'ACTIVO CORRIENTE', type: 'ASSET', subType: 'OTHER', description: 'Activos líquidos' },
  { code: '1.1.01.000', name: 'EFECTIVO Y EQUIVALENTES', type: 'ASSET', subType: 'CASH', description: 'Caja y bancos' },
  { code: '1.1.01.001', name: 'Caja General', type: 'ASSET', subType: 'CASH', description: 'Efectivo en mano' },
  { code: '1.1.01.002', name: 'Caja Chica', type: 'ASSET', subType: 'CASH', description: 'Gastos menores' },
  { code: '1.1.01.003', name: 'Banco Nacional', type: 'ASSET', subType: 'BANK', description: 'Cuenta bancaria principal' },
  { code: '1.1.01.004', name: 'Banco Internacional', type: 'ASSET', subType: 'BANK', description: 'Cuenta en moneda extranjera' },
  { code: '1.1.02.000', name: 'CUENTAS POR COBRAR', type: 'ASSET', subType: 'RECEIVABLE', description: 'Deudas de clientes' },
  { code: '1.1.02.001', name: 'Clientes Nacionales', type: 'ASSET', subType: 'RECEIVABLE', description: '' },
  { code: '1.1.03.000', name: 'INVENTARIOS', type: 'ASSET', subType: 'INVENTORY', description: 'Mercancía' },
  
  { code: '1.2.00.000', name: 'ACTIVO NO CORRIENTE', type: 'ASSET', subType: 'OTHER', description: 'Activos fijos' },
  { code: '1.2.01.000', name: 'PROPIEDAD PLANTA Y EQUIPO', type: 'ASSET', subType: 'FIXED_ASSET', description: '' },
  { code: '1.2.01.001', name: 'Mobiliario y Equipo', type: 'ASSET', subType: 'FIXED_ASSET', description: '' },
  { code: '1.2.01.002', name: 'Equipos de Computación', type: 'ASSET', subType: 'FIXED_ASSET', description: '' },

  // PASIVOS
  { code: '2.0.00.000', name: 'PASIVO', type: 'LIABILITY', subType: 'OTHER', description: 'Cuenta raíz de pasivos' },
  { code: '2.1.00.000', name: 'PASIVO CORRIENTE', type: 'LIABILITY', subType: 'OTHER', description: 'Deudas a corto plazo' },
  { code: '2.1.01.000', name: 'CUENTAS POR PAGAR', type: 'LIABILITY', subType: 'PAYABLE', description: 'Proveedores' },
  { code: '2.1.01.001', name: 'Proveedores Nacionales', type: 'LIABILITY', subType: 'PAYABLE', description: '' },
  { code: '2.1.02.000', name: 'OBLIGACIONES LABORALES', type: 'LIABILITY', subType: 'PAYABLE', description: 'Sueldos y beneficios' },

  // PATRIMONIO
  { code: '3.0.00.000', name: 'PATRIMONIO', type: 'EQUITY', subType: 'OTHER', description: 'Capital contable' },
  { code: '3.1.00.000', name: 'CAPITAL SOCIAL', type: 'EQUITY', subType: 'OTHER', description: '' },
  { code: '3.2.00.000', name: 'RESULTADOS ACUMULADOS', type: 'EQUITY', subType: 'OTHER', description: '' },

  // INGRESOS
  { code: '4.0.00.000', name: 'INGRESOS', type: 'REVENUE', subType: 'OTHER', description: 'Ventas y otros ingresos' },
  { code: '4.1.00.000', name: 'INGRESOS OPERATIVOS', type: 'REVENUE', subType: 'OPERATING', description: '' },
  { code: '4.1.01.000', name: 'VENTAS', type: 'REVENUE', subType: 'OPERATING', description: '' },
  { code: '4.1.01.001', name: 'Ventas de Servicios', type: 'REVENUE', subType: 'OPERATING', description: '' },
  { code: '4.1.01.002', name: 'Ventas de Productos', type: 'REVENUE', subType: 'OPERATING', description: '' },

  // GASTOS
  { code: '5.0.00.000', name: 'GASTOS', type: 'EXPENSE', subType: 'OTHER', description: 'Gastos operativos y administrativos' },
  { code: '5.1.00.000', name: 'GASTOS OPERATIVOS', type: 'EXPENSE', subType: 'OPERATING', description: '' },
  { code: '5.1.01.000', name: 'GASTOS DE PERSONAL', type: 'EXPENSE', subType: 'OPERATING', description: 'Nómina' },
  { code: '5.1.01.001', name: 'Sueldos y Salarios', type: 'EXPENSE', subType: 'OPERATING', description: '' },
  { code: '5.1.02.000', name: 'SERVICIOS PÚBLICOS', type: 'EXPENSE', subType: 'OPERATING', description: '' },
  { code: '5.1.02.001', name: 'Electricidad', type: 'EXPENSE', subType: 'OPERATING', description: '' },
  { code: '5.1.02.002', name: 'Internet y Telefonía', type: 'EXPENSE', subType: 'OPERATING', description: '' },
  { code: '5.1.03.000', name: 'MANTENIMIENTO', type: 'EXPENSE', subType: 'OPERATING', description: '' },
];
