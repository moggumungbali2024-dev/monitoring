import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3001;

app.use(express.json());

// Lazy-loaded Gemini AI client to prevent crash if key is missing on startup
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// REST API endpoint for AI performance analysis
app.post("/api/ai/analyze", async (req, res) => {
  try {
    const { branches, omsetRecords, camerasCount } = req.body;

    // Validate request data
    if (!branches || !omsetRecords) {
      return res.status(400).json({ error: "Missing required fields: branches or omsetRecords" });
    }

    const ai = getGeminiClient();

    // If Gemini key is missing, provide a high-quality local rules-based simulation response
    if (!ai) {
      console.log("GEMINI_API_KEY is not configured or placeholder. Using fallback engine.");
      
      // Compute mock stats for Indonesian fallback response
      const totalOmsetByBranch: Record<string, number> = {};
      branches.forEach((b: any) => { totalOmsetByBranch[b.id] = 0; });
      omsetRecords.forEach((r: any) => {
        if (totalOmsetByBranch[r.branchId] !== undefined) {
          totalOmsetByBranch[r.branchId] += r.amount;
        }
      });

      const ranking = branches.map((b: any) => {
        const total = totalOmsetByBranch[b.id] || 0;
        let perf = "Cukup";
        if (total > b.targetOmsetDaily * 7 * 1.1) perf = "Sangat Baik 🌟";
        else if (total < b.targetOmsetDaily * 7 * 0.8) perf = "Butuh Perhatian ⚠️";
        else perf = "Stabil ✅";

        return {
          branchName: b.name,
          totalRevenue: total,
          performance: perf
        };
      }).sort((a: any, b: any) => b.totalRevenue - a.totalRevenue);

      const highPerfBranch = ranking[0]?.branchName || "Cabang Utama";
      const lowPerfBranch = ranking[ranking.length - 1]?.branchName || "Cabang Lain";

      const fallbackResponse = {
        summary: `[Fallback Engine - Atur GEMINI_API_KEY untuk analisis AI asli] Berdasarkan data omset terbaru, restoran Anda menunjukkan aktivitas keuangan yang dinamis dengan total cabang aktif sebanyak ${branches.length}. Cabang ${highPerfBranch} memimpin penjualan secara keseluruhan, sementara ${lowPerfBranch} memerlukan tinjauan lebih lanjut karena performa di bawah target mingguan. Pengawasan CCTV di ${camerasCount} kamera aktif berfungsi normal guna mendukung kepatuhan standar pelayanan.`,
        performanceRank: ranking,
        recommendations: [
          `Optimalkan jumlah staf kasir di ${highPerfBranch} pada jam makan siang dan malam untuk menghindari antrean panjang yang terpantau di CCTV.`,
          `Gencarkan promosi menu lokal atau diskon khusus di ${lowPerfBranch} untuk meningkatkan omset harian mendekati target.`,
          `Lakukan audit visual via CCTV secara berkala pada area dapur saat jam kritis (12:00 - 14:00) untuk menjamin kecepatan penyajian hidangan.`
        ],
        anomalies: [
          `Ada pola transaksi yang melambat di ${lowPerfBranch} pada akhir pekan, padahal CCTV menunjukkan kepadatan pengunjung yang cukup tinggi. Periksa efisiensi sistem kasir.`
        ]
      };

      return res.json(fallbackResponse);
    }

    // Prepare analysis prompt in Indonesian
    const prompt = `Analisis data cabang restoran dan laporan omset berikut untuk pemilik restoran.
Data Cabang:
${JSON.stringify(branches, null, 2)}

Data Omset Terakhir:
${JSON.stringify(omsetRecords, null, 2)}

Jumlah Kamera CCTV Hikvision Aktif: ${camerasCount}

Berikan analisis dalam Bahasa Indonesia yang profesional, padat, dan sangat berharga bagi manajemen restoran yang ditampilkan pada layar TV Dashboard. Temukan tren penjualan, hubungkan dengan kapasitas operasional CCTV (misalnya pengawasan kasir, antrean, produktivitas dapur), sebutkan cabang terbaik dan terlemah, berikan rekomendasi spesifik, serta deteksi anomali (misal: omset drop, transaksi jenuh, dll).`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "Anda adalah CFO & Analis Operasional Bisnis Restoran RestoCast. Berikan rekomendasi taktis bernilai tinggi dalam Bahasa Indonesia.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: {
              type: Type.STRING,
              description: "Ringkasan eksekutif tentang kinerja restoran, kepatuhan CCTV, dan performa keuangan secara keseluruhan."
            },
            performanceRank: {
              type: Type.ARRAY,
              description: "Daftar peringkat cabang restoran berdasarkan total omset dari data yang diberikan.",
              items: {
                type: Type.OBJECT,
                properties: {
                  branchName: { type: Type.STRING },
                  totalRevenue: { type: Type.NUMBER },
                  performance: { type: Type.STRING, description: "Status kinerja cabang seperti 'Sangat Baik', 'Stabil', 'Butuh Perhatian', atau 'Drop'" }
                },
                required: ["branchName", "totalRevenue", "performance"]
              }
            },
            recommendations: {
              type: Type.ARRAY,
              description: "Rekomendasi taktis operasional (misalnya alokasi staf, perbaikan antrean, promo cabang, audit keamanan).",
              items: { type: Type.STRING }
            },
            anomalies: {
              type: Type.ARRAY,
              description: "Anomali atau kejanggalan operasional dan finansial yang berhasil diidentifikasi dari data.",
              items: { type: Type.STRING }
            }
          },
          required: ["summary", "performanceRank", "recommendations", "anomalies"]
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("No response text received from Gemini");
    }

    const parsedResult = JSON.parse(resultText.trim());
    return res.json(parsedResult);

  } catch (error: any) {
    console.error("Gemini Analysis Error:", error);
    res.status(500).json({ error: error.message || "Internal server error during analysis" });
  }
});

