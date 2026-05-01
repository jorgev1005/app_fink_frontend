
import axios from 'axios';

async function testApis() {
  console.log('--- Testing CriptoYa API (Primary) ---');
  try {
    const start = Date.now();
    const res1 = await axios.get('https://criptoya.com/api/binancep2p/usdt/ves');
    const duration = Date.now() - start;
    console.log(`Status: ${res1.status} (Time: ${duration}ms)`);
    console.log('Data:', JSON.stringify(res1.data, null, 2));
  } catch (err: any) {
    console.error('Error CriptoYa:', err.message);
  }

  console.log('\n--- Testing DolarApi (Fallback) ---');
  try {
    const start = Date.now();
    const res2 = await axios.get('https://ve.dolarapi.com/v1/dolares');
    const duration = Date.now() - start;
    console.log(`Status: ${res2.status} (Time: ${duration}ms)`);
    // Filter for parallel just to show relevant part
    const data = res2.data;
    if (Array.isArray(data)) {
        const paralelo = data.find((d: any) => d.fuente === 'paralelo' || (d.nombre && d.nombre.toLowerCase().includes('paralelo')));
        console.log('Full Data Length:', data.length);
        console.log('Paralelo Found:', JSON.stringify(paralelo, null, 2));
    } else {
        console.log('Data:', JSON.stringify(data, null, 2));
    }
  } catch (err: any) {
    console.error('Error DolarApi:', err.message);
  }
}

testApis();
