const axios = require('axios');

(async ()=>{
  try{
    const API = 'http://localhost:4002/api';
    console.log('Login...');
    const login = await axios.post(`${API}/auth/login`, { email: 'admin@fink.com', password: 'admin123' });
    const token = login.data.data.token;
    console.log('Token received');

    console.log('Fetching projects...');
    const pr = await axios.get(`${API}/projects`, { headers: { Authorization: `Bearer ${token}` } });
    const projects = pr.data.data;
    if (!projects || projects.length === 0) throw new Error('No projects found');
    const projectId = projects[0].id;
    console.log('Using project:', projectId, projects[0].code);

    console.log('Creating recurring rule (quick) ...');
    const payload = {
      projectId,
      name: 'TEST - Recurring Quick',
      description: 'Prueba endpoint mark-paid',
      amount: 50,
      currency: 'USD',
      entriesTemplate: [ { description: 'Test small fee', quantity: 1, unitPrice: 50, accountCode: 'MISC' } ],
      frequency: 'MONTHLY',
      interval: 1,
      startDate: new Date().toISOString()
    };
    const cr = await axios.post(`${API}/recurring`, payload, { headers: { Authorization: `Bearer ${token}` } });
    const rule = cr.data.data;
    console.log('Created rule id:', rule.id);

    console.log('Triggering rule now...');
    const trig = await axios.post(`${API}/recurring/${rule.id}/trigger`, {}, { headers: { Authorization: `Bearer ${token}` } });
    const occurrence = trig.data.data.occurrence;
    const invoice = trig.data.data.invoice;
    console.log('Occurrence created:', occurrence.id, 'invoice:', invoice.id);

    console.log('Calling mark-paid endpoint...');
    const resp = await axios.post(`${API}/recurring/occurrence/${occurrence.id}/mark-paid`, {}, { headers: { Authorization: `Bearer ${token}` } });
    console.log('mark-paid response status:', resp.status);
    console.log(JSON.stringify(resp.data, null, 2));

  }catch(err){
    if (err.response) console.error('API error', err.response.status, JSON.stringify(err.response.data,null,2));
    else console.error(err.message || err);
    process.exit(1);
  }
})();
