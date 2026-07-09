/**
 * A reusable catalogue of educational activity structures.
 *
 * The activity templates below are sourced from docs/activity-templates-source.csv.
 * Future AI generation should select a suitable template from this library,
 * then supply the requested inputs and populate the declared output format.
 * Keeping selection separate from content generation makes generated
 * activities more consistent and easier to validate.
 */

export const SUBJECT_AREAS = [
  "Phonics",
  "Reading",
  "Times Tables",
  "Arithmetic",
  "Writing",
] as const;

export type SubjectArea = (typeof SUBJECT_AREAS)[number];

export const DELIVERY_METHODS = [
  "Using my previously made times table app",
  "Hit the Button style game",
  "Worksheet",
  "Interactive activity",
  "Quiz",
  "External app",
  "Tutor-led",
  "Parent-led",
  "Audio",
  "Physical cards",
  "Discussion",
  "Game",
  "Practical task",
] as const;

export type DeliveryMethod = (typeof DELIVERY_METHODS)[number];

export const YEAR_GROUPS = [
  "Reception",
  "Year 1",
  "Year 2",
  "Year 3",
  "Year 4",
  "Year 5",
  "Year 6",
  "Year 7",
] as const;

export type YearGroup = (typeof YEAR_GROUPS)[number];

export type ActivityOutputFormat =
  | "question_set"
  | "word_list"
  | "matching_pairs"
  | "sorting_groups"
  | "sentence_set"
  | "worked_example_and_questions"
  | "practical_task"
  | "timed_question_set";

export interface ActivityTemplate {
  template_id: string;
  activity_name: string;
  subject: SubjectArea;
  skill_area: string;
  activity_type: string;
  delivery_methods: readonly DeliveryMethod[];
  typical_year_groups: readonly YearGroup[];
  estimated_minutes: number;
  purpose: string;
  when_to_use: string;
  inputs_needed_from_ai: readonly string[];
  output_structure: string;
  output_format: ActivityOutputFormat;
  difficulty_controls: string;
  example_activity: string;
  success_criteria: string;
  notes: string;
}

export interface ActivityQuestion {
  prompt: string;
  answer?: string;
}

export interface QuestionSetPayload {
  questions: readonly ActivityQuestion[];
}

export interface WordListPayload {
  words: readonly string[];
}

export interface MatchingPairsPayload {
  pairs: readonly {
    left: string;
    right: string;
  }[];
}

export interface SortingGroupsPayload {
  groups: readonly {
    label: string;
    items: readonly string[];
  }[];
}

export interface SentenceSetPayload {
  sentences: readonly string[];
}

export interface WorkedExampleAndQuestionsPayload {
  worked_example: {
    steps: readonly string[];
    answer?: string;
  };
  questions: readonly ActivityQuestion[];
}

export interface PracticalTaskPayload {
  resources: readonly string[];
  steps: readonly string[];
  questions: readonly ActivityQuestion[];
}

export interface TimedQuestionSetPayload {
  time_limit_seconds: number;
  questions: readonly ActivityQuestion[];
}

export type ActivityPayload =
  | QuestionSetPayload
  | WordListPayload
  | MatchingPairsPayload
  | SortingGroupsPayload
  | SentenceSetPayload
  | WorkedExampleAndQuestionsPayload
  | PracticalTaskPayload
  | TimedQuestionSetPayload;

type GeneratedActivityContentFor<
  OutputFormat extends ActivityOutputFormat,
  Payload extends ActivityPayload,
> = {
  schema_version: 1;
  output_format: OutputFormat;
  instructions: string;
  delivery_method: DeliveryMethod;
  payload: Payload;
};

/**
 * Structured content stored for a generated activity. The top-level
 * `output_format` discriminates the payload shape so future generation and
 * rendering code can validate content before using it.
 */
export type GeneratedActivityContent =
  | GeneratedActivityContentFor<"question_set", QuestionSetPayload>
  | GeneratedActivityContentFor<"word_list", WordListPayload>
  | GeneratedActivityContentFor<"matching_pairs", MatchingPairsPayload>
  | GeneratedActivityContentFor<"sorting_groups", SortingGroupsPayload>
  | GeneratedActivityContentFor<"sentence_set", SentenceSetPayload>
  | GeneratedActivityContentFor<"worked_example_and_questions", WorkedExampleAndQuestionsPayload>
  | GeneratedActivityContentFor<"practical_task", PracticalTaskPayload>
  | GeneratedActivityContentFor<"timed_question_set", TimedQuestionSetPayload>;

export interface CrossSubjectActivityType {
  activity_type: string;
  reusable_in: readonly SubjectArea[];
  adaptation_note: string;
}

/**
 * Add future templates to this array by updating docs/activity-templates-source.csv,
 * then refreshing this library from the source data. An AI-facing selector can
 * later filter by subject, skill area, year group, time available, delivery
 * method, and technical output format before asking a model to fill
 * `inputs_needed_from_ai`.
 */
