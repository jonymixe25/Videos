import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, Home, Mail, Play, SkipForward, Video, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

// --- Constants ---
const API_BASE = window.location.origin; // Use local proxy
const EXTERNAL_BASE = 'https://videos-gamma-seven-80.vercel.app';

// --- Components ---

const Navbar = () => {
  const location = useLocation();
  
  const links = [
    { path: '/', label: 'Inicio', icon: Home },
    { path: '/subir', label: 'Subir', icon: Upload },
    { path: '/contacto', label: 'Contacto', icon: Mail },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 p-4 md:top-0 md:bottom-auto">
      <div className="max-w-md mx-auto glass rounded-2xl flex justify-around p-2 md:max-w-lg">
        {links.map(({ path, label, icon: Icon }) => (
          <Link
            key={path}
            to={path}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${
              location.pathname === path ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Icon size={20} />
            <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
};

const VideoPlayer = () => {
  const [videos, setVideos] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [source, setSource] = useState<'local' | 'external'>('local');
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const fetchVideos = async (pageNum: number, isInitial = false) => {
    if (isInitial) {
      setLoading(true);
      setError(null);
    } else {
      setFetchingMore(true);
    }

    try {
      const res = await fetch(`${API_BASE}/api/proxy/videos?page=${pageNum}&limit=5`);
      
      if (!res.ok) {
        throw new Error(`Error del servidor: ${res.status}`);
      }

      const data = await res.json();
      setSource(data.source);

      // Ensure video URLs are absolute pointing to the correct server
      const newVideos = data.videos.map((v: string) => {
        if (v.startsWith('http')) return v;
        return data.source === 'external' ? `${EXTERNAL_BASE}${v}` : `${API_BASE}${v}`;
      });
      
      if (isInitial) {
        setVideos(newVideos);
        setCurrentIndex(0);
      } else {
        setVideos(prev => [...prev, ...newVideos]);
      }
      
      setHasMore(data.hasMore);
    } catch (err: any) {
      console.error("Error fetching videos:", err);
      setError(err.message || "No se pudieron cargar los videos");
    } finally {
      setLoading(false);
      setFetchingMore(false);
    }
  };

  useEffect(() => {
    fetchVideos(1, true);
  }, []);

  const nextVideo = () => {
    const nextIdx = currentIndex + 1;
    
    if (nextIdx >= videos.length - 2 && hasMore && !fetchingMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchVideos(nextPage);
    }

    if (nextIdx < videos.length) {
      setCurrentIndex(nextIdx);
    } else if (!hasMore && videos.length > 0) {
      setCurrentIndex(0);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin text-zinc-500" size={48} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-8 text-center">
        <AlertCircle size={64} className="text-red-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Error de Conexión</h2>
        <p className="text-zinc-500 mb-6">{error}</p>
        <button 
          onClick={() => fetchVideos(1, true)}
          className="px-6 py-3 bg-white text-black rounded-full font-bold hover:bg-zinc-200 transition-all"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const currentVideo = videos[currentIndex];

  return (
    <div className="relative h-screen w-full bg-black overflow-hidden flex items-center justify-center">
      {currentVideo ? (
        <>
          <AnimatePresence mode="wait">
            <motion.video
              key={currentVideo}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.3 }}
              ref={videoRef}
              src={currentVideo}
              autoPlay
              controls
              className="h-full w-full object-contain"
              onEnded={nextVideo}
            />
          </AnimatePresence>
          
          <div className="absolute right-6 bottom-24 md:bottom-12 flex flex-col gap-4 z-10">
            <button
              onClick={nextVideo}
              className="p-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-white hover:bg-white/20 transition-all shadow-xl"
              title="Siguiente Video"
            >
              <SkipForward size={24} />
            </button>
            
            {fetchingMore && (
              <div className="bg-black/50 backdrop-blur-sm p-2 rounded-full">
                <Loader2 className="animate-spin text-white" size={20} />
              </div>
            )}
          </div>

          <div className="absolute top-6 left-6 z-10 flex flex-col gap-2">
            <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
              <span className="text-xs font-bold text-white/70 uppercase tracking-widest">
                Video {currentIndex + 1} de {videos.length} {hasMore ? '+' : ''}
              </span>
            </div>
            <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter w-fit ${source === 'external' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
              Servidor: {source === 'external' ? 'Vercel' : 'Local'}
            </div>
          </div>
        </>
      ) : (
        <div className="text-center p-8">
          <Video size={64} className="mx-auto mb-4 text-zinc-700" />
          <h2 className="text-2xl font-bold mb-2">No hay videos aún</h2>
          <p className="text-zinc-500 mb-6">Sé el primero en subir algo increíble.</p>
          <Link to="/subir" className="px-6 py-3 bg-white text-black rounded-full font-bold hover:bg-zinc-200 transition-all">
            Subir Video
          </Link>
        </div>
      )}
    </div>
  );
};

const UploadPage = () => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatus(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('video', file);

    try {
      // Use proxy to avoid CORS
      const res = await fetch(`${API_BASE}/api/proxy/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setStatus({ type: 'success', message: '¡Video publicado con éxito!' });
        setFile(null);
      } else {
        setStatus({ type: 'error', message: data.error || 'Error al subir el video' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Error de conexión con el servidor externo' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen pt-12 pb-32 px-6 max-w-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8"
      >
        <header>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Subir Video</h1>
          <p className="text-zinc-500">Comparte tus momentos con el mundo.</p>
        </header>

        <div className="glass rounded-3xl p-8 text-center space-y-6">
          <div className="relative group cursor-pointer">
            <input
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className={`border-2 border-dashed rounded-2xl p-12 transition-all ${file ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-zinc-800 group-hover:border-zinc-600'}`}>
              <Upload size={48} className={`mx-auto mb-4 ${file ? 'text-emerald-500' : 'text-zinc-600'}`} />
              <p className="text-lg font-medium">
                {file ? file.name : 'Selecciona un archivo de video'}
              </p>
              <p className="text-sm text-zinc-500 mt-2">MP4, WebM o OGG</p>
            </div>
          </div>

          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className={`w-full py-4 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-2 ${
              !file || uploading 
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                : 'bg-white text-black hover:bg-zinc-200'
            }`}
          >
            {uploading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Subiendo...
              </>
            ) : (
              'Publicar Video'
            )}
          </button>

          <AnimatePresence>
            {status && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={`flex items-center gap-3 p-4 rounded-xl ${
                  status.type === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                }`}
              >
                {status.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                <span className="text-sm font-medium">{status.message}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

const ContactPage = () => {
  return (
    <div className="min-h-screen pt-12 pb-32 px-6 max-w-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8"
      >
        <header>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Contacto</h1>
          <p className="text-zinc-500">¿Tienes alguna duda o sugerencia?</p>
        </header>

        <div className="glass rounded-3xl p-8 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Nombre</label>
              <input type="text" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 focus:outline-none focus:border-white transition-all" placeholder="Tu nombre" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Email</label>
              <input type="email" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 focus:outline-none focus:border-white transition-all" placeholder="tu@email.com" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Mensaje</label>
              <textarea rows={4} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 focus:outline-none focus:border-white transition-all resize-none" placeholder="¿En qué podemos ayudarte?"></textarea>
            </div>
          </div>

          <button className="w-full py-4 bg-white text-black rounded-2xl font-bold text-lg hover:bg-zinc-200 transition-all">
            Enviar Mensaje
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-zinc-950">
        <Navbar />
        <main>
          <Routes>
            <Route path="/" element={<VideoPlayer />} />
            <Route path="/subir" element={<UploadPage />} />
            <Route path="/contacto" element={<ContactPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
