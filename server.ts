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

  // --- Helper for local video listing ---
  const getLocalVideos = (req: any) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const startIndex = (page - 1) * limit;

    const files = fs.readdirSync(videosDir);
    const videoFiles = files.filter(file => 
      [".mp4", ".webm", ".ogg", ".mov"].includes(path.extname(file).toLowerCase())
    );

    const sortedVideos = videoFiles
      .map(file => ({
        name: file,
        time: fs.statSync(path.join(videosDir, file)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time)
      .map(v => `/videos/${v.name}`);

    return {
      videos: sortedVideos.slice(startIndex, startIndex + limit),
      total: sortedVideos.length,
      hasMore: startIndex + limit < sortedVideos.length,
      source: "local"
    };
  };

  // Proxy Routes with Fallback
  app.get("/api/proxy/videos", async (req, res) => {
    try {
      const targetUrl = `https://videos-gamma-seven-80.vercel.app/api/videos?${new URLSearchParams(req.query as any).toString()}`;
      const response = await fetch(targetUrl);
      
      if (response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          return res.json({ ...data, source: "external" });
        }
      }
      
      console.warn(`External API failed (${response.status}), falling back to local.`);
      res.json(getLocalVideos(req));
    } catch (error: any) {
      console.error("Proxy Error (Videos), falling back to local:", error.message);
      res.json(getLocalVideos(req));
    }
  });

  app.post("/api/proxy/upload", upload.single("video"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No se subió ningún archivo" });

      // Try external upload
      try {
        const formData = new FormData();
        const fileBuffer = fs.readFileSync(req.file.path);
        const blob = new Blob([fileBuffer], { type: req.file.mimetype });
        formData.append("video", blob, req.file.originalname);

        const response = await fetch("https://videos-gamma-seven-80.vercel.app/api/upload", {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          // Clean up local temp file if external upload succeeded
          fs.unlinkSync(req.file.path);
          return res.json({ ...data, source: "external" });
        }
        console.warn(`External upload failed (${response.status}), keeping local copy.`);
      } catch (extError) {
        console.warn("External upload failed, keeping local copy.");
      }
      
      // If external fails, the file is already in videosDir thanks to multer
      res.json({ 
        message: "Video subido con éxito (Local)", 
        url: `/videos/${req.file.filename}`,
        source: "local"
      });
    } catch (error: any) {
      res.status(500).json({ error: "Error crítico en la subida", details: error.message });
    }
  });

  // API Routes (Local fallback)
  app.get("/api/videos", (req, res) => {
    try {
      res.json(getLocalVideos(req));
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
