// Seed content for quizzes and condition checklists, in the format of A's labpass_schema.sql.
// Owner: Member B. A loads it into the database with the seed script (or with seed-quiz-and-checklists.sql).
// All content is fictional demo data for "Northfield Institute of Technology".
//
// A's format:
//   quizzes.questions  jsonb array of { id, text, options, answer }, where answer is the correct option's text.
//                      submit_quiz compares the student's chosen option with `answer`.
//   quizzes.pass_mark  percentage: 4 of 5 = 80.
//   quizzes            one row per resource (resource_id is unique).
//   resources.checklist jsonb array of text items.

export type QuizQuestion = {
  id: string;
  text: string;
  options: string[];
  answer: string; // must be exactly one of `options`
};

export type Quiz = {
  pass_mark: number; // percentage
  questions: QuizQuestion[];
};

// The general lab-safety questions (FR-07: 5 questions, pass mark 4/5).
export const SAFETY_QUESTIONS: QuizQuestion[] = [
  {
    id: "q1",
    text: "Before using any equipment, what should you do first?",
    options: [
      "Start it and see if it works",
      "Check its condition and complete the check-in checklist",
      "Ask a friend to hold it",
      "Skip the checklist if you are in a hurry",
    ],
    answer: "Check its condition and complete the check-in checklist",
  },
  {
    id: "q2",
    text: "You notice a frayed power cable at check-in. What do you do?",
    options: [
      "Use it carefully",
      "Tape it and continue",
      "Do not use it; report an issue with a photo",
      "Return it later without saying anything",
    ],
    answer: "Do not use it; report an issue with a photo",
  },
  {
    id: "q3",
    text: "Who may operate Tier 3 equipment such as the laser cutter?",
    options: [
      "Any student",
      "Only students with a confirmed staff or peer supervisor present",
      "Anyone who has watched a video",
      "Students with more than 5 credits",
    ],
    answer: "Only students with a confirmed staff or peer supervisor present",
  },
  {
    id: "q4",
    text: "You will be 20 minutes late to return a booking. What should you do?",
    options: [
      "Nothing, it is only 20 minutes",
      "Return it whenever convenient",
      "Contact the lab manager and return it as soon as possible",
      "Give it to another student to return",
    ],
    answer: "Contact the lab manager and return it as soon as possible",
  },
  {
    id: "q5",
    text: "Something breaks while you are using it. What is the right step?",
    options: [
      "Stop, make it safe, and report the incident with photos",
      "Hide the damage",
      "Try to repair it yourself",
      "Keep using it if it still works",
    ],
    answer: "Stop, make it safe, and report the incident with photos",
  },
];

// One quiz per Tier 1 resource (the quiz is what unlocks Tier 1).
// Seminar room is Tier 0 (no quiz). 3D printer (Tier 2) and laser cutter (Tier 3)
// are unlocked by a certificate, supervision or graduation, not by the quiz.
// Keys must match resources.name in A's seed data.
export const QUIZZES: Record<string, Quiz> = {
  Oscilloscope: { pass_mark: 80, questions: SAFETY_QUESTIONS },
  DSLR: { pass_mark: 80, questions: SAFETY_QUESTIONS },
  "Robotics lab": { pass_mark: 80, questions: SAFETY_QUESTIONS },
};

// Condition checklists per demo resource (resources.checklist).
// The check-in and return reports must tick every item (A's _report_problem checks this).
export const CHECKLISTS: Record<string, string[]> = {
  "Seminar room": [
    "Projector and screen working",
    "Chairs and tables arranged",
    "Whiteboard clean, markers present",
    "No damage or litter",
  ],
  "Robotics lab": [
    "Workbenches clear",
    "Tools returned to their racks",
    "Power supplies switched off",
    "No damage to kits or benches",
  ],
  Oscilloscope: [
    "Powers on and self-test passes",
    "Both probes present and undamaged",
    "Screen free of cracks",
    "Power cable intact",
  ],
  DSLR: [
    "Body and lens free of scratches",
    "Battery charged and present",
    "Memory card present",
    "Lens cap and strap present",
  ],
  "3D printer": [
    "Build plate clean",
    "Nozzle not clogged",
    "Filament spool loaded and sufficient",
    "Enclosure and frame undamaged",
  ],
  "Laser cutter": [
    "Supervisor present and co-signing",
    "Extraction fan running",
    "Lens and bed clean",
    "Emergency stop tested",
    "Only approved materials loaded",
  ],
};
