// Demo data for local development: teammates, boards, tags, cards and expenses dated around today.
//
//   pnpm db:seed-demo
//
// Safe to re-run: it first deletes what it created before (demo users have @demo.qazbot.test emails,
// and their boards cascade away with them), then inserts everything fresh. Real users and their boards
// are never touched, but some demo cards are assigned to them so their dashboard has content.
// Refuses to run against anything but a local database unless you pass --force.

import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set (run through `pnpm db:seed-demo`, which loads .env.local).");
const host = new URL(url).hostname;
if (!["127.0.0.1", "localhost", "::1"].includes(host) && !process.argv.includes("--force")) {
  throw new Error(`Refusing to seed ${host}: demo data is for a local database. Pass --force to override.`);
}

const DOMAIN = "demo.qazbot.test";
const sql = postgres(url, { prepare: false, max: 1 });

// "Today" in the team's zone, as plain YYYY-MM-DD; offsets are whole days from it.
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: process.env.APP_TIMEZONE ?? "Asia/Almaty",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const day = (offset) => {
  if (offset === null || offset === undefined) return null;
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

const PEOPLE = [
  { key: "aigerim", name: "Aigerim Sadykova" },
  { key: "daniyar", name: "Daniyar Kenzhebekov" },
  { key: "madina", name: "Madina Tulegenova" },
  { key: "arman", name: "Arman Bekov" },
  { key: "dana", name: "Dana Zhunusova" },
  { key: "timur", name: "Timur Omarov" },
];

// Each card: [column, title, start offset, due offset, tags, assignees, description?].
// Assignee "me" is the first real (non-demo) user, if there is one.
const BOARDS = [
  {
    name: "Hotel reception rollout",
    owner: "aigerim",
    columns: ["Backlog", "To do", "In progress", "Review", "Done"],
    tags: [
      ["Hardware", "sky"],
      ["Software", "violet"],
      ["Client", "gold"],
      ["Blocker", "red"],
    ],
    cards: [
      ["Done", "Site survey at the hotel lobby", -20, -16, ["Client"], ["aigerim", "arman"], "Measure Wi-Fi coverage, floor type and charging spot."],
      ["Done", "Boot autostart on X2 Ultra", -14, -10, ["Software"], ["daniyar"]],
      ["Done", "Passport scanner mount", -12, -7, ["Hardware"], ["arman"]],
      ["Review", "Check-in dialog script (RU / KZ / EN)", -8, -1, ["Software", "Client"], ["madina", "me"], "Greeting, booking lookup, room handover. Needs sign-off from the hotel manager."],
      ["Review", "Passport OCR accuracy test", -5, 1, ["Software"], ["daniyar"]],
      ["In progress", "Lobby navigation map", -6, 2, ["Software"], ["timur", "me"]],
      ["In progress", "Charging dock install", -3, 0, ["Hardware", "Blocker"], ["arman"], "Waiting on a second power outlet from hotel maintenance."],
      ["In progress", "Staff training session", 1, 3, ["Client"], ["aigerim"]],
      ["To do", "Barge-in tuning for a noisy lobby", 2, 6, ["Software"], ["madina"]],
      ["To do", "Fallback to front-desk staff", null, 8, ["Software"], ["daniyar", "me"]],
      ["To do", "Go-live checklist", 9, 12, ["Client"], ["aigerim", "me"]],
      ["Backlog", "Room-service upsell flow", null, null, ["Software"], []],
      ["Backlog", "Guest satisfaction survey on screen", null, null, ["Client"], ["madina"]],
    ],
  },
  {
    name: "Voice & language",
    owner: "madina",
    columns: ["To do", "In progress", "Done"],
    tags: [
      ["TTS", "violet"],
      ["STT", "sky"],
      ["Kazakh", "green"],
      ["Latency", "orange"],
    ],
    cards: [
      ["Done", "Wake word model v2", -18, -11, ["STT"], ["daniyar"]],
      ["Done", "Russian voice A/B test", -9, -4, ["TTS"], ["madina", "dana"]],
      ["In progress", "Kazakh TTS voice tuning", -4, 1, ["TTS", "Kazakh"], ["madina"], "Compare two voices with native speakers; fix stress on place names."],
      ["In progress", "First-token latency under 600 ms", -7, -2, ["Latency"], ["daniyar", "me"], "Currently ~850 ms on the interaction unit. Try streaming LLM output into TTS."],
      ["In progress", "Wake word false positives on TV audio", -2, 4, ["STT"], ["timur"]],
      ["To do", "Code-switching RU ↔ KZ in one sentence", 3, 10, ["STT", "Kazakh"], ["madina"]],
      ["To do", "Offline STT fallback", null, 14, ["STT", "Latency"], ["daniyar"]],
      ["To do", "Glossary of hotel terms", null, 5, ["Kazakh"], ["dana", "me"]],
      ["To do", "Voice for kids' mode", null, null, ["TTS"], []],
    ],
  },
  {
    name: "Robot fleet",
    owner: "arman",
    columns: ["To do", "In progress", "Done"],
    tags: [
      ["X2 Ultra", "sky"],
      ["A2", "pink"],
      ["Maintenance", "slate"],
      ["Urgent", "red"],
    ],
    cards: [
      ["Done", "Firmware update on all units", -10, -8, ["Maintenance"], ["arman"]],
      ["In progress", "OmniHand grip calibration", -5, -3, ["X2 Ultra", "Urgent"], ["arman", "timur"], "Left hand drifts after ~2 hours. Recalibrate both hands before the demo."],
      ["In progress", "A2 battery health report", -1, 2, ["A2", "Maintenance"], ["timur"]],
      ["To do", "Spare battery packs order", null, 4, ["Maintenance"], ["aigerim"]],
      ["To do", "Gamepad binds for dance mode", 4, 7, ["X2 Ultra"], ["dana"]],
      ["To do", "Eye-tracking demo video", 6, 9, ["A2"], ["dana", "me"]],
      ["To do", "Ship unit #3 to Astana", 10, 15, ["X2 Ultra"], ["arman"]],
      ["To do", "Remote teleop access audit", null, null, ["Maintenance"], []],
    ],
  },
];

// Demo expenses in tenge, by days before today, so the expenses page has several months of data.
// [daysAgo, vendor, description, category, amount, by]
const EXPENSES = [
  [290, "Kaspi Magazin", "Jetson Orin dev kit", "Hardware", 1_250_000, "arman"],
  [284, "OpenRouter", "LLM credits", "Software", 98_000, "daniyar"],
  [271, "Air Astana", "Flight to Shanghai (AgiBot)", "Travel", 410_000, "aigerim"],
  [265, "Technodom", "Monitors x2", "Office", 360_000, "madina"],
  [257, "Vercel", "Pro plan", "Software", 24_000, "daniyar"],
  [248, "Instagram Ads", "Expo campaign", "Marketing", 150_000, "madina"],
  [235, "Sulpak", "Router + switches", "Hardware", 185_000, "arman"],
  [222, "Hilton Astana", "Hotel, client demo", "Travel", 210_000, "aigerim"],
  [211, "Supabase", "Team plan", "Software", 12_500, "daniyar"],
  [202, "AgiBot", "X2 Ultra spare actuators", "Hardware", 2_900_000, "arman"],
  [190, "Coworking Hub", "Desk rent", "Office", 120_000, "madina"],
  [177, "Soniox", "STT usage", "Software", 45_000, "daniyar"],
  [165, "PrintPro", "Expo banners", "Marketing", 88_000, "madina"],
  [152, "Yandex Go", "Taxi, robot transport", "Travel", 32_000, "arman"],
  [140, "Coworking Hub", "Desk rent", "Office", 120_000, "madina"],
  [128, "Legal Partners", "Contract review", "Services", 300_000, "aigerim"],
  [112, "Kaspi Magazin", "Batteries", "Hardware", 76_000, "arman"],
  [90, "OpenRouter", "LLM credits", "Software", 110_000, "daniyar"],
  [77, "Air Astana", "Almaty ↔ Astana", "Travel", 95_000, "aigerim"],
  [64, "Figma", "Seats", "Software", 36_000, "daniyar"],
  [54, "Technodom", "Laptop", "Hardware", 890_000, "arman"],
  [37, "Accountant LLP", "Q3 bookkeeping", "Services", 180_000, "aigerim"],
  [25, "Coworking Hub", "Desk rent", "Office", 120_000, "madina"],
  [12, "Meta Ads", "Hotel reception launch", "Marketing", 220_000, "madina"],
  [4, "OpenRouter", "LLM credits", "Software", 105_000, "daniyar"],
];

const ids = await sql.begin(async (tx) => {
  // Remove the previous demo run. Boards they created cascade to columns, cards and tags.
  const old = await tx`select id from auth.users where email like ${"%@" + DOMAIN}`;
  if (old.length) {
    const oldIds = old.map((r) => r.id);
    await tx`delete from board where created_by in ${tx(oldIds)}`;
    await tx`delete from expense where created_by in ${tx(oldIds)}`;
    await tx`delete from auth.users where id in ${tx(oldIds)}`;
  }

  const people = {};
  for (const p of PEOPLE) {
    const email = `${p.key}@${DOMAIN}`;
    const [u] = await tx`
      insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at,
                              raw_app_meta_data, raw_user_meta_data)
      values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
              ${email}, now(), now(), now(), '{}'::jsonb, '{}'::jsonb)
      returning id`;
    await tx`insert into profile (id, email, name, role) values (${u.id}, ${email}, ${p.name}, 'member')`;
    people[p.key] = u.id;
  }
  const [me] = await tx`select id from profile where email not like ${"%@" + DOMAIN} order by created_at limit 1`;
  if (me) people.me = me.id;

  let cardCount = 0;
  for (const b of BOARDS) {
    const [board] = await tx`insert into board (name, created_by) values (${b.name}, ${people[b.owner]}) returning id`;
    const colIds = {};
    for (const [i, name] of b.columns.entries()) {
      const [c] = await tx`
        insert into "column" (board_id, name, position, is_done)
        values (${board.id}, ${name}, ${i}, ${name === "Done"}) returning id`;
      colIds[name] = c.id;
    }
    const tagIds = {};
    for (const [name, color] of b.tags) {
      const [t] = await tx`insert into tag (board_id, name, color) values (${board.id}, ${name}, ${color}) returning id`;
      tagIds[name] = t.id;
    }
    const positions = {};
    for (const [col, title, start, due, tags, who, description = ""] of b.cards) {
      const position = (positions[col] = (positions[col] ?? -1) + 1);
      const [card] = await tx`
        insert into card (board_id, column_id, title, description, start_date, due_date, position)
        values (${board.id}, ${colIds[col]}, ${title}, ${description}, ${day(start)}, ${day(due)}, ${position})
        returning id`;
      for (const t of tags) await tx`insert into card_tag (card_id, tag_id) values (${card.id}, ${tagIds[t]})`;
      for (const p of who) {
        if (people[p]) await tx`insert into card_assignee (card_id, profile_id) values (${card.id}, ${people[p]})`;
      }
      cardCount++;
    }
  }
  for (const [ago, vendor, description, category, amount, by] of EXPENSES) {
    await tx`
      insert into expense (date, vendor, description, category, amount, created_by)
      values (${day(-ago)}, ${vendor}, ${description}, ${category}, ${amount}, ${people[by]})`;
  }
  return { people: PEOPLE.length, boards: BOARDS.length, cards: cardCount, expenses: EXPENSES.length, me: !!me };
});

console.log(
  `Seeded ${ids.people} demo teammates, ${ids.boards} boards, ${ids.cards} cards and ${ids.expenses} expenses around ${today}.` +
    (ids.me ? " Some cards are assigned to you." : " No real user yet, so nothing is assigned to you."),
);
await sql.end();
