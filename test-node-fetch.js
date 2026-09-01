const req = async () => {
  try {
    console.log("Start fetch");
    const loginRes = await fetch("https://on.moggumung.id/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "cek", password: "cek" }),
    });
    console.log("Status:", loginRes.status);
    const text = await loginRes.text();
    console.log("Body:", text.substring(0, 100));
  } catch (err) {
    console.error("Error:", err);
  }
}
req();