export const ACTIVITY_TEMPLATES = [
  {
    template_id: "phonics_read_words",
    activity_name: "Read words",
    subject: "Phonics",
    skill_area: "Decoding and grapheme recognition",
    activity_type: "Read words",
    delivery_methods: ["Worksheet", "Quiz", "Interactive activity"],
    typical_year_groups: [],
    estimated_minutes: 5,
    purpose: "Build fluency reading words containing a target sound or spelling pattern.",
    when_to_use: "Use after the tutor has introduced or revisited a grapheme and the student needs quick decoding practice.",
    inputs_needed_from_ai: ["Target grapheme(s)", "word difficulty", "year group", "optional theme/interests"],
    output_structure: "A short list of 8–12 words grouped by target sound, with a simple instruction to read aloud or tick when read.",
    output_format: "word_list",
    difficulty_controls: "Easy: common CVC/CVCC words. Medium: longer words. Hard: mixed graphemes or less familiar vocabulary.",
    example_activity: "Read these ay words aloud: play, tray, day, stay, spray, crayon, holiday, display.",
    success_criteria: "Student reads most words accurately and can correct errors after prompting.",
    notes: "Good quick warm-up or retrieval task.",
  },
  {
    template_id: "phonics_spell_picture",
    activity_name: "Spell words from picture",
    subject: "Phonics",
    skill_area: "Encoding from visual prompt",
    activity_type: "Spell words from picture",
    delivery_methods: ["Worksheet", "Interactive activity"],
    typical_year_groups: [],
    estimated_minutes: 5,
    purpose: "Support spelling by linking a picture prompt to a word containing the target sound.",
    when_to_use: "Use when the student can recognise the sound but needs encoding practice without full dictation.",
    inputs_needed_from_ai: ["Target grapheme(s)", "pictureable word list", "year group"],
    output_structure: "A set of picture prompts with blank lines for spelling the word.",
    output_format: "question_set",
    difficulty_controls: "Easy: single-syllable words. Hard: two-syllable words or mixed target spellings.",
    example_activity: "Look at the picture of a snail. Write the word: ______. Look at the picture of a tray. Write the word: ______.",
    success_criteria: "Student spells target words with the correct grapheme in most cases.",
    notes: "Images may need to be represented by emojis/labels until real image generation exists.",
  },
  {
    template_id: "phonics_spell_dictation",
    activity_name: "Spell the word from dictation",
    subject: "Phonics",
    skill_area: "Encoding from hearing",
    activity_type: "Spell the word from dictation",
    delivery_methods: ["Tutor-led", "Parent-led", "Audio", "Worksheet"],
    typical_year_groups: [],
    estimated_minutes: 5,
    purpose: "Practise hearing a word and selecting the correct spelling pattern.",
    when_to_use: "Use when the student can read words but needs spelling fluency and auditory discrimination.",
    inputs_needed_from_ai: ["Target grapheme(s)", "word list", "include sentence or word-only dictation"],
    output_structure: "List of words/sentences for audio to read, plus writing spaces for student.",
    output_format: "word_list",
    difficulty_controls: "Easy: word-only. Medium: short phrases. Hard: full sentences with mixed graphemes.",
    example_activity: "Adult says: “play”. Student writes: ______. Adult says: “The rain fell today.” Student writes the full sentence.",
    success_criteria: "Student uses the target grapheme accurately and forms a readable spelling.",
    notes: "Useful future voice/audio feature candidate.",
  },
  {
    template_id: "phonics_sound_cards",
    activity_name: "Spell the word using sound cards",
    subject: "Phonics",
    skill_area: "Segmenting and blending",
    activity_type: "Spell the word using sound cards",
    delivery_methods: ["Interactive activity", "Physical cards", "Tutor-led"],
    typical_year_groups: [],
    estimated_minutes: 7,
    purpose: "Help the student construct words by selecting and ordering sound cards.",
    when_to_use: "Use for students who benefit from manipulatives or need support segmenting sounds.",
    inputs_needed_from_ai: ["Target word list", "available sound cards/graphemes", "level of scaffolding"],
    output_structure: "For each word, provide the sound cards needed and ask the student to build the word.",
    output_format: "question_set",
    difficulty_controls: "Easy: provide only needed cards. Hard: include distractor cards.",
    example_activity: "Build the word “chain” using these cards: ch / ai / n / sh / ay.",
    success_criteria: "Student selects the right sound cards in order and reads the completed word.",
    notes: "This is one of the more distinctive tutor-led activities.",
  },
  {
    template_id: "phonics_word_sort",
    activity_name: "Word sort based on sounds",
    subject: "Phonics",
    skill_area: "Grapheme discrimination",
    activity_type: "Word sort based on sounds",
    delivery_methods: ["Worksheet", "Interactive activity", "Quiz"],
    typical_year_groups: [],
    estimated_minutes: 7,
    purpose: "Help students distinguish between different spellings of the same sound.",
    when_to_use: "Use when the student is confusing related spellings such as ai/ay/a_e or air/are/ear.",
    inputs_needed_from_ai: ["Target graphemes", "number of categories", "word list size", "year group"],
    output_structure: "A sorting task with category headings and 12–18 words to sort.",
    output_format: "sorting_groups",
    difficulty_controls: "Easy: two categories. Medium: three categories. Hard: include exception/tricky words.",
    example_activity: "Sort these words into ai / ay / a_e: rain, play, cake, train, day, snake, stay, snail, make.",
    success_criteria: "Student sorts at least 80% of words correctly and can explain one choice.",
    notes: "Very useful template for AI generation.",
  },
  {
    template_id: "phonics_match_picture",
    activity_name: "Match word to picture",
    subject: "Phonics",
    skill_area: "Word recognition and meaning",
    activity_type: "Match word to picture",
    delivery_methods: ["Worksheet", "Interactive activity"],
    typical_year_groups: [],
    estimated_minutes: 5,
    purpose: "Connect decoding with meaning by matching target words to pictures.",
    when_to_use: "Use when the student can decode but needs confidence recognising words quickly.",
    inputs_needed_from_ai: ["Target words", "pictureable nouns/verbs", "year group"],
    output_structure: "A matching task with words in one column and pictures/descriptions in another.",
    output_format: "matching_pairs",
    difficulty_controls: "Easy: obvious nouns. Hard: verbs/adjectives or similar-looking words.",
    example_activity: "Match: snail, tray, cake, rain to the correct picture/description.",
    success_criteria: "Student matches words correctly and reads them aloud.",
    notes: "Can use descriptions where images are not available.",
  },
  {
    template_id: "phonics_real_fake",
    activity_name: "Sort real words and fake words",
    subject: "Phonics",
    skill_area: "Decoding unfamiliar words",
    activity_type: "Sort real and fake words",
    delivery_methods: ["Quiz", "Worksheet", "Interactive activity"],
    typical_year_groups: [],
    estimated_minutes: 5,
    purpose: "Build decoding confidence by reading both real and pseudo-words.",
    when_to_use: "Use when preparing for phonics screening-style practice or checking decoding rather than sight memory.",
    inputs_needed_from_ai: ["Target grapheme(s)", "real word count", "fake word count", "year group"],
    output_structure: "Two-column sort: real words and alien/fake words.",
    output_format: "sorting_groups",
    difficulty_controls: "Easy: simple pseudo-words. Hard: longer pseudo-words with adjacent consonants.",
    example_activity: "Sort into real/fake: play, zay, train, vail, cake, splake, day, frain.",
    success_criteria: "Student decodes pseudo-words using phonics rather than guessing.",
    notes: "Good for phonics intervention.",
  },
  {
    template_id: "phonics_fill_gap",
    activity_name: "Fill the gap",
    subject: "Phonics",
    skill_area: "Spelling in context",
    activity_type: "Fill the gap",
    delivery_methods: ["Worksheet", "Quiz", "Interactive activity"],
    typical_year_groups: [],
    estimated_minutes: 5,
    purpose: "Practise choosing or spelling the correct target word in a sentence.",
    when_to_use: "Use after word-level practice to move into sentence context.",
    inputs_needed_from_ai: ["Target grapheme(s)", "target words", "sentence difficulty", "optional theme"],
    output_structure: "Sentences with missing target words and a word bank or spelling blank.",
    output_format: "question_set",
    difficulty_controls: "Easy: word bank included. Hard: no word bank and mixed graphemes.",
    example_activity: "The dog likes to ____ in the park. (play / rain / cake)",
    success_criteria: "Student chooses/spells the correct word and reads the sentence.",
    notes: "Useful bridge from phonics to writing.",
  },
  {
    template_id: "phonics_sentence_completion",
    activity_name: "Sentence completion",
    subject: "Phonics",
    skill_area: "Using target words in sentences",
    activity_type: "Sentence completion",
    delivery_methods: ["Worksheet", "Interactive activity"],
    typical_year_groups: [],
    estimated_minutes: 7,
    purpose: "Encourage students to use target spelling words meaningfully in a sentence.",
    when_to_use: "Use when the student can spell words individually and needs sentence-level practice.",
    inputs_needed_from_ai: ["Target word list", "sentence starters", "writing support level"],
    output_structure: "Sentence starters requiring the student to complete using target words.",
    output_format: "sentence_set",
    difficulty_controls: "Easy: choose from word bank. Hard: write own sentence independently.",
    example_activity: "Complete: I like to play _____. The rain _____.",
    success_criteria: "Student completes sentences sensibly and spells target words correctly.",
    notes: "Good for combining phonics and writing.",
  },
  {
    template_id: "reading_retrieval",
    activity_name: "Retrieval questions",
    subject: "Reading",
    skill_area: "Literal comprehension",
    activity_type: "Retrieval questions",
    delivery_methods: ["Worksheet", "Quiz", "Interactive activity"],
    typical_year_groups: [],
    estimated_minutes: 7,
    purpose: "Practise finding explicitly stated information in a text.",
    when_to_use: "Use when checking basic understanding before inference or explanation.",
    inputs_needed_from_ai: ["Short text", "reading age", "number of questions", "topic/interest"],
    output_structure: "Text followed by 3–5 literal questions.",
    output_format: "question_set",
    difficulty_controls: "Easy: answers in same sentence. Hard: answers spread across paragraph.",
    example_activity: "Question: Where did Maya put the key? Answer using the text.",
    success_criteria: "Student locates accurate information and answers in full or short responses.",
    notes: "Core comprehension template.",
  },
  {
    template_id: "reading_vocab_meaning",
    activity_name: "Vocabulary – meaning of words",
    subject: "Reading",
    skill_area: "Vocabulary in context",
    activity_type: "Vocabulary meaning",
    delivery_methods: ["Worksheet", "Quiz", "Interactive activity"],
    typical_year_groups: [],
    estimated_minutes: 7,
    purpose: "Develop understanding of unfamiliar words using context clues.",
    when_to_use: "Use when the student struggles with vocabulary or explaining word meaning.",
    inputs_needed_from_ai: ["Target words", "short text", "reading age", "options or open response"],
    output_structure: "Short extract with highlighted words and meaning questions.",
    output_format: "question_set",
    difficulty_controls: "Easy: multiple choice. Hard: explain meaning in own words.",
    example_activity: "In the sentence, “Tom was exhausted,” what does exhausted mean?",
    success_criteria: "Student identifies or explains meaning accurately using context.",
    notes: "Useful for SATs-style vocabulary practice.",
  },
  {
    template_id: "reading_vocab_synonym",
    activity_name: "Vocabulary – synonym of words",
    subject: "Reading",
    skill_area: "Vocabulary precision",
    activity_type: "Vocabulary synonym",
    delivery_methods: ["Quiz", "Worksheet"],
    typical_year_groups: [],
    estimated_minutes: 5,
    purpose: "Build vocabulary range by matching words to close synonyms.",
    when_to_use: "Use when student needs richer vocabulary or test-style vocabulary practice.",
    inputs_needed_from_ai: ["Target vocabulary", "difficulty level", "multiple choice or matching format"],
    output_structure: "A set of target words with synonym options or matching pairs.",
    output_format: "matching_pairs",
    difficulty_controls: "Easy: common words. Hard: tier 2 vocabulary and close distractors.",
    example_activity: "Choose the best synonym for astonished: tired / surprised / angry / bored.",
    success_criteria: "Student chooses appropriate synonyms and can use one in a sentence.",
    notes: "Good quick activity for 5-minute slots.",
  },
  {
    template_id: "reading_inference",
    activity_name: "Inference questions",
    subject: "Reading",
    skill_area: "Inference and evidence",
    activity_type: "Inference questions",
    delivery_methods: ["Worksheet", "Quiz", "Interactive activity"],
    typical_year_groups: [],
    estimated_minutes: 10,
    purpose: "Practise reading between the lines and using evidence from the text.",
    when_to_use: "Use when the student can retrieve facts but needs support explaining what the text suggests.",
    inputs_needed_from_ai: ["Short text", "inference focus", "reading age", "scaffold level"],
    output_structure: "Short paragraph followed by an inference question and evidence prompt.",
    output_format: "question_set",
    difficulty_controls: "Easy: obvious clues. Hard: subtle character feelings/motives.",
    example_activity: "How do you know Sam felt nervous? Use one clue from the text.",
    success_criteria: "Student makes a plausible inference and supports it with evidence.",
    notes: "One of the most important reading templates.",
  },
  {
    template_id: "reading_sequencing",
    activity_name: "Sequencing",
    subject: "Reading",
    skill_area: "Ordering events",
    activity_type: "Sequencing",
    delivery_methods: ["Worksheet", "Interactive activity"],
    typical_year_groups: [],
    estimated_minutes: 7,
    purpose: "Practise ordering events and understanding chronology.",
    when_to_use: "Use when student struggles to retell or follow events in order.",
    inputs_needed_from_ai: ["Short text", "number of events", "year group"],
    output_structure: "Text plus mixed-up event statements to number in order.",
    output_format: "sorting_groups",
    difficulty_controls: "Easy: 3 events. Hard: 5–6 events with similar details.",
    example_activity: "Number these events 1–4: The egg cracked; The bird flew; The nest was built; The chick hatched.",
    success_criteria: "Student orders events accurately and explains first/next/final.",
    notes: "Good for younger readers.",
  },
  {
    template_id: "reading_prediction",
    activity_name: "Prediction",
    subject: "Reading",
    skill_area: "Prediction from evidence",
    activity_type: "Prediction",
    delivery_methods: ["Worksheet", "Discussion", "Interactive activity"],
    typical_year_groups: [],
    estimated_minutes: 7,
    purpose: "Practise making sensible predictions based on clues.",
    when_to_use: "Use before or during a story/text to develop active reading.",
    inputs_needed_from_ai: ["Short text opening", "genre", "reading age", "prediction scaffold"],
    output_structure: "Short extract followed by prediction and evidence questions.",
    output_format: "question_set",
    difficulty_controls: "Easy: likely next event. Hard: justify with two clues.",
    example_activity: "What do you think will happen next? Which clue helped you decide?",
    success_criteria: "Student gives a plausible prediction linked to evidence.",
    notes: "Works well with story extracts.",
  },
  {
    template_id: "reading_evidence_hunt",
    activity_name: "Evidence hunt",
    subject: "Reading",
    skill_area: "Finding evidence",
    activity_type: "Evidence hunt",
    delivery_methods: ["Worksheet", "Interactive activity"],
    typical_year_groups: [],
    estimated_minutes: 7,
    purpose: "Practise locating words or phrases that support an answer.",
    when_to_use: "Use when student gives answers but does not justify them with evidence.",
    inputs_needed_from_ai: ["Short text", "target question", "number of evidence clues"],
    output_structure: "Prompt requiring student to underline/copy evidence for a claim.",
    output_format: "matching_pairs",
    difficulty_controls: "Easy: direct phrase. Hard: several possible clues across the text.",
    example_activity: "Find and copy one phrase that shows the cave was dangerous.",
    success_criteria: "Student selects relevant evidence rather than unrelated detail.",
    notes: "Pairs well with inference.",
  },
  {
    template_id: "tt_fact_recall",
    activity_name: "Fact recall",
    subject: "Times Tables",
    skill_area: "Multiplication fluency",
    activity_type: "Fact recall",
    delivery_methods: ["Quiz", "Interactive activity", "Worksheet"],
    typical_year_groups: [],
    estimated_minutes: 5,
    purpose: "Build quick recall of target multiplication facts.",
    when_to_use: "Use for fluency practice or retrieval at the start of a session.",
    inputs_needed_from_ai: ["Target table(s)", "known/unknown facts", "number of questions", "include timer yes/no"],
    output_structure: "A set of 8–12 multiplication facts.",
    output_format: "question_set",
    difficulty_controls: "Easy: one table in order. Medium: one table mixed. Hard: multiple tables mixed.",
    example_activity: "Answer: 4×6, 4×7, 4×8, 4×9, 4×12.",
    success_criteria: "Student answers accurately and improves speed over time.",
    notes: "Can later link to interactive game mode.",
  },
  {
    template_id: "tt_missing_number",
    activity_name: "Missing number",
    subject: "Times Tables",
    skill_area: "Multiplication relationships",
    activity_type: "Missing number",
    delivery_methods: ["Quiz", "Worksheet", "Interactive activity"],
    typical_year_groups: [],
    estimated_minutes: 5,
    purpose: "Strengthen understanding of multiplication facts and inverse relationships.",
    when_to_use: "Use when student can recite facts but struggles with flexible recall.",
    inputs_needed_from_ai: ["Target table(s)", "difficulty", "include multiplication/division mix"],
    output_structure: "Missing-number equations using multiplication facts.",
    output_format: "question_set",
    difficulty_controls: "Easy: ___ × 4 = 20. Hard: 7 × ___ = 56 mixed with division.",
    example_activity: "Complete: __ × 6 = 42; 8 × __ = 48; __ × 9 = 72.",
    success_criteria: "Student finds missing factors accurately.",
    notes: "Good transition to division links.",
  },
  {
    template_id: "tt_related_facts",
    activity_name: "Related facts",
    subject: "Times Tables",
    skill_area: "Derived multiplication facts",
    activity_type: "Related facts",
    delivery_methods: ["Worksheet", "Tutor-led", "Interactive activity"],
    typical_year_groups: [],
    estimated_minutes: 7,
    purpose: "Use known facts to derive harder facts.",
    when_to_use: "Use when student knows easier facts but needs strategies for harder ones.",
    inputs_needed_from_ai: ["Target table", "known facts", "strategy focus such as doubling, halving, 10x minus 1x"],
    output_structure: "Worked example followed by related practice facts.",
    output_format: "worked_example_and_questions",
    difficulty_controls: "Easy: doubling 2x to 4x. Hard: 10x - 1x, 5x + 2x.",
    example_activity: "If 5×8 = 40, then 10×8 = 80. So 9×8 = 80 - 8 = 72. Now try 9×7.",
    success_criteria: "Student explains how the new fact was derived.",
    notes: "Strongly reflects your times table pedagogy.",
  },
  {
    template_id: "tt_division_links",
    activity_name: "Division links",
    subject: "Times Tables",
    skill_area: "Multiplication and division facts",
    activity_type: "Division links",
    delivery_methods: ["Quiz", "Worksheet", "Interactive activity"],
    typical_year_groups: [],
    estimated_minutes: 5,
    purpose: "Connect multiplication facts to related division facts.",
    when_to_use: "Use when student knows times tables but struggles applying inverse division facts.",
    inputs_needed_from_ai: ["Target table(s)", "number of fact families", "difficulty"],
    output_structure: "Fact-family questions linking multiplication and division.",
    output_format: "question_set",
    difficulty_controls: "Easy: same fact family. Hard: mixed tables and missing number.",
    example_activity: "If 6×7=42, complete: 42÷6=__, 42÷7=__.",
    success_criteria: "Student recalls inverse facts without counting.",
    notes: "Supports fractions and arithmetic fluency.",
  },
  {
    template_id: "tt_timed_challenge",
    activity_name: "Timed challenge",
    subject: "Times Tables",
    skill_area: "Speed and automaticity",
    activity_type: "Timed challenge",
    delivery_methods: ["Quiz", "Interactive activity", "Game"],
    typical_year_groups: [],
    estimated_minutes: 5,
    purpose: "Build automaticity through short, focused timed practice.",
    when_to_use: "Use when facts are mostly secure and speed is the goal.",
    inputs_needed_from_ai: ["Target table(s)", "time limit", "number of questions"],
    output_structure: "Timed set of multiplication/division questions.",
    output_format: "timed_question_set",
    difficulty_controls: "Easy: 60 seconds one table. Hard: 60 seconds mixed facts.",
    example_activity: "Answer as many as you can in 60 seconds: 7×3, 7×4, 7×5...",
    success_criteria: "Student improves score or maintains accuracy under time pressure.",
    notes: "Can be delivered like Hit the Button style game later.",
  },
  {
    template_id: "arith_fluency",
    activity_name: "Fluency questions",
    subject: "Arithmetic",
    skill_area: "Calculation fluency",
    activity_type: "Fluency questions",
    delivery_methods: ["Worksheet", "Quiz", "Interactive activity"],
    typical_year_groups: [],
    estimated_minutes: 7,
    purpose: "Practise accurate calculation with a specific method or skill.",
    when_to_use: "Use after modelling a method and before problem solving.",
    inputs_needed_from_ai: ["Operation", "year group", "number range", "method focus", "number of questions"],
    output_structure: "A short set of calculation questions.",
    output_format: "question_set",
    difficulty_controls: "Easy: smaller numbers/no regrouping. Hard: larger numbers/regrouping/decimals.",
    example_activity: "Calculate: 342 + 156; 609 - 247; 24 × 3.",
    success_criteria: "Student completes calculations accurately using an efficient method.",
    notes: "Good core arithmetic template.",
  },
  {
    template_id: "arith_worked_example",
    activity_name: "Worked example",
    subject: "Arithmetic",
    skill_area: "Modelled calculation strategy",
    activity_type: "Worked example",
    delivery_methods: ["Worksheet", "Tutor-led", "Interactive activity"],
    typical_year_groups: [],
    estimated_minutes: 7,
    purpose: "Show a clear model before asking the student to try similar questions.",
    when_to_use: "Use when introducing or revisiting a method.",
    inputs_needed_from_ai: ["Skill", "method", "example numbers", "common misconception"],
    output_structure: "One worked example, one partially completed example, and one independent question.",
    output_format: "worked_example_and_questions",
    difficulty_controls: "Easy: lots of steps shown. Hard: fewer prompts and larger numbers.",
    example_activity: "Worked: 48 ÷ 4 = 12 because 40÷4=10 and 8÷4=2. Try 84÷4.",
    success_criteria: "Student follows the example and applies the method to a new question.",
    notes: "Excellent for reducing cognitive load.",
  },
  {
    template_id: "arith_error_spotting",
    activity_name: "Error spotting",
    subject: "Arithmetic",
    skill_area: "Misconception checking",
    activity_type: "Error spotting",
    delivery_methods: ["Worksheet", "Quiz", "Discussion"],
    typical_year_groups: [],
    estimated_minutes: 7,
    purpose: "Help students identify and correct common calculation mistakes.",
    when_to_use: "Use after a misconception has appeared in tutoring or completion data.",
    inputs_needed_from_ai: ["Skill", "common error", "worked incorrect example", "correct method"],
    output_structure: "Incorrect solution with prompts: find the mistake, explain it, correct it.",
    output_format: "worked_example_and_questions",
    difficulty_controls: "Easy: obvious arithmetic error. Hard: method error or multi-step reasoning.",
    example_activity: "Alex says 304 - 178 = 234. Find the mistake and correct it.",
    success_criteria: "Student explains the error and completes the correct solution.",
    notes: "Great for diagnostic practice.",
  },
  {
    template_id: "arith_independent",
    activity_name: "Independent practice",
    subject: "Arithmetic",
    skill_area: "Independent application",
    activity_type: "Independent practice",
    delivery_methods: ["Worksheet", "Quiz"],
    typical_year_groups: [],
    estimated_minutes: 10,
    purpose: "Give students independent practice after support and modelling.",
    when_to_use: "Use when the student is ready to practise without step-by-step scaffolding.",
    inputs_needed_from_ai: ["Skill", "number range", "number of questions", "challenge level"],
    output_structure: "A set of independent questions with optional challenge at end.",
    output_format: "question_set",
    difficulty_controls: "Easy: similar questions. Hard: mixed question types.",
    example_activity: "Complete independently: 36÷3, 48÷4, 84÷7, 96÷8.",
    success_criteria: "Student completes most questions without adult support.",
    notes: "Good Session 4 style activity.",
  },
  {
    template_id: "arith_word_questions",
    activity_name: "Word questions",
    subject: "Arithmetic",
    skill_area: "Applying arithmetic in context",
    activity_type: "Word questions",
    delivery_methods: ["Worksheet", "Interactive activity"],
    typical_year_groups: [],
    estimated_minutes: 10,
    purpose: "Practise choosing and applying the right operation from a word problem.",
    when_to_use: "Use once the calculation skill is fairly secure.",
    inputs_needed_from_ai: ["Skill/operation", "context/theme", "number range", "reading level"],
    output_structure: "3–5 short word problems.",
    output_format: "question_set",
    difficulty_controls: "Easy: operation obvious. Hard: irrelevant information or larger numbers.",
    example_activity: "There are 6 bags with 8 apples in each. How many apples altogether?",
    success_criteria: "Student identifies the operation and solves accurately.",
    notes: "Can personalise contexts to student interests.",
  },
  {
    template_id: "arith_two_step",
    activity_name: "2-step problems",
    subject: "Arithmetic",
    skill_area: "Multi-step reasoning",
    activity_type: "2-step problems",
    delivery_methods: ["Worksheet", "Interactive activity"],
    typical_year_groups: [],
    estimated_minutes: 10,
    purpose: "Practise solving problems that require two operations or stages.",
    when_to_use: "Use when student can solve single-step problems but rushes multi-step reasoning.",
    inputs_needed_from_ai: ["Operations", "topic context", "number range", "scaffold level"],
    output_structure: "A short set of two-step problems with space for working.",
    output_format: "question_set",
    difficulty_controls: "Easy: question prompts both steps. Hard: student must infer both steps.",
    example_activity: "Lena buys 3 packs of 6 stickers and gives 5 away. How many are left?",
    success_criteria: "Student identifies both steps and records working clearly.",
    notes: "Important for upper KS2.",
  },
  {
    template_id: "arith_missing_number",
    activity_name: "Missing number problems",
    subject: "Arithmetic",
    skill_area: "Algebraic thinking",
    activity_type: "Missing number problems",
    delivery_methods: ["Worksheet", "Quiz", "Interactive activity"],
    typical_year_groups: [],
    estimated_minutes: 7,
    purpose: "Develop flexible thinking and inverse operation understanding.",
    when_to_use: "Use when student needs more than procedural calculation.",
    inputs_needed_from_ai: ["Operation", "number range", "equation format", "difficulty"],
    output_structure: "Missing-number equations with increasing complexity.",
    output_format: "question_set",
    difficulty_controls: "Easy: __ + 7 = 15. Hard: 3 × __ + 4 = 25.",
    example_activity: "Complete: __ + 38 = 92; 7 × __ = 56; 100 - __ = 37.",
    success_criteria: "Student uses inverse operations rather than guessing.",
    notes: "Good bridge to algebra.",
  },
  {
    template_id: "arith_practical",
    activity_name: "Practical measuring, money and time problems",
    subject: "Arithmetic",
    skill_area: "Real-world application",
    activity_type: "Practical problems",
    delivery_methods: ["Worksheet", "Interactive activity", "Practical task"],
    typical_year_groups: [],
    estimated_minutes: 10,
    purpose: "Apply arithmetic to everyday contexts like measure, money and time.",
    when_to_use: "Use to make maths more meaningful or practise applied reasoning.",
    inputs_needed_from_ai: ["Topic: measure/money/time", "year group", "units", "context"],
    output_structure: "Short practical or scenario-based questions.",
    output_format: "practical_task",
    difficulty_controls: "Easy: whole pounds/minutes/cm. Hard: conversions, change, elapsed time.",
    example_activity: "A film starts at 2:15 and lasts 45 minutes. What time does it finish?",
    success_criteria: "Student selects relevant information, units and operation.",
    notes: "Useful for tutoring students who need functional maths practice.",
  },
  {
    template_id: "writing_sentence_improvement",
    activity_name: "Sentence improvement",
    subject: "Writing",
    skill_area: "Sentence quality",
    activity_type: "Sentence improvement",
    delivery_methods: ["Worksheet", "Interactive activity"],
    typical_year_groups: [],
    estimated_minutes: 10,
    purpose: "Improve boring or unclear sentences using detail, precision and structure.",
    when_to_use: "Use when student writes basic sentences and needs development.",
    inputs_needed_from_ai: ["Sentence topic", "target feature", "year group", "examples of desired improvement"],
    output_structure: "A weak sentence with prompts to improve it.",
    output_format: "sentence_set",
    difficulty_controls: "Easy: add adjectives/adverbs. Hard: vary clauses or sentence openings.",
    example_activity: "Improve: The dog ran. Add detail about where, how and why.",
    success_criteria: "Student writes a clearer, more detailed sentence.",
    notes: "Good for creative or persuasive writing.",
  },
  {
    template_id: "writing_punctuation",
    activity_name: "Punctuation correction",
    subject: "Writing",
    skill_area: "Grammar and punctuation accuracy",
    activity_type: "Punctuation correction",
    delivery_methods: ["Worksheet", "Quiz", "Interactive activity"],
    typical_year_groups: [],
    estimated_minutes: 7,
    purpose: "Practise spotting and correcting punctuation errors.",
    when_to_use: "Use when student knows rules but forgets in writing.",
    inputs_needed_from_ai: ["Target punctuation", "sentence difficulty", "number of items"],
    output_structure: "Sentences with missing or incorrect punctuation to correct.",
    output_format: "sentence_set",
    difficulty_controls: "Easy: capital letters/full stops. Hard: commas, speech marks, apostrophes.",
    example_activity: "Correct: when tom shouted stop everyone turned around",
    success_criteria: "Student corrects punctuation accurately and can explain one change.",
    notes: "Can be quick retrieval practice.",
  },
  {
    template_id: "writing_vocab_upgrade",
    activity_name: "Vocabulary upgrade",
    subject: "Writing",
    skill_area: "Vocabulary choice",
    activity_type: "Vocabulary upgrade",
    delivery_methods: ["Worksheet", "Interactive activity"],
    typical_year_groups: [],
    estimated_minutes: 7,
    purpose: "Encourage precise and ambitious word choice.",
    when_to_use: "Use when student repeats simple vocabulary or needs stronger description/persuasion.",
    inputs_needed_from_ai: ["Target boring words", "context", "tone", "year group"],
    output_structure: "A list of weak words/sentences to improve with better vocabulary.",
    output_format: "sentence_set",
    difficulty_controls: "Easy: choose from word bank. Hard: generate own alternatives.",
    example_activity: "Replace “nice” in: It was a nice day. Choose: pleasant, peaceful, glorious, ordinary.",
    success_criteria: "Student selects vocabulary that fits the meaning and tone.",
    notes: "Works well with persuasive writing lessons.",
  },
  {
    template_id: "writing_sentence_combining",
    activity_name: "Sentence combining",
    subject: "Writing",
    skill_area: "Complex sentence construction",
    activity_type: "Sentence combining",
    delivery_methods: ["Worksheet", "Interactive activity"],
    typical_year_groups: [],
    estimated_minutes: 10,
    purpose: "Develop sentence control by combining simple sentences.",
    when_to_use: "Use when student writes short repetitive sentences.",
    inputs_needed_from_ai: ["Pair/group of simple sentences", "conjunctions/relative clauses to practise"],
    output_structure: "Several simple sentence pairs to combine into stronger sentences.",
    output_format: "sentence_set",
    difficulty_controls: "Easy: use and/but/because. Hard: relative clauses, subordinate clauses.",
    example_activity: "Combine: The museum was huge. It had dinosaur bones. → The museum was huge and had dinosaur bones.",
    success_criteria: "Student combines sentences without losing meaning or creating errors.",
    notes: "Very useful for Year 7 writing too.",
  },
  {
    template_id: "writing_editing",
    activity_name: "Editing task",
    subject: "Writing",
    skill_area: "Proofreading and revision",
    activity_type: "Editing task",
    delivery_methods: ["Worksheet", "Interactive activity"],
    typical_year_groups: [],
    estimated_minutes: 10,
    purpose: "Practise improving a short piece of writing by finding errors and weak spots.",
    when_to_use: "Use when student needs editing habits and attention to accuracy.",
    inputs_needed_from_ai: ["Short paragraph", "target errors", "year group", "editing focus"],
    output_structure: "A paragraph with specific things to find and improve.",
    output_format: "sentence_set",
    difficulty_controls: "Easy: 5 obvious errors. Hard: mixed grammar, punctuation and clarity issues.",
    example_activity: "Edit this paragraph. Find 3 punctuation errors and improve one weak sentence.",
    success_criteria: "Student identifies and corrects errors, not just rewrites randomly.",
    notes: "Can later support AI feedback loops.",
  },
  {
    template_id: "writing_grammar_questions",
    activity_name: "Grammar questions",
    subject: "Writing",
    skill_area: "Grammar knowledge",
    activity_type: "Grammar questions",
    delivery_methods: ["Quiz", "Worksheet", "Interactive activity"],
    typical_year_groups: [],
    estimated_minutes: 7,
    purpose: "Practise identifying word classes and grammar features.",
    when_to_use: "Use for grammar retrieval or exam-style practice.",
    inputs_needed_from_ai: ["Grammar focus: noun/verb/adjective/adverb etc.", "sentence level", "difficulty"],
    output_structure: "Short sentences with questions asking student to identify grammar features.",
    output_format: "question_set",
    difficulty_controls: "Easy: identify nouns/verbs. Hard: clauses, determiners, adverbials.",
    example_activity: "In this sentence, circle the adjective: The fierce dragon slept quietly.",
    success_criteria: "Student identifies target grammar features accurately.",
    notes: "Good short activity for grammar tutoring.",
  },
  {
    template_id: "writing_tense_rewrite",
    activity_name: "Rewrite the sentence in a new tense",
    subject: "Writing",
    skill_area: "Verb tense control",
    activity_type: "Tense rewrite",
    delivery_methods: ["Worksheet", "Quiz", "Interactive activity"],
    typical_year_groups: [],
    estimated_minutes: 7,
    purpose: "Practise controlling verb tense and rewriting accurately.",
    when_to_use: "Use when student shifts tense inconsistently or needs grammar practice.",
    inputs_needed_from_ai: ["Original sentences", "target tense", "year group", "difficulty"],
    output_structure: "Sentences to rewrite from present to past/future or vice versa.",
    output_format: "sentence_set",
    difficulty_controls: "Easy: simple verbs. Hard: irregular verbs and multi-clause sentences.",
    example_activity: "Rewrite in the past tense: The boy runs to the shop. → The boy ran to the shop.",
    success_criteria: "Student changes tense accurately while keeping meaning.",
    notes: "Good grammar-to-writing bridge.",
  },
  {
    template_id: "writing_punctuation_fix_it",
    activity_name: "Punctuation Fix-It",
    subject: "Writing",
    skill_area: "Punctuation",
    activity_type: "Correction task",
    delivery_methods: ["Worksheet", "Interactive activity", "Quiz"],
    typical_year_groups: [],
    estimated_minutes: 5,
    purpose: "Practise spotting and correcting missing punctuation.",
    when_to_use: "Use when a student forgets full stops, capital letters, question marks, commas or apostrophes.",
    inputs_needed_from_ai: ["Target punctuation marks", "student ability level", "topic or sentence theme"],
    output_structure: "5-8 sentences with missing or incorrect punctuation. Student rewrites or corrects each sentence.",
    output_format: "sentence_set",
    difficulty_controls: "Easier: full stops and capital letters only. Harder: commas, apostrophes, speech marks or mixed punctuation.",
    example_activity: "where is my pencil → Where is my pencil?",
    success_criteria: "Student corrects most sentences accurately and can explain at least one correction.",
    notes: "Designed to be completed independently. A reminder rule can be shown before the task.",
  },
  {
    template_id: "writing_capital_letter_hunt",
    activity_name: "Capital Letter Hunt",
    subject: "Writing",
    skill_area: "Punctuation",
    activity_type: "Editing task",
    delivery_methods: ["Worksheet", "Interactive activity"],
    typical_year_groups: [],
    estimated_minutes: 5,
    purpose: "Reinforce capital letters for sentence starts, names, places, days, months and I.",
    when_to_use: "Use when a student uses capital letters inconsistently.",
    inputs_needed_from_ai: ["Short passage topic", "names or proper nouns to include", "difficulty level"],
    output_structure: "A short passage with missing capital letters. Student identifies and corrects them.",
    output_format: "sentence_set",
    difficulty_controls: "Easier: sentence starts and names. Harder: places, days, months, titles and the pronoun I.",
    example_activity: "on monday, sara went to london. → On Monday, Sara went to London.",
    success_criteria: "Student finds and corrects most missing capital letters.",
    notes: "Works well as a quick editing warm-up.",
  },
  {
    template_id: "writing_apostrophe_choice",
    activity_name: "Apostrophe Choice",
    subject: "Writing",
    skill_area: "Punctuation",
    activity_type: "Multiple choice; fill the gap",
    delivery_methods: ["Worksheet", "Interactive activity", "Quiz"],
    typical_year_groups: [],
    estimated_minutes: 5,
    purpose: "Practise apostrophes for contraction and possession.",
    when_to_use: "Use when a student confuses contractions, possession, plurals or apostrophe placement.",
    inputs_needed_from_ai: ["Focus type: contraction, possession or mixed", "example words", "sentence context"],
    output_structure: "5-8 sentences where the student chooses or writes the correct apostrophe form.",
    output_format: "question_set",
    difficulty_controls: "Easier: contractions only. Harder: singular and plural possession mixed together.",
    example_activity: "The ___ tail was fluffy. Options: cats, cat's, cats'",
    success_criteria: "Student chooses the correct apostrophe form in most examples.",
    notes: "May need a short rule box before the task.",
  },
  {
    template_id: "writing_speech_punctuation_builder",
    activity_name: "Speech Punctuation Builder",
    subject: "Writing",
    skill_area: "Punctuation",
    activity_type: "Sentence correction",
    delivery_methods: ["Worksheet", "Interactive activity"],
    typical_year_groups: [],
    estimated_minutes: 5,
    purpose: "Practise punctuating direct speech accurately.",
    when_to_use: "Use when a student is learning inverted commas and punctuation around speech.",
    inputs_needed_from_ai: ["Character names", "simple dialogue lines", "difficulty level"],
    output_structure: "3-5 sentences of direct speech with missing punctuation. Student rewrites them correctly.",
    output_format: "sentence_set",
    difficulty_controls: "Easier: speech tag at the end. Harder: speech tag at the start or in the middle.",
    example_activity: "I am ready said Tom → \"I am ready,\" said Tom.",
    success_criteria: "Student places inverted commas and speech punctuation correctly in most examples.",
    notes: "Works best with one worked example shown first.",
  },
  {
    template_id: "writing_comma_check",
    activity_name: "Comma Check",
    subject: "Writing",
    skill_area: "Punctuation",
    activity_type: "Correction task",
    delivery_methods: ["Worksheet", "Interactive activity", "Quiz"],
    typical_year_groups: [],
    estimated_minutes: 5,
    purpose: "Practise using commas accurately in lists, after fronted adverbials or to separate clauses.",
    when_to_use: "Use when a student overuses commas or forgets them.",
    inputs_needed_from_ai: ["Comma focus", "sentence topic", "difficulty level"],
    output_structure: "5-8 sentences where the student adds commas where needed.",
    output_format: "sentence_set",
    difficulty_controls: "Easier: commas in lists. Harder: fronted adverbials, embedded clauses or mixed comma use.",
    example_activity: "After lunch we went outside. → After lunch, we went outside.",
    success_criteria: "Student adds commas accurately and avoids adding unnecessary commas.",
    notes: "A reminder rule should be included before the questions.",
  },
  {
    template_id: "writing_spot_the_word_class",
    activity_name: "Spot the Word Class",
    subject: "Writing",
    skill_area: "Grammar",
    activity_type: "Identification task",
    delivery_methods: ["Worksheet", "Interactive activity", "Quiz"],
    typical_year_groups: [],
    estimated_minutes: 5,
    purpose: "Practise identifying nouns, verbs, adjectives, adverbs and other word classes.",
    when_to_use: "Use when a student needs grammar terminology practice.",
    inputs_needed_from_ai: ["Target word classes", "sentence difficulty", "topic"],
    output_structure: "5 sentences. Student highlights, selects or writes the target word classes.",
    output_format: "question_set",
    difficulty_controls: "Easier: one word class at a time. Harder: mixed word classes in longer sentences.",
    example_activity: "The enormous dog barked loudly. Find the adjective, noun, verb and adverb.",
    success_criteria: "Student identifies the target word classes accurately.",
    notes: "Good quick retrieval activity for grammar terms.",
  },
  {
    template_id: "writing_tense_transformer",
    activity_name: "Tense Transformer",
    subject: "Writing",
    skill_area: "Grammar",
    activity_type: "Rewrite task",
    delivery_methods: ["Worksheet", "Interactive activity"],
    typical_year_groups: [],
    estimated_minutes: 5,
    purpose: "Practise rewriting sentences in a different tense.",
    when_to_use: "Use when a student needs work on past, present or future tense.",
    inputs_needed_from_ai: ["Original sentences", "target tense", "topic", "difficulty level"],
    output_structure: "5 sentences to rewrite in the requested tense.",
    output_format: "sentence_set",
    difficulty_controls: "Easier: simple present to simple past. Harder: progressive or perfect tense forms.",
    example_activity: "She walks to school. → She walked to school.",
    success_criteria: "Student rewrites sentences accurately while keeping the meaning clear.",
    notes: "Useful for students who confuse tense consistency in writing.",
  },
  {
    template_id: "writing_choose_conjunction",
    activity_name: "Choose the Best Conjunction",
    subject: "Writing",
    skill_area: "Grammar",
    activity_type: "Multiple choice",
    delivery_methods: ["Worksheet", "Interactive activity", "Quiz"],
    typical_year_groups: [],
    estimated_minutes: 5,
    purpose: "Practise selecting the most appropriate conjunction to show the relationship between ideas.",
    when_to_use: "Use when a student can write simple sentences but needs support choosing accurate conjunctions such as because, although, while, but, so and however.",
    inputs_needed_from_ai: ["Sentence stems", "target conjunctions", "difficulty level", "topic or context"],
    output_structure: "5-8 sentences with a gap and 3-4 conjunction options. Student chooses the best conjunction for each sentence.",
    output_format: "question_set",
    difficulty_controls: "Easier: use common conjunctions such as and, but, because, so. Harder: include although, however, while, whereas, despite and conjunctions where more than one answer seems possible but one is best.",
    example_activity: "I wanted to play outside, ___ it was raining. Options: because, but, although, so. Best answer: but.",
    success_criteria: "Student chooses the most appropriate conjunction in most examples and can explain how one conjunction changes the meaning.",
    notes: "Good bridge between grammar practice and sentence improvement. Could later include a short explanation prompt: “Why is this conjunction the best choice?”",
  },
  {
    template_id: "writing_grammar_fix_it",
    activity_name: "Grammar Fix-It",
    subject: "Writing",
    skill_area: "Grammar",
    activity_type: "Correction task",
    delivery_methods: ["Worksheet", "Interactive activity", "Quiz"],
    typical_year_groups: [],
    estimated_minutes: 5,
    purpose: "Practise identifying and correcting grammar errors.",
    when_to_use: "Use when a student writes unclear or ungrammatical sentences.",
    inputs_needed_from_ai: ["Error types", "sentence topic", "difficulty level"],
    output_structure: "5 incorrect sentences. Student corrects each one.",
    output_format: "sentence_set",
    difficulty_controls: "Easier: one error per sentence. Harder: mixed grammar errors.",
    example_activity: "She were happy. → She was happy.",
    success_criteria: "Student corrects most errors while keeping the sentence meaning clear.",
    notes: "Works well as a short editing task before independent writing.",
  },
] as const satisfies readonly ActivityTemplate[];

