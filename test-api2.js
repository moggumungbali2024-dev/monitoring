const req = async () => {
  const res = await fetch('https://on.moggumung.id/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({username: 'cek', password: 'cek'})
  });
  const data = await res.json();
  console.log('Login:', data);
  
  const cookie = res.headers.get('set-cookie');
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers['Cookie'] = cookie;
  
  const fetchApi = async (path) => {
    const r = await fetch(`https://on.moggumung.id${path}`, { headers });
    if (r.ok) {
      console.log(path, await r.text());
    } else {
      console.log(path, r.status);
    }
  }
  
  await fetchApi('/api/omset');
  await fetchApi('/api/dashboard');
  await fetchApi('/api/resto');
  await fetchApi('/api/data');
}
req();
