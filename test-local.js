const req = async () => {
  const loginRes = await fetch("http://localhost:3000/api/moggumung/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "cek", password: "cek" }),
  });
  console.log(loginRes.status);
  console.log(await loginRes.text());
}
req();
