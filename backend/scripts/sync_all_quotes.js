const fs = require('fs');
const path = require('path');

const quoteTecnisport = {
  id: "COT-20260825-9160",
  correlative: "COT-20260825-9160",
  createdAt: "2026-08-25T23:11:54.663Z",
  channel: "CATALOGO_WEB",
  status: "APPROVED",
  customer: {
    name: "TECNISPORT C.A. - MARCOS ALVAREZ",
    taxId: "J-31200447-9",
    phone: "+58 412-0345153",
    email: "tecnisportca@gmail.com",
    city: "La Victoria, Aragua (Sede Principal)",
    seller: "Oficina",
    gpsCoordinates: "10.304702, -67.321480",
    gpsMapsUrl: "https://maps.google.com/?q=10.304702,-67.321480",
    emissionPlace: "GPS: 10.304702, -67.321480"
  },
  paymentMethod: "bcv_bs",
  rates: {
    bcv: 785.0693,
    paralelo: 929.80,
    eur: 916.03
  },
  items: [
    {
      sku: "LUC-CAR-RAF-H1-004",
      name: "Caja de carton de premiación H1",
      quantity: 200,
      unit: "UNIDAD",
      unitPriceUSD: 0.84,
      unitPriceBs: 659.46,
      subtotalUSD: 168.00,
      subtotalBs: 131891.64,
      medidas: "H1",
      costPrice: 0.60
    },
    {
      sku: "LUC-CAR-RAF-H2-005",
      name: "Caja de carton de premiación H2",
      quantity: 200,
      unit: "UNIDAD",
      unitPriceUSD: 0.84,
      unitPriceBs: 659.46,
      subtotalUSD: 168.00,
      subtotalBs: 131891.64,
      medidas: "H2",
      costPrice: 0.60
    },
    {
      sku: "LUC-CAR-RAF-H21-006",
      name: "Caja de carton de premiación H2 1/2",
      quantity: 200,
      unit: "UNIDAD",
      unitPriceUSD: 0.96,
      unitPriceBs: 753.67,
      subtotalUSD: 192.00,
      subtotalBs: 150733.31,
      medidas: "H2 1/2",
      costPrice: 0.69
    },
    {
      sku: "LUC-CAR-RAF-H3-007",
      name: "Caja de carton de premiación H3",
      quantity: 200,
      unit: "UNIDAD",
      unitPriceUSD: 1.04,
      unitPriceBs: 816.47,
      subtotalUSD: 208.00,
      subtotalBs: 163294.41,
      medidas: "H3",
      costPrice: 0.75
    },
    {
      sku: "LUC-CAR-RAF-H4-008",
      name: "Caja de carton de premiación H4",
      quantity: 150,
      unit: "UNIDAD",
      unitPriceUSD: 1.38,
      unitPriceBs: 1083.40,
      subtotalUSD: 207.00,
      subtotalBs: 162509.35,
      medidas: "H4",
      costPrice: 0.99
    },
    {
      sku: "LUC-CAR-RAF-H5-009",
      name: "Caja de carton de premiación H5",
      quantity: 150,
      unit: "UNIDAD",
      unitPriceUSD: 1.50,
      unitPriceBs: 1177.60,
      subtotalUSD: 225.00,
      subtotalBs: 176640.59,
      medidas: "H5",
      costPrice: 1.08
    },
    {
      sku: "LUC-CAR-RAF-H1T-010",
      name: "Troquel doble para cajas H1",
      quantity: 1,
      unit: "UNIDAD",
      unitPriceUSD: 100.00,
      unitPriceBs: 78506.93,
      subtotalUSD: 100.00,
      subtotalBs: 78506.93,
      medidas: "H1",
      costPrice: 71.15
    },
    {
      sku: "LUC-CAR-RAF-H2T-011",
      name: "Troquel doble para cajas H2",
      quantity: 1,
      unit: "UNIDAD",
      unitPriceUSD: 100.00,
      unitPriceBs: 78506.93,
      subtotalUSD: 100.00,
      subtotalBs: 78506.93,
      medidas: "H2",
      costPrice: 71.15
    },
    {
      sku: "LUC-CAR-RAF-HXT-012",
      name: "Troquel doble para cajas H2 1/2",
      quantity: 1,
      unit: "UNIDAD",
      unitPriceUSD: 100.00,
      unitPriceBs: 78506.93,
      subtotalUSD: 100.00,
      subtotalBs: 78506.93,
      medidas: "H2 1/2",
      costPrice: 71.15
    },
    {
      sku: "LUC-CAR-RAF-H3T-013",
      name: "Troquel doble para cajas H3",
      quantity: 1,
      unit: "UNIDAD",
      unitPriceUSD: 100.00,
      unitPriceBs: 78506.93,
      subtotalUSD: 100.00,
      subtotalBs: 78506.93,
      medidas: "H3",
      costPrice: 71.15
    },
    {
      sku: "LUC-CAR-RAF-H4T-014",
      name: "Troquel doble para cajas H4",
      quantity: 1,
      unit: "UNIDAD",
      unitPriceUSD: 100.00,
      unitPriceBs: 78506.93,
      subtotalUSD: 100.00,
      subtotalBs: 78506.93,
      medidas: "H4",
      costPrice: 71.15
    },
    {
      sku: "LUC-CAR-RAF-H5T-015",
      name: "Troquel doble para cajas H5",
      quantity: 1,
      unit: "UNIDAD",
      unitPriceUSD: 100.00,
      unitPriceBs: 78506.93,
      subtotalUSD: 100.00,
      subtotalBs: 78506.93,
      medidas: "H5",
      costPrice: 71.15
    }
  ],
  totalUSD: 1768.00,
  totalBs: 1388002.52,
  notes: "entregado en el galpon"
};

