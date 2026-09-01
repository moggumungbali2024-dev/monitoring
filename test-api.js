const req = async () => {
  const res = await fetch('https://on.moggumung.id/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({username: 'cek', password: 'cek'})
  });
  console.log(res.status, await res.text());
}
req();
