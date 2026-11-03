// The lead-generation pipeline as six agents. `model` is the character GLB in /public/models.
export const AGENTS = [
  { id: "researcher", name: "Researcher", model: "intake" },
  { id: "writer",     name: "Writer",     model: "designer" },
  { id: "qa",         name: "QA",         model: "critic" },
  { id: "outreach",   name: "Outreach",   model: "report-writer" },
  { id: "followup",   name: "Follow-up",  model: "reviser" },
  { id: "booker",     name: "Booker",     model: "parts-buyer" },
];

// Scripted run shown when no live backend is connected: [who, what they're doing, hand off to]
export const DEMO_STEPS = [
  ["researcher", "finding companies that fit the profile", "writer"],
  ["writer", "writing a personal first message", "qa"],
  ["qa", "checking tone, facts and who we represent", "outreach", true],
  ["outreach", "sending on the client's behalf", "followup"],
  ["followup", "following up, day 3", "booker"],
  ["booker", "booking Thursday 2:00 pm", "review"],
];
export const DEMO_TAIL = {
  waiting: ["booker", "meeting brief ready for the client"],
  finishing: ["researcher", "starting the next batch"],
  done: "12 meetings booked this month",
};

// How-it-works step -> which agents are active and what they say
export const HOW_STEPS = [
  { focus: "researcher", states: [["researcher", "typing", "turning your call into an ideal-customer profile"]] },
  { focus: "writer", states: [["researcher", "typing", "verifying 1,200 contacts"], ["writer", "typing", "researching each company"], ["qa", "typing", "dropping bad fits"]] },
  { focus: "outreach", states: [["writer", "typing", "writing personal first messages"], ["qa", "typing", "checking every message"], ["outreach", "typing", "sending as BardalesLabs for you"], ["followup", "typing", "follow-up, day 3"]] },
  { focus: "booker", states: [["booker", "typing", "booking Thursday 2:00 pm"], ["outreach", "carry", "handing a warm reply to Booker", "booker"]] },
];
