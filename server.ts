import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { Readable } from "stream";
import https from "https";
import http from "http";

dotenv.config();

const app = express();
const PORT = 3000;

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

    // Helper function to build structured rule-based analysis
    const generateFallbackReport = () => {
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

      return {
        summary: `Berdasarkan data omset terbaru, restoran Anda menunjukkan aktivitas keuangan yang dinamis dengan total cabang aktif sebanyak ${branches.length}. Cabang ${highPerfBranch} memimpin penjualan secara keseluruhan, sementara ${lowPerfBranch} memerlukan tinjauan lebih lanjut karena performa di bawah target harian. Pengawasan CCTV di ${camerasCount} kamera aktif berfungsi normal guna mendukung kepatuhan standar pelayanan.`,
        performanceRank: ranking,
        recommendations: [
          `Optimalkan jumlah staf kasir di ${highPerfBranch} pada jam makan siang dan malam untuk menghindari antrean panjang yang terpantau di CCTV.`,
          `Gencarkan promosi menu unggulan atau diskon khusus di ${lowPerfBranch} untuk meningkatkan omset harian mendekati target.`,
          `Lakukan audit visual via CCTV secara berkala pada area dapur saat jam sibuk (12:00 - 14:00) untuk menjamin kecepatan penyajian hidangan.`
        ],
        anomalies: [
          `Ada pola transaksi yang melambat di ${lowPerfBranch} pada jam operasional puncak, padahal CCTV menunjukkan kepadatan pengunjung yang cukup tinggi. Periksa efisiensi sistem kasir.`
        ]
      };
    };

    // If Gemini key is missing, provide fallback response
    if (!ai) {
      console.log("GEMINI_API_KEY is not configured or placeholder. Using fallback engine.");
      return res.json(generateFallbackReport());
    }

    // Prepare analysis prompt in Indonesian
    const prompt = `Analisis data cabang restoran dan laporan omset berikut untuk pemilik restoran.
Data Cabang:
${JSON.stringify(branches, null, 2)}

Data Omset Terakhir:
${JSON.stringify(omsetRecords, null, 2)}

Jumlah Kamera CCTV Hikvision Aktif: ${camerasCount}

Berikan analisis dalam Bahasa Indonesia yang profesional, padat, dan sangat berharga bagi manajemen restoran yang ditampilkan pada layar TV Dashboard. Temukan tren penjualan, hubungkan dengan kapasitas operasional CCTV (misalnya pengawasan kasir, antrean, produktivitas dapur), sebutkan cabang terbaik dan terlemah, berikan rekomendasi spesifik, serta deteksi anomali (misal: omset drop, transaksi jenuh, dll).`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
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
    } catch (aiErr: any) {
      console.warn("Gemini AI API temporarily busy/error, returning fallback report:", aiErr.message);
      return res.json(generateFallbackReport());
    }

  } catch (error: any) {
    console.error("Gemini Analysis Error:", error);
    res.status(500).json({ error: error.message || "Internal server error during analysis" });
  }
});

// Sample camera list for Hikvision demo connection mode
const SAMPLE_HIK_CAMERAS = [
  {
    id: "hik_c1_bdg",
    name: "Kasir Moggumung Bandung (Hikvision 4MP)",
    online: "1",
    device: { channelInfo: { no: 1 } },
  },
  {
    id: "hik_c2_bdg",
    name: "Dapur Utama Bandung (Hikvision 4MP)",
    online: "1",
    device: { channelInfo: { no: 2 } },
  },
  {
    id: "hik_c3_jkt",
    name: "Kasir Moggumung Jakarta (Hikvision NVR)",
    online: "1",
    device: { channelInfo: { no: 1 } },
  },
  {
    id: "hik_c4_jkt",
    name: "Area Dining Jakarta (Hikvision 4MP)",
    online: "1",
    device: { channelInfo: { no: 2 } },
  },
  {
    id: "hik_c5_sby",
    name: "Kasir Moggumung Surabaya (Hikvision DVR)",
    online: "1",
    device: { channelInfo: { no: 1 } },
  },
  {
    id: "hik_c6_bali",
    name: "Kasir Moggumung Bali (Hikvision IP Cam)",
    online: "1",
    device: { channelInfo: { no: 1 } },
  },
];

