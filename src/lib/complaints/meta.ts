import { Zap, Droplets, Construction, Lightbulb, Waves, RadioTower } from "lucide-react";
import type { ComplaintCategory } from "@/lib/offline/db";

export const CATEGORY_META: Record<ComplaintCategory, {
  label: string;
  description: string;
  icon: typeof Zap;
  color: string;
}> = {
  transformer:    { label: "Transformer failure",   description: "Power outage, sparks, exploded unit",     icon: Zap,         color: "#F59E0B" },
  water_pipe:     { label: "Water pipe burst",      description: "Burst pipe, leakage, no supply",          icon: Droplets,    color: "#0EA5E9" },
  road_damage:    { label: "Road damage",           description: "Potholes, collapsed road, cracks",        icon: Construction, color: "#A855F7" },
  street_light:   { label: "Street light outage",   description: "Dark lane, broken pole, flicker",         icon: Lightbulb,   color: "#EAB308" },
  sewage_leak:    { label: "Sewage leak",           description: "Overflow, blockage, odour, leak",         icon: Waves,       color: "#10B981" },
  network_tower:  { label: "Network tower failure", description: "Signal blackout, no internet, outage",    icon: RadioTower,  color: "#EF4444" },
};

export const CATEGORY_ORDER: ComplaintCategory[] = [
  "transformer", "water_pipe", "road_damage", "street_light", "sewage_leak", "network_tower",
];
