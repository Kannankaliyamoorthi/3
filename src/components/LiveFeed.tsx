import React, { useState, useEffect, useRef, ChangeEvent } from 'react';
import { Activity, ShieldAlert, Cpu, Zap, Camera, Upload, Video, RefreshCcw, CheckCircle2, AlertTriangle, Car, Truck, Bike, Gauge, ScanText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { initAI, detectObjects, performOCR, analyzeSignalColor, checkHelmet, calculateSpeed } from '../lib/ai-engine';

interface TrackedObject {
  id: string;
  class: string;
  bbox: [number, number, number, number];
  lastPos: { x: number, y: number, t: number };
  speed: number;
  isRider?: boolean;
  hasHelmet?: boolean;
  violationTriggered: boolean;
  violationType?: string;
  associatedPlate?: string;
  isScanningPlate?: boolean;
}

export const LiveFeed: React.FC = () => {
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [detections, setDetections] = useState<any[]>([]);
  const [registry, setRegistry] = useState<any[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [sourceType, setSourceType] = useState<'live' | 'webcam' | 'upload'>('live');
  
  const [aiSignal, setAiSignal] = useState<'red' | 'yellow' | 'green' | 'unknown'>('unknown');
  const [signalOverride, setSignalOverride] = useState<'auto' | 'red' | 'yellow' | 'green'>('auto');
  const [speedLimit, setSpeedLimit] = useState<number>(60);
  
  const [error, setError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef<number>();
  const tracker = useRef<Map<string, TrackedObject>>(new Map());
  const streamRef = useRef<MediaStream | null>(null);

  const effectiveSignal = signalOverride === 'auto' ? aiSignal : signalOverride;
  const effectiveSignalRef = useRef(effectiveSignal);
  const speedLimitRef = useRef(speedLimit);

  const LIVE_FEED_URL = "https://assets.mixkit.co/videos/preview/mixkit-traffic-in-a-city-at-night-4506-large.mp4";

  useEffect(() => {
    effectiveSignalRef.current = effectiveSignal;
  }, [effectiveSignal]);

  useEffect(() => {
    speedLimitRef.current = speedLimit;
  }, [speedLimit]);

  useEffect(() => {
    const load = async () => {
      try {
        await initAI();
        setIsModelLoading(false);
        setIsPlaying(true);
      } catch (err) {
        setError("AI Engine failed to initialize.");
      }
    };
    load();
    return () => stopMedia();
  }, []);

  const stopMedia = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsPlaying(false);
  };

  const processFrame = async () => {
    if (!videoRef.current || !canvasRef.current || !isPlaying) return;

    const video = videoRef.current;
    if (video.readyState === 4) {
      const results = await detectObjects(video);
      const now = Date.now();
      const trafficClasses = ['car', 'motorcycle', 'bus', 'truck', 'person', 'traffic light'];

      if (signalOverride === 'auto') {
        const light = results.find(r => r.class === 'traffic light' && r.score > 0.5);
        if (light) {
          const [x, y, w, h] = light.bbox;
          const lightCanvas = document.createElement('canvas');
          lightCanvas.width = Math.max(1, w); lightCanvas.height = Math.max(1, h);
          const lCtx = lightCanvas.getContext('2d');
          if (lCtx) {
            lCtx.drawImage(video, x, y, w, h, 0, 0, w, h);
            const color = analyzeSignalColor(lightCanvas);
            if (color !== 'unknown') setAiSignal(color);
          }
        }
      }

      const currentFrameDetections: any[] = [];
      const assignedTrackIds = new Set<string>();

      for (const res of results) {
        if (!trafficClasses.includes(res.class) || res.score < 0.45) continue;

        const [x, y, w, h] = res.bbox;
        const centerX = x + w / 2;
        const centerY = y + h / 2;

        let trackId = "";
        let minDistance = 100;

        tracker.current.forEach((obj, id) => {
          if (assignedTrackIds.has(id)) return;
          const dist = Math.sqrt(Math.pow(centerX - obj.lastPos.x, 2) + Math.pow(centerY - obj.lastPos.y, 2));
          if (dist < minDistance) {
            minDistance = dist;
            trackId = id;
          }
        });

        if (!trackId) {
          trackId = Math.random().toString(36).substr(2, 5);
          tracker.current.set(trackId, {
            id: trackId,
            class: res.class,
            bbox: res.bbox as [number, number, number, number],
            lastPos: { x: centerX, y: centerY, t: now },
            speed: 0,
            violationTriggered: false,
            isScanningPlate: false
          });
        } else {
          const obj = tracker.current.get(trackId)!;
          const rawSpeed = calculateSpeed(obj.lastPos, { x: centerX, y: centerY, t: now }, video.videoHeight);
          
          if (rawSpeed > 0) {
            obj.speed = obj.speed === 0 ? rawSpeed : Math.round((obj.speed * 0.8) + (rawSpeed * 0.2));
          }

          obj.lastPos = { x: centerX, y: centerY, t: now };
          obj.bbox = res.bbox as [number, number, number, number];

          if (res.class === 'person') {
            let isRider = false;
            let associatedBikeId: string | null = null;
            
            tracker.current.forEach((tObj, tId) => {
              if (tObj.class === 'motorcycle') {
                const dist = Math.sqrt(Math.pow(tObj.lastPos.x - centerX, 2) + Math.pow(tObj.lastPos.y - centerY, 2));
                if (dist < 150) {
                  isRider = true;
                  associatedBikeId = tId;
                }
              }
            });

            if (isRider) {
              obj.isRider = true;
              const pCanvas = document.createElement('canvas');
              pCanvas.width = Math.max(1, w); pCanvas.height = Math.max(1, h);
              const pCtx = pCanvas.getContext('2d');
              if (pCtx) {
                pCtx.drawImage(video, x, y, w, h, 0, 0, w, h);
                obj.hasHelmet = checkHelmet(pCanvas);
              }

              if (obj.hasHelmet === false && !obj.violationTriggered) {
                const bike = associatedBikeId ? tracker.current.get(associatedBikeId) : null;
                if (bike) bike.violationType = 'No Helmet';
                triggerViolation(bike || obj, 'No Helmet', 500, video);
                obj.violationTriggered = true;
                if (bike) bike.violationTriggered = true;
              }
            }
          }

          if (!obj.violationTriggered && !obj.isScanningPlate) {
            const isOverLine = (y + h) > (video.videoHeight * 0.7);
            const currentLimit = speedLimitRef.current;
            
            if (obj.speed > currentLimit && ['car', 'motorcycle', 'truck', 'bus'].includes(res.class)) {
              obj.violationType = 'Overspeeding';
              triggerViolation(obj, 'Overspeeding', 2000, video);
              obj.violationTriggered = true;
            } 
            else if (isOverLine && effectiveSignalRef.current === 'red' && ['car', 'motorcycle', 'truck', 'bus'].includes(res.class)) {
              obj.violationType = 'Signal Jump';
              triggerViolation(obj, 'Signal Jump', 1000, video);
              obj.violationTriggered = true;
            }
          }
        }
        
        assignedTrackIds.add(trackId);
        currentFrameDetections.push({ ...tracker.current.get(trackId), score: res.score });
      }

      tracker.current.forEach((obj, id) => {
        if (now - obj.lastPos.t > 2000) tracker.current.delete(id);
      });

      setDetections(currentFrameDetections);
    }
    requestRef.current = requestAnimationFrame(processFrame);
  };

  const triggerViolation = async (obj: TrackedObject, type: string, fine: number, video: HTMLVideoElement) => {
    obj.isScanningPlate = true; // Visual indicator for ANPR
    const [x, y, w, h] = obj.bbox;
    const vCanvas = document.createElement('canvas');
    vCanvas.width = Math.max(1, w); vCanvas.height = Math.max(1, h);
    const vCtx = vCanvas.getContext('2d');
    
    if (vCtx) {
      vCtx.drawImage(video, x, y, w, h, 0, 0, w, h);
      
      // Module 5: Perform OCR on the cropped vehicle
      const plate = await performOCR(vCanvas);
      obj.associatedPlate = plate;
      obj.isScanningPlate = false;
      
      const data = {
        vehicle_number: plate,
        violation_type: type,
        fine_amount: fine,
        location: 'Junction-01',
        speed: obj.speed,
        status: 'Pending',
        metadata: { class: obj.class, confidence: '0.92', limit: speedLimitRef.current },
        evidence_url: vCanvas.toDataURL('image/jpeg')
      };

      await supabase.from('violations').insert([data]);
      setRegistry(prev => [{ ...data, timestamp: new Date().toLocaleTimeString() }, ...prev].slice(0, 10));
    }
  };

  useEffect(() => {
    if (!isModelLoading && isPlaying) requestRef.current = requestAnimationFrame(processFrame);
    return () => cancelAnimationFrame(requestRef.current!);
  }, [isModelLoading, isPlaying]);

  const vehicleCounts = detections.reduce((acc, det) => {
    if (['car', 'motorcycle', 'bus', 'truck'].includes(det.class)) {
      acc[det.class] = (acc[det.class] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <div className="bg-blue-600 p-1.5 rounded-lg text-white">
              <Cpu className="w-5 h-5" />
            </div>
            5-Module AI Precision Engine
          </h2>
          <p className="text-slate-500 text-sm">Vehicle • Signal • Helmet • Speed • OCR Active</p>
        </div>
        
        <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
          <button onClick={() => { stopMedia(); setSourceType('live'); setIsPlaying(true); }} className={cn("px-4 py-2 rounded-xl text-xs font-bold transition-all", sourceType === 'live' ? "bg-blue-600 text-white shadow-md" : "text-slate-500")}>Live</button>
          <button onClick={async () => { stopMedia(); const s = await navigator.mediaDevices.getUserMedia({video: true}); streamRef.current = s; if(videoRef.current) videoRef.current.srcObject = s; setSourceType('webcam'); setIsPlaying(true); }} className={cn("px-4 py-2 rounded-xl text-xs font-bold transition-all", sourceType === 'webcam' ? "bg-blue-600 text-white shadow-md" : "text-slate-500")}>Camera</button>
          <button onClick={() => fileInputRef.current?.click()} className={cn("px-4 py-2 rounded-xl text-xs font-bold transition-all", sourceType === 'upload' ? "bg-blue-600 text-white shadow-md" : "text-slate-500")}>Upload</button>
          <input type="file" ref={fileInputRef} className="hidden" accept="video/*" onChange={(e) => { const f = e.target.files?.[0]; if(f) { stopMedia(); if(videoRef.current) videoRef.current.src = URL.createObjectURL(f); setSourceType('upload'); setIsPlaying(true); } }} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 relative aspect-video bg-slate-950 rounded-[2.5rem] overflow-hidden shadow-2xl border-8 border-slate-900">
          <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted loop playsInline src={sourceType === 'live' ? LIVE_FEED_URL : undefined} />
          <canvas ref={canvasRef} className="hidden" width="1280" height="720" />

          <div className="absolute inset-0 pointer-events-none">
            {detections.map((det) => {
              const [x, y, w, h] = det.bbox;
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
                    "absolute border-2 rounded-lg transition-all duration-75",
                    det.violationType === 'Signal Jump' ? "border-red-500 shadow-[0_0_20px_red] bg-red-500/10" :
                    det.speed > speedLimit ? "border-orange-500 shadow-[0_0_15px_orange] bg-orange-500/10" : 
                    det.isRider ? (det.hasHelmet ? "border-green-500" : "border-red-500 shadow-[0_0_15px_red]") : 
                    "border-blue-500/40"
                  )}
                  style={{ left: `${px}%`, top: `${py}%`, width: `${pw}%`, height: `${ph}%` }}
                >
                  <div className="absolute -top-6 left-0 flex items-center gap-1 whitespace-nowrap">
                    <span className="bg-slate-900 text-white text-[8px] px-2 py-0.5 rounded font-bold uppercase">
                      {det.class} #{det.id.substring(0,4)}
                    </span>
                    
                    {det.speed > 0 && (
                      <span className={cn(
                        "text-white text-[8px] px-2 py-0.5 rounded font-bold uppercase",
                        det.speed > speedLimit ? "bg-orange-600 animate-pulse" : "bg-blue-600"
                      )}>
                        {det.speed} KM/H {det.speed > speedLimit ? `(LIMIT: ${speedLimit})` : ''}
                      </span>
                    )}
                    
                    {det.isRider && (
                      <span className={cn(
                        "text-white text-[8px] px-2 py-0.5 rounded font-black uppercase",
                        det.hasHelmet ? "bg-green-600" : "bg-red-600 animate-pulse"
                      )}>
                        {det.hasHelmet ? "HELMET WORN" : "NO HELMET"}
                      </span>
                    )}

                    {det.violationType && !det.isRider && det.violationType !== 'Overspeeding' && (
                      <span className="bg-red-600 text-white text-[8px] px-2 py-0.5 rounded font-black animate-pulse">
                        {det.violationType}
                      </span>
                    )}
                  </div>

                  {/* Module 5: ANPR Scanning Indicator */}
                  {(det.isScanningPlate || det.associatedPlate) && (
                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-slate-900/90 text-white text-[9px] px-2 py-1 rounded font-mono font-bold border border-slate-700 shadow-lg whitespace-nowrap">
                      {det.isScanningPlate ? (
                        <>
                          <ScanText className="w-3 h-3 text-blue-400 animate-pulse" />
                          <span className="text-blue-400 animate-pulse">EXTRACTING PLATE...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-green-400" />
                          <span className="tracking-widest">{det.associatedPlate}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            
            <div className={cn(
              "absolute top-[70%] left-0 right-0 h-1.5 transition-all duration-300", 
              effectiveSignal === 'red' ? "bg-red-500 shadow-[0_0_15px_red]" : 
              effectiveSignal === 'yellow' ? "bg-yellow-500/50 border-t-2 border-dashed border-yellow-500" : 
              "bg-green-500/20 border-t-2 border-dashed border-green-500/50"
            )}>
              <div className={cn(
                "absolute -top-4 left-1/2 -translate-x-1/2 text-white text-[10px] px-4 py-1 rounded-full font-black uppercase tracking-widest transition-colors",
                effectiveSignal === 'red' ? "bg-red-600 shadow-lg" : "bg-slate-900/80 backdrop-blur-sm"
              )}>
                {effectiveSignal === 'red' ? 'DO NOT CROSS' : 'Stop Line'}
              </div>
            </div>
          </div>

          <div className="absolute top-6 left-6 flex flex-col gap-3 pointer-events-auto">
            <div className="bg-slate-900/90 backdrop-blur-md p-3 rounded-2xl border border-slate-700 shadow-2xl flex flex-col gap-3">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Signal Control</span>
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-2 bg-black/50 p-2 rounded-xl border border-slate-800">
                  <button onClick={() => setSignalOverride('red')} className={cn("w-6 h-6 rounded-full transition-all", effectiveSignal === 'red' ? "bg-red-500 shadow-[0_0_15px_red]" : "bg-red-950 hover:bg-red-900")} />
                  <button onClick={() => setSignalOverride('yellow')} className={cn("w-6 h-6 rounded-full transition-all", effectiveSignal === 'yellow' ? "bg-yellow-500 shadow-[0_0_15px_yellow]" : "bg-yellow-950 hover:bg-yellow-900")} />
                  <button onClick={() => setSignalOverride('green')} className={cn("w-6 h-6 rounded-full transition-all", effectiveSignal === 'green' ? "bg-green-500 shadow-[0_0_15px_green]" : "bg-green-950 hover:bg-green-900")} />
                </div>
                <div className="flex flex-col gap-2">
                  <button onClick={() => setSignalOverride('auto')} className={cn("text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all", signalOverride === 'auto' ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700")}>AUTO AI</button>
                  <button onClick={() => setSignalOverride('red')} className={cn("text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all", signalOverride !== 'auto' ? "bg-slate-700 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700")}>MANUAL</button>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/90 backdrop-blur-md p-3 rounded-2xl border border-slate-700 shadow-2xl flex flex-col gap-3">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center flex items-center justify-center gap-1">
                <Gauge className="w-3 h-3" /> Speed Limit
              </span>
              <div className="grid grid-cols-2 gap-2">
                {[40, 60, 80, 100].map(limit => (
                  <button 
                    key={limit}
                    onClick={() => setSpeedLimit(limit)}
                    className={cn(
                      "text-xs font-bold px-3 py-2 rounded-xl transition-all border",
                      speedLimit === limit 
                        ? "bg-orange-500 text-white border-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.5)]" 
                        : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700"
                    )}
                  >
                    {limit}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {isModelLoading && (
            <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center text-white">
              <RefreshCcw className="w-12 h-12 animate-spin text-blue-500 mb-4" />
              <p className="font-bold tracking-widest">CALIBRATING 5-MODULE SUITE...</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-900 text-sm mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600" /> Module Health
            </h3>
            <div className="space-y-3">
              {[
                { name: 'Vehicle Det.', status: 'Active', icon: CheckCircle2 },
                { name: 'Signal Det.', status: effectiveSignal !== 'unknown' ? 'Active' : 'Searching', icon: effectiveSignal !== 'unknown' ? CheckCircle2 : AlertTriangle },
                { name: 'Helmet Det.', status: 'Active', icon: CheckCircle2 },
                { name: 'Speed Det.', status: `Limit: ${speedLimit}km/h`, icon: CheckCircle2 },
                { name: 'ANPR (OCR)', status: 'Active', icon: CheckCircle2 },
              ].map((m, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">{m.name}</span>
                  <div className="flex items-center gap-1.5 font-bold text-slate-900">
                    <m.icon className={cn("w-3 h-3", m.status.includes('Active') || m.status.includes('Limit') ? "text-green-500" : "text-amber-500")} />
                    {m.status}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 pt-5 border-t border-slate-100">
              <h4 className="text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest">Live Vehicle Count</h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5"><Car className="w-3.5 h-3.5" /> Cars</span>
                  <span className="text-sm font-black text-slate-900">{vehicleCounts['car'] || 0}</span>
                </div>
                <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5"><Bike className="w-3.5 h-3.5" /> Bikes</span>
                  <span className="text-sm font-black text-slate-900">{vehicleCounts['motorcycle'] || 0}</span>
                </div>
                <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5"><Truck className="w-3.5 h-3.5" /> Trucks</span>
                  <span className="text-sm font-black text-slate-900">{vehicleCounts['truck'] || 0}</span>
                </div>
                <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5"><Truck className="w-3.5 h-3.5" /> Buses</span>
                  <span className="text-sm font-black text-slate-900">{vehicleCounts['bus'] || 0}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-xl flex-1 flex flex-col">
            <h3 className="font-black text-slate-900 flex items-center gap-2 text-lg mb-6">
              <ShieldAlert className="text-blue-600 w-6 h-6" /> Incident Log
            </h3>
            <div className="flex-1 space-y-3 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
              <AnimatePresence mode="popLayout">
                {registry.map((item, idx) => (
                  <motion.div key={idx} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                    <div className="flex justify-between items-start mb-1">
                      <span className={cn(
                        "text-[10px] font-black uppercase flex items-center gap-1",
                        item.violation_type === 'Overspeeding' ? "text-orange-600" : "text-red-600"
                      )}>
                        <Zap className="w-3 h-3 fill-current" /> {item.violation_type}
                      </span>
                      <span className="text-[9px] font-mono text-slate-400">{item.timestamp}</span>
                    </div>
                    <p className="font-mono font-black text-lg text-slate-900 flex items-center gap-2">
                      <ScanText className="w-4 h-4 text-blue-500" />
                      {item.vehicle_number}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">
                        {item.metadata.class} {item.speed > 0 ? `• ${item.speed} km/h` : ''}
                      </span>
                      <span className="text-[10px] font-black bg-slate-900 text-white px-2 py-0.5 rounded uppercase">STORED</span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
