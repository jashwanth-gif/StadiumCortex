import React, { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { 
  X, 
  Camera, 
  CameraOff, 
  QrCode, 
  Sparkles, 
  ArrowRight, 
  Compass, 
  ShieldAlert, 
  Flame, 
  Accessibility as AccessIcon, 
  CheckCircle,
  RefreshCw
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (responseText: string, suggestedRole?: "fan" | "volunteer" | "accessibility" | "emergency") => void;
  triggerHaptic?: (duration?: number | number[]) => void;
}

interface SimulatedSign {
  id: string;
  label: string;
  category: "gate" | "seat" | "access" | "sop" | "emergency";
  data: string;
  description: string;
}

const SIMULATED_SIGNS: SimulatedSign[] = [
  {
    id: "gate-c",
    label: "Gate C West Entrance",
    category: "gate",
    data: "stadiumcortex://location/gate_c",
    description: "Scan on Gate C pillar for accessibility step-free entry details."
  },
  {
    id: "seat-124",
    label: "Section 124 Seat Sign",
    category: "seat",
    data: "stadiumcortex://location/seat_124_rK",
    description: "Scan on handrail at Concourse Level 1 to find seat routing."
  },
  {
    id: "elevator-b",
    label: "Accessible Elevator B Lift",
    category: "access",
    data: "stadiumcortex://location/elevator_b",
    description: "Scan near the Lift B lobby in Zone B."
  },
  {
    id: "medical-a",
    label: "First Aid Center A Post",
    category: "access",
    data: "stadiumcortex://location/medical_center_a",
    description: "Scan near Section 115 entry wall."
  },
  {
    id: "sop-01-sign",
    label: "SOP-01 QR (Staff SOP)",
    category: "sop",
    data: "stadiumcortex://sop/sop-01",
    description: "Found inside operations desk - Staff Manual for Lost Child."
  },
  {
    id: "emergency-d",
    label: "Gate D Evac Exit Sign",
    category: "emergency",
    data: "stadiumcortex://location/emergency_exit_d",
    description: "Scan on south exit gate for immediate evacuation routing."
  }
];

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  triggerHaptic
}) => {
  const [hasCamera, setHasCamera] = useState<boolean | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [scanTab, setScanTab] = useState<"camera" | "simulator">("camera");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Local haptic fallback if prop not passed
  const handleLocalHaptic = (duration: number | number[] = 25) => {
    if (triggerHaptic) {
      triggerHaptic(duration);
    } else if (typeof navigator !== "undefined" && navigator.vibrate) {
      try { navigator.vibrate(duration); } catch (e) {}
    }
  };

  // List available video cameras on mobile/desktop
  useEffect(() => {
    if (isOpen && typeof navigator !== "undefined" && navigator.mediaDevices) {
      navigator.mediaDevices.enumerateDevices()
        .then(devices => {
          const videoDevices = devices.filter(d => d.kind === "videoinput");
          setAvailableCameras(videoDevices);
          if (videoDevices.length > 0) {
            // Default to environment/back camera if possible, or the first one
            const backCam = videoDevices.find(d => d.label.toLowerCase().includes("back") || d.label.toLowerCase().includes("environment"));
            setSelectedCameraId(backCam ? backCam.deviceId : videoDevices[0].deviceId);
            setHasCamera(true);
          } else {
            setHasCamera(false);
          }
        })
        .catch(err => {
          console.error("Error enumerating cameras:", err);
          setHasCamera(false);
        });
    }
  }, [isOpen]);

  // Start/Stop camera stream based on modal openness, active tab, and selected camera
  useEffect(() => {
    if (isOpen && scanTab === "camera" && selectedCameraId) {
      startCameraStream(selectedCameraId);
    } else {
      stopCameraStream();
    }

    return () => {
      stopCameraStream();
    };
  }, [isOpen, scanTab, selectedCameraId]);

  const startCameraStream = async (deviceId: string) => {
    stopCameraStream();
    setCameraError(null);
    setIsCameraActive(false);

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          facingMode: deviceId ? undefined : "environment",
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        // Wait for metadata to load to ensure dimensions are correct
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play()
              .then(() => {
                setIsCameraActive(true);
                // Start real-time frame scanning loop
                animationFrameRef.current = requestAnimationFrame(scanTick);
              })
              .catch(err => {
                console.error("Play failed:", err);
                setCameraError("Failed to trigger video stream playback.");
              });
          }
        };
      }
    } catch (err: any) {
      console.error("Failed to acquire camera stream:", err);
      setCameraError(
        err.name === "NotAllowedError" || err.name === "PermissionDeniedError"
          ? "Camera permission denied. Please allow camera permissions or switch to our Interactive Simulator tab."
          : "Could not open camera stream. It may be in use by another application."
      );
      setHasCamera(false);
      setScanTab("simulator"); // fallback automatically
    }
  };

  const stopCameraStream = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Real-time canvas frame extraction and QR parsing
  const scanTick = () => {
    if (videoRef.current && canvasRef.current && isCameraActive) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert"
          });

          if (code && code.data) {
            handleParsedQR(code.data);
            return; // stop requesting frames
          }
        }
      }
    }
    
    if (isOpen && scanTab === "camera") {
      animationFrameRef.current = requestAnimationFrame(scanTick);
    }
  };

  // Map QR code data payload to beautiful human inquiries and auto role upgrades
  const handleParsedQR = (qrData: string) => {
    handleLocalHaptic([75, 40, 75]);
    setScannedCode(qrData);
    stopCameraStream();

    let queryText = "";
    let suggestedRole: "fan" | "volunteer" | "accessibility" | "emergency" | undefined;

    if (qrData.includes("location/gate_c")) {
      queryText = "Show me the optimized, step-free navigation route to Gate C (West Gate) Entry and its current crowd wait times.";
      suggestedRole = "accessibility";
    } else if (qrData.includes("location/seat_124_rK")) {
      queryText = "Tell me how to navigate from here to Section 124, Row K, Seat 14, and what restroom or food stall is nearest.";
      suggestedRole = "fan";
    } else if (qrData.includes("location/elevator_b")) {
      queryText = "Show me the step-free flat path from Elevator B Lobby in Zone B to Concourse level 2 and seats.";
      suggestedRole = "accessibility";
    } else if (qrData.includes("location/medical_center_a")) {
      queryText = "Guide me immediately to First Aid Medical Center A near Section 115 and show me the accessible pathway.";
      suggestedRole = "accessibility";
    } else if (qrData.includes("sop/sop-01")) {
      queryText = "Show the official operations manual for SOP-01 (Lost Child Protocol) and Family Desk reunification points.";
      suggestedRole = "volunteer";
    } else if (qrData.includes("location/emergency_exit_d")) {
      queryText = "EMERGENCY: Direct me along the safest, step-free evacuation route to Gate D South Exit right now.";
      suggestedRole = "emergency";
    } else {
      // General custom scanned text
      queryText = `Guide me based on this scanned stadium sign location: "${qrData}"`;
    }

    setTimeout(() => {
      onScanSuccess(queryText, suggestedRole);
      onClose();
      setScannedCode(null);
    }, 1200);
  };

  const handleSimulateScan = (sign: SimulatedSign) => {
    handleParsedQR(sign.data);
  };

  const switchCamera = () => {
    handleLocalHaptic(30);
    if (availableCameras.length <= 1) return;
    const currentIndex = availableCameras.findIndex(c => c.deviceId === selectedCameraId);
    const nextIndex = (currentIndex + 1) % availableCameras.length;
    setSelectedCameraId(availableCameras[nextIndex].deviceId);
  };

  if (!isOpen) return null;

  return (
    <div id="qr-scanner-modal-overlay" className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div 
        id="qr-scanner-modal-body"
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-slate-200"
      >
        {/* Header */}
        <div className="bg-indigo-900 text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-indigo-500 rounded-xl flex items-center justify-center shadow-inner">
              <QrCode className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold font-display tracking-tight text-base leading-none">Stadium QR Scanner</h3>
              <span className="text-[10px] text-indigo-200 uppercase tracking-wider font-bold">Live Sign Navigation</span>
            </div>
          </div>
          <button 
            onClick={() => { handleLocalHaptic(15); onClose(); }}
            className="w-8 h-8 rounded-full bg-indigo-950/40 text-indigo-100 hover:text-white flex items-center justify-center hover:bg-indigo-950/60 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 bg-slate-50 p-1 shrink-0">
          <button
            onClick={() => { handleLocalHaptic(15); setScanTab("camera"); }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              scanTab === "camera" 
                ? "bg-white text-indigo-900 shadow-sm border border-slate-200/50" 
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            Live Device Camera
          </button>
          <button
            onClick={() => { handleLocalHaptic(15); setScanTab("simulator"); }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              scanTab === "simulator" 
                ? "bg-white text-indigo-900 shadow-sm border border-slate-200/50" 
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            Sign Simulator
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-grow p-5 overflow-y-auto max-h-[70vh] flex flex-col gap-4">
          <AnimatePresence mode="wait">
            {scannedCode ? (
              <motion.div 
                key="scan-success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex-grow flex flex-col items-center justify-center py-10 text-center gap-4"
              >
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center animate-bounce shadow-md">
                  <CheckCircle className="w-10 h-10" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-slate-800">Stadium Sign Identified!</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                    Successfully decoded:<br/>
                    <code className="text-[10px] bg-slate-100 px-2 py-1 rounded mt-1 inline-block font-mono text-indigo-600 break-all">{scannedCode}</code>
                  </p>
                </div>
                <div className="text-xs text-indigo-600 font-bold uppercase tracking-wider flex items-center gap-2 animate-pulse mt-2">
                  <span>Generating Optimized Directions...</span>
                </div>
              </motion.div>
            ) : scanTab === "camera" ? (
              <motion.div 
                key="camera-tab"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col gap-3"
              >
                {cameraError ? (
                  <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 text-xs flex flex-col gap-2">
                    <div className="flex items-start gap-2">
                      <CameraOff className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                      <p className="leading-relaxed font-medium">{cameraError}</p>
                    </div>
                    <button
                      onClick={() => setScanTab("simulator")}
                      className="mt-2 w-full py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl uppercase tracking-wider text-[10px] cursor-pointer shadow-sm text-center"
                    >
                      Open Interactive Sign Simulator
                    </button>
                  </div>
                ) : (
                  <div className="relative aspect-video w-full bg-slate-900 rounded-2xl overflow-hidden border border-slate-200 shadow-inner flex items-center justify-center">
                    {/* Live Video */}
                    <video 
                      ref={videoRef}
                      className="absolute inset-0 w-full h-full object-cover"
                      playsInline
                      muted
                    />

                    {/* Hidden canvas used to extract imageData frames */}
                    <canvas ref={canvasRef} className="hidden" />

                    {/* HUD Viewfinder Screen Overlay */}
                    {isCameraActive ? (
                      <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                        {/* Target Box corners */}
                        <div className="w-48 h-48 border-2 border-dashed border-indigo-400 rounded-2xl relative flex items-center justify-center">
                          <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-indigo-500 rounded-tl" />
                          <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-indigo-500 rounded-tr" />
                          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-indigo-500 rounded-bl" />
                          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-indigo-500 rounded-br" />

                          {/* Dynamic green scanning laser bar */}
                          <div className="absolute left-1 right-1 h-0.5 bg-indigo-400 shadow-md shadow-indigo-400 animate-pulse" style={{
                            animation: "pulse 1.2s infinite alternate",
                            top: "50%"
                          }} />
                        </div>
                        <span className="text-[10px] bg-slate-900/80 text-white font-bold px-2.5 py-1 rounded-full uppercase tracking-wider mt-4 backdrop-blur-sm">
                          Align QR code inside box
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center text-center p-6 gap-2">
                        <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
                        <span className="text-xs text-slate-400 font-medium">Acquiring Camera Feed...</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Camera controls (Switch button) */}
                {isCameraActive && availableCameras.length > 1 && (
                  <button
                    type="button"
                    onClick={switchCamera}
                    className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer border border-slate-200"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Switch Camera
                  </button>
                )}

                <div className="text-center">
                  <p className="text-[11px] text-slate-400 leading-relaxed max-w-sm mx-auto">
                    Point your camera at any designated **StadiumCortex QR code marker** on stadium exit gates, handrails, food stalls, or staff clipboards.
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="simulator-tab"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col gap-3"
              >
                <div className="bg-indigo-50 p-3.5 rounded-2xl border border-indigo-100 flex gap-2.5 items-start">
                  <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-indigo-800 leading-relaxed font-medium">
                    **Simulate physical QR scans** instantly! In a real stadium, fans or staff use their cameras to scan QR markers. Tap any sign below to simulate a live physical scan.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-1">
                  {SIMULATED_SIGNS.map(sign => {
                    const getCategoryIcon = (cat: string) => {
                      switch (cat) {
                        case "gate": return <Compass className="w-4 h-4 text-blue-500" />;
                        case "seat": return <QrCode className="w-4 h-4 text-indigo-500" />;
                        case "access": return <AccessIcon className="w-4 h-4 text-emerald-500 animate-pulse" />;
                        case "sop": return <Sparkles className="w-4 h-4 text-amber-500" />;
                        case "emergency": return <ShieldAlert className="w-4 h-4 text-red-500" />;
                        default: return <QrCode className="w-4 h-4 text-slate-500" />;
                      }
                    };

                    const getCategoryBadge = (cat: string) => {
                      switch (cat) {
                        case "gate": return "bg-blue-50 text-blue-700 border border-blue-200";
                        case "seat": return "bg-indigo-50 text-indigo-700 border border-indigo-200";
                        case "access": return "bg-emerald-50 text-emerald-700 border border-emerald-200";
                        case "sop": return "bg-amber-50 text-amber-700 border border-amber-200";
                        case "emergency": return "bg-red-50 text-red-700 border border-red-200";
                        default: return "bg-slate-50 text-slate-700 border border-slate-200";
                      }
                    };

                    return (
                      <button
                        key={sign.id}
                        onClick={() => handleSimulateScan(sign)}
                        className="group flex flex-col items-start text-left p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-50/60 transition-all cursor-pointer"
                      >
                        <div className="flex items-center justify-between w-full mb-1">
                          <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-900 transition-colors">
                            {sign.label}
                          </span>
                          <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${getCategoryBadge(sign.category)}`}>
                            {sign.category}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-tight mb-2">
                          {sign.description}
                        </p>
                        <div className="flex items-center gap-1 text-[9px] text-indigo-600 font-bold uppercase tracking-wider mt-auto pt-1.5 border-t border-slate-50 w-full group-hover:text-indigo-700">
                          {getCategoryIcon(sign.category)}
                          <span>Simulate Scan</span>
                          <ArrowRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transform translate-x-[-4px] group-hover:translate-x-0 transition-all" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};
