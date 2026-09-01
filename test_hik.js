const test = async () => {
  const tokenRes = await fetch('http://127.0.0.1:3000/api/hik/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      serverAddress: "isgp-team.hikcentralconnect.com",
      appKey: "test",
      secretKey: "test",
    }),
  });
  const tokenText = await tokenRes.text();
  console.log("Status:", tokenRes.status);
  console.log("Response:", tokenText);
};
test();
