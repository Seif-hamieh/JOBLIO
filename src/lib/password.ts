// Password strength, shared by the sign-up / reset / change-password forms
// (the meter) and the server (which rejects weak passwords). Rule-based.

export const MIN_PASSWORD = 10;

export type PasswordProblem = "tooShort" | "common" | "repeated" | "sequence" | "personal";
export type PasswordLevel = "weak" | "medium" | "strong";

// Frequently leaked passwords and patterns that satisfy a 10-character minimum.
const COMMON = new Set([
  "password", "password1", "password12", "password123", "password1234", "passw0rd", "p@ssw0rd", "p@ssword1",
  "qwertyuiop", "qwerty1234", "qwerty12345", "qwerty123456", "1q2w3e4r5t", "1q2w3e4r5t6y", "q1w2e3r4t5", "zaq12wsxcde",
  "asdfghjkl", "asdfghjkl1", "zxcvbnm123", "iloveyou12", "iloveyou123", "letmein123", "welcome123", "welcome1234",
  "admin12345", "administrator", "football12", "baseball12", "princess12", "sunshine12", "monkey1234", "dragon1234",
  "1234567890", "0987654321", "12345678910", "123456789a", "a123456789", "abc1234567", "abcd123456", "qwerty",
  "changeme123", "trustno1234", "superman12", "batman1234", "starwars12", "computer12", "internet12", "joblio123",
  "joblio1234", "joblio12345",
]);

const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm", "1234567890", "abcdefghijklmnopqrstuvwxyz", "0987654321"];

/** True when the whole password walks one keyboard row or the alphabet / digits, forwards or backwards. */
function isSequence(pw: string) {
  const s = pw.toLowerCase();
  if (s.length < 4) return false;
  return ROWS.some((row) => {
    const back = [...row].reverse().join("");
    // Allow the run to wrap (e.g. "7890123456").
    return (row + row).includes(s) || (back + back).includes(s);
  });
}

export function assessPassword(pw: string, personal: (string | null | undefined)[] = []): { score: number; level: PasswordLevel; problem: PasswordProblem | null } {
  const lower = pw.toLowerCase();
  let problem: PasswordProblem | null = null;
  if (pw.length < MIN_PASSWORD) problem = "tooShort";
  else if (COMMON.has(lower) || COMMON.has(lower.replace(/[!@#$%^&*.?_-]+$/, ""))) problem = "common";
  else if (/^(.)\1+$/.test(pw) || new Set(lower).size <= 2) problem = "repeated";
  else if (isSequence(pw)) problem = "sequence";
  else {
    const parts = personal
      .flatMap((p) => (p ?? "").toLowerCase().split(/[\s@._-]+/))
      .filter((p) => p.length >= 4);
    // Mostly made of the person's own name / email parts (e.g. "mayachen2026").
    let rest = lower;
    for (const part of parts) rest = rest.split(part).join("");
    if (rest !== lower && rest.length < 6) problem = "personal";
  }

  let score = 0;
  if (pw.length >= MIN_PASSWORD) score++;
  if (pw.length >= 14) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  else if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) score += 0.5;
  if (new Set(lower).size >= 8) score += 0.5;
  if (problem) score = Math.min(score, 1);
  score = Math.min(4, Math.floor(score));
  const level: PasswordLevel = problem || score <= 1 ? "weak" : score === 2 ? "medium" : "strong";
  return { score, level, problem };
}
