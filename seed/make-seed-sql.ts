// Builds seed-quiz-and-checklists.sql from quiz-and-checklists.ts, so the SQL never drifts from the TS.
// Run: npx tsx seed/make-seed-sql.ts > seed/seed-quiz-and-checklists.sql
import { QUIZZES, CHECKLISTS, type Quiz } from "./quiz-and-checklists";

const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;
const json = (v: unknown) => `${lit(JSON.stringify(v))}::jsonb`;

function check(name: string, quiz: Quiz) {
  for (const q of quiz.questions) {
    if (!q.options.includes(q.answer)) throw new Error(`${name} ${q.id}: answer is not one of the options`);
  }
  if (quiz.pass_mark < 0 || quiz.pass_mark > 100) throw new Error(`${name}: pass_mark must be 0–100`);
}

const out: string[] = [
  "-- LabPass seed: condition checklists and Tier 1 safety quizzes (Member B).",
  "-- Generated from quiz-and-checklists.ts. Run after A's seed has created the resources.",
  "-- Matches resources by name; a resource that doesn't exist yet is skipped.",
  "begin;",
  "",
  "-- Checklists",
];

for (const [name, items] of Object.entries(CHECKLISTS)) {
  out.push(`update public.resources set checklist = ${json(items)} where name = ${lit(name)};`);
}

out.push("", "-- Quizzes (one per Tier 1 resource; pass mark is a percentage, 80 = 4 of 5)");
for (const [name, quiz] of Object.entries(QUIZZES)) {
  check(name, quiz);
  out.push(
    `insert into public.quizzes(resource_id, questions, pass_mark)`,
    `select id, ${json(quiz.questions)}, ${quiz.pass_mark} from public.resources where name = ${lit(name)}`,
    `on conflict (resource_id) do update set questions = excluded.questions, pass_mark = excluded.pass_mark;`,
  );
}

out.push("", "commit;", "");
process.stdout.write(out.join("\n"));