const quoteBlas = {
  id: "COT-20260805-3813",
  correlative: "COT-20260805-3813",
  createdAt: "2026-08-05T20:40:00.000Z",
  channel: "CATALOGO_WEB",
  status: "APPROVED",
  customer: {
    name: "Blas",
    taxId: "",
    phone: "+58 412-271-1859",
    email: "",
    city: "La Victoria, Aragua",
    seller: "Oficina"
  },
  paymentMethod: "bcv_bs",
  rates: {
    bcv: 755.16,
    paralelo: 832.55,
    eur: 870.04
  },
  items: [
    {
      sku: "LUC-CAR-23185",
      name: "Caja de carton 23x18x5",
      quantity: 1,
      unit: "UNIDAD",
      unitPriceUSD: 0.26,
      unitPriceBs: 196.34,
      subtotalUSD: 0.26,
      subtotalBs: 196.34,
      medidas: "23 x 18 x 5 cm"
    }
  ],
  totalUSD: 0.26,
  totalBs: 196.34,
  notes: ""
};

const quoteRiveyes = {
  id: "COT-20260610-5122",
  correlative: "COT-20260610-5122",
  createdAt: "2026-06-10T23:32:00.000Z",
  channel: "CATALOGO_WEB",
  status: "APPROVED",
  customer: {
    name: "Luis Morales - Riveyes",
    taxId: "",
    phone: "+58 412-271-1859",
    email: "",
    city: "La Victoria, Aragua",
    seller: "Oficina"
  },
  paymentMethod: "bcv_bs",
  rates: {
    bcv: 572.68,
    paralelo: 802.07,
    eur: 662.25
  },
  items: [
    { sku: "LUC-FER-JUL-EST-001", name: "Caja apilable grande estándar", quantity: 1, unit: "UNIDAD", unitPriceUSD: 3.97, subtotalUSD: 3.97 },
    { sku: "ALK-FER-MAR-RED-001", name: "Caja apilable grande reducida negra", quantity: 1, unit: "UNIDAD", unitPriceUSD: 2.50, subtotalUSD: 2.50 },
    { sku: "LUC-FER-MAR-AZU-004", name: "Caja apilable mediana azul", quantity: 1, unit: "UNIDAD", unitPriceUSD: 1.40, subtotalUSD: 1.40 },
    { sku: "LUC-FER-MAR-AZU-005", name: "Caja apilable pequeña azul", quantity: 1, unit: "UNIDAD", unitPriceUSD: 1.00, subtotalUSD: 1.00 },
    { sku: "LUC-ALU-MAR-NEG-002", name: "Cajas apilables medianas negras", quantity: 1, unit: "UNIDAD", unitPriceUSD: 1.40, subtotalUSD: 1.40 },
    { sku: "LUC-ALU-MAR-NEG-001", name: "Cajas apilables pequeñas negras", quantity: 1, unit: "UNIDAD", unitPriceUSD: 1.00, subtotalUSD: 1.00 },
    { sku: "LUC-FER-MAR-ROJ-004", name: "Caja apilable pequeña roja", quantity: 1, unit: "UNIDAD", unitPriceUSD: 1.00, subtotalUSD: 1.00 }
  ],
  totalUSD: 12.27,
  totalBs: 7026.77,
  notes: ""
};

const quotesToUpsert = [quoteTecnisport, quoteBlas, quoteRiveyes];

const paths = [
  // Local paths
  'd:/Documentos/espacio_vc/app_fink/backend/data/cotizaciones_historial.json',
  'd:/Documentos/espacio_vc/app_fink/backend/uploads/cotizaciones_historial.json',
  'd:/Documentos/espacio_vc/asistente/cotizaciones_historial.json',
  'd:/Documentos/espacio_vc/pagina web de tools/catalogo_aludra/src/data/cotizaciones_historial.json',
  // VPS paths
  '/home/fink/app_fink/backend/data/cotizaciones_historial.json',
  '/home/fink/app_fink/data/cotizaciones_historial.json',
  '/home/fink/app_fink/cotizaciones_historial.json',
  '/home/fink/cotizaciones_historial.json',
  '/var/www/catalogo_aludra/src/data/cotizaciones_historial.json',
  '/home/fink/asistente/cotizaciones_historial.json'
];

for (const p of paths) {
  try {
    if (!fs.existsSync(p) && !fs.existsSync(path.dirname(p))) continue;
    let list = [];
    if (fs.existsSync(p)) {
      list = JSON.parse(fs.readFileSync(p, 'utf8'));
    }

    for (const q of quotesToUpsert) {
      const idx = list.findIndex(x => x.id === q.id || x.correlative === q.correlative);
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...q };
      } else {
        list.push(q);
      }
    }

    list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(list, null, 2), 'utf8');
    console.log(`Updated ${p} -> Total: ${list.length} quotes`);
  } catch (e) {
    // Ignore for OS paths that don't match
  }
}
