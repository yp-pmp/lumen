/* Invitations and prompts. Never assignments. */

import { hashString } from "./utils/text.js";

/** Shown on Today. One is chosen per day, so the day has its own question. */
export const INVITATIONS = [
  "What stayed with you today?",
  "What is taking up space in your mind?",
  "What would you like to remember about today?",
  "You don't have to make sense of everything. Just begin.",
  "What made today feel like today?",
  "Is there anything you haven't said out loud yet?",
  "What did the day ask of you?",
  "Where did your attention keep returning?",
  "Nothing has to be resolved here. Only noticed.",
  "What would you tell someone who asked how you really are?",
];

export const CATEGORIES = [
  {
    name: "Today",
    prompts: [
      "What was the best part of today?",
      "What is one small thing you'd forget if you didn't write it down?",
      "How did today begin, and how is it ending?",
      "What surprised you today?",
    ],
  },
  {
    name: "Reflection",
    prompts: [
      "What has been on your mind lately?",
      "What keeps coming back to you?",
      "What have you been avoiding thinking about?",
      "What feels different about this season of your life?",
    ],
  },
  {
    name: "Gratitude",
    prompts: [
      "What is something small you appreciated today?",
      "Who would you thank, if you could tell them right now?",
      "What is working, quietly, in your life?",
      "What did you almost not notice?",
    ],
  },
  {
    name: "Growth",
    prompts: [
      "What are you learning about yourself?",
      "What would you do differently, gently?",
      "What are you becoming better at?",
      "What belief are you outgrowing?",
    ],
  },
  {
    name: "Work",
    prompts: [
      "What are you proud of accomplishing?",
      "What part of the work felt like yours?",
      "What is draining you, and what is feeding you?",
      "What would make tomorrow feel lighter?",
    ],
  },
  {
    name: "Relationships",
    prompts: [
      "Who made your day a little better?",
      "Who have you been meaning to reach out to?",
      "What did someone say that stayed with you?",
      "Where do you want to be more generous?",
    ],
  },
  {
    name: "Future",
    prompts: [
      "What do you hope your future self remembers?",
      "What are you quietly looking forward to?",
      "If next year felt good, what would be true?",
      "What are you building, slowly?",
    ],
  },
  {
    name: "Unfiltered",
    prompts: [
      "What would you say if nobody could judge you?",
      "What are you pretending not to know?",
      "Say the unreasonable thing.",
      "What do you actually want?",
    ],
  },
];

const FLAT = CATEGORIES.flatMap((category) =>
  category.prompts.map((text) => ({ text, category: category.name }))
);

/** Stable for a given day — today's invitation doesn't shuffle on refresh. */
export function invitationFor(dayKey) {
  return INVITATIONS[hashString(`invite:${dayKey}`) % INVITATIONS.length];
}

export function promptFor(dayKey) {
  return FLAT[hashString(`prompt:${dayKey}`) % FLAT.length];
}

/** Next prompt, never repeating the one on screen. */
export function anotherPrompt(current) {
  if (FLAT.length < 2) return FLAT[0];
  let next = current;
  while (!next || next.text === current?.text) {
    next = FLAT[Math.floor(Math.random() * FLAT.length)];
  }
  return next;
}
