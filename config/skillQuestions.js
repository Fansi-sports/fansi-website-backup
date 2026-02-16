// backend/config/skillQuestions.js

function normalizeAnswer(s = "") {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
}

// Keep in sync with frontend ids (ids + answers must match)
const QUESTIONS = [
  // ---------------- FOOTBALL (5) ----------------
  { id: "fb-easy-001", answers: ["11", "eleven"] },
  { id: "fb-easy-002", answers: ["red", "redcard", "red card"] },
  { id: "fb-easy-003", answers: ["hattrick", "hat trick", "hat-trick"] },
  { id: "fb-easy-004", answers: ["90", "ninety", "90minutes", "90 minutes"] },
  { id: "fb-easy-005", answers: ["3", "three"] },

  // ---------------- RUGBY (5) ----------------
  { id: "ru-easy-001", answers: ["15", "fifteen"] },
  { id: "ru-easy-002", answers: ["5", "five"] },
  { id: "ru-easy-003", answers: ["lineout", "line out"] },
  { id: "ru-easy-004", answers: ["scrum"] },
  { id: "ru-easy-005", answers: ["3", "three"] },

  // ---------------- TENNIS (5) ----------------
  { id: "te-easy-001", answers: ["40", "forty"] },
  { id: "te-easy-002", answers: ["deuce"] },
  {
    id: "te-easy-003",
    answers: ["racket", "racquet", "tennisracket", "tennisracquet", "tennis racket", "tennis racquet"],
  },
  { id: "te-easy-004", answers: ["ace"] },
  { id: "te-easy-005", answers: ["love"] },

  // ---------------- GOLF (5) ----------------
  { id: "go-easy-001", answers: ["18", "eighteen"] },
  { id: "go-easy-002", answers: ["birdie"] },
  { id: "go-easy-003", answers: ["putter"] },
  { id: "go-easy-004", answers: ["holeinone", "hole in one", "ace"] },
  { id: "go-easy-005", answers: ["eagle"] },

  // ---------------- F1 (5) ----------------
  { id: "f1-easy-001", answers: ["formula1", "formula 1", "formula one"] },
  { id: "f1-easy-002", answers: ["25", "twentyfive", "twenty five"] },
  { id: "f1-easy-003", answers: ["pitstop", "pit stop"] },
  { id: "f1-easy-004", answers: ["qualifying", "quali"] },
  { id: "f1-easy-005", answers: ["safetycar", "safety car"] },
];

function isCorrectAnswer(questionId, typedAnswer) {
  const qid = String(questionId || "").trim();
  const typed = normalizeAnswer(typedAnswer || "");
  if (!qid || !typed) return false;

  const row = QUESTIONS.find((x) => x.id === qid);
  if (!row) return false;

  const normalizedAnswers = (row.answers || []).map((x) => normalizeAnswer(x));
  return normalizedAnswers.includes(typed);
}

module.exports = { isCorrectAnswer };
