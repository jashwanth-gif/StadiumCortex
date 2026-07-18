export type Role = "fan" | "volunteer" | "accessibility" | "emergency";

export interface Gate {
  name: string;
  zone: string;
  bestForSections: string[];
  accessible: boolean;
  details: string;
}

export interface FoodStall {
  id: string;
  name: string;
  location: string;
  cuisine: string;
  accessibleCounter: boolean;
  averagePrepTimeMinutes: number;
}

export interface Restroom {
  id: string;
  location: string;
  type: string;
  accessible: boolean;
  hasStrollerSpace: boolean;
  notes: string;
}

export interface HelpDesk {
  name: string;
  location: string;
  services: string[];
}

export interface StadiumMap {
  stadiumName: string;
  capacity: number;
  zones: string[];
  gates: Gate[];
  foodStalls: FoodStall[];
  restrooms: Restroom[];
  helpDesks: HelpDesk[];
}

export interface CrowdData {
  lastUpdated: string;
  crowdStatus: string;
  congestedGates: string[];
  clearGates: string[];
  gateCongestion: Record<string, string>;
  foodStallQueues: Record<string, {
    queueStatus: string;
    estimatedWaitMinutes: number;
    congestionLevel: string;
  }>;
  restroomQueues: Record<string, {
    queueStatus: string;
    estimatedWaitMinutes: number;
  }>;
}

export interface Message {
  id: string;
  text: string;
  sender: "user" | "ai";
  timestamp: string;
  role: Role;
}