/**
 * These activity structures can be adapted across subject boundaries. This
 * index allows future selection logic to broaden its search without treating
 * delivery methods as educational activity types.
 */
export const CROSS_SUBJECT_ACTIVITY_TYPES = [
  {
    activity_type: "Fill the gap / missing number",
    reusable_in: ["Phonics", "Reading", "Times Tables", "Arithmetic", "Writing"],
    adaptation_note: "Hide a sound, word, fact, number, punctuation mark, or grammar feature.",
  },
  {
    activity_type: "Retrieval questions",
    reusable_in: ["Reading", "Times Tables", "Arithmetic", "Writing"],
    adaptation_note: "Retrieve facts, methods, definitions, or previously taught rules.",
  },
  {
    activity_type: "Sorting",
    reusable_in: ["Phonics", "Reading", "Times Tables", "Arithmetic", "Writing"],
    adaptation_note: "Sort examples by sound, meaning, mathematical property, or language feature.",
  },
  {
    activity_type: "Matching",
    reusable_in: ["Phonics", "Reading", "Times Tables", "Arithmetic", "Writing"],
    adaptation_note: "Match equivalent representations, examples, definitions, pictures, or answers.",
  },
  {
    activity_type: "Error spotting / editing",
    reusable_in: ["Phonics", "Reading", "Arithmetic", "Writing"],
    adaptation_note: "Diagnose and correct a spelling, comprehension, calculation, or writing error.",
  },
  {
    activity_type: "Sequencing",
    reusable_in: ["Reading", "Arithmetic", "Writing"],
    adaptation_note: "Order story events, calculation steps, instructions, or sentences.",
  },
  {
    activity_type: "Independent practice",
    reusable_in: ["Phonics", "Reading", "Times Tables", "Arithmetic", "Writing"],
    adaptation_note: "Apply a taught skill through a graduated set of independent questions.",
  },
] as const satisfies readonly CrossSubjectActivityType[];

