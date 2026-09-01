const req = async () => {
  const res = await fetch('https://on.moggumung.id/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({username: 'cek', password: 'cek'})
  });
  const loginData = await res.json();
  console.log('Login:', loginData);
  
  const cookie = res.headers.get('set-cookie');
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers['Cookie'] = cookie;
  
  const confRes = await fetch('https://on.moggumung.id/api/dashboard-config', { headers });
  const confData = await confRes.json();
  console.log('Config:', confData);
  
  if (confData.tokens && confData.tokens.length > 0) {
    const tokens = confData.tokens.join(',');
    const brRes = await fetch(`https://on.moggumung.id/api/branches?tokens=${tokens}`, { headers });
    const brData = await brRes.json();
    console.log('Branches:', JSON.stringify(brData).substring(0,200));

    const revRes = await fetch(`https://on.moggumung.id/api/revenue/overview?tokens=${tokens}`, { headers });
    const revData = await revRes.json();
    console.log('Revenue Overview:', revData);
  }
}
req();
