console.log(parseAmount(4.3569, true)); console.log(parseAmount(500, true)); function parseAmount(val, multiply) { let num = val; if (multiply) num *= 1000; return num; }
