const axios = require('axios');
(async ()=>{
  try{
    const API = 'http://localhost:4002/api';
    console.log('GET /api/projects without auth...');
    const r1 = await axios.get(`${API}/projects`).catch(e=>e.response||e);
    console.log('status:', r1.status || r1.statusCode, 'data keys:', r1.data ? Object.keys(r1.data) : r1);

    console.log('\nGET /api/projects with auth...');
    const login = await axios.post(`${API}/auth/login`,{ email: 'admin@fink.com', password: 'admin123' });
    const token = login.data.data.token;
    const r2 = await axios.get(`${API}/projects`, { headers: { Authorization: `Bearer ${token}` } });
    console.log('status:', r2.status, 'projects count:', Array.isArray(r2.data.data)? r2.data.data.length : 'unknown');
    console.log(JSON.stringify(r2.data.data.slice(0,5), null, 2));
  }catch(err){
    if (err.response) console.error('API error', err.response.status, JSON.stringify(err.response.data,null,2));
    else console.error(err);
    process.exit(1);
  }
})();