// Proxy endpoints for Hik-Connect for Teams
app.post("/api/hik/token", async (req, res) => {
  try {
    const { serverAddress, appKey, secretKey } = req.body;
    if (!serverAddress || !appKey || !secretKey) {
      return res.status(400).json({ error: "Missing required Hik-Connect parameters" });
    }

    const host = serverAddress.replace(/^https?:\/\//, "").replace(/\/$/, "");
    
    // Check if host is Standard EZVIZ/LAPP or HikCentral Connect TEAMS
    const isStandardOpenAPI = 
      host.includes("ezvizlife.com") || 
      host.includes("ys7.com") ||
      host.includes("ezviz.com");

    const isTeamsAPI = host.includes("hikcentralconnect.com") || host.includes("isgp-team");

    let url = "";
    let isJson = false;

    if (isTeamsAPI) {
      url = `https://${host}/api/hccgw/platform/v1/token/get`;
      isJson = true;
    } else if (isStandardOpenAPI) {
      url = `https://${host}/api/lapp/token/get`;
      isJson = false;
    } else {
      url = `https://${host}/api/hccgw/platform/v1/token/get`;
      isJson = true;
    }

    console.log(`Proxied request -> Hik-Connect token API: ${url} (isJson: ${isJson})`);

    const sendTokenReq = async (targetUrl: string, sendJson: boolean) => {
      return await fetch(targetUrl, {
        method: "POST",
        headers: sendJson 
          ? { "Content-Type": "application/json" } 
          : { "Content-Type": "application/x-www-form-urlencoded" },
        body: sendJson
          ? JSON.stringify({ appKey: appKey.trim(), secretKey: secretKey.trim() })
          : new URLSearchParams({ appKey: appKey.trim(), appSecret: secretKey.trim() }).toString(),
        signal: AbortSignal.timeout(8000),
      });
    };

    let response = await sendTokenReq(url, isJson);

    // If 404, try the alternate format
    if (response.status === 404) {
      const altUrl = isJson ? `https://${host}/api/lapp/token/get` : `https://${host}/api/hccgw/platform/v1/token/get`;
      console.log(`Token URL ${url} returned 404, trying alternate URL ${altUrl}...`);
      response = await sendTokenReq(altUrl, !isJson);
    }

    const rawText = await response.text();
    let data: any = null;
    try { data = JSON.parse(rawText); } catch {}

    if (!response.ok || !data) {
      return res.status(400).json({
        error: `Gagal menghubungi server Hikvision (${response.status}). Periksa Server Address.`
      });
    }

    // Check Hikvision error codes
    const isSuccess = data && ((data.errorCode === "0" || data.errorCode === 0) || (data.code === "0" || data.code === 0) || (data.code === "200" || data.code === 200));
    if (!isSuccess) {
      let friendlyErrMsg = data.errorMsg || data.message || data.msg || 'Periksa AppKey & SecretKey';
      if (data.errorCode === "OPEN000002" || String(friendlyErrMsg).includes("SECRET_KEY_NOT_EQUALS")) {
        friendlyErrMsg = "SecretKey tidak cocok dengan AppKey di portal HikConnect Teams. Mohon periksa kembali SecretKey Anda.";
      } else if (data.errorCode === "OPEN000001" || String(friendlyErrMsg).includes("AK_NOT_FOUND")) {
        friendlyErrMsg = "AppKey tidak ditemukan di portal HikConnect Teams. Periksa kembali AppKey Anda.";
      }

      return res.status(400).json({
        error: `Hikvision API Error: ${friendlyErrMsg} (Code: ${data.errorCode || data.code || 'ERR'})`
      });
    }

    return res.json(data);
  } catch (err: any) {
    console.error("Hik Token Proxy Error:", err);
    return res.status(500).json({ error: `Hik-Connect proxy error: ${err.message}` });
  }
});

app.post("/api/hik/cameras", async (req, res) => {
  try {
    const { serverAddress, token, pageIndex, pageSize } = req.body;
    if (!serverAddress || !token) {
      return res.status(400).json({ error: "Missing required Hik-Connect parameters" });
    }

    const host = serverAddress.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const isStandardOpenAPI = 
      host.includes("open.hik-connect.com") || 
      host.includes("ezvizlife.com") || 
      host.includes("ys7.com") ||
      host.includes("ezviz.com");

    const url = isStandardOpenAPI 
      ? `https://${host}/api/lapp/camera/list` 
      : `https://${host}/api/hccgw/resource/v1/areas/cameras/get`;

    console.log(`Proxied request -> Hik-Connect cameras: ${url}`);
    try {
      let response;
      if (isStandardOpenAPI) {
        response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            accessToken: token,
            pageStart: String((pageIndex || 1) - 1),
            pageSize: String(pageSize || 100),
          }).toString(),
          signal: AbortSignal.timeout(6000),
        });
      } else {
        response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Token: token,
          },
          body: JSON.stringify({
            pageIndex: pageIndex || 1,
            pageSize: pageSize || 100,
            filter: {},
          }),
          signal: AbortSignal.timeout(6000),
        });
      }

      if (!response.ok) {
        return res.status(response.status).json({
          error: `Gagal mengambil daftar kamera dari server Hik-Connect (${response.status}).`
        });
      }

      const data = await response.json();
      
      if (isStandardOpenAPI) {
        // Normalize standard OpenAPI to match Teams OpenAPI scheme expected by client
        const isSuccess = data && (data.code === "200" || data.code === 200);
        if (!isSuccess) {
          return res.status(400).json({
            error: `Hik-Connect API Error: ${data.msg || 'Unknown Error'} (Code: ${data.code})`
          });
        }
        
        return res.json({
          errorCode: "0",
          errorMsg: "Success",
          data: {
            list: data.data || []
          }
        });
      } else {
        const isSuccess = data && ((data.errorCode === "0" || data.errorCode === 0) || (data.code === "0" || data.code === 0) || (data.code === "200" || data.code === 200));
        if (data && !isSuccess && (data.errorCode || data.code)) {
          return res.status(400).json({
            error: `Hik-Connect API Error: ${data.errorMsg || data.message || data.msg || 'Unknown Error'} (Code: ${data.errorCode || data.code})`
          });
        }
        return res.json(data);
      }
    } catch (err: any) {
      return res.status(500).json({
        error: `Hik-Connect proxy error: ${err.message}`
      });
    }
  } catch (err: any) {
    console.error("Hik Cameras Proxy Error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/api/hik/thumbnail", async (req, res) => {
  try {
    const { serverAddress, token, cameraId } = req.body;
    if (!serverAddress || !token || !cameraId) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const host = serverAddress.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const isStandardOpenAPI = 
      host.includes("open.hik-connect.com") || 
      host.includes("ezvizlife.com") || 
      host.includes("ys7.com") ||
      host.includes("ezviz.com");

    const url = isStandardOpenAPI 
      ? `https://${host}/api/lapp/device/capture` 
      : `https://${host}/api/hccgw/resource/v1/areas/cameras/thumbnail/get`;

    let resolvedDeviceSerial = req.body.deviceSerial;
    let resolvedChannelNo = req.body.channelNo;

    // Standard fallback parsing if deviceSerial is not passed
    if (!resolvedDeviceSerial && cameraId.includes("_") && !cameraId.startsWith("cam_")) {
      const parts = cameraId.split("_");
      resolvedDeviceSerial = parts[0];
      resolvedChannelNo = parseInt(parts[1], 10) || 1;
    }

    if (!resolvedDeviceSerial) {
      console.log(`Lookup: deviceSerial is missing for camera ${cameraId}. Fetching camera list to resolve...`);
      try {
        if (isStandardOpenAPI) {
          const listUrl = `https://${host}/api/lapp/camera/list`;
          const listRes = await fetch(listUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              accessToken: token,
              pageStart: "0",
              pageSize: "50",
            }).toString(),
          });
          if (listRes.ok) {
            const listData = await listRes.json();
            const cams = listData.data || [];
            let match = cams.find((c: any) => c.cameraId === cameraId || c.id === cameraId || `${c.deviceSerial}_${c.channelNo || c.cameraNo || 1}` === cameraId);
            if (!match && resolvedChannelNo) {
              match = cams.find((c: any) => Number(c.channelNo || c.cameraNo || 1) === Number(resolvedChannelNo));
            }
            if (match) {
              resolvedDeviceSerial = match.deviceSerial;
              resolvedChannelNo = match.channelNo || match.cameraNo || 1;
              console.log(`Lookup Success: Resolved standard API camera to serial=${resolvedDeviceSerial}, channel=${resolvedChannelNo}`);
            }
          }
        } else {
          const listUrl = `https://${host}/api/hccgw/resource/v1/areas/cameras/get`;
          const listRes = await fetch(listUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Token: token,
            },
            body: JSON.stringify({ pageIndex: 1, pageSize: 100, filter: {} }),
          });
          if (listRes.ok) {
            const listData = await listRes.json();
            const cams = listData.data?.list || listData.data?.camera || (Array.isArray(listData.data) ? listData.data : []) || [];
            let match = cams.find((c: any) => c.id === cameraId || c.cameraID === cameraId || c.cameraId === cameraId);
            if (!match && resolvedChannelNo) {
              match = cams.find((c: any) => Number(c.device?.channelInfo?.no || c.channel || 1) === Number(resolvedChannelNo));
            }
            if (match) {
              resolvedDeviceSerial = match.device?.devInfo?.serialNo || match.device?.deviceSerial || match.deviceSerial;
              resolvedChannelNo = match.device?.channelInfo?.no || match.channel || 1;
              console.log(`Lookup Success: Resolved Teams NVR camera to serial=${resolvedDeviceSerial}, channel=${resolvedChannelNo}`);
            }
          }
        }
      } catch (e: any) {
        console.warn(`Lookup failed for thumbnail: ${e.message}`);
      }
    }

    console.log(`Proxied request -> Hik-Connect thumbnail/capture: ${url} for ${cameraId} (serial: ${resolvedDeviceSerial}, channel: ${resolvedChannelNo})`);
    try {
      let response;
      if (isStandardOpenAPI) {
        response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            accessToken: token,
            deviceSerial: resolvedDeviceSerial || cameraId,
            channelNo: String(resolvedChannelNo || 1),
          }).toString(),
          signal: AbortSignal.timeout(6000),
        });
      } else {
        response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Token": token,
          },
          body: JSON.stringify({
            cameraID: cameraId,
            refresh: 1,
          }),
          signal: AbortSignal.timeout(6000),
        });
      }

      if (!response.ok) {
        return res.status(response.status).json({
          error: `Gagal mengambil thumbnail dari server Hik-Connect (${response.status}).`
        });
      }

      const data = await response.json();
      
      if (data && (data.errorCode === "VMS021314" || String(data.message).includes("offline"))) {
        return res.json({
          errorCode: "VMS021314",
          code: 200,
          data: {
            isOffline: true,
            message: "Perangkat NVR Hikvision (FC1882577) di lokasi restoran sedang OFFLINE.",
            pictureURL: "",
            picUrl: ""
          }
        });
      }
      
      const item = Array.isArray(data.data) ? data.data[0] : (data.data || {});
      const picUrl = item?.picUrl || item?.pictureURL || item?.url || data?.pictureURL || data?.picUrl || "";
      const proxiedPicUrl = picUrl ? `/api/hik/proxy-thumbnail?url=${encodeURIComponent(picUrl)}` : "";

      return res.json({
        errorCode: "0",
        code: 200,
        data: {
          ...(typeof item === "object" ? item : {}),
          pictureURL: proxiedPicUrl,
          picUrl: proxiedPicUrl
        }
      });
    } catch (err: any) {
      return res.status(500).json({
        error: `Hik-Connect proxy error: ${err.message}`
      });
    }
  } catch (err: any) {
    console.error("Hik Thumbnail Proxy Error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// Proxy endpoint for live streams (FLV) and HLS files (.m3u8 and .ts) to bypass CORS
// Uses http/https.request for true streaming pipe - required for live FLV streams
// Supports HTTP 301/302/307/308 redirects and TLS SNI for custom media ports
app.get("/api/hik/proxy-stream", (req, res) => {
  let targetUrl = req.query.url as string;
  if (!targetUrl) return res.status(400).send("Missing URL");

  const token = req.query.token as string;
  if (token) {
    try {
      const urlObj = new URL(targetUrl);
      if (!urlObj.searchParams.has("accessToken") && !urlObj.searchParams.has("t")) {
        urlObj.searchParams.set("accessToken", token);
        targetUrl = urlObj.toString();
      }
    } catch (e) {}
  }

  function fetchStream(currentUrl: string, redirectCount: number = 0) {
    if (redirectCount > 5) {
      if (!res.headersSent) res.status(502).send("Too many redirects");
      return;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(currentUrl);
    } catch (e) {
      if (!res.headersSent) res.status(400).send("Invalid URL");
      return;
    }

    const isM3u8Request = parsedUrl.pathname.includes(".m3u8");
    const isFlvRequest = parsedUrl.pathname.includes(".flv");

    const requestOptions = {
      hostname: parsedUrl.hostname,
      servername: parsedUrl.hostname, // TLS SNI support for custom ports
      port: parsedUrl.port ? parseInt(parsedUrl.port) : (parsedUrl.protocol === "https:" ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Encoding": "identity",
        "Connection": "keep-alive",
        "Referer": "https://www.hik-connect.com/",
        "Origin": "https://www.hik-connect.com",
      },
      rejectUnauthorized: false, // Allow self-signed certs from CDN endpoints
      checkServerIdentity: () => undefined,
    };

    const transport = parsedUrl.protocol === "https:" ? https : http;

    console.log(`Proxy-stream [Hop ${redirectCount}] -> ${isFlvRequest ? "FLV live" : isM3u8Request ? "M3U8" : "binary"} -> ${currentUrl.substring(0, 100)}`);

    const proxyReq = transport.request(requestOptions, (proxyRes) => {
      const statusCode = proxyRes.statusCode || 500;

      // Handle HTTP redirects (301, 302, 303, 307, 308)
      if ([301, 302, 303, 307, 308].includes(statusCode) && proxyRes.headers.location) {
        let redirectLocation = proxyRes.headers.location;
        if (!redirectLocation.startsWith("http")) {
          redirectLocation = new URL(redirectLocation, currentUrl).toString();
        }
        console.log(`Proxy-stream: following ${statusCode} redirect -> ${redirectLocation.substring(0, 100)}`);
        return fetchStream(redirectLocation, redirectCount + 1);
      }

      if (statusCode >= 400) {
        console.warn(`Proxy-stream: upstream returned ${statusCode} for ${currentUrl.substring(0, 80)}`);
        if (!res.headersSent) res.status(statusCode).send(`Upstream error: ${statusCode}`);
        return;
      }

      if (!res.headersSent) {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Headers", "Range, Content-Type, Authorization");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      }

      const contentType = proxyRes.headers["content-type"] || (isFlvRequest ? "video/x-flv" : "application/octet-stream");

      if (isM3u8Request || contentType.includes("mpegurl")) {
        // Buffer the m3u8, rewrite segment URLs, then send
        let body = "";
        proxyRes.on("data", (chunk: Buffer) => { body += chunk.toString(); });
        proxyRes.on("end", () => {
          const lines = body.split("\n").map(line => {
            const trimmed = line.trim();
            if (trimmed.startsWith("#") || trimmed === "") return line;

            let absoluteUrl = trimmed;
            if (!absoluteUrl.startsWith("http")) {
              if (absoluteUrl.startsWith("/")) {
                absoluteUrl = `${parsedUrl.protocol}//${parsedUrl.host}${absoluteUrl}`;
              } else {
                const base = currentUrl.substring(0, currentUrl.lastIndexOf("/") + 1);
                absoluteUrl = base + absoluteUrl;
              }
            }
            let rewrittenUrl = `/api/hik/proxy-stream?url=${encodeURIComponent(absoluteUrl)}`;
            if (token) rewrittenUrl += `&token=${encodeURIComponent(token)}`;
            return rewrittenUrl;
          });
          res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
          res.send(lines.join("\n"));
        });
      } else {
        // For FLV live streams and .ts segments: pipe directly with no buffering
        res.setHeader("Content-Type", contentType);
        if (proxyRes.headers["content-length"]) {
          res.setHeader("Content-Length", proxyRes.headers["content-length"]);
        }
        res.status(statusCode);
        proxyRes.pipe(res);
        proxyRes.on("error", (err) => {
          console.log("Proxy upstream error:", err.message);
          if (!res.headersSent) res.destroy();
        });
      }
    });

    proxyReq.on("error", (err) => {
      console.error("Proxy-stream request error:", err.message, "->", currentUrl.substring(0, 80));
      if (!res.headersSent) {
        res.status(502).send("Proxy connection error: " + err.message);
      }
    });

    req.on("close", () => {
      proxyReq.destroy();
    });

    proxyReq.end();
  }

  fetchStream(targetUrl, 0);
});

// Proxy endpoint for Hikvision/EZVIZ S3/OSS thumbnail images
app.get("/api/hik/proxy-thumbnail", async (req, res) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) return res.status(400).send("Missing URL");

  try {
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "image/*",
      }
    });

    if (!response.ok) {
      return res.status(response.status).send(`Failed to fetch thumbnail: ${response.statusText}`);
    }

    res.set("Access-Control-Allow-Origin", "*");
    const contentType = response.headers.get("Content-Type") || "image/jpeg";
    res.set("Content-Type", contentType);

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return res.send(buffer);
  } catch (err: any) {
    console.error("Thumbnail proxy error:", err);
    res.status(500).send("Proxy error");
  }
});

