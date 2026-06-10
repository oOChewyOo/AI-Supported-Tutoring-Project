import { PracticeSession, Student } from "@/lib/types";

export const students: Student[] = [
  {
    id: "maya-patel",
    name: "Maya Patel",
    yearGroup: "Year 6",
    subjectFocus: "English",
    interests: ["Space", "Drawing", "Mysteries"],
    strengths: ["Creative ideas", "Vocabulary", "Verbal reasoning"],
    needsPractice: ["Inference", "Using evidence", "Paragraph structure"],
  },
  {
    id: "leo-hughes",
    name: "Leo Hughes",
    yearGroup: "Year 5",
    subjectFocus: "Maths",
    interests: ["Football", "Robotics", "Cooking"],
    strengths: ["Mental arithmetic", "Pattern spotting"],
    needsPractice: ["Fractions", "Explaining methods", "Word problems"],
  },
  {
    id: "amina-yusuf",
    name: "Amina Yusuf",
    yearGroup: "Year 8",
    subjectFocus: "Science",
    interests: ["Nature", "Photography", "Music"],
    strengths: ["Recall", "Practical investigations"],
    needsPractice: ["Scientific writing", "Interpreting graphs"],
  },
];

export const weeklySessions: PracticeSession[] = [
  {
    day: "Monday",
    title: "Warm up the memory",
    focus: "Recall the key ideas while they are still fresh.",
    activities: [
      { title: "Key idea flashcards", type: "Flashcards", minutes: 4, description: "Review six ideas from the lesson." },
      { title: "Fast five", type: "Quick quiz", minutes: 5, description: "Answer five short retrieval questions." },
      { title: "Confidence check", type: "Sort & match", minutes: 6, description: "Sort ideas into got it, unsure, and revisit." },
    ],
  },
  {
    day: "Tuesday",
    title: "Spot the connection",
    focus: "Link new learning to examples and prior knowledge.",
    activities: [
      { title: "Match it up", type: "Sort & match", minutes: 5, description: "Pair each idea with the best example." },
      { title: "Complete the thought", type: "Fill the gap", minutes: 5, description: "Use lesson vocabulary to finish each sentence." },
      { title: "One-minute explain", type: "Fluency check", minutes: 5, description: "Explain one tricky idea in your own words." },
    ],
  },
  {
    day: "Wednesday",
    title: "Use it in context",
    focus: "Apply the learning in a short, meaningful task.",
    activities: [
      { title: "Read and notice", type: "Mini read", minutes: 5, description: "Read a short example and highlight useful clues." },
      { title: "Choose your evidence", type: "Quick quiz", minutes: 5, description: "Select the strongest evidence for each answer." },
      { title: "Make the link", type: "Fill the gap", minutes: 5, description: "Complete three explanation sentences." },
    ],
  },
  {
    day: "Thursday",
    title: "Strengthen the tricky bit",
    focus: "Slow down and practise the part that needs attention.",
    activities: [
      { title: "Common mix-ups", type: "Sort & match", minutes: 4, description: "Sort correct examples from common mistakes." },
      { title: "Guided practice", type: "Fill the gap", minutes: 6, description: "Complete a scaffolded practice task." },
      { title: "Try it solo", type: "Fluency check", minutes: 5, description: "Complete one similar task independently." },
    ],
  },
  {
    day: "Friday",
    title: "Show what you know",
    focus: "Bring the week together and reflect on progress.",
    activities: [
      { title: "Weekly challenge", type: "Quick quiz", minutes: 6, description: "Complete a mixed review of the week's learning." },
      { title: "Teach it back", type: "Fluency check", minutes: 5, description: "Explain the main idea as if teaching someone else." },
      { title: "Ready for next time", type: "Flashcards", minutes: 4, description: "Rate confidence and choose one tutor question." },
    ],
  },
];

export function getStudent(id: string) {
  return students.find((student) => student.id === id) ?? students[0];
}
