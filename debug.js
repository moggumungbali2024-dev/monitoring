const req = async () => {
  const loginRes = await fetch("https://on.moggumung.id/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "cek", password: "cek" }),
  });
  console.log(loginRes.status);
  console.log(loginRes.headers.get("set-cookie"));
  console.log(await loginRes.text());
}
req();
