import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import multer from "multer";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Ensure videos directory exists
  const videosDir = path.join(process.cwd(), "public", "videos");
  if (!fs.existsSync(videosDir)) {
    fs.mkdirSync(videosDir, { recursive: true });
  }

  // Configure multer for video uploads
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, videosDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    },
  });

  const upload = multer({ 
    storage,
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith("video/")) {
        cb(null, true);
      } else {
        cb(new Error("Solo se permiten archivos de video."));
      }
    }
  });

  // Proxy Routes to avoid CORS issues with external Vercel URL
  app.get("/api/proxy/videos", async (req, res) => {
    try {
      const targetUrl = `https://videos-gamma-seven-80.vercel.app/api/videos?${new URLSearchParams(req.query as any).toString()}`;
      const response = await fetch(targetUrl);
      if (!response.ok) throw new Error(`External API returned ${response.status}`);
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Proxy Error (Videos):", error.message);
      res.status(502).json({ error: "Error al conectar con el servidor externo", details: error.message });
    }
  });

  app.post("/api/proxy/upload", upload.single("video"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No se subió ningún archivo" });

      const formData = new FormData();
      const blob = new Blob([fs.readFileSync(req.file.path)], { type: req.file.mimetype });
      formData.append("video", blob, req.file.originalname);

      const response = await fetch("https://videos-gamma-seven-80.vercel.app/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error(`External API returned ${response.status}`);
      const data = await response.json();
      
      // Clean up local temp file
      fs.unlinkSync(req.file.path);
      
      res.json(data);
    } catch (error: any) {
      console.error("Proxy Error (Upload):", error.message);
      res.status(502).json({ error: "Error al subir al servidor externo", details: error.message });
    }
  });

  // API Routes (Local fallback)
  app.get("/api/videos", (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const startIndex = (page - 1) * limit;

      const files = fs.readdirSync(videosDir);
      const videoFiles = files.filter(file => 
        [".mp4", ".webm", ".ogg", ".mov"].includes(path.extname(file).toLowerCase())
      );

      // Sort by creation time (newest first) for consistent pagination
      const sortedVideos = videoFiles
        .map(file => ({
          name: file,
          time: fs.statSync(path.join(videosDir, file)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time)
        .map(v => `/videos/${v.name}`);

      const paginatedVideos = sortedVideos.slice(startIndex, startIndex + limit);

      res.json({
        videos: paginatedVideos,
        total: sortedVideos.length,
        hasMore: startIndex + limit < sortedVideos.length
      });
    } catch (error) {
      res.status(500).json({ error: "Error al leer la carpeta de videos" });
    }
  });

  app.post("/api/upload", upload.single("video"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No se subió ningún archivo" });
    }
    res.json({ message: "Video subido con éxito", url: `/videos/${req.file.filename}` });
  });

  // Serve static videos
  app.use("/videos", express.static(videosDir));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
}

startServer();
