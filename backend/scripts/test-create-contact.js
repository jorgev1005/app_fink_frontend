const axios = require('axios');

const API = 'http://localhost:4002/api';

async function main(){
  try{
    // login
    const login = await axios.post(`${API}/auth/login`, { email: 'admin@fink.com', password: 'admin123' });
    const token = login.data.data.token;
    console.log('token:', token.slice(0,20),'...');

    const projectId = '8f9ce8cb-ff88-4858-8b20-7ce1bf0c7f2e'; // PERS-001
    const payload = { projectId, name: 'jose de nobrega', type: 'OTHER', isActive: true };
    const res = await axios.post(`${API}/contacts`, payload, { headers: { Authorization: `Bearer ${token}` } });
    console.log('status:', res.status);
    console.log('data:', res.data);
  } catch(e){
    if (e.response) {
      console.error('API error', e.response.status, e.response.data);
    } else {
      console.error('Error', e.message);
    }
    process.exit(1);
  }
}

main();
