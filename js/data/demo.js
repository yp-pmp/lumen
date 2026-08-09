/* ==========================================================================
   Demo pages — fictional, for trying LUMEN out.
   Every record carries isDemo: true and can be removed in one action from
   Settings → Demo pages. Real entries are never touched by that removal.
   Offsets are counted back from today so the archive always looks lived-in.
   ========================================================================== */

import { dayKey, keyToDate, todayKey } from "../utils/date.js";
import { countWords } from "../utils/text.js";

const DEMO = [
  {
    daysAgo: 0,
    hour: 8,
    minute: 12,
    mood: "Peaceful",
    prompt: "What is something small you appreciated today?",
    promptCategory: "Gratitude",
    content:
      "Woke before the alarm. The flat was that particular blue it only gets for about twenty minutes, and I sat with coffee and didn't reach for my phone once.\n\nSmall thing: the neighbour's cat was on the wall again, doing nothing, extremely committed to it. I appreciated that.",
  },
  {
    daysAgo: 0,
    hour: 22,
    minute: 40,
    mood: "Tired",
    content: "Long day. Nothing wrong with it. Just long.",
  },
  {
    daysAgo: 1,
    hour: 21,
    minute: 5,
    mood: "Reflective",
    prompt: "What has been on your mind lately?",
    promptCategory: "Reflection",
    content:
      "I keep circling the same thought, so I may as well put it down properly.\n\nI think I've been treating rest as something I have to earn, and then never quite earning it. There's always one more thing that would justify stopping. It's a clever trap because it looks like diligence from the outside.\n\nWhat I noticed this week is that the work I'm proudest of didn't come from the exhausted hours. It came from the ones where I'd slept, gone for a walk, and let the problem sit. The tired hours produce volume. The rested ones produce judgement.\n\nSo: an experiment. For the next two weeks I stop at seven. Not as a rule I'll feel guilty about breaking — as a thing I'm curious about. I want to see what the evenings are like when they belong to me. I suspect I'll be bored at first and that boredom is probably the point.\n\nAlso, unrelated, I've been thinking about going to Japan again. Not planning. Just thinking. The way you turn an idea over without deciding anything.",
  },
  {
    daysAgo: 3,
    hour: 13,
    minute: 30,
    mood: "Happy",
    prompt: "Who made your day a little better?",
    promptCategory: "Relationships",
    content:
      "Lunch with Mara in the park. We hadn't seen each other since spring and it took about four minutes to be completely back in it — no throat-clearing, no updates, just straight into the middle of a conversation.\n\nShe said something I want to keep: \"You're allowed to change your mind in public.\" I've been quietly embarrassed about a few things I said I'd do this year and haven't. She made it sound like ordinary weather.",
  },
  {
    daysAgo: 5,
    hour: 19,
    minute: 50,
    mood: "Anxious",
    content:
      "The presentation is Thursday and I have the familiar low hum going. I've written the thing three times now, which is usually a sign I don't trust it.\n\nWriting it down to get it out of my head: the worst case is that it's fine and slightly forgettable. That's genuinely the worst case. I know that and my chest hasn't been told.",
  },
  {
    daysAgo: 8,
    hour: 7,
    minute: 45,
    mood: "Energized",
    prompt: "What are you learning about yourself?",
    promptCategory: "Growth",
    content:
      "Ran the long loop for the first time since June. Slower than I wanted, which annoyed me for about a kilometre and then stopped mattering.\n\nWhat I'm learning: I'm much better at starting than at continuing, and I've been calling that a flaw. Maybe it's just a shape. If I build things that suit a starter — short cycles, fresh problems, visible ends — I get further than when I try to be someone who grinds.",
  },
  {
    daysAgo: 12,
    hour: 23,
    minute: 15,
    content:
      "Can't sleep. The window's open and someone two streets over is having a much better night than I am.\n\nNothing profound. Just here.",
  },
  {
    daysAgo: 17,
    hour: 18,
    minute: 20,
    mood: "Grateful",
    prompt: "What do you hope your future self remembers?",
    promptCategory: "Future",
    content:
      "If you're reading this later and things are complicated: this evening was easy. Dinner on the floor because the table was covered in laundry. The good olive oil. A film neither of us watched properly.\n\nRemember that the easy evenings didn't announce themselves. They just happened on a Tuesday.",
  },
  {
    daysAgo: 26,
    hour: 12,
    minute: 5,
    mood: "Reflective",
    prompt: "What are you proud of accomplishing?",
    promptCategory: "Work",
    content:
      "Shipped the migration. Six weeks, no drama on the day, which is the whole point and also why nobody notices.\n\nI'm proud of the boring parts — the rollback plan we didn't need, the doc I wrote that meant three people could answer questions without me. That's the work I want more of.",
  },
  {
    daysAgo: 41,
    hour: 20,
    minute: 30,
    mood: "Sad",
    content:
      "Dad's scan was clear, and I burst into tears in the corridor about ten seconds after hanging up, which surprised me.\n\nI think I'd been holding it since March without admitting there was anything to hold.",
  },
  {
    daysAgo: 58,
    hour: 16,
    minute: 0,
    mood: "Peaceful",
    prompt: "What was the best part of today?",
    promptCategory: "Today",
    content:
      "Swam in the lake. Cold enough to be a decision. Best part of today, easily, and it took eleven minutes.",
  },
  {
    daysAgo: 96,
    hour: 9,
    minute: 25,
    mood: "Happy",
    content:
      "First proper warm morning. Had breakfast outside and read for an hour with my phone inside on purpose.\n\nI've been thinking about Japan again — the trip we keep almost booking. Maybe next spring I'll finally stop treating it as hypothetical.",
  },
  {
    daysAgo: 140,
    hour: 21,
    minute: 40,
    mood: "Reflective",
    prompt: "What would you say if nobody could judge you?",
    promptCategory: "Unfiltered",
    content:
      "That I don't actually want the promotion. I want the money and the reassurance that comes with it, and I've been telling myself those are the same thing as wanting the job.\n\nSaying it here where nobody's listening: I like making things. Every step up has been a step away from making things.",
  },
  {
    // Exactly one year ago today — this is what "On this day" surfaces.
    yearsAgo: 1,
    hour: 22,
    minute: 10,
    mood: "Reflective",
    prompt: "What would you like to remember about today?",
    promptCategory: "Today",
    content:
      "A completely ordinary Saturday and I want to remember it anyway.\n\nMarket in the morning, too many tomatoes, the man who always says \"go on then\" when you hesitate. Slept in the afternoon like a teenager. In the evening we walked to the bridge and stayed longer than we meant to because the light kept changing.\n\nI've spent a lot of this year waiting for something to begin. Today didn't feel like waiting.",
  },
  {
    yearsAgo: 1,
    daysAgo: 34,
    hour: 8,
    minute: 30,
    mood: "Energized",
    content:
      "New notebook, new resolve, the usual. But I did the thing I said I'd do, which is a start.",
  },
];

function makeDate({ daysAgo = 0, yearsAgo = 0, hour = 12, minute = 0 }) {
  const base = keyToDate(todayKey());
  base.setFullYear(base.getFullYear() - yearsAgo);
  base.setDate(base.getDate() - daysAgo);
  base.setHours(hour, minute, 0, 0);
  return base;
}

export function buildDemoEntries() {
  return DEMO.map((seed, index) => {
    const created = makeDate(seed);
    return {
      id: `demo-${index + 1}`,
      createdAt: created.toISOString(),
      updatedAt: created.toISOString(),
      date: dayKey(created),
      content: seed.content,
      mood: seed.mood || null,
      prompt: seed.prompt || null,
      promptCategory: seed.promptCategory || null,
      wordCount: countWords(seed.content),
      isDemo: true,
    };
  });
}
