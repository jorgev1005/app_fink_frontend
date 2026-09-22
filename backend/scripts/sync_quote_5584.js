const fs = require('fs');
const path = require('path');

const quote5584 = {
  id: "COT-20260910-5584",
  correlative: "COT-20260910-5584",
  createdAt: "2026-09-10T21:06:00.000Z",
  channel: "CATALOGO_WEB",
  status: "APPROVED",
  customer: {
    name: "INDUSTRIA TAPA AMARILLA C.A.",
    taxId: "J-501762805",
    phone: "+58 412-271-1859",
    email: "admin@grupoaludra.com",
    city: "CALLE ARISMENDI, LOCAL NRO. 54, ZONA INDUSTRIAL LA CHAPA, LA VICTORIA, EDO. ARAGUA. ZP 2121",
    seller: "Oficina",
    gpsCoordinates: "",
    gpsMapsUrl: "",
    emissionPlace: "La Victoria, Aragua"
  },
  paymentMethod: "bcv_bs",
  rates: {
    bcv: 827.74,
    paralelo: 929.80,
    eur: 916.03
  },
  items: [
    {
      sku: "LUC-TAP-JAM-AMA-001",
      name: "Tapa 028 mm sin precinto amarilla",
      quantity: 10000,
      unit: "UNIDAD",
      unitPriceUSD: 0.19,
      unitPriceBs: 157.27,
      subtotalUSD: 1900.00,
      subtotalBs: 1572700.49,
      costPrice: 0.145,
      medidas: "AMARILLO"
    },
    {
      sku: "LUC-CAR-RAF-CL5-017",
      name: "Separador de carton cloro 500",
      quantity: 3000,
      unit: "UNIDAD",
      unitPriceUSD: 0.20,
      unitPriceBs: 165.55,
      subtotalUSD: 600.00,
      subtotalBs: 496642.26,
      costPrice: 0.15,
      medidas: "CL500"
    },
    {
      sku: "LUC-CAR-RAF-LV8-016",
      name: "Separador de carton lavaplatos 800",
      quantity: 3000,
      unit: "UNIDAD",
      unitPriceUSD: 0.15,
      unitPriceBs: 124.16,
      subtotalUSD: 450.00,
      subtotalBs: 372481.70,
      costPrice: 0.10,
      medidas: "LV800"
    }
  ],
  totalUSD: 2950.00,
  totalBs: 2441824.45,
  notes: "Entrega en CALLE ARISMENDI, LOCAL NRO. 54, ZONA INDUSTRIAL LA CHAPA, LA VICTORIA, EDO. ARAGUA. ZP 2121 (Envio Gratuito disponible a partir de $1000.00 USD)"
};

const pathsToUpdate = [
  // VPS paths
  '/home/fink/app_fink/backend/data/cotizaciones_historial.json',
  '/home/fink/app_fink/data/cotizaciones_historial.json',
  '/home/fink/app_fink/cotizaciones_historial.json',
  '/home/fink/cotizaciones_historial.json',
  '/var/www/catalogo_aludra/src/data/cotizaciones_historial.json',
  '/home/fink/asistente/cotizaciones_historial.json',
  // Local paths
  'd:/Documentos/espacio_vc/app_fink/backend/data/cotizaciones_historial.json',
  'd:/Documentos/espacio_vc/app_fink/backend/uploads/cotizaciones_historial.json',
  'd:/Documentos/espacio_vc/asistente/cotizaciones_historial.json',
  'd:/Documentos/espacio_vc/pagina web de tools/catalogo_aludra/src/data/cotizaciones_historial.json'
];

for (const p of pathsToUpdate) {
  try {
    if (!fs.existsSync(p) && !fs.existsSync(path.dirname(p))) continue;
    let list = [];
    if (fs.existsSync(p)) {
      list = JSON.parse(fs.readFileSync(p, 'utf8'));
    }
    const idx = list.findIndex(x => x.id === quote5584.id || x.correlative === quote5584.correlative);
    if (idx >= 0) {
      list[idx] = quote5584;
    } else {
      list.unshift(quote5584);
    }
    list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(list, null, 2), 'utf8');
    console.log(`Updated: ${p} (${list.length} quotes)`);
  } catch (err) {
    // Ignore errors for paths not existing on this OS
  }
}
