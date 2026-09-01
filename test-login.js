const req = async () => {
  const res = await fetch('http://localhost:3000/api/moggumung/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({username: 'cek', password: 'cek'})
  });
  console.log(res.status);
  console.log(await res.text());
}
req();
