const axios = require('axios');

(async ()=>{
  try{
    const API = 'http://localhost:4002/api';
    const occId = process.argv[2];
    if(!occId){
      console.error('Usage: node mark-occurrence-paid-auto.js <occurrenceId>');
      process.exit(2);
    }

    console.log('Login...');
    const login = await axios.post(`${API}/auth/login`, { email: 'admin@fink.com', password: 'admin123' });
    const token = login.data.data.token;
    console.log('Token received');

    console.log('Marking occurrence', occId, 'as paid (autoPost:true)');
    const resp = await axios.post(`${API}/recurring/occurrence/${occId}/mark-paid`, { autoPost: true }, { headers: { Authorization: `Bearer ${token}` } });
    console.log('Response:');
    console.log(JSON.stringify(resp.data, null, 2));

    // if there's a payment id, show it
    const paymentId = resp.data.data?.payment?.id || resp.data.data?.payment;
    if(paymentId){
      console.log('Payment id:', paymentId);
    }

    process.exit(0);
  }catch(err){
    if(err.response) console.error('API error', err.response.status, JSON.stringify(err.response.data,null,2));
    else console.error(err.message || err);
    process.exit(1);
  }
})();
