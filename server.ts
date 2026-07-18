import express from "express";
import path from "path";
import fs from "fs/promises";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(express.json());

  // Use process.cwd() to consistently locate data files in fullstack mode
  const dataDir = path.join(process.cwd(), "data");

  // API: Get Stadium operational and crowd queue data
  app.get("/api/stadium-data", async (req, res) => {
    try {
      const mapDataStr = await fs.readFile(path.join(dataDir, "stadium_map.json"), "utf-8");
      const crowdDataStr = await fs.readFile(path.join(dataDir, "crowd.json"), "utf-8");
      
      res.json({
        map: JSON.parse(mapDataStr),
        crowd: JSON.parse(crowdDataStr),
      });
    } catch (error: any) {
      console.error("Error reading stadium data:", error);
      res.status(500).json({ error: "Failed to read stadium data", details: error.message });
    }
  });

  // API: Reset or update crowd queue simulation
  app.post("/api/simulate-crowd", async (req, res) => {
    try {
      const { action } = req.body;
      let crowd = JSON.parse(await fs.readFile(path.join(dataDir, "crowd.json"), "utf-8"));

      if (action === "high") {
        crowd.crowdStatus = "High Congestion";
        crowd.gateCongestion["Gate A"] = "High (15 min wait)";
        crowd.gateCongestion["Gate B"] = "Severe (25 min wait)";
        crowd.gateCongestion["Gate C"] = "Moderate (8 min wait)";
        crowd.foodStallQueues["food_1"].estimatedWaitMinutes = 12;
        crowd.foodStallQueues["food_1"].queueStatus = "High";
        crowd.foodStallQueues["food_2"].estimatedWaitMinutes = 25;
        crowd.foodStallQueues["food_2"].queueStatus = "High";
        crowd.foodStallQueues["food_3"].estimatedWaitMinutes = 18;
        crowd.foodStallQueues["food_3"].queueStatus = "High";
      } else if (action === "low") {
        crowd.crowdStatus = "Very Low";
        crowd.gateCongestion["Gate A"] = "Low (1 min wait)";
        crowd.gateCongestion["Gate B"] = "Low (2 min wait)";
        crowd.gateCongestion["Gate C"] = "Low (1 min wait)";
        crowd.foodStallQueues["food_1"].estimatedWaitMinutes = 1;
        crowd.foodStallQueues["food_1"].queueStatus = "Low";
        crowd.foodStallQueues["food_2"].estimatedWaitMinutes = 2;
        crowd.foodStallQueues["food_2"].queueStatus = "Low";
        crowd.foodStallQueues["food_3"].estimatedWaitMinutes = 1;
        crowd.foodStallQueues["food_3"].queueStatus = "Low";
      } else {
        // Default / moderate reset
        crowd.crowdStatus = "Moderate";
        crowd.gateCongestion["Gate A"] = "Moderate";
        crowd.gateCongestion["Gate B"] = "High (12 min wait)";
        crowd.gateCongestion["Gate C"] = "Low (2 min wait)";
        crowd.gateCongestion["Gate D"] = "Low (1 min wait)";
        crowd.foodStallQueues["food_1"].estimatedWaitMinutes = 3;
        crowd.foodStallQueues["food_1"].queueStatus = "Low";
        crowd.foodStallQueues["food_2"].estimatedWaitMinutes = 15;
        crowd.foodStallQueues["food_2"].queueStatus = "High";
        crowd.foodStallQueues["food_3"].estimatedWaitMinutes = 8;
        crowd.foodStallQueues["food_3"].queueStatus = "Moderate";
      }

      crowd.lastUpdated = new Date().toISOString();
      await fs.writeFile(path.join(dataDir, "crowd.json"), JSON.stringify(crowd, null, 2), "utf-8");
      res.json({ success: true, crowd });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to simulate crowd updates", details: error.message });
    }
  });

  // API: Handle role-based chat using Gemini
  app.post("/api/chat", async (req, res) => {
    const { message, role, chatHistory } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const activeRole = role || "fan";

    try {
      // 1. Read grounding files
      const mapData = await fs.readFile(path.join(dataDir, "stadium_map.json"), "utf-8").catch(() => "{}");
      const crowdData = await fs.readFile(path.join(dataDir, "crowd.json"), "utf-8").catch(() => "{}");
      const faqsData = await fs.readFile(path.join(dataDir, "faqs.md"), "utf-8").catch(() => "");
      const sopsData = await fs.readFile(path.join(dataDir, "sops_volunteer.md"), "utf-8").catch(() => "");

      // 2. Check for emergency triggers in message to force auto-override
      const lowerMsg = message.toLowerCase();
      const hasEmergencyTrigger = 
        lowerMsg.includes("emergency") || 
        lowerMsg.includes("evacuate") || 
        lowerMsg.includes("evacuation") || 
        lowerMsg.includes("fire") || 
        lowerMsg.includes("panic") || 
        lowerMsg.includes("medical help") || 
        lowerMsg.includes("lost child") || 
        lowerMsg.includes("danger") || 
        lowerMsg.includes("heart attack") || 
        lowerMsg.includes("bleeding");

      const calculatedRole = hasEmergencyTrigger ? "emergency" : activeRole;

      // 3. Prepare System Instructions
      const systemInstruction = `You are StadiumCortex, the official intelligent stadium operations and fan experience assistant for Lusail Iconic Stadium at the FIFA World Cup.
Your active role is: ${calculatedRole.toUpperCase()}.

Here is the official stadium data and operational records you MUST ground your responses in. NEVER invent non-existent gates, food stands, restrooms, sections, or help desks.
=== STADIUM MAP & FACILITIES ===
${mapData}

=== LIVE CROWD STATUS & QUEUE TIMES ===
${crowdData}

=== FREQUENTLY ASKED QUESTIONS ===
${faqsData}

=== VOLUNTEER STANDARD OPERATING PROCEDURES (SOPS) ===
${sopsData}

=== GENERAL RULES FOR ALL ROLES ===
1. Be concise, extremely helpful, and accurate. Stadium users are on the move.
2. Ground everything in the provided data. If the information is missing, clearly state that you are unsure and advise them to ask a stadium volunteer or go to the nearest Help Desk.
3. Keep a friendly, serious, and professional tone.
4. Auto-Emergency Override: If the user mentions fire, evacuation, panic, medical emergency, or security threat, you must provide calm, direct, bulleted commands following the EMERGENCY mode guidelines below.

=== ROLE-SPECIFIC RESPONSES ===

1. FAN MODE:
- Focus on helping fans reach gates, sections, food outlets, and restrooms.
- Suggest safer or less crowded routes. If Gate B is congested, advise them to enter via Gate C or Gate D instead.
- Point them to the nearest restrooms and food outlets with the lowest wait times.

2. VOLUNTEER MODE:
- Speak as an operations supervisor instructing a field volunteer.
- Provide step-by-step guidance on SOPs: Lost Child Reunification (SOP-01), Medical Response Level 1 vs Level 2 (SOP-02), and Gate congestion redirects (SOP-03).
- Be crisp, objective, and use operational terms.

3. ACCESSIBILITY MODE:
- Optimize routes specifically for wheelchair users, senior citizens, and parents with strollers.
- ALWAYS prefer step-free paths (Gate C and Gate D). Never recommend escalators or stairs.
- Highlight accessible facilities: Family/All-Gender toilets (Section 104), Coed Accessible toilets (Section 128), and elevators at Section 121.
- Use simple, reassuring, and exceptionally clear language.

4. EMERGENCY MODE:
- Give calm, short, bulleted, official instructions.
- Do not add conversational fluff or apologies.
- Advise them to proceed calmly to the nearest wide step-free exit (Gate C (West) or Gate D (South)), do NOT use elevators, and follow directions from on-site security personnel and public announcements.
- Provide direct, safe instructions: Stay Calm, Proceed to Nearest Exit, Follow Staff Instructions.
`;

      // 4. Lazy initialize Gemini API key
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
        // Fallback for hackathon/local use without configured Gemini API key
        let mockReply = "";
        if (calculatedRole === "emergency") {
          mockReply = "**[EMERGENCY MODE ACTIVATED]**\n\n- **Stay calm.**\n- Proceed immediately to the nearest exit: **Gate C (West Gate)** or **Gate D (South Gate)**. Both offer step-free evacuation lanes.\n- Do **NOT** use elevators or escalators.\n- Follow all instructions from on-site security staff and public address announcements.";
        } else if (calculatedRole === "volunteer") {
          if (lowerMsg.includes("child") || lowerMsg.includes("lost")) {
            mockReply = "**Volunteer Protocol: Lost Child (SOP-01)**\n\n1. **Comfort:** Keep the child calm at your current location. Do not move.\n2. **Radio Announcement:** Call Sector Supervisor with child's details (age, clothing, gender).\n3. **Wait 5 Mins:** Stand by for parents.\n4. **Escort:** If unclaimed, guide child to **Family & Lost Desk** (Zone B, Main Lobby near Section 122).";
          } else if (lowerMsg.includes("medical") || lowerMsg.includes("escalation")) {
            mockReply = "**Volunteer Protocol: Medical Emergency (SOP-02)**\n\n- **Level 1 (Minor):** Guide to **Medical Center A** (Zone C, Lower Ground, under Section 115).\n- **Level 2 (Severe):** Keep patient stable. Immediately radio dispatch with exact sector coordinates (e.g., Section 124, Row K) to deploy emergency responders.";
          } else {
            mockReply = "Hello Volunteer. Please check current gate queues on your dashboard. Currently Gate B has high congestion. You are advised to direct arriving fans toward Gate C (West Gate) or Gate D (South Gate) to alleviate pressure.";
          }
        } else if (calculatedRole === "accessibility") {
          mockReply = "Welcome! For an easy, step-free route, we recommend using **Gate C (West Gate)** or **Gate D (South Gate)**, which have gentle ramps and flat entry. If you need to change levels, elevators are located near **Section 121**. Accessible family restrooms are available at **Section 104** and **Section 128**.";
        } else {
          // Fan Mode
          if (lowerMsg.includes("food") || lowerMsg.includes("crowded")) {
            mockReply = "I recommend **Burger Pitch** (Concourse Level 2, Section 112) for food. It is currently the least crowded stall with a **3-minute wait**. Avoid Taco Goal near Section 125, which has a 15-minute wait.";
          } else if (lowerMsg.includes("restroom") || lowerMsg.includes("toilet")) {
            mockReply = "The closest restroom with a low queue is at **Concourse Level 1, Section 104** (Family/Accessible, 1 min wait). The restroom near Section 118 is currently highly congested (10 min wait).";
          } else if (lowerMsg.includes("gate")) {
            mockReply = "For Sections 101-110, use **Gate A**. For Sections 121-130, use **Gate C (West)** which has a very short wait of 2 minutes. Avoid Gate B (North Gate) if possible as it currently has high congestion with a 12-minute queue.";
          } else {
            mockReply = "Welcome to Lusail Iconic Stadium! I can help you find gates, restrooms, food stalls, or assist you with volunteer SOPs and accessibility routes. How can I guide you today?";
          }
        }
        return res.json({ text: mockReply, role: calculatedRole, warning: "Using local rule-based fallback model because GEMINI_API_KEY is not configured in Secrets." });
      }

      // 5. Setup GoogleGenAI
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      // 6. Format chat history
      const contents: any[] = [];
      if (chatHistory && Array.isArray(chatHistory)) {
        chatHistory.forEach((msgObj: any) => {
          contents.push({
            role: msgObj.sender === "user" ? "user" : "model",
            parts: [{ text: msgObj.text }]
          });
        });
      }
      // Push the newest message
      contents.push({
        role: "user",
        parts: [{ text: message }]
      });

      // 7. Generate content using Gemini
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents,
        config: {
          systemInstruction,
          temperature: 0.3,
          topP: 0.9,
        }
      });

      const aiResponseText = response.text || "I am currently unable to process your request. Please ask a stadium volunteer for assistance.";
      res.json({ text: aiResponseText, role: calculatedRole });

    } catch (err: any) {
      console.error("Gemini API error:", err);
      res.status(500).json({ error: "Failed to generate AI response", details: err.message });
    }
  });

  // Serve VITE dev assets or production static bundle
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`StadiumCortex Server is listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
