import { useState, useEffect, useRef } from "react";
import { 
  Role, 
  StadiumMap, 
  CrowdData, 
  Message, 
  Gate, 
  FoodStall, 
  Restroom, 
  HelpDesk 
} from "./types";
import { 
  Flame, 
  AlertTriangle, 
  Accessibility as AccessIcon, 
  Send, 
  Clock, 
  Compass, 
  Utensils, 
  Navigation, 
  Baby, 
  ChevronRight, 
  RefreshCw, 
  User, 
  Activity, 
  BookOpen, 
  HelpCircle, 
  Sparkles, 
  UserCheck, 
  Search, 
  MapPin, 
  ShieldAlert, 
  CheckCircle,
  HelpCircle as QuestionIcon,
  Mic,
  MicOff,
  QrCode
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { QRScannerModal } from "./components/QRScannerModal";

export default function App() {
  const [activeRole, setActiveRole] = useState<Role>("fan");
  const [stadiumData, setStadiumData] = useState<{ map: StadiumMap; crowd: CrowdData } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [simulationStatus, setSimulationStatus] = useState<"normal" | "high" | "low">("normal");
  const [selectedMapItem, setSelectedMapItem] = useState<{ type: string; id: string; name: string } | null>(null);
  const [activeMobileTab, setActiveMobileTab] = useState<"chat" | "map">("chat");
  const [isOffline, setIsOffline] = useState(typeof navigator !== "undefined" ? !navigator.onLine : false);
  const [isListening, setIsListening] = useState(false);
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Haptic vibration helper for mobile interactivity
  const triggerHaptic = (duration: number | number[] = 20) => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate(duration);
      } catch (e) {
        // Safe catch for permissions or frame/sandbox limits
      }
    }
  };

  // Monitor connectivity state
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      triggerHaptic([30, 20, 30]);
    };
    const handleOffline = () => {
      setIsOffline(true);
      triggerHaptic([100, 50, 100]);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Initialize SpeechRecognition from Web Speech API
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = "en-US";

      rec.onstart = () => {
        setIsListening(true);
        triggerHaptic(40);
      };

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputText((prev) => (prev ? prev.trim() + " " + transcript : transcript));
          triggerHaptic(35);
        }
      };

      rec.onerror = (event: any) => {
        console.error("Speech Recognition error:", event.error);
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
    }
  }, []);

  const toggleListening = () => {
    triggerHaptic(25);
    if (!recognitionRef.current) {
      alert("Voice input is not supported or permitted on this browser.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error("Failed to start Speech Recognition:", e);
      }
    }
  };

  // Initialize chat messages & load stadium data
  useEffect(() => {
    loadStadiumData();
    
    // Check local storage for cached history of this specific role first
    const cachedHistory = localStorage.getItem(`stadiumcortex_chat_history_${activeRole}`);
    if (cachedHistory) {
      try {
        const history = JSON.parse(cachedHistory);
        if (history && history.length > 0) {
          setMessages(history);
          return;
        }
      } catch (e) {
        console.error("Failed to parse cached history", e);
      }
    }
    
    // Add default initial welcome message based on role if no cache exists
    resetChat(activeRole);
  }, [activeRole]);

  // Keep chat history in local storage per-role
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(`stadiumcortex_chat_history_${activeRole}`, JSON.stringify(messages));
    }
  }, [messages, activeRole]);

  useEffect(() => {
    // Auto-scroll chat to bottom
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadStadiumData = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/stadium-data");
      if (res.ok) {
        const data = await res.json();
        setStadiumData(data);
        localStorage.setItem("stadiumcortex_stadium_data", JSON.stringify(data));
      } else {
        throw new Error("Server returned error status");
      }
    } catch (err) {
      console.error("Error loading stadium data, fallback to local storage:", err);
      const cached = localStorage.getItem("stadiumcortex_stadium_data");
      if (cached) {
        try {
          setStadiumData(JSON.parse(cached));
        } catch (e) {
          console.error("Parse failed for cached stadium data:", e);
        }
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const resetChat = (role: Role) => {
    let initialText = "";
    switch (role) {
      case "fan":
        initialText = "Welcome to StadiumCortex Fan Support! 🏟️ How can I help you reach your seat, find the nearest restrooms, or discover less crowded food stalls today?";
        break;
      case "volunteer":
        initialText = "StadiumCortex Operations Portal Active. 📋 Hello Volunteer! Ask me about specific SOP instructions (SOP-01 Lost Child, SOP-02 Medical, SOP-03 Crowd redirects) or help desk coordinates.";
        break;
      case "accessibility":
        initialText = "Welcome to Accessibility Support. ❤️ We prioritize step-free routing, flat pathways, and stroller-friendly access points. Let me know how I can guide you comfortably.";
        break;
      case "emergency":
        initialText = "⚠️ EMERGENCY SAFETY INTERFACE. Remain calm. Direct instructions are online. Tell me your sector or situation, or check the evacuation map in the side panel.";
        break;
    }
    setMessages([
      {
        id: "initial",
        sender: "ai",
        text: initialText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        role: role
      }
    ]);
  };

  // Offline chat response generator based on cached stadiumData and static SOPs
  const getOfflineFallbackResponse = (text: string, role: string) => {
    const lowerMsg = text.toLowerCase();
    
    if (role === "emergency" || lowerMsg.includes("emergency") || lowerMsg.includes("evacuate") || lowerMsg.includes("fire") || lowerMsg.includes("danger") || lowerMsg.includes("medical help")) {
      return {
        text: "**[OFFLINE EMERGENCY RE-DIRECT]**\n\n- **Stay calm.** You are currently offline, but the stadium mesh recommends proceeding to the nearest wide step-free exit:\n- **Gate C (West Gate)** or **Gate D (South Gate)**.\n- Do **NOT** use elevators during emergency scenarios.\n- Follow direct instructions from on-site security and steward personnel.",
        role: "emergency"
      };
    }
    
    if (role === "volunteer" || lowerMsg.includes("child") || lowerMsg.includes("lost") || lowerMsg.includes("sop")) {
      if (lowerMsg.includes("child") || lowerMsg.includes("lost") || lowerMsg.includes("sop-01")) {
        return {
          text: "**[OFFLINE SOP-01: Lost Child Protocol]**\n\n1. **Comfort:** Keep the child calm. Do not leave the spot.\n2. **Radio Report:** Tell Sector Supervisor child's details (age, clothing, gender).\n3. **Wait 5 Mins:** Stand by for nearby parents.\n4. **Reunification:** Escort child to **Family & Lost Desk** (Zone B, Main Lobby near Section 122).",
          role: "volunteer"
        };
      }
      if (lowerMsg.includes("medical") || lowerMsg.includes("doctor") || lowerMsg.includes("sop-02")) {
        return {
          text: "**[OFFLINE SOP-02: Medical Incident Protocol]**\n\n- **Level 1 (Minor Injury):** Direct the patient to **Medical Center A** (Zone C, Lower Ground, Section 115).\n- **Level 2 (Severe/Critical):** Keep patient stable. Immediately radio dispatch with exact coordinates (e.g., Section 124, Row K, Seat 14) to deploy the emergency response team.",
          role: "volunteer"
        };
      }
      return {
        text: "**[OFFLINE VOLUNTEER MANUAL]**\n\nHere are some offline guidelines:\n- **SOP-01 (Lost Child):** Keep child calm, radio supervisor, wait 5 min, escort to Family & Lost Desk.\n- **SOP-02 (Medical):** Level 1 to Medical Center A (Sec 115). Level 2: radio dispatcher with coordinates.\n- **SOP-03 (Crowd Congestion):** Redirect Gate B flow toward Gate C (West) or Gate D (South) to ease bottlenecks.",
        role: "volunteer"
      };
    }

    if (role === "accessibility" || lowerMsg.includes("wheelchair") || lowerMsg.includes("stroller") || lowerMsg.includes("ramp") || lowerMsg.includes("disabled")) {
      return {
        text: "**[OFFLINE ACCESSIBILITY ASSISTANCE]**\n\nFor a smooth step-free experience:\n- **Entrance:** Use **Gate C (West)** or **Gate D (South)**. Both feature step-free ramps.\n- **Level Changes:** Use the central elevators located near **Section 121**.\n- **Restrooms:** Family & accessible coed toilets are located at **Section 104** and **Section 128**.",
        role: "accessibility"
      };
    }

    // General Fan Mode Fallback using cached stadiumData if available
    let cached: any = null;
    try {
      const cachedStr = localStorage.getItem("stadiumcortex_stadium_data");
      if (cachedStr) cached = JSON.parse(cachedStr);
    } catch (e) {}

    if (lowerMsg.includes("food") || lowerMsg.includes("burger") || lowerMsg.includes("eat") || lowerMsg.includes("concession")) {
      if (cached && cached.map?.foodStalls) {
        const stalls = cached.map.foodStalls;
        const crowd = cached.crowd;
        let lowestWait = 999;
        let bestStall = stalls[0];
        stalls.forEach((s: any) => {
          const wait = crowd?.foodStallQueues?.[s.id]?.estimatedWaitMinutes || 5;
          if (wait < lowestWait) {
            lowestWait = wait;
            bestStall = s;
          }
        });
        return {
          text: `**[OFFLINE COGNITIVE ASSISTANCE]**\n\nYour offline cache shows that **${bestStall.name}** at **${bestStall.location}** has the lowest current queue (**${lowestWait} min wait**). We recommend visiting this stall to avoid delay!\n\n*Stadium offline database last sync: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}*`,
          role: "fan"
        };
      }
      return {
        text: "**[OFFLINE GUIDE]**\n\n- Least crowded food stall: **Burger Pitch** (Concourse Level 2, Section 112) typically has the lowest wait times.\n- Avoid Taco Goal (Section 125) which is highly congested during peak match intervals.",
        role: "fan"
      };
    }

    if (lowerMsg.includes("restroom") || lowerMsg.includes("toilet") || lowerMsg.includes("bathroom") || lowerMsg.includes("washroom")) {
      if (cached && cached.map?.restrooms) {
        const rrms = cached.map.restrooms;
        const crowd = cached.crowd;
        let lowestWait = 999;
        let bestRoom = rrms[0];
        rrms.forEach((r: any) => {
          const wait = crowd?.restroomQueues?.[r.id]?.estimatedWaitMinutes || 5;
          if (wait < lowestWait) {
            lowestWait = wait;
            bestRoom = r;
          }
        });
        return {
          text: `**[OFFLINE COGNITIVE ASSISTANCE]**\n\nThe nearest clean restroom with the lowest queue is **${bestRoom.name}** near **${bestRoom.location}** (estimated queue wait: **${lowestWait} min**). It features accessible and family-friendly stalls.`,
          role: "fan"
        };
      }
      return {
        text: "**[OFFLINE GUIDE]**\n\n- Cleanest/fastest restroom: **Concourse Level 1, Section 104** (Family/Accessible).\n- Avoid Section 118 restrooms as they are currently highly congested.",
        role: "fan"
      };
    }

    if (lowerMsg.includes("gate") || lowerMsg.includes("entrance")) {
      return {
        text: "**[OFFLINE NAVIGATION]**\n\n- **Gate A:** Best for Sections 101-110\n- **Gate C (West Gate):** Best for Sections 121-130 (Step-free)\n- **Gate D (South Gate):** Best for Sections 131-140 (Step-free)\n- *Tip:* Avoid entering through Gate B (North) as it has peak congestion during pre-match crowd surges.",
        role: "fan"
      };
    }

    return {
      text: `**[OFFLINE LOCAL ASSISTANT]**\n\nYou are currently operating in **Offline/Intermittent Mode**. I can still guide you using local cached data:\n- Ask me about: **nearest restrooms**, **food queue wait times**, **accessibility elevators**, or **volunteer SOPs**.\n- All emergency evacuation directions remain operational offline in this interface.`,
      role: "fan"
    };
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text) return;

    triggerHaptic(45);

    if (!textToSend) {
      setInputText("");
    }

    const userMsgId = `user-${Date.now()}`;
    const userMsg: Message = {
      id: userMsgId,
      sender: "user",
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      role: activeRole
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    // Auto detect emergency trigger in frontend too for visual indicators
    const hasEmergencyTrigger = 
      text.toLowerCase().includes("emergency") || 
      text.toLowerCase().includes("evacuate") || 
      text.toLowerCase().includes("evacuation") || 
      text.toLowerCase().includes("fire") || 
      text.toLowerCase().includes("panic") ||
      text.toLowerCase().includes("medical help") ||
      text.toLowerCase().includes("heart attack") ||
      text.toLowerCase().includes("lost child") ||
      text.toLowerCase().includes("danger");

    if (hasEmergencyTrigger && activeRole !== "emergency") {
      setActiveRole("emergency");
    }

    // Direct offline logic bypass
    if (isOffline) {
      setTimeout(() => {
        const fallback = getOfflineFallbackResponse(text, activeRole);
        setMessages(prev => [...prev, {
          id: `ai-offline-${Date.now()}`,
          sender: "ai",
          text: fallback.text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          role: fallback.role as any
        }]);
        triggerHaptic([65, 45, 65]);
        setIsLoading(false);
      }, 700);
      return;
    }

    try {
      // Build previous messages payload for context (up to last 10 messages)
      const chatHistory = messages.slice(-10).map(m => ({
        sender: m.sender,
        text: m.text
      }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          role: activeRole,
          chatHistory: chatHistory
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        // If server forced emergency override, update role
        if (data.role === "emergency" && activeRole !== "emergency") {
          setActiveRole("emergency");
        }

        setMessages(prev => [...prev, {
          id: `ai-${Date.now()}`,
          sender: "ai",
          text: data.text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          role: data.role
        }]);
        triggerHaptic([65, 45, 65]);
      } else {
        throw new Error("Failed response");
      }
    } catch (err) {
      console.error("Chat error:", err);
      const fallback = getOfflineFallbackResponse(text, activeRole);
      setMessages(prev => [...prev, {
        id: `ai-fallback-${Date.now()}`,
        sender: "ai",
        text: `*(Mesh Sync Offline - Loaded Offline Manual)*\n\n${fallback.text}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        role: fallback.role as any
      }]);
      triggerHaptic([120, 60, 120]);
    } finally {
      setIsLoading(false);
    }
  };

  const triggerSimulation = async (level: "normal" | "high" | "low") => {
    setSimulationStatus(level);
    try {
      const res = await fetch("/api/simulate-crowd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: level })
      });
      if (res.ok) {
        const data = await res.json();
        setStadiumData(prev => prev ? { ...prev, crowd: data.crowd } : null);
      }
    } catch (err) {
      console.error("Simulation error:", err);
    }
  };

  const getQuickActions = () => {
    switch (activeRole) {
      case "fan":
        return [
          { label: "Which food stall is less crowded?", text: "Which food stall is less crowded right now?" },
          { label: "Where is the nearest restroom?", text: "Where is the nearest restroom with a low queue?" },
          { label: "How do I reach my gate?", text: "How do I reach my gate and seat sections?" },
          { label: "How to get back to seat?", text: "How do I navigate back to my seat after buying food?" }
        ];
      case "volunteer":
        return [
          { label: "SOP-01: Lost Child Protocol", text: "What is the step-by-step SOP-01 protocol if a child is lost?" },
          { label: "SOP-02: Medical Emergency", text: "What is the SOP-02 escalation process for severe medical help?" },
          { label: "SOP-03: Congested Gate redirect", text: "How do we direct fans if Gate B has high congestion?" },
          { label: "Family Help Desk location", text: "Where is the family help desk located and what services does it have?" }
        ];
      case "accessibility":
        return [
          { label: "Wheelchair step-free routes", text: "Show me step-free optimized routes to avoid escalators." },
          { label: "Accessible family toilets", text: "Where are the accessible toilets with stroller or diaper changing space?" },
          { label: "Stroller support and wristbands", text: "What stroller services and safety wristbands are available?" },
          { label: "Elevator & flat pathways", text: "Where are the elevators located to reach Concourse level 2 and 3?" }
        ];
      case "emergency":
        return [
          { label: "Emergency Evacuation Route", text: "EMERGENCY: What is the safest, step-free evacuation route right now?" },
          { label: "Fire near Section 112", text: "ALERT: Fire reported near Section 112! What are the safety instructions?" },
          { label: "Medical level 2 assistance", text: "EMERGENCY: Cardiac event, urgent medical support needed." },
          { label: "On-site security instructions", text: "What are the calm, official instructions to follow staff announcements?" }
        ];
    }
  };

  const handleMapItemClick = (type: string, id: string, name: string, detailText: string) => {
    setSelectedMapItem({ type, id, name });
    setInputText(`Tell me details about ${name} located at ${detailText}`);
    setActiveMobileTab("chat");
  };

  const renderRoleBanner = () => {
    switch (activeRole) {
      case "emergency":
        return (
          <div className="bg-red-600 text-white px-4 py-3 flex items-center justify-between gap-3 animate-pulse shadow-md">
            <div className="flex items-center gap-2">
              <Flame className="w-6 h-6 shrink-0" />
              <div>
                <span className="font-bold tracking-wide uppercase font-display text-sm">EMERGENCY SAFE MODE DETECTED</span>
                <p className="text-xs text-red-100 leading-tight">Only calm, short, official safety protocols are served. Follow steward guidelines.</p>
              </div>
            </div>
            <button 
              onClick={() => setActiveRole("fan")}
              className="px-2.5 py-1 text-xs bg-white text-red-700 rounded-md font-bold hover:bg-red-50 transition-colors uppercase cursor-pointer"
            >
              Exit Safe Mode
            </button>
          </div>
        );
      case "volunteer":
        return (
          <div className="bg-amber-500 text-white px-4 py-2 flex items-center gap-2 shadow-sm text-xs font-display">
            <UserCheck className="w-4 h-4 shrink-0" />
            <span className="font-semibold tracking-wide uppercase">VOLUNTEER COMMAND FEED ACTIVE</span>
            <span className="ml-auto bg-amber-600 px-2 py-0.5 rounded text-[10px] font-bold">STAFF MODE</span>
          </div>
        );
      case "accessibility":
        return (
          <div className="bg-emerald-600 text-white px-4 py-2 flex items-center gap-2 shadow-sm text-xs font-display">
            <AccessIcon className="w-4 h-4 shrink-0" />
            <span className="font-semibold tracking-wide uppercase">ACCESSIBILITY-PRIORITY PROTOCOL ONLINE</span>
            <span className="ml-auto bg-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold">STEP-FREE</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      
      {/* Upper Navigation Bar */}
      <header className="h-16 bg-indigo-900 text-white flex items-center justify-between px-3 sm:px-6 shadow-md sticky top-0 z-40 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center font-bold text-lg relative shadow-sm shrink-0">
            <Sparkles className="w-4.5 h-4.5 text-white" />
            <div className="absolute inset-0 rounded-lg border border-white/20 pulse-active pointer-events-none" />
          </div>
          <div>
            <h1 className="text-base sm:text-xl font-semibold tracking-tight italic leading-none">StadiumCortex</h1>
            <span className="text-[8px] sm:text-[9px] text-indigo-300 font-bold uppercase tracking-widest block mt-0.5">World Cup AI Copilot</span>
          </div>
          <span className="ml-2 sm:ml-4 px-2 py-0.5 bg-indigo-800 text-[10px] rounded border border-indigo-700 text-indigo-200 uppercase tracking-wider hidden md:inline-block">Lusail Stadium • Zone B</span>
        </div>

        {/* System live status / profile block */}
        <div className="flex items-center gap-3 sm:gap-6">
          <div className="flex items-center gap-2">
            <span className="text-xs text-indigo-300 font-medium hidden md:inline">Mesh Status:</span>
            <div className="flex items-center gap-1.5 bg-indigo-950 px-2 py-1 rounded-lg border border-indigo-800">
              <div className={`w-2 h-2 rounded-full ${isOffline ? "bg-amber-400" : "bg-emerald-400 animate-pulse"}`} />
              <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-wide ${isOffline ? "text-amber-300" : "text-emerald-300"}`}>
                {isOffline ? "Cached" : "Online"}
              </span>
            </div>
          </div>

          {/* Role Changer Pills */}
          <div className="flex items-center gap-0.5 sm:gap-1 bg-indigo-950 p-1 rounded-xl border border-indigo-800/60">
            <button 
              onClick={() => { triggerHaptic(40); setActiveRole("fan"); setActiveMobileTab("chat"); }}
              title="Fan Mode"
              className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs font-semibold tracking-wide uppercase transition-all cursor-pointer flex items-center gap-1 sm:gap-1.5 ${activeRole === "fan" ? "bg-indigo-600 text-white shadow-sm" : "text-indigo-300 hover:text-white"}`}
            >
              <User className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Fan</span>
            </button>
            <button 
              onClick={() => { triggerHaptic(40); setActiveRole("volunteer"); setActiveMobileTab("chat"); }}
              title="Volunteer Mode"
              className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs font-semibold tracking-wide uppercase transition-all cursor-pointer flex items-center gap-1 sm:gap-1.5 ${activeRole === "volunteer" ? "bg-amber-500 text-white shadow-sm" : "text-indigo-300 hover:text-white"}`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Volunteer</span>
            </button>
            <button 
              onClick={() => { triggerHaptic(40); setActiveRole("accessibility"); setActiveMobileTab("chat"); }}
              title="Accessibility Mode"
              className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs font-semibold tracking-wide uppercase transition-all cursor-pointer flex items-center gap-1 sm:gap-1.5 ${activeRole === "accessibility" ? "bg-emerald-600 text-white shadow-sm" : "text-indigo-300 hover:text-white"}`}
            >
              <AccessIcon className="w-3.5 h-3.5 animate-pulse" />
              <span className="hidden sm:inline">Access</span>
            </button>
            <button 
              onClick={() => { triggerHaptic([60, 40, 60]); setActiveRole("emergency"); setActiveMobileTab("chat"); }}
              title="Emergency Mode"
              className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs font-bold tracking-wide uppercase transition-all cursor-pointer flex items-center gap-1 sm:gap-1.5 ${activeRole === "emergency" ? "bg-rose-600 text-white shadow-sm animate-pulse" : "text-rose-400 hover:bg-rose-950/50 hover:text-white"}`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Emergency</span>
            </button>
          </div>
        </div>
      </header>

      {/* Role specific Warning Banners */}
      {renderRoleBanner()}

      {/* Mobile Tab Switcher */}
      <div className="flex lg:hidden bg-white border-b border-slate-200 p-2 gap-2 sticky top-16 z-30 shadow-sm shrink-0">
        <button
          onClick={() => setActiveMobileTab("chat")}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeMobileTab === "chat"
              ? "bg-indigo-600 text-white shadow-sm"
              : "bg-slate-50 text-slate-500 hover:bg-slate-100"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Chat Assistant
        </button>
        <button
          onClick={() => setActiveMobileTab("map")}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeMobileTab === "map"
              ? "bg-indigo-600 text-white shadow-sm"
              : "bg-slate-50 text-slate-500 hover:bg-slate-100"
          }`}
        >
          <Compass className="w-4 h-4" />
          Stadium Map & Live DB
        </button>
      </div>

      {/* Main Container */}
      <main className="max-w-7xl w-full mx-auto p-4 flex-grow grid grid-cols-1 lg:grid-cols-12 gap-5 overflow-hidden">
        
        {/* Left Side: Copilot Chat Panel (Takes 7 columns on desktop) */}
        <div className={`lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[calc(100vh-12rem)] min-h-[450px] sm:min-h-[500px] ${activeMobileTab === "chat" ? "flex" : "hidden lg:flex"}`}>
          
          {/* Chat Header */}
          <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50 rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                activeRole === "emergency" ? "bg-rose-100 text-rose-600" :
                activeRole === "volunteer" ? "bg-amber-100 text-amber-600" :
                activeRole === "accessibility" ? "bg-emerald-100 text-emerald-600" :
                "bg-indigo-100 text-indigo-600"
              }`}>
                {activeRole === "emergency" ? <ShieldAlert className="w-5 h-5" /> :
                 activeRole === "volunteer" ? <BookOpen className="w-5 h-5" /> :
                 activeRole === "accessibility" ? <AccessIcon className="w-5 h-5" /> :
                 <Sparkles className="w-5 h-5" />}
              </div>
              <div>
                <h2 className="font-bold text-slate-800 font-display flex items-center gap-2 text-sm">
                  Stadium Copilot
                  <span className="text-[10px] bg-indigo-100 text-indigo-800 font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">
                    Grounded AI
                  </span>
                </h2>
                <p className="text-xs text-slate-500">
                  {activeRole === "emergency" ? "Calm Evacuation Protocols" :
                   activeRole === "volunteer" ? "Operations & Safety Guideline Advisor" :
                   activeRole === "accessibility" ? "Step-Free Wayfinder Companion" :
                   "Lusail Stadium Concierge"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button 
                onClick={() => { triggerHaptic(40); setIsQRScannerOpen(true); }}
                title="Scan Stadium QR Sign"
                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs flex items-center gap-1.5 border border-indigo-100 transition-all cursor-pointer shadow-sm hover:shadow active:scale-95"
              >
                <QrCode className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
                <span>Scan QR</span>
              </button>

              <button 
                onClick={() => { triggerHaptic(20); resetChat(activeRole); }}
                title="Reset Chat"
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100/80 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-grow overflow-y-auto p-4 space-y-4 bg-slate-50/30">
            {isOffline && (
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-center justify-between text-xs text-amber-800 shrink-0 shadow-sm animate-fade-in">
                <div className="flex items-center gap-2 font-medium">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                  <span>Connection intermittent. Running via Offline Stadium Cache.</span>
                </div>
                <span className="text-[9px] bg-amber-200/50 px-2 py-0.5 rounded font-bold uppercase tracking-wider text-amber-900 shrink-0">
                  Offline Active
                </span>
              </div>
            )}
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <div 
                  key={msg.id}
                  className={`flex gap-4 max-w-[85%] ${msg.sender === "user" ? "ml-auto flex-row-reverse" : "mr-auto"}`}
                >
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center shadow-sm text-[10px] font-bold ${
                    msg.sender === "user" ? "bg-slate-300 text-slate-700" :
                    msg.role === "emergency" ? "bg-rose-600 text-white" :
                    msg.role === "volunteer" ? "bg-amber-500 text-white" :
                    msg.role === "accessibility" ? "bg-emerald-600 text-white" :
                    "bg-indigo-600 text-white"
                  }`}>
                    {msg.sender === "user" ? <User className="w-4 h-4" /> : "AI"}
                  </div>

                  {/* Bubble Container */}
                  <div className="space-y-1">
                    {/* Meta tag */}
                    {msg.sender === "ai" && (
                      <span className={`text-[9px] font-extrabold uppercase tracking-widest block px-1 ${
                        msg.role === "emergency" ? "text-rose-600" :
                        msg.role === "volunteer" ? "text-amber-600" :
                        msg.role === "accessibility" ? "text-emerald-600" :
                        "text-indigo-600"
                      }`}>
                        {msg.role === "emergency" ? "🛡️ Official Calm SOP" :
                         msg.role === "volunteer" ? "📋 Operational Checklists" :
                         msg.role === "accessibility" ? "♿ Comfort Route Plan" :
                         "🏟️ Fan Grounded Guide"}
                      </span>
                    )}

                    <div className={`p-4 rounded-2xl shadow-sm text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.sender === "user"
                        ? "bg-indigo-600 text-white rounded-tr-none shadow-md"
                        : "bg-white border border-slate-200 text-slate-800 rounded-tl-none"
                    }`}>
                      {msg.text}
                    </div>

                    <span className="text-[10px] text-slate-400 block px-1 text-right">
                      {msg.timestamp}
                    </span>
                  </div>
                </div>
              ))}
            </AnimatePresence>

            {isLoading && (
              <div className="flex gap-4 max-w-[80%] mr-auto">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex-shrink-0 flex items-center justify-center text-[10px] animate-pulse">
                  ...
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] font-extrabold uppercase tracking-widest text-indigo-400">
                    Querying Stadium Mesh
                  </span>
                  <div className="p-4 rounded-2xl bg-white border border-slate-200 text-slate-500 rounded-tl-none text-xs flex items-center gap-2 shadow-sm">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                    <span>StadiumCortex is loading active queue database...</span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={chatEndRef} />
          </div>

          {/* Quick Actions Scroll Tray */}
          <div className="p-3 border-t border-slate-200 bg-slate-50/50">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-extrabold px-1 mb-2">
              Suggested Queries ({activeRole.toUpperCase()}):
            </p>
            <div className="flex overflow-x-auto gap-2 pb-1 scrollbar-thin scrollbar-thumb-slate-200">
              {getQuickActions()?.map((action, i) => (
                <button
                  key={i}
                  onClick={() => handleSendMessage(action.text)}
                  className="flex-shrink-0 text-xs bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 text-indigo-700 px-3 py-2 rounded-xl font-semibold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
                >
                  <Navigation className="w-3 h-3 text-indigo-400 shrink-0" />
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Chat Input */}
          <footer className="p-4 border-t border-slate-200 bg-white rounded-b-2xl">
            <form 
              onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
              className="relative flex items-center"
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  activeRole === "emergency" ? "Enter emergency location or safety issue..." :
                  activeRole === "volunteer" ? "Query operational SOPs or gate queues..." :
                  activeRole === "accessibility" ? "Ask for wheelchair or flat routes..." :
                  "Ask about gates, food, or safety procedures..."
                }
                className="w-full pl-6 pr-40 py-4 bg-slate-100 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm transition-all text-slate-800"
              />
              <div className="absolute right-2 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={toggleListening}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                    isListening 
                      ? "bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-200" 
                      : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                  }`}
                  title={isListening ? "Listening... Click to stop" : "Use Voice Input"}
                >
                  {isListening ? <MicOff className="w-4 h-4 animate-bounce" /> : <Mic className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => { triggerHaptic(40); setIsQRScannerOpen(true); }}
                  className="w-10 h-10 bg-slate-200 text-slate-600 hover:bg-slate-300 rounded-xl flex items-center justify-center transition-all cursor-pointer hover:text-indigo-600 active:scale-95"
                  title="Scan Stadium QR Marker"
                >
                  <QrCode className="w-4 h-4" />
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !inputText.trim()}
                  className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 transition-colors cursor-pointer shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
            <div className="mt-3 flex gap-4 px-2 justify-between text-[10px] text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${isOffline ? "bg-amber-400" : "bg-indigo-400"}`}></span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                  {isOffline ? "Offline Copilot Active" : "AI Assistant Active"}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${isOffline ? "bg-amber-400" : "bg-emerald-400 animate-pulse"}`}></span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                  {isOffline ? "Running Offline Cache" : "Synced with Stadium Mesh"}
                </span>
              </div>
            </div>
          </footer>

        </div>

        {/* Right Side: Operations Map & Live Database (Takes 5 columns on desktop) */}
        <div className={`lg:col-span-5 space-y-5 overflow-y-auto h-[calc(100vh-12rem)] min-h-[450px] sm:min-h-[500px] pb-10 scrollbar-none ${activeMobileTab === "map" ? "block" : "hidden lg:block"}`}>
          
          {/* Interactive Simulated Map Mockup */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-800 font-display text-sm flex items-center gap-1.5">
                <Compass className="w-4.5 h-4.5 text-indigo-600" />
                Stadium Layout
              </h3>
              <div className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                Live Tracking
              </div>
            </div>

            {/* Stadium Map SVG */}
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-center justify-center relative overflow-hidden">
              <svg className="w-full max-w-[340px] aspect-square" viewBox="0 0 300 300">
                {/* Outer Bowl */}
                <circle cx="150" cy="150" r="130" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                {/* Zones quadrants dividers */}
                <line x1="150" y1="20" x2="150" y2="280" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3" />
                <line x1="20" y1="150" x2="280" y2="150" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3" />

                {/* Inner bowl seating tiers */}
                <circle cx="150" cy="150" r="110" fill="none" stroke="#cbd5e1" strokeWidth="12" />
                <circle cx="150" cy="150" r="90" fill="none" stroke="#94a3b8" strokeWidth="10" />

                {/* The Pitch (Field) */}
                <rect x="110" y="110" width="80" height="80" rx="6" fill="#10b981" fillOpacity="0.85" stroke="#ffffff" strokeWidth="2" />
                <line x1="150" y1="110" x2="150" y2="190" stroke="#ffffff" strokeWidth="1.5" />
                <circle cx="150" cy="150" r="15" fill="none" stroke="#ffffff" strokeWidth="1.5" />

                {/* Interactive Pins - Gates */}
                {/* Gate A - East Gate (Right) */}
                <g 
                  className="cursor-pointer group" 
                  onClick={() => handleMapItemClick("gate", "Gate A", "Gate A (East Gate)", "Sections 101-110")}
                >
                  <circle cx="270" cy="150" r="10" fill="#312e81" className="transition-all group-hover:scale-125" />
                  <text x="270" y="153" fill="white" fontSize="9" fontWeight="bold" textAnchor="middle">A</text>
                  <circle cx="270" cy="150" r="14" fill="none" stroke="#312e81" strokeWidth="1" className="animate-ping opacity-25" />
                </g>

                {/* Gate B - North Gate (Top) - High queue warning */}
                <g 
                  className="cursor-pointer group" 
                  onClick={() => handleMapItemClick("gate", "Gate B", "Gate B (North Gate)", "Sections 111-120")}
                >
                  <circle cx="150" cy="30" r="10" fill="#d97706" className="transition-all group-hover:scale-125" />
                  <text x="150" y="33" fill="white" fontSize="9" fontWeight="bold" textAnchor="middle">B</text>
                  <circle cx="150" cy="30" r="14" fill="none" stroke="#d97706" strokeWidth="1" className="animate-pulse" />
                </g>

                {/* Gate C - West Gate (Left) - Accessible */}
                <g 
                  className="cursor-pointer group" 
                  onClick={() => handleMapItemClick("gate", "Gate C", "Gate C (West Gate)", "Sections 121-130")}
                >
                  <circle cx="30" cy="150" r="10" fill="#059669" className="transition-all group-hover:scale-125" />
                  <text x="30" y="153" fill="white" fontSize="9" fontWeight="bold" textAnchor="middle">C</text>
                  <circle cx="30" cy="150" r="14" fill="none" stroke="#059669" strokeWidth="1.5" className="animate-ping opacity-20" />
                </g>

                {/* Gate D - South Gate (Bottom) */}
                <g 
                  className="cursor-pointer group" 
                  onClick={() => handleMapItemClick("gate", "Gate D", "Gate D (South Gate)", "Sections 131-140")}
                >
                  <circle cx="150" cy="270" r="10" fill="#312e81" className="transition-all group-hover:scale-125" />
                  <text x="150" y="273" fill="white" fontSize="9" fontWeight="bold" textAnchor="middle">D</text>
                </g>

                {/* Concessions pins - Food / drinks */}
                {/* Burger Pitch (Top right Section 112) */}
                <g 
                  className="cursor-pointer group" 
                  onClick={() => handleMapItemClick("food", "food_1", "Burger Pitch", "Section 112")}
                >
                  <circle cx="225" cy="80" r="8" fill="#4f46e5" />
                  <text x="225" y="83" fill="white" fontSize="8" fontWeight="bold" textAnchor="middle">🍔</text>
                </g>
                {/* Taco Goal (Bottom Left Section 125) - Busy */}
                <g 
                  className="cursor-pointer group" 
                  onClick={() => handleMapItemClick("food", "food_2", "Taco Goal", "Section 125")}
                >
                  <circle cx="75" cy="220" r="8" fill="#ef4444" />
                  <text x="75" y="223" fill="white" fontSize="8" fontWeight="bold" textAnchor="middle">🌮</text>
                </g>
                {/* Kebab Corner (Bottom Right Section 138) */}
                <g 
                  className="cursor-pointer group" 
                  onClick={() => handleMapItemClick("food", "food_3", "Kebab Corner", "Section 138")}
                >
                  <circle cx="215" cy="225" r="8" fill="#4f46e5" />
                  <text x="215" y="228" fill="white" fontSize="8" fontWeight="bold" textAnchor="middle">🌯</text>
                </g>

                {/* Restroom Pins */}
                {/* Section 104 (Accessible / Low wait) */}
                <g 
                  className="cursor-pointer group" 
                  onClick={() => handleMapItemClick("restroom", "rest_1", "Section 104 Restroom", "Concourse Level 1")}
                >
                  <circle cx="240" cy="185" r="7" fill="#10b981" />
                  <text x="240" y="188" fill="white" fontSize="7" fontWeight="bold" textAnchor="middle">WC</text>
                </g>
                {/* Section 118 (Busy Male/Female) */}
                <g 
                  className="cursor-pointer group" 
                  onClick={() => handleMapItemClick("restroom", "rest_2", "Section 118 Restroom", "Concourse Level 2")}
                >
                  <circle cx="100" cy="55" r="7" fill="#ef4444" />
                  <text x="100" y="58" fill="white" fontSize="7" fontWeight="bold" textAnchor="middle">WC</text>
                </g>

                {/* Help desks / Emergency stations */}
                {/* Family & Lost desk Section 122 */}
                <g 
                  className="cursor-pointer group" 
                  onClick={() => handleMapItemClick("helpdesk", "help_1", "Family & Lost Desk", "Section 122")}
                >
                  <circle cx="65" cy="120" r="8" fill="#8b5cf6" />
                  <text x="65" y="123" fill="white" fontSize="8" fontWeight="bold" textAnchor="middle">ℹ️</text>
                </g>
              </svg>

              <div className="absolute bottom-2 left-2 bg-white/95 border border-slate-100 p-2.5 rounded-lg text-[9px] text-slate-500 leading-normal space-y-1 shadow-sm">
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-950 inline-block"></span> Normal Gate</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-600 inline-block"></span> Accessible Gate</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span> Congested Gate</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-600 inline-block"></span> Food Outlet</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500 inline-block"></span> Info Help Point</div>
              </div>
            </div>

            {/* Selected layout item trigger */}
            {selectedMapItem ? (
              <div className="mt-3 bg-indigo-50 border border-indigo-100 p-3 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-indigo-800 uppercase font-extrabold tracking-wider">SELECTED TARGET POINT</span>
                  <p className="font-bold text-slate-800">{selectedMapItem.name}</p>
                </div>
                <button 
                  onClick={() => handleSendMessage()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase transition-colors cursor-pointer"
                >
                  Ask Copilot
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 text-center mt-2.5">
                💡 Click any labeled point on the map to query the Copilot about its status.
              </p>
            )}
          </div>

          {/* Real-time Crowd Density Simulation Controller (Awesome Hackathon Tool) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 font-display text-sm flex items-center justify-between mb-3">
              <span className="flex items-center gap-1.5">
                <Activity className="w-4.5 h-4.5 text-indigo-600" />
                Crowd Density Simulator
              </span>
              <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-extrabold uppercase">
                Interactive DB
              </span>
            </h3>
            <p className="text-xs text-slate-500 mb-4 leading-normal">
              Toggle stadium crowd levels to test how the Grounded AI copilot automatically adjusts queue directions and wait-time estimations dynamically!
            </p>

            <div className="grid grid-cols-3 gap-2">
              <button 
                onClick={() => triggerSimulation("low")}
                className={`py-2.5 px-1 text-center rounded-xl font-bold text-xs cursor-pointer transition-all ${
                  simulationStatus === "low" 
                    ? "bg-emerald-500 text-white shadow-sm ring-2 ring-emerald-500/20" 
                    : "bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600"
                }`}
              >
                Low Crowd
              </button>
              <button 
                onClick={() => triggerSimulation("normal")}
                className={`py-2.5 px-1 text-center rounded-xl font-bold text-xs cursor-pointer transition-all ${
                  simulationStatus === "normal" 
                    ? "bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-500/20" 
                    : "bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600"
                }`}
              >
                Normal
              </button>
              <button 
                onClick={() => triggerSimulation("high")}
                className={`py-2.5 px-1 text-center rounded-xl font-bold text-xs cursor-pointer transition-all ${
                  simulationStatus === "high" 
                    ? "bg-rose-500 text-white shadow-sm ring-2 ring-rose-500/20" 
                    : "bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600"
                }`}
              >
                Congested
              </button>
            </div>
          </div>

          {/* Gate Queues & Capacity Monitor */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="font-bold text-slate-800 font-display text-sm flex items-center gap-1.5">
              <Navigation className="w-4.5 h-4.5 text-indigo-600" />
              Gate Entrance Status
            </h3>
            <div className="space-y-2">
              {stadiumData?.map?.gates.map((g: Gate, idx: number) => {
                const congestion = stadiumData?.crowd?.gateCongestion[g.name.split(" (")[0]] || "Low (1 min wait)";
                const isHigh = congestion.toLowerCase().includes("high") || congestion.toLowerCase().includes("severe");
                const isModerate = congestion.toLowerCase().includes("moderate");

                return (
                  <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 hover:border-indigo-100 transition-colors">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-800 text-xs">{g.name}</span>
                        {g.accessible && (
                          <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 rounded border border-emerald-100 flex items-center">♿</span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400">Sections: {g.bestForSections.join(", ")}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isHigh ? "bg-rose-100 text-rose-800" :
                      isModerate ? "bg-amber-100 text-amber-800" :
                      "bg-emerald-100 text-emerald-800"
                    }`}>
                      {congestion}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Food concessions & Restrooms database list */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="font-bold text-slate-800 font-display text-sm flex items-center gap-1.5">
              <Utensils className="w-4.5 h-4.5 text-indigo-600" />
              Live Concessions & Restrooms
            </h3>

            <div className="space-y-2">
              {/* Food concessions */}
              {stadiumData?.map?.foodStalls.map((stall: FoodStall) => {
                const queue = stadiumData?.crowd?.foodStallQueues[stall.id];
                const waitTime = queue ? queue.estimatedWaitMinutes : 5;
                const congestion = queue ? queue.queueStatus : "Low";

                return (
                  <div 
                    key={stall.id}
                    onClick={() => handleMapItemClick("food", stall.id, stall.name, stall.location)}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 hover:border-indigo-200 cursor-pointer transition-colors flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-800">{stall.name}</span>
                        <span className="text-[10px] text-slate-400">({stall.cuisine})</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">{stall.location}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full block ${
                        congestion === "High" ? "bg-rose-100 text-rose-800" :
                        congestion === "Moderate" ? "bg-amber-100 text-amber-800" :
                        "bg-emerald-100 text-emerald-800"
                      }`}>
                        {waitTime} min wait
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Accessible Family Restrooms */}
              {stadiumData?.map?.restrooms.slice(0, 2).map((rest: Restroom) => {
                const queue = stadiumData?.crowd?.restroomQueues[rest.id];
                const waitTime = queue ? queue.estimatedWaitMinutes : 2;

                return (
                  <div 
                    key={rest.id}
                    onClick={() => handleMapItemClick("restroom", rest.id, `Restroom near Section ${rest.location.split("Section ")[1]}`, rest.location)}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 hover:border-indigo-200 cursor-pointer transition-colors flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-slate-700">
                        <span>Restroom near {rest.location.split(", ")[1]}</span>
                        {rest.accessible && (
                          <span className="text-[9px] text-emerald-700 bg-emerald-50 px-1 rounded">♿ Step-Free</span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">{rest.type} | {rest.notes}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      waitTime > 5 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                    }`}>
                      {waitTime} min queue
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Help point directories */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="font-bold text-slate-800 font-display text-sm flex items-center gap-1.5">
              <Baby className="w-4.5 h-4.5 text-indigo-600" />
              Official Help Points & Care Desks
            </h3>
            <div className="space-y-2">
              {stadiumData?.map?.helpDesks.map((desk: HelpDesk, idx: number) => (
                <div 
                  key={idx}
                  onClick={() => handleMapItemClick("helpdesk", `desk-${idx}`, desk.name, desk.location)}
                  className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 hover:border-indigo-200 cursor-pointer transition-colors text-xs"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-800">{desk.name}</span>
                    <span className="text-[10px] text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded font-semibold border border-indigo-100">
                      {desk.location.split(",")[0]}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">{desk.location}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {desk.services.map((serv, sIdx) => (
                      <span key={sIdx} className="text-[9px] bg-indigo-50/70 text-indigo-700 px-1.5 py-0.5 rounded font-medium border border-indigo-100/40">
                        {serv}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Emergency SOS Trigger Button inside right sidebar */}
          <div className="pt-2">
            <button 
              onClick={() => setActiveRole("emergency")}
              className="w-full py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold uppercase tracking-widest text-sm shadow-lg shadow-rose-200 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
            >
              <span className="animate-pulse">🚨</span> Emergency SOS
            </button>
          </div>

        </div>

      </main>

      {/* Footer */}
      <footer className="bg-indigo-950 text-slate-400 text-center py-6 border-t border-indigo-900 mt-10">
        <div className="max-w-7xl mx-auto px-4 text-xs space-y-2">
          <p>© 2026 StadiumCortex FIFA World Cup Edition - Secure Fullstack Concierge</p>
          <div className="flex justify-center gap-4 text-slate-400">
            <a href="#" className="hover:text-white transition-colors">Incident Guidelines</a>
            <span>•</span>
            <a href="#" className="hover:text-white transition-colors">Volunteer SOPs</a>
            <span>•</span>
            <a href="#" className="hover:text-white transition-colors">Accessibility Standards</a>
          </div>
        </div>
      </footer>

      {/* QR Code Scanner Overlay Modal */}
      <QRScannerModal 
        isOpen={isQRScannerOpen}
        onClose={() => setIsQRScannerOpen(false)}
        onScanSuccess={(query, suggestedRole) => {
          if (suggestedRole && activeRole !== suggestedRole) {
            setActiveRole(suggestedRole);
          }
          handleSendMessage(query);
        }}
        triggerHaptic={triggerHaptic}
      />

    </div>
  );
}