export function getActivityTemplateById(templateId: string): ActivityTemplate | undefined {
  return ACTIVITY_TEMPLATES.find((template) => template.template_id === templateId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isActivityQuestion(value: unknown): value is ActivityQuestion {
  return (
    isRecord(value) &&
    typeof value.prompt === "string" &&
    (value.answer === undefined || typeof value.answer === "string")
  );
}

function isActivityQuestionArray(value: unknown): value is ActivityQuestion[] {
  return Array.isArray(value) && value.every(isActivityQuestion);
}

function hasValidCommonContent(value: Record<string, unknown>): boolean {
  return (
    value.schema_version === 1 &&
    typeof value.instructions === "string" &&
    typeof value.delivery_method === "string" &&
    DELIVERY_METHODS.some((method) => method === value.delivery_method) &&
    isRecord(value.payload)
  );
}

/**
 * Validates unknown JSON read from storage before it reaches future activity
 * renderers. Invalid or unsupported content can safely fall back to the
 * existing title and description UI.
 */
export function isGeneratedActivityContent(value: unknown): value is GeneratedActivityContent {
  if (!isRecord(value) || !hasValidCommonContent(value)) return false;

  const payload = value.payload;
  if (!isRecord(payload)) return false;

  switch (value.output_format) {
    case "question_set":
      return isActivityQuestionArray(payload.questions);
    case "word_list":
      return isStringArray(payload.words);
    case "matching_pairs":
      return (
        Array.isArray(payload.pairs) &&
        payload.pairs.every(
          (pair) => isRecord(pair) && typeof pair.left === "string" && typeof pair.right === "string",
        )
      );
    case "sorting_groups":
      return (
        Array.isArray(payload.groups) &&
        payload.groups.every(
          (group) => isRecord(group) && typeof group.label === "string" && isStringArray(group.items),
        )
      );
    case "sentence_set":
      return isStringArray(payload.sentences);
    case "worked_example_and_questions":
      return (
        isRecord(payload.worked_example) &&
        isStringArray(payload.worked_example.steps) &&
        (payload.worked_example.answer === undefined || typeof payload.worked_example.answer === "string") &&
        isActivityQuestionArray(payload.questions)
      );
    case "practical_task":
      return (
        isStringArray(payload.resources) &&
        isStringArray(payload.steps) &&
        isActivityQuestionArray(payload.questions)
      );
    case "timed_question_set":
      return (
        typeof payload.time_limit_seconds === "number" &&
        Number.isFinite(payload.time_limit_seconds) &&
        payload.time_limit_seconds > 0 &&
        isActivityQuestionArray(payload.questions)
      );
    default:
      return false;
  }
}
