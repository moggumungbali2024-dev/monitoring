const req = async () => {
  const res = await fetch('https://on.moggumung.id/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({username: 'cek', password: 'cek'})
  });
  
  const cookie = res.headers.get('set-cookie');
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers['Cookie'] = cookie;
  
  const confRes = await fetch('https://on.moggumung.id/api/dashboard-config', { headers });
  const confData = await confRes.json();
  const tokensArr = confData.connected_tokens || confData.tokens;
  const tokens = tokensArr.join(',');
  
  const recRes = await fetch(`https://on.moggumung.id/api/analytics/branch-records?tokens=${tokens}`, { headers });
  const records = await recRes.json();
  console.log(JSON.stringify(records, null, 2).substring(0, 1000));
}
req();
