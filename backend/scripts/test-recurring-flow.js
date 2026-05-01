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

    console.log('Creating recurring rule...');
    const payload = {
      projectId,
      name: 'TEST - Recurring Rent (auto)',
      description: 'Prueba automática de regla recurrente',
      amount: 1000,
      currency: 'USD',
      entriesTemplate: [],
      frequency: 'MONTHLY',
      interval: 1,
      startDate: new Date().toISOString()
    };
    const cr = await axios.post(`${API}/recurring`, payload, { headers: { Authorization: `Bearer ${token}` } });
    if (!cr.data.success) throw new Error('Create recurring failed: ' + JSON.stringify(cr.data));
    const rule = cr.data.data;
    console.log('Created rule id:', rule.id, 'nextRunAt:', rule.nextRunAt);

    console.log('Triggering rule now...');
    const trig = await axios.post(`${API}/recurring/${rule.id}/trigger`, {}, { headers: { Authorization: `Bearer ${token}` } });
    console.log('Trigger response status:', trig.status);
    console.log(JSON.stringify(trig.data, null, 2));
    console.log('Done');
  }catch(err){
    if (err.response) console.error('API error', err.response.status, JSON.stringify(err.response.data,null,2));
    else console.error(err.message || err);
    process.exit(1);
  }
})();
