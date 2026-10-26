// Tool designation for the main chat: read the USER's words deterministically and, if
// they clearly relate to one of the on-device tools, suggest opening it. The buddy still
// answers normally — this just surfaces an "Open [Tool] →" shortcut. No model involved.
import type { FeatureRoute } from "./screens/Tools";

export type ToolHit = { route: FeatureRoute; title: string };

// Order = priority (first match wins); more specific phrasings sit higher.
const RULES: { route: FeatureRoute; title: string; re: RegExp }[] = [
  { route: "translate", title: "Translate", re: /\btranslat(e|ion)\b|how do you say\b|\b(in|to) (spanish|german|french|italian|chinese|japanese|arabic|russian|portuguese|dutch|polish|turkish|hindi)\b/ },
  { route: "timer", title: "Timer", re: /\b(timer|count\s?down|set .*\b(minutes?|seconds?|hours?)\b)\b/ },
  { route: "convert", title: "Converter", re: /\b(convert|conversion|how many (km|miles?|kg|lb|pounds?|ml|oz|cups?|°|celsius|fahrenheit)\b|units?)\b/ },
  { route: "travel", title: "Travel", re: /\b(directions?|navigate|drive to|take me to|how do i get to|route to|my trip)\b/ },
  { route: "calendar", title: "Calendar", re: /\b(calendar|remind me|reminder|schedule|appointment|agenda|event on)\b/ },
  { route: "grocery", title: "Grocery", re: /\b(grocery|groceries|shopping list|add .* to (my )?list)\b/ },
  { route: "recipes", title: "Recipes", re: /\b(recipe|cook|ingredients?|how (do i|to) make)\b/ },
  { route: "meals", title: "Meal planner", re: /\b(meal\s?plan|plan (my )?meals?|what to eat this week|dinner plan)\b/ },
  { route: "diet", title: "Diet", re: /\b(calor|macro|protein|carbs?|my diet|food log|track (what|my) (i )?eat)\b/ },
  { route: "fitness", title: "Fitness", re: /\b(workout|exercise|gym|fitness|reps?|\bsets?\b|bench|squat|deadlift|training volume)\b/ },
  { route: "water", title: "Water", re: /\b(water intake|hydrat|how much water|drink(ing)? water|cups of water)\b/ },
  { route: "sleep", title: "Sleep", re: /\b(sleep|slept|how (long|well) did i sleep|bedtime|hours of rest)\b/ },
  { route: "measure", title: "Measurements", re: /\b(measurement|my weight|waist|body fat|bmi|track .* weight)\b/ },
  { route: "budget", title: "Budget", re: /\b(budget|how much (did i|have i) spen|expense|my income|track (my )?(money|spending))\b/ },
  { route: "habits", title: "Habits", re: /\b(habit|streak|daily routine|check ?in to|build a habit)\b/ },
  { route: "memory", title: "Memory", re: /\b(remember that|my name is|note about me|i prefer|remember i)\b/ },
  { route: "notes", title: "Dictaphone & Notes", re: /\b(take a note|new note|voice memo|dictate|write (this|that) down)\b/ },
  { route: "experts", title: "Experts", re: /\b(knowledge pack|ask the experts?|look (this|that|it) up|research|marketing (advice|funnel)|business advice)\b/ },
  { route: "notifs", title: "Reader", re: /\b(read (my )?notifications?|read it (out )?loud|read aloud)\b/ },
];

export function detectTool(raw: string): ToolHit | null {
  const t = (raw || "").toLowerCase();
  if (!t.trim()) return null;
  for (const r of RULES) if (r.re.test(t)) return { route: r.route, title: r.title };
  return null;
}