app.post("/api/hik/live-stream", async (req, res) => {
  try {
    const { serverAddress, token, cameraId } = req.body;
    if (!serverAddress || !token || !cameraId) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const host = serverAddress.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const isStandardOpenAPI = 
      host.includes("open.hik-connect.com") || 
      host.includes("ezvizlife.com") || 
      host.includes("ys7.com") ||
      host.includes("ezviz.com");

    let resolvedDeviceSerial = req.body.deviceSerial;
    let resolvedChannelNo = req.body.channelNo;
    let resolvedResourceId = cameraId;

    // Standard fallback parsing if deviceSerial is not passed
    if (!resolvedDeviceSerial && cameraId.includes("_") && !cameraId.startsWith("cam_")) {
      const parts = cameraId.split("_");
      resolvedDeviceSerial = parts[0];
      resolvedChannelNo = parseInt(parts[1], 10) || 1;
    }

    if (!resolvedDeviceSerial) {
      console.log(`Lookup: deviceSerial is missing for camera ${cameraId}. Fetching camera list to resolve...`);
      try {
        if (isStandardOpenAPI) {
          const listUrl = `https://${host}/api/lapp/camera/list`;
          const listRes = await fetch(listUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              accessToken: token,
              pageStart: "0",
              pageSize: "50",
            }).toString(),
          });
          if (listRes.ok) {
            const listData = await listRes.json();
            const cams = listData.data || [];
            let match = cams.find((c: any) => c.cameraId === cameraId || c.id === cameraId || `${c.deviceSerial}_${c.channelNo || c.cameraNo || 1}` === cameraId);
            if (!match && resolvedChannelNo) {
              match = cams.find((c: any) => Number(c.channelNo || c.cameraNo || 1) === Number(resolvedChannelNo));
            }
            if (match) {
              resolvedDeviceSerial = match.deviceSerial;
              resolvedChannelNo = match.channelNo || match.cameraNo || 1;
              resolvedResourceId = match.cameraId || match.id || cameraId;
              console.log(`Lookup Success: Resolved standard API camera to serial=${resolvedDeviceSerial}, channel=${resolvedChannelNo}, resourceId=${resolvedResourceId}`);
            }
          }
        } else {
          const listUrl = `https://${host}/api/hccgw/resource/v1/areas/cameras/get`;
          const listRes = await fetch(listUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Token: token,
            },
            body: JSON.stringify({ pageIndex: 1, pageSize: 100, filter: {} }),
          });
          if (listRes.ok) {
            const listData = await listRes.json();
            const cams = listData.data?.list || listData.data?.camera || (Array.isArray(listData.data) ? listData.data : []) || [];
            let match = cams.find((c: any) => c.id === cameraId || c.cameraID === cameraId || c.cameraId === cameraId);
            if (!match && resolvedChannelNo) {
              match = cams.find((c: any) => Number(c.device?.channelInfo?.no || c.channel || 1) === Number(resolvedChannelNo));
            }
            if (match) {
              resolvedDeviceSerial = match.device?.devInfo?.serialNo || match.device?.deviceSerial || match.deviceSerial;
              resolvedChannelNo = match.device?.channelInfo?.no || match.channel || 1;
              resolvedResourceId = match.id || match.cameraID || match.cameraId || cameraId;
              console.log(`Lookup Success: Resolved Teams NVR camera to serial=${resolvedDeviceSerial}, channel=${resolvedChannelNo}, resourceId=${resolvedResourceId}`);
            }
          }
        }
      } catch (e: any) {
        console.warn(`Lookup failed for live-stream: ${e.message}`);
      }
    }

    if (resolvedDeviceSerial) {
      const sourceStr = `${resolvedDeviceSerial}:${resolvedChannelNo || 1}`;
      const apiGateways = [
        `https://${host}/api/lapp/live/video/open`,
        `https://isgpopen.ezvizlife.com/api/lapp/live/video/open`,
        `https://iusopen.ezvizlife.com/api/lapp/live/video/open`,
        `https://euopen.ezvizlife.com/api/lapp/live/video/open`,
        `https://open.ezvizlife.com/api/lapp/live/video/open`,
        `https://open.ys7.com/api/lapp/live/video/open`,
        `https://open.hik-connect.com/api/lapp/live/video/open`,
        `https://open-sg.hik-connect.com/api/lapp/live/video/open`
      ];
      console.log(`Waking up/opening live stream for source: ${sourceStr}...`);
      await Promise.allSettled(apiGateways.map(async (openUrl) => {
        try {
          const res = await fetch(openUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              accessToken: token,
              source: sourceStr,
            }).toString(),
            signal: AbortSignal.timeout(2000),
          });
          const text = await res.text();
          console.log(`Wake up response from ${openUrl} (Status: ${res.status}): ${text.substring(0, 80)}`);
        } catch (err: any) {
          // Ignore wake up errors
        }
      }));
    }

    if (isStandardOpenAPI) {
      const url = `https://${host}/api/lapp/live/address/get`;
      console.log(`Proxied request -> Hik-Connect Standard live stream: ${url} for ${cameraId} (serial: ${resolvedDeviceSerial}, channel: ${resolvedChannelNo})`);
      try {
        let streamUrl: string | null = null;
        let hlsUrl: string | null = null;
        let flvUrl: string | null = null;
        let lastErrorMsg: string | null = null;

        // Try protocol "2" (HLS) first for maximum web compatibility, then "4" (FLV)
        for (const proto of ["2", "4"]) {
          for (const qual of ["1", "0"]) { // 1 = Clear/HD, 0 = Fluent/SD
            console.log(`Trying Standard API protocol ${proto} with quality ${qual} for ${cameraId}...`);
            try {
              const response = await fetch(url, {
                method: "POST",
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                  accessToken: token,
                  deviceSerial: resolvedDeviceSerial || cameraId,
                  channelNo: String(resolvedChannelNo || 1),
                  protocol: proto,
                  quality: qual,
                }).toString(),
                signal: AbortSignal.timeout(6000),
              });

              if (response.ok) {
                const data = await response.json();
                console.log(`Standard API proto ${proto} (qual ${qual}) response:`, JSON.stringify(data));
                const isSuccess = data && (data.code === "200" || data.code === 200 || data.errorCode === "0" || data.errorCode === 0);
                const item = Array.isArray(data.data) ? data.data[0] : (data.data || {});
                const retrieved = item?.url || item?.hls || item?.hlsHd || item?.flv || item?.flvAddress || item?.playUrl || item?.playAddress;
                if (isSuccess && retrieved) {
                  console.log(`Successfully retrieved stream URL for protocol ${proto} (quality ${qual}): ${retrieved}`);
                  if (proto === "2" && !hlsUrl) hlsUrl = item.hlsHd || item.hls || retrieved;
                  if (proto === "4" && !flvUrl) flvUrl = item.flvAddress || item.flv || retrieved;
                  if (!streamUrl) streamUrl = retrieved;
                } else if (data && (data.msg || data.message || data.errorMsg)) {
                  lastErrorMsg = data.msg || data.message || data.errorMsg;
                }
              }
            } catch (e: any) {
              console.warn(`Standard API live-stream protocol ${proto} quality ${qual} failed: ${e.message}`);
            }
          }
        }

        const finalUrl = hlsUrl || streamUrl || flvUrl;

        if (finalUrl) {
          return res.json({
            code: 200,
            errorCode: "0",
            data: {
              url: finalUrl,
              hlsUrl: hlsUrl || (finalUrl.includes(".m3u8") ? finalUrl : null),
              flvUrl: flvUrl || (finalUrl.includes(".flv") ? finalUrl : null),
            },
          });
        }

        if (lastErrorMsg) {
          return res.status(400).json({
            error: `Hik-Connect API Error: ${lastErrorMsg}`
          });
        }

        return res.status(400).json({ error: "Stream URL tidak ditemukan di respons server." });
      } catch (err: any) {
        return res.status(500).json({
          error: `Hik-Connect proxy error: ${err.message}`
        });
      }
    } else {
      const url = `https://${host}/api/hccgw/video/v1/live/address/get`;
      console.log(`Proxied request -> Hik-Connect Teams live stream: ${url} for ${cameraId} (serial: ${resolvedDeviceSerial}, channel: ${resolvedChannelNo})`);
      try {
        const payloads: any[] = [
          // 1. HLS Protocol 2 with deviceSerial & channelNo (Standard HLS stream for web player)
          {
            resourceId: resolvedResourceId,
            deviceSerial: resolvedDeviceSerial,
            channelNo: resolvedChannelNo ? Number(resolvedChannelNo) : 1,
            protocol: 2,
            streamType: 0,
          },
          {
            resourceId: resolvedResourceId,
            deviceSerial: resolvedDeviceSerial,
            channelNo: resolvedChannelNo ? Number(resolvedChannelNo) : 1,
            protocol: 2,
            streamType: 1,
          },
          // 2. HTTP-FLV Protocol 4
          {
            resourceId: resolvedResourceId,
            deviceSerial: resolvedDeviceSerial,
            channelNo: resolvedChannelNo ? Number(resolvedChannelNo) : 1,
            protocol: 4,
            streamType: 0,
          },
          {
            resourceId: resolvedResourceId,
            deviceSerial: resolvedDeviceSerial,
            channelNo: resolvedChannelNo ? Number(resolvedChannelNo) : 1,
            protocol: 4,
            streamType: 1,
          },
          {
            resourceId: resolvedResourceId,
          }
        ];

        let lastError: any = null;
        for (const reqBody of payloads) {
          try {
            const response = await fetch(url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Token": token,
              },
              body: JSON.stringify(reqBody),
              signal: AbortSignal.timeout(6000),
            });

            if (!response.ok) {
              const errText = await response.text().catch(() => "");
              console.warn(`Hik-Connect server returned HTTP ${response.status} for payload: ${JSON.stringify(reqBody)} - Error: ${errText}`);
              lastError = `Gagal mengambil stream dari server Hik-Connect (${response.status}): ${errText}`;
              continue;
            }

            const data = await response.json();
            
            if (data && data.errorCode === "OPEN000503") {
              return res.status(400).json({
                error: "Kamera ini tidak terdaftar di akun HikConnect Teams. Silakan klik tombol HUBUNGKAN AKUN INI pada pengaturan untuk menyegarkan daftar kamera."
              });
            }
            const isSuccess = data && ((data.errorCode === "0" || data.errorCode === 0) || (data.code === "0" || data.code === 0) || (data.code === "200" || data.code === 200));
            if (data && !isSuccess && (data.errorCode || data.code)) {
              console.warn(`Hik-Connect API Error for payload: ${JSON.stringify(reqBody)} - Error: ${JSON.stringify(data)}`);
              lastError = `Hik-Connect API Error: ${data.errorMsg || data.message || data.msg || 'Unknown Error'} (Code: ${data.errorCode || data.code})`;
              continue;
            }

            const rawData = data?.data;
            const streamPayload = Array.isArray(rawData) ? rawData[0] : (rawData || data);
            const streamUrl = streamPayload?.url || streamPayload?.playUrl || streamPayload?.playAddress || streamPayload?.streamUrl || streamPayload?.hls || streamPayload?.flv || data?.url;
            const hlsUrl = streamPayload?.hls || (streamUrl && streamUrl.includes(".m3u8") ? streamUrl : null);
            const flvUrl = streamPayload?.flv || (streamUrl && streamUrl.includes(".flv") ? streamUrl : null);

            if (streamUrl) {
              console.log(`Successfully retrieved Teams stream URL: ${streamUrl} (Payload: ${JSON.stringify(reqBody)})`);
              return res.json({
                code: 200,
                errorCode: "0",
                data: {
                  ...(streamPayload && typeof streamPayload === "object" ? streamPayload : {}),
                  url: streamUrl,
                  hlsUrl,
                  flvUrl,
                },
              });
            }

            return res.json(data);
          } catch (err: any) {
            console.warn(`Hik-Connect live-stream proxy fetch error: ${err.message}`);
            lastError = `Hik-Connect proxy error: ${err.message}`;
          }
        }

        return res.status(400).json({ error: lastError || "Gagal mengambil stream dari server Hik-Connect." });
      } catch (err: any) {
        return res.status(500).json({
          error: `Hik-Connect proxy error: ${err.message}`
        });
      }
    }
  } catch (err: any) {
    console.error("Hik Live Stream Proxy Error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// Proxy endpoints for Moggumung POS Integration
app.post("/api/moggumung/sync", async (req, res) => {
  try {
    const { apiUrl, token, tokens: userTokens } = req.body;
    const baseUrl = (apiUrl || "https://on.moggumung.id").replace(/\/$/, "");

    const activeTokens = userTokens || token || "WPMX-F4J7-AUBT,8MAA-E8UW-RH59,2MFA-0GKS-HY3A";

    const headers: Record<string, string> = { 
      "Content-Type": "application/json",
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    };

    console.log(`Syncing Moggumung POS from ${baseUrl} using tokens: ${activeTokens}...`);

    const now = new Date();
    const todayDate = now.toISOString().split('T')[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().split('T')[0];

    // Fetch branches, latest revenues, revenue overview, and branch records in parallel
    const [brRes, revLatestRes, overviewRes, recRes, rangedRes] = await Promise.allSettled([
      fetch(`${baseUrl}/api/branches?tokens=${encodeURIComponent(activeTokens)}`, { headers, signal: AbortSignal.timeout(7000) }),
      fetch(`${baseUrl}/api/revenue/branches/latest?tokens=${encodeURIComponent(activeTokens)}`, { headers, signal: AbortSignal.timeout(7000) }),
      fetch(`${baseUrl}/api/revenue/overview?tokens=${encodeURIComponent(activeTokens)}`, { headers, signal: AbortSignal.timeout(7000) }),
      fetch(`${baseUrl}/api/analytics/branch-records?tokens=${encodeURIComponent(activeTokens)}`, { headers, signal: AbortSignal.timeout(7000) }),
      fetch(`${baseUrl}/api/revenue/branches/ranged?tokens=${encodeURIComponent(activeTokens)}&startDate=${sevenDaysAgo}&endDate=${todayDate}`, { headers, signal: AbortSignal.timeout(7000) }),
    ]);

    let rawBranches: any[] = brRes.status === "fulfilled" && brRes.value.ok ? await brRes.value.json().catch(() => []) : [];
    let latestRevenues: any[] = revLatestRes.status === "fulfilled" && revLatestRes.value.ok ? await revLatestRes.value.json().catch(() => []) : [];
    let revenueOverview: any = overviewRes.status === "fulfilled" && overviewRes.value.ok ? await overviewRes.value.json().catch(() => null) : null;
    let branchRecords: any[] = recRes.status === "fulfilled" && recRes.value.ok ? await recRes.value.json().catch(() => []) : [];
    let rangedRecords: any[] = rangedRes.status === "fulfilled" && rangedRes.value.ok ? await rangedRes.value.json().catch(() => []) : [];

    // If branches empty, fallback to known active branch list
    if (!rawBranches || rawBranches.length === 0) {
      rawBranches = [
        { id: "SEMINYAK", name: "SEMINYAK", legacy_id: "SEMINYAK" },
        { id: "JIMBARAN", name: "JIMBARAN", legacy_id: "JIMBARAN" },
        { id: "BANDUNG", name: "BANDUNG", legacy_id: "BANDUNG" },
        { id: "CANGGU", name: "CANGGU", legacy_id: "CANGGU" },
        { id: "UBUD", name: "UBUD", legacy_id: "UBUD" },
        { id: "0f27531a-c4d7-4270-881c-de2d6de44041", name: "MEDAN PATTIMURA", legacy_id: "MEDAN PATTIMURA" }
      ];
    }

    // Merge each branch with real live revenue from latestRevenues
    const mergedBranches = rawBranches.map((b: any) => {
      const bName = (b.name || b.id || "").toLowerCase().trim();
      const bLegacy = (b.legacy_id || "").toLowerCase().trim();

      const revMatch = Array.isArray(latestRevenues) ? latestRevenues.find((r: any) => {
        const rName = (r.name || "").toLowerCase().trim();
        return r.id === b.id ||
          (rName && bName && (rName === bName || rName.includes(bName) || bName.includes(rName))) ||
          (rName && bLegacy && (rName === bLegacy || rName.includes(bLegacy) || bLegacy.includes(rName)));
      }) : null;

      const recordMatch = Array.isArray(branchRecords) ? branchRecords.find((r: any) => {
        const rBranch = (r.branch || "").toLowerCase().trim();
        return rBranch && (rBranch === bName || rBranch === bLegacy || rBranch.includes(bName) || bName.includes(rBranch));
      }) : null;

      const liveRevenue = revMatch ? Number(revMatch.revenue || 0) : (recordMatch ? Number(recordMatch.lowest || 0) : 0);

      return {
        ...b,
        revenue: liveRevenue,
        paid: revMatch ? Number(revMatch.paid || 0) : 0,
        unpaid: revMatch ? Number(revMatch.unpaid || 0) : 0,
        date: revMatch?.date || todayDate,
        recordStats: recordMatch || null
      };
    });

    // Compute live total if not available
    const calculatedTotalLive = mergedBranches.reduce((acc: number, b: any) => acc + (b.revenue || 0), 0);
    if (!revenueOverview) {
      revenueOverview = { total_live: calculatedTotalLive };
    } else if (revenueOverview.total_live === 0 && calculatedTotalLive > 0) {
      revenueOverview.total_live = calculatedTotalLive;
    }

    // Build comprehensive daily records
    const dailyRecords: any[] = [];
    mergedBranches.forEach((b: any) => {
      dailyRecords.push({
        branch: b.name,
        branchId: b.id,
        revenue: b.revenue,
        paid: b.paid,
        unpaid: b.unpaid,
        date: todayDate,
        isLiveToday: true
      });
    });

    return res.json({
      success: true,
      tokens: activeTokens,
      branches: mergedBranches,
      revenueOverview,
      dailyRecords,
      branchRecords,
      rangedRecords
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
