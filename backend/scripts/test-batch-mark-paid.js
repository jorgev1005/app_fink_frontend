const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async ()=>{
  try{
    const API = 'http://localhost:4002/api';
    console.log('Login...');
    const login = await axios.post(`${API}/auth/login`, { email: 'admin@fink.com', password: 'admin123' });
    const token = login.data.data.token;
    console.log('Token received');

    // Create an invoice manually and a PENDING occurrence for testing
    console.log('Fetching projects...');
    const pr = await axios.get(`${API}/projects`, { headers: { Authorization: `Bearer ${token}` } });
    const projects = pr.data.data;
    const projectId = projects[0].id;

    // Create invoice
    const inv = await prisma.invoice.create({ data: {
      projectId: projectId,
      code: `INV-${projectId}-${Date.now()}`,
      type: 'BILL',
      issueDate: new Date(),
      dueDate: new Date(),
      currency: 'USD',
      total: 75,
      outstanding: 75,
      lines: [{ quantity:1, unitPrice:75, accountCode: 'MISC', description: 'Batch test' }],
      createdBy: '8de01782-ce46-496f-a0d6-bbd9de90fb7e'
    }});

    const rule = await prisma.recurringRule.create({ data: {
      projectId: projectId,
      name: 'manual-test-rule',
      description: 'manual rule for batch test',
      amount: 75,
      currency: 'USD',
      entriesTemplate: [{ quantity:1, unitPrice:75, accountCode: 'MISC', description: 'Batch test' }],
      frequency: 'MONTHLY',
      interval: 1,
      startDate: new Date(),
      nextRunAt: new Date(),
      isActive: true,
      timezone: 'America/Caracas',
      createdBy: '8de01782-ce46-496f-a0d6-bbd9de90fb7e'
    }});

    const occ = await prisma.scheduledOccurrence.create({ data: { recurringRuleId: rule.id, scheduledFor: new Date(), status: 'PENDING', invoiceId: inv.id } });
    console.log('Created pending occurrence:', occ.id, 'invoice:', inv.id);

    // Call backend list pending occurrences
    const list = await axios.get(`${API}/recurring/occurrences/pending`, { headers: { Authorization: `Bearer ${token}` } });
    console.log('Pending occurrences count:', list.data.data.length);

    // For each pending occurrence, call mark-paid with autoPost=true
    for (const p of list.data.data) {
      console.log('Marking occurrence', p.id);
      const resp = await axios.post(`${API}/recurring/occurrence/${p.id}/mark-paid`, { autoPost: true }, { headers: { Authorization: `Bearer ${token}` } });
      console.log('Marked:', resp.data.data?.payment?.id || resp.data);
    }

    console.log('Done');
  }catch(err){
    if (err.response) console.error('API error', err.response.status, JSON.stringify(err.response.data,null,2));
    else console.error(err.message || err);
    process.exit(1);
  } finally { await prisma.$disconnect(); }
})();