// Proxy endpoints for Hik-Connect for Teams OpenAPI
app.post("/api/hik/token", async (req, res) => {
  try {
    const { serverAddress, appKey, secretKey } = req.body;
    if (!serverAddress || !appKey || !secretKey) {
      return res.status(400).json({ error: "serverAddress, appKey, and secretKey are required" });
    }

    const host = serverAddress.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const url = `https://${host}/api/hccgw/platform/v1/token/get`;

    console.log(`Proxied request -> Hik-Connect Teams token API: ${url}`);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        appKey: appKey.trim(),
        secretKey: secretKey.trim(),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText || "Gagal menghubungi server Hik-Connect" });
    }

    const data = await response.json();
    return res.json(data);
  } catch (err: any) {
    console.error("Hik Token Proxy Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/hik/cameras", async (req, res) => {
  try {
    const { serverAddress, token, pageIndex, pageSize } = req.body;
    if (!serverAddress || !token) {
      return res.status(400).json({ error: "serverAddress and token are required" });
    }

    const host = serverAddress.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const url = `https://${host}/api/hccgw/resource/v1/areas/cameras/get`;

    console.log(`Proxied request -> Hik-Connect Teams cameras: ${url}`);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Token": token,
      },
      body: JSON.stringify({
        pageIndex: pageIndex || 1,
        pageSize: pageSize || 100,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText || "Gagal mengambil daftar kamera" });
    }

    const data = await response.json();
    return res.json(data);
  } catch (err: any) {
    console.error("Hik Cameras Proxy Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/hik/thumbnail", async (req, res) => {
  try {
    const { serverAddress, token, cameraId } = req.body;
    if (!serverAddress || !token || !cameraId) {
      return res.status(400).json({ error: "serverAddress, token, and cameraId are required" });
    }

    const host = serverAddress.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const url = `https://${host}/api/hccgw/resource/v1/areas/cameras/thumbnail/get`;

    console.log(`Proxied request -> Hik-Connect Teams thumbnail: ${url} for ${cameraId}`);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Token": token,
      },
      body: JSON.stringify({
        cameraID: cameraId,
        refresh: 1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText || "Gagal mengambil thumbnail" });
    }

    const data = await response.json();
    return res.json(data);
  } catch (err: any) {
    console.error("Hik Thumbnail Proxy Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/hik/live-stream", async (req, res) => {
  try {
    const { serverAddress, token, cameraId, deviceSerial } = req.body;
    if (!serverAddress || !token || !cameraId) {
      return res.status(400).json({ error: "serverAddress, token, and cameraId are required" });
    }

    const host = serverAddress.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const url = `https://${host}/api/hccgw/video/v1/live/address/get`;

    console.log(`Proxied request -> Hik-Connect Teams live stream: ${url} for ${cameraId}`);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Token": token,
      },
      body: JSON.stringify({
        resourceId: cameraId,
        deviceSerial: deviceSerial || "",
        type: "1", // live view
        protocol: 2, // HLS stream protocol
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText || "Gagal mengambil stream HLS" });
    }

    const data = await response.json();
    return res.json(data);
  } catch (err: any) {
    console.error("Hik Live Stream Proxy Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Proxy endpoints for Moggumung POS Integration
app.post("/api/moggumung/sync", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    // 1. Login to Moggumung POS
    const loginRes = await fetch("https://on.moggumung.id/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!loginRes.ok) {
      return res.status(400).json({ error: `Gagal login ke Moggumung POS (${loginRes.status}). Periksa kredensial atau server sedang gangguan.` });
    }

    const loginData = await loginRes.json();
    if (!loginData.success) {
      return res.status(401).json({ error: "Kredensial tidak valid" });
    }

    const cookie = loginRes.headers.get("set-cookie");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (cookie) headers["Cookie"] = cookie;

    // 2. Fetch Dashboard Config (to get tokens)
    const confRes = await fetch("https://on.moggumung.id/api/dashboard-config", { headers });
    if (!confRes.ok) return res.status(400).json({ error: `Gagal mengambil konfigurasi dari Moggumung (${confRes.status})` });
    const confData = await confRes.json();
    
    const tokensArr = confData.connected_tokens || confData.tokens;
    if (!tokensArr || tokensArr.length === 0) {
      return res.status(404).json({ error: "Tidak ada token restoran yang ditemukan di akun ini." });
    }

    const tokens = tokensArr.join(",");

    // 3. Fetch Branches
    const brRes = await fetch(`https://on.moggumung.id/api/branches?tokens=${tokens}`, { headers });
    let moggumungBranches = [];
    if (brRes.ok) {
      moggumungBranches = await brRes.json();
    }

    // 4. Fetch Revenue Overview
    const revRes = await fetch(`https://on.moggumung.id/api/revenue/overview?tokens=${tokens}`, { headers });
    let revenueOverview = [];
    if (revRes.ok) {
      revenueOverview = await revRes.json();
    }

    // 5. Fetch Daily Records (last 7 days omset simulation from revenue endpoint or branch records)
    const recRes = await fetch(`https://on.moggumung.id/api/analytics/branch-records?tokens=${tokens}`, { headers });
    let dailyRecords = [];
    if (recRes.ok) {
      dailyRecords = await recRes.json();
    }

    return res.json({
      success: true,
      branches: moggumungBranches,
      revenueOverview,
      dailyRecords
    });

  } catch (err: any) {
    console.error("Moggumung Proxy Error:", err);
    return res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

// Setup Vite Dev server middleware or serve production client files
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with Vite Middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express server running on http://localhost:${PORT}`);
  });
}

startServer();
