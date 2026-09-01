import express from "express";
const app = express();
app.use(express.json());
app.post("/api/moggumung/sync", async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log("Fetching login...");
    const loginRes = await fetch("https://on.moggumung.id/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
      signal: AbortSignal.timeout(15000)
    });
    console.log("Login OK:", loginRes.ok);
    res.json({ ok: loginRes.ok });
  } catch (err) {
    console.log("Error caught:", err);
    res.status(400).json({ error: err.message });
  }
});
app.listen(3002, () => console.log("Listen 3002"));
