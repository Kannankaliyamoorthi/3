import React, { useState, useEffect, useRef, ChangeEvent } from 'react';
import { Camera, Activity, AlertCircle, Upload, Video, VideoOff, ClipboardList, ShieldAlert, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { initAI, detectObjects, performOCR, analyzeSignalColor } from '../lib/ai-engine';

interface RealDetection {
  id: string;
  class: string;
  bbox: [number, number, number, number];
  score: number;
  plate?: string;
  violation?: string;
}

export const LiveFeed: React.FC = () => {
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [detections, setDetections] = useState<RealDetection[]>([]);
  const [registry, setRegistry] = useState<any[]>([]);
  const [sourceType, setSourceType] = useState<'live' | 'upload' | 'webcam'>('live');
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef<number>();
  const streamRef = useRef<MediaStream | null>(null);

  const LIVE_FEED_URL = "https://assets.mixkit.co/videos/preview/mixkit-traffic-in-a-city-at-night-4506-large.mp4";

  // Initialize AI Models
  useEffect(() => {
    const load = async () => {
      try {
        await initAI();
        setIsModelLoading(false);
        setIsPlaying(true);
      } catch (err) {
        setError("Failed to load AI models. Please refresh.");
      }
    };
    load();
  }, []);

  // Main AI Processing Loop
  const processFrame = async () => {
    if (!videoRef.current || !canvasRef.current || !isPlaying) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (video.readyState === 4 && ctx) {
      // 1. Run Real Object Detection
      const results = await detectObjects(video);
      
      // 2. Filter for Traffic Entities
      const trafficClasses = ['car', 'motorcycle', 'bus', 'truck', 'person', 'traffic light'];
      const filtered = results
        .filter(r => trafficClasses.includes(r.class) && r.score > 0.5)
        .map(r => ({
          id: Math.random().toString(36).substr(2, 9),
          class: r.class,
          bbox: r.bbox as [number, number, number, number],
          score: r.score
        }));

      setDetections(filtered);

      // 3. Logic for Violations & Registry
      for (const det of filtered) {
        if (['car', 'motorcycle', 'truck'].includes(det.class)) {
          // Check for Stop Line Violation (Simulated line at 70% height)
          const isOverLine = (det.bbox[1] + det.bbox[3]) > (video.videoHeight * 0.7);
          
          if (isOverLine && Math.random() > 0.99) { // Real coordinate check + throttle
            handleRealViolation(det, video, canvas);
          }
        }
      }
    }

    requestRef.current = requestAnimationFrame(processFrame);
  };

  useEffect(() => {
    if (!isModelLoading && isPlaying) {
      requestRef.current = requestAnimationFrame(processFrame);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isModelLoading, isPlaying, sourceType]);

  const handleRealViolation = async (det: any, video: HTMLVideoElement, canvas: HTMLCanvasElement) => {
    // Perform Real OCR on the detected vehicle
    const tempCanvas = document.createElement('canvas');
    const [x, y, w, h] = det.bbox;
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      tempCtx.drawImage(video, x, y, w, h, 0, 0, w, h);
      const plate = await performOCR(tempCanvas);
      
      const violationData = {
        vehicle_number: plate,
        violation_type: 'Stop Line',
        fine_amount: 500,
        status: 'Pending',
        location: 'Junction-01',
        metadata: { class: det.class, confidence: det.score.toFixed(2) },
        evidence_url: canvas.toDataURL('image/jpeg')
      };

      // Save to Supabase
      await supabase.from('violations').insert([violationData]);
      
      setRegistry(prev => [{ ...violationData, timestamp: new Date().toLocaleTimeString() }, ...prev].slice(0, 10));
    }
  };

  const startWebcam = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setSourceType('webcam');
      setIsPlaying(true);
    } catch (err) {
      setError("Camera access denied.");
    }
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSourceType('upload');
      setVideoRefSrc(URL.createObjectURL(file));
      setIsPlaying(true);
    }
  };

  const setVideoRefSrc = (src: string) => {
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.src = src;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <div className="bg-blue-600 p-1.5 rounded-lg text-white">
              <Cpu className="w-5 h-5" />
            </div>
            YOLOv8 Real-Time Engine
          </h2>
          <p className="text-slate-500 text-sm">Processing live frames via TensorFlow.js & Tesseract OCR</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="bg-slate-100 p-1 rounded-xl flex border border-slate-200">
            <button onClick={() => { setSourceType('live'); setVideoRefSrc(LIVE_FEED_URL); }} className={cn("px-4 py-2 text-xs font-bold rounded-lg transition-all", sourceType === 'live' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500")}>Live Feed</button>
            <button onClick={startWebcam} className={cn("px-4 py-2 text-xs font-bold rounded-lg transition-all", sourceType === 'webcam' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500")}>Webcam</button>
            <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 text-xs font-bold text-slate-500">Upload</button>
          </div>
          <input type="file" ref={fileInputRef} className="hidden" accept="video/*" onChange={handleFileUpload} />
          
          <div className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all",
            isModelLoading ? "bg-amber-50 border-amber-200 text-amber-600" : "bg-green-50 border-green-200 text-green-600"
          )}>
            <Activity className={cn("w-3.5 h-3.5", !isModelLoading && "animate-pulse")} />
            {isModelLoading ? "LOADING MODELS..." : "ENGINE ACTIVE"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 relative aspect-video bg-slate-950 rounded-[2.5rem] overflow-hidden shadow-2xl border-8 border-slate-900">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            autoPlay muted loop playsInline
            src={sourceType !== 'webcam' ? LIVE_FEED_URL : undefined}
          />
          
          {/* Hidden processing canvas */}
          <canvas ref={canvasRef} className="hidden" width="1280" height="720" />

          {/* Real AI Overlays */}
          <div className="absolute inset-0 pointer-events-none">
            {detections.map((det) => {
              const [x, y, w, h] = det.bbox;
              // Convert absolute px to percentage for responsive overlay
              const video = videoRef.current;
              if (!video) return null;
              const px = (x / video.videoWidth) * 100;
              const py = (y / video.videoHeight) * 100;
              const pw = (w / video.videoWidth) * 100;
              const ph = (h / video.videoHeight) * 100;

              return (
                <div
                  key={det.id}
                  className={cn(
                    "absolute border-2 rounded-lg transition-all",
                    det.class === 'traffic light' ? "border-yellow-400" : "border-blue-500"
                  )}
                  style={{ left: `${px}%`, top: `${py}%`, width: `${pw}%`, height: `${ph}%` }}
                >
                  <div className="absolute -top-6 left-0 bg-slate-900 text-[8px] px-2 py-0.5 rounded text-white font-bold uppercase">
                    {det.class} {(det.score * 100).toFixed(0)}%
                  </div>
                </div>
              );
            })}
            
            {/* Virtual Stop Line */}
            <div className="absolute top-[70%] left-0 right-0 h-1 border-t-2 border-dashed border-red-500/50 flex items-center justify-center">
              <span className="bg-red-500 text-white text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter">AI Stop Line Boundary</span>
            </div>
          </div>

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm z-50">
              <div className="text-center p-8">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-white font-bold text-xl">{error}</h3>
                <button onClick={() => window.location.reload()} className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-xl font-bold">Retry Engine</button>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-xl h-full flex flex-col">
            <h3 className="font-black text-slate-900 flex items-center gap-2 text-lg mb-6">
              <ShieldAlert className="text-blue-600 w-6 h-6" />
              Real-Time Registry
            </h3>
            
            <div className="flex-1 space-y-3 overflow-y-auto max-h-[500px] pr-2 custom-scrollbar">
              <AnimatePresence mode="popLayout">
                {registry.map((item, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-4 bg-slate-50 border border-slate-100 rounded-2xl"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-[10px] font-black text-red-600 uppercase">Violation Detected</span>
                      <span className="text-[9px] font-mono text-slate-400">{item.timestamp}</span>
                    </div>
                    <p className="font-mono font-black text-lg text-slate-900">{item.vehicle_number}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">{item.metadata.class}</span>
                      <span className="text-[10px] font-black bg-red-100 text-red-700 px-2 py-0.5 rounded uppercase">Stop Line</span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {registry.length === 0 && (
                <div className="flex flex-col items-center justify-center h-60 text-center opacity-40">
                  <Activity className="w-12 h-12 mb-4" />
                  <p className="text-sm font-bold">Scanning for objects...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
