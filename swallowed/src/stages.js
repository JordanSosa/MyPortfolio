// The six organ stages of the journey, plus bite (0) and exit (6).
// Each stage owns: a name, a palette, fog settings, and caption copy.
// Captions are VERBATIM per the creative spec.
//
// `pStart`/`pEnd` are normalized progress windows along the single curve.
// Stage groups toggle visibility based on whether progress is near the window
// (see scene.js) so the whole tract isn't all active at once.

export const FOODS = {
  strawberry: "strawberry",
  "slice of toast": "slice of toast",
  "cube of cheese": "cube of cheese",
};

// Returns caption copy with the chosen food spliced in where relevant.
export function buildStages(food = "strawberry") {
  return [
    {
      id: "bite",
      title: "The Bite",
      // palette: soft darkness resolving to mouth coral
      colors: { fog: "#1a1012", key: "#E8868C", fill: "#C25A66", accent: "#F4EFE4" },
      fogDensity: 0.035,
      pStart: 0.0,
      pEnd: 0.07,
      caption: `You're a ${food}. Enjoy being whole — it won't last.`,
    },
    {
      id: "mouth",
      title: "The Mouth",
      colors: { fog: "#C25A66", key: "#E8868C", fill: "#F4EFE4", accent: "#F4EFE4" },
      fogDensity: 0.05,
      pStart: 0.07,
      pEnd: 0.2,
      caption:
        "Thirty-two teeth, up to seventy kilograms of force — and saliva that's already digesting you. Amylase, splitting your starches before you've even gone down.",
    },
    {
      id: "esophagus",
      title: "The Esophagus",
      colors: { fog: "#7A3B40", key: "#C56B6B", fill: "#7A3B40", accent: "#C56B6B" },
      fogDensity: 0.09,
      pStart: 0.2,
      pEnd: 0.34,
      // swallow caption fires at the very start; tube caption a touch later
      captionSwallow: "The epiglottis seals your airway. No turning back now.",
      caption:
        "Peristalsis — muscle contracting in waves behind you, a few centimetres a second. You'd make this trip even upside down. Gravity is optional here.",
    },
    {
      id: "stomach",
      title: "The Stomach",
      colors: { fog: "#3A1E16", key: "#D98A3D", fill: "#9B3D2E", accent: "#D98A3D" },
      fogDensity: 0.06,
      pStart: 0.34,
      pEnd: 0.5,
      caption:
        "Hydrochloric acid — pH around 1.5, strong enough to corrode metal. Pepsin tears into proteins. You are dissolving into chyme.",
    },
    {
      id: "small",
      title: "The Small Intestine",
      colors: { fog: "#E8B45A", key: "#FFE9B0", fill: "#D98C8C", accent: "#B23A48" },
      fogDensity: 0.045,
      pStart: 0.5,
      pEnd: 0.74,
      captionBile:
        "Bile floods in, green from the gallbladder, shattering fat into droplets. The acid is neutralised. The burning stops.",
      // the thesis line — the emotional peak
      caption:
        "Six metres of velvet — villi folded and refolded into the surface area of a tennis court. Here your nutrients leave you, pulled into the blood to become muscle, bone, and thought. This is where you become someone else.",
      thesis: true,
    },
    {
      id: "large",
      title: "The Large Intestine",
      colors: { fog: "#2A1C13", key: "#6F8A5A", fill: "#6E4A33", accent: "#6F8A5A" },
      fogDensity: 0.07,
      pStart: 0.74,
      pEnd: 0.9,
      caption:
        "Thirty-eight trillion bacteria live here. They ferment what's left, brew your vitamins, and — yes — the gas. The water is reclaimed. You're nearly solid now.",
    },
    {
      id: "exit",
      title: "The Exit",
      colors: { fog: "#120D0A", key: "#FBFAF6", fill: "#FBFAF6", accent: "#FBFAF6" },
      fogDensity: 0.05,
      pStart: 0.9,
      pEnd: 1.0,
      caption:
        "Twenty-four to seventy-two hours. Nine metres. One body. You came in as food — you leave as what remained. And part of you stayed behind, alive in someone.",
    },
  ];
}

// Used to splice the food name into the bite caption when redrawn.
export function captionForStage(stage) {
  return stage.caption;
}
