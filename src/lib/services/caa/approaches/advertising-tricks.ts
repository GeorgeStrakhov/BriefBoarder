/**
 * Advertising Tricks & Frameworks Library
 * Inspired by the masters: Bernbach, Ogilvy, Della Femina, Gossage
 * High-performing creative approaches that make ads unforgettable
 */

export interface AdvertisingTrick {
  id: string;
  name: string;
  description: string;
  whenToUse: string;
  examples: string[];
  inspiration?: string; // Famous campaign reference
}

export const ADVERTISING_TRICKS: AdvertisingTrick[] = [
  {
    id: "reverse-psychology",
    name: "The Anti-Ad",
    description:
      "Tell people NOT to buy. Honesty so brutal it builds instant trust. 'Our product isn't for everyone.'",
    whenToUse: "Overcoming ad fatigue, premium positioning, cult brands",
    examples: [
      "Patagonia: 'Don't Buy This Jacket' on Black Friday",
      "'Only for people who actually read' - book club ad",
      "Stark warning label style: 'Not recommended for quitters'",
    ],
    inspiration: "VW: 'Think Small' (honesty over hype)",
  },
  {
    id: "absurd-juxtaposition",
    name: "The Surreal Collision",
    description:
      "Smash two completely unrelated worlds together. The more absurd, the more memorable. Make them go 'wait, what?!'",
    whenToUse: "Crowded markets, need instant attention, younger audiences",
    examples: [
      "Octopus in a business suit analyzing spreadsheets",
      "Grandmother doing parkour through office cubicles",
      "Medieval knight frustrated by slow WiFi",
    ],
    inspiration: "Skittles: Taste the Rainbow's surreal worlds",
  },
  {
    id: "brutal-honesty",
    name: "The Uncomfortable Truth",
    description:
      "Say what everyone thinks but no one dares to say. Cut through BS with savage truth.",
    whenToUse: "Challenging category norms, disrupting incumbents",
    examples: [
      "'You're probably overpaying for this' - then show why",
      "'Most of our competitors are lying to you' - with receipts",
      "'Yeah, it's expensive. Here's why you'll pay it anyway'",
    ],
    inspiration: "Avis: 'We're number two. We try harder.'",
  },
  {
    id: "villain-protagonist",
    name: "Root for the Bad Guy",
    description:
      "Make the problem/competitor/old way the sympathetic protagonist. Then destroy them lovingly.",
    whenToUse: "Disrupting established categories, challenger brands",
    examples: [
      "Heartfelt tribute to the fax machine before announcing its death",
      "Beautiful eulogy for traditional banking",
      "Love letter to your old, broken way of doing things",
    ],
    inspiration: "Apple: '1984' (IBM as Big Brother)",
  },
  {
    id: "micro-moment",
    name: "The 3-Second Story",
    description:
      "Capture one tiny, hyper-specific, universally relatable moment. So specific it becomes universal.",
    whenToUse: "Emotional connection, relatability, lifestyle brands",
    examples: [
      "The exact face you make when the meeting could've been an email",
      "That split-second panic when the WiFi drops during a presentation",
      "The silent celebration when you find the perfect parking spot",
    ],
    inspiration: "Nike: Just Do It moments",
  },
  {
    id: "data-made-visceral",
    name: "Numbers Made Terrifying/Beautiful",
    description:
      "Turn abstract stats into something you can FEEL. Make data make you gasp.",
    whenToUse: "Impact metrics, environmental issues, scale demonstrations",
    examples: [
      "'Enough plastic to wrap around Earth 400 times' visualized as actual wrap",
      "Every 2.3 seconds ticker counting up in real-time",
      "Stadium filled with the exact number of people affected",
    ],
    inspiration: "WNP: Water scarcity campaigns",
  },
  {
    id: "permission-to-suck",
    name: "Celebration of Failure",
    description:
      "Normalize being terrible at something. Make trying > perfection. Lower the barrier, raise the aspiration.",
    whenToUse: "Beginner products, wellness, learning platforms",
    examples: [
      "'Your first pancake will be trash. Make it anyway.' - cooking brand",
      "Hall of fame of spectacular failures leading to success",
      "'Everyone sucks at first. Here's proof.' - learning app",
    ],
    inspiration: "Nike: Athletes failing then succeeding montages",
  },
  {
    id: "enemy-of-enemy",
    name: "Unite Against Common Foe",
    description:
      "Create an external enemy everyone can hate together. Bond through shared frustration.",
    whenToUse: "Building community, challenger positioning",
    examples: [
      "'Death to jargon' - plain English movement",
      "'Down with pointless meetings' - productivity tool",
      "'End tyranny of printer jams' - tech company",
    ],
    inspiration:
      "Old Spice: The Man Your Man Could Smell Like (vs boring guys)",
  },
  {
    id: "impossible-demonstration",
    name: "The Impossible Made Possible",
    description:
      "Show your product doing something physically impossible but metaphorically true. Magical realism for ads.",
    whenToUse: "Demonstrating intangible benefits, premium products",
    examples: [
      "Mattress so comfortable, gravity doesn't work on it",
      "Coffee so strong it literally lifts your roof off",
      "Shoes so fast they leave time behind",
    ],
    inspiration: "Red Bull: Gives You Wings (literal wings)",
  },
  {
    id: "found-poetry",
    name: "Customer Words as Art",
    description:
      "Real customer reviews/complaints/praise as giant beautiful typography. No editing. Pure truth as design.",
    whenToUse: "Social proof, authenticity, user-generated content",
    examples: [
      "One-star reviews printed huge with pride: 'Too easy to use - my job is boring now'",
      "Typo-filled thank you notes blown up to poster size",
      "Real DMs made into museum-worthy installations",
    ],
    inspiration: "Spotify Wrapped: Your data made beautiful",
  },
  {
    id: "the-long-con",
    name: "Anti-Climactic Payoff",
    description:
      "Build massive tension... then deliberately underwhelm. The anti-payoff IS the payoff.",
    whenToUse: "Subverting expectations, humor, sophisticated audiences",
    examples: [
      "Epic hero's journey... to find the TV remote",
      "Heist movie tension... stealing one french fry",
      "Movie trailer gravitas... for mundane product",
    ],
    inspiration: "Dollar Shave Club: Over-the-top for razors",
  },
  {
    id: "weaponized-simplicity",
    name: "One Ingredient Hero",
    description:
      "Obsess over ONE thing to absurd degree. Everything else disappears. Monomaniacal focus.",
    whenToUse: "Product with clear USP, need differentiation",
    examples: [
      "Just the button. Nothing else. The entire ad is one giant button.",
      "100 ways to show roundness if that's your thing",
      "The color blue in 10,000 variations",
    ],
    inspiration:
      "iPod: '1,000 songs in your pocket' (only metric that mattered)",
  },
  {
    id: "corporate-sabotage",
    name: "Breaking the Fourth Wall",
    description:
      "Ad acknowledges it's an ad. Makes fun of advertising itself. Meta-commentary that disarms cynicism.",
    whenToUse: "Ad-savvy audiences, building authenticity",
    examples: [
      "'This space was expensive. We're using it anyway.'",
      "'Yes, we paid an influencer to say this'",
      "'Skip this ad in 5... actually please don't'",
    ],
    inspiration:
      "Geico: 'We could save you 15% in 15 minutes' (self-aware simplicity)",
  },
  {
    id: "prophetic-nostalgia",
    name: "Future Looks Back",
    description:
      "Advertise from future POV looking back at 'the dark ages' (now). Make present seem primitive.",
    whenToUse: "Innovation, disruptive tech, category creation",
    examples: [
      "'Remember when we used to ___?' - future person pitying us",
      "Museum exhibit of 'ancient 2024 technology'",
      "'Our grandkids won't believe we actually did this'",
    ],
    inspiration: "Tesla: Making gas cars feel like horse carriages",
  },
  {
    id: "the-whisper-campaign",
    name: "Aggressively Quiet",
    description:
      "Make them lean in. Tiny type, hidden messages, deliberate mystery. Luxury through withholding.",
    whenToUse: "Premium brands, creating intrigue, exclusive positioning",
    examples: [
      "Billboard with microscopic text: 'If you can read this, you're too close'",
      "Ad that's 99% white space, 1% tiny revelation",
      "Mysterious symbols that only insiders understand",
    ],
    inspiration: "Supreme: No explanation needed",
  },
  {
    id: "beautiful-decay",
    name: "Aesthetic of Failure",
    description:
      "Show the product failing, breaking, dying beautifully. Memento mori for brands. Make impermanence gorgeous.",
    whenToUse: "Durability messaging, sustainability, authentic luxury",
    examples: [
      "Slow-mo of product gracefully falling apart after 10,000 uses",
      "Beautiful time-lapse of patina developing on leather",
      "Elegant documentation of wear-and-tear as badge of honor",
    ],
    inspiration: "Patagonia: Worn Wear (celebrate repairs)",
  },
];

/**
 * Get random trick for variety
 */
export function getRandomTrick(): AdvertisingTrick {
  return ADVERTISING_TRICKS[
    Math.floor(Math.random() * ADVERTISING_TRICKS.length)
  ];
}

/**
 * Get trick by ID
 */
export function getTrickById(id: string): AdvertisingTrick | undefined {
  return ADVERTISING_TRICKS.find((t) => t.id === id);
}

/**
 * Get formatted library for LLM
 */
export function getFormattedTricksLibrary(): string {
  return ADVERTISING_TRICKS.map(
    (trick) =>
      `${trick.id.toUpperCase()}: ${trick.name}
${trick.description}
When to use: ${trick.whenToUse}
Examples: ${trick.examples.join(" | ")}
${trick.inspiration ? `Classic reference: ${trick.inspiration}` : ""}`,
  ).join("\n\n");
}
