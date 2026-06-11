/**
 * A reusable catalogue of educational activity structures.
 *
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

export interface ExampleActivity {
  instructions: string;
  content: readonly string[];
}

export interface ActivityTemplate {
  template_id: string;
  subject: SubjectArea;
  skill_area: string;
  activity_type: string;
  suitable_year_groups: readonly YearGroup[];
  estimated_minutes: number;
  delivery_methods: readonly DeliveryMethod[];
  input_needed_from_ai: readonly string[];
  output_format: ActivityOutputFormat;
  example_activity: ExampleActivity;
}

export interface CrossSubjectActivityType {
  activity_type: string;
  reusable_in: readonly SubjectArea[];
  adaptation_note: string;
}

const ALL_PRIMARY_YEARS: readonly YearGroup[] = [
  "Year 1",
  "Year 2",
  "Year 3",
  "Year 4",
  "Year 5",
  "Year 6",
];

const EARLY_READING_YEARS: readonly YearGroup[] = ["Reception", "Year 1", "Year 2"];
const KEY_STAGE_TWO_YEARS: readonly YearGroup[] = ["Year 3", "Year 4", "Year 5", "Year 6"];
const PAPER_OR_INTERACTIVE: readonly DeliveryMethod[] = ["Worksheet", "Interactive activity"];
const PAPER_INTERACTIVE_OR_QUIZ: readonly DeliveryMethod[] = [
  "Worksheet",
  "Interactive activity",
  "Quiz",
];

/**
 * Add future templates to this array. An AI-facing selector can later filter
 * by subject, skill area, year group, time available, and delivery method
 * before asking a model to fill `input_needed_from_ai`.
 */
export const ACTIVITY_TEMPLATES = [
  {
    template_id: "phonics-read-words",
    subject: "Phonics",
    skill_area: "Decoding",
    activity_type: "Read words",
    suitable_year_groups: EARLY_READING_YEARS,
    estimated_minutes: 5,
    delivery_methods: PAPER_OR_INTERACTIVE,
    input_needed_from_ai: ["target graphemes or phonemes", "decodable word list", "student reading level"],
    output_format: "word_list",
    example_activity: {
      instructions: "Read each word aloud.",
      content: ["ship", "shop", "fish", "shell"],
    },
  },
  {
    template_id: "phonics-spell-words-from-picture",
    subject: "Phonics",
    skill_area: "Encoding",
    activity_type: "Spell words from picture",
    suitable_year_groups: EARLY_READING_YEARS,
    estimated_minutes: 8,
    delivery_methods: PAPER_OR_INTERACTIVE,
    input_needed_from_ai: ["target graphemes or phonemes", "picture concepts", "expected spellings"],
    output_format: "question_set",
    example_activity: {
      instructions: "Look at each picture and write the word it shows.",
      content: ["Picture: ship -> ______", "Picture: fish -> ______"],
    },
  },
  {
    template_id: "phonics-spell-word-from-dictation",
    subject: "Phonics",
    skill_area: "Encoding",
    activity_type: "Spell the word from dictation",
    suitable_year_groups: EARLY_READING_YEARS,
    estimated_minutes: 8,
    delivery_methods: ["Worksheet", "Interactive activity", "Quiz"],
    input_needed_from_ai: ["target graphemes or phonemes", "dictation words", "optional example sentences"],
    output_format: "word_list",
    example_activity: {
      instructions: "Listen to each word and write it down.",
      content: ["Teacher says: ship", "Teacher says: fish"],
    },
  },
  {
    template_id: "phonics-spell-word-using-sound-cards",
    subject: "Phonics",
    skill_area: "Phoneme-grapheme correspondence",
    activity_type: "Spell the word using sound cards",
    suitable_year_groups: EARLY_READING_YEARS,
    estimated_minutes: 8,
    delivery_methods: ["Interactive activity"],
    input_needed_from_ai: ["target words", "available sound cards", "correct phoneme sequence for each word"],
    output_format: "question_set",
    example_activity: {
      instructions: "Choose and order the sound cards to spell each word.",
      content: ["ship: sh | i | p", "chop: ch | o | p"],
    },
  },
  {
    template_id: "phonics-word-sort-based-on-sounds",
    subject: "Phonics",
    skill_area: "Sound discrimination",
    activity_type: "Word sort based on sounds",
    suitable_year_groups: EARLY_READING_YEARS,
    estimated_minutes: 10,
    delivery_methods: PAPER_OR_INTERACTIVE,
    input_needed_from_ai: ["sound categories", "words belonging to each category", "any distractor words"],
    output_format: "sorting_groups",
    example_activity: {
      instructions: "Sort the words by their vowel sound.",
      content: ["short /oo/: book, look", "long /oo/: moon, food"],
    },
  },
  {
    template_id: "phonics-match-word-to-picture",
    subject: "Phonics",
    skill_area: "Decoding and meaning",
    activity_type: "Match word to picture",
    suitable_year_groups: EARLY_READING_YEARS,
    estimated_minutes: 5,
    delivery_methods: PAPER_OR_INTERACTIVE,
    input_needed_from_ai: ["decodable words", "matching picture descriptions", "target graphemes or phonemes"],
    output_format: "matching_pairs",
    example_activity: {
      instructions: "Match each word to the correct picture.",
      content: ["ship <-> picture of a ship", "fish <-> picture of a fish"],
    },
  },
  {
    template_id: "phonics-sort-real-and-fake-words",
    subject: "Phonics",
    skill_area: "Decoding",
    activity_type: "Sort real words and fake words",
    suitable_year_groups: EARLY_READING_YEARS,
    estimated_minutes: 8,
    delivery_methods: PAPER_INTERACTIVE_OR_QUIZ,
    input_needed_from_ai: ["target graphemes or phonemes", "decodable real words", "decodable pseudo-words"],
    output_format: "sorting_groups",
    example_activity: {
      instructions: "Read each word and sort it into real or fake.",
      content: ["Real: ship, fish", "Fake: shig, fesh"],
    },
  },
  {
    template_id: "phonics-fill-the-gap",
    subject: "Phonics",
    skill_area: "Phoneme-grapheme correspondence",
    activity_type: "Fill the gap",
    suitable_year_groups: EARLY_READING_YEARS,
    estimated_minutes: 8,
    delivery_methods: PAPER_INTERACTIVE_OR_QUIZ,
    input_needed_from_ai: ["target graphemes or phonemes", "partially completed words", "answer key"],
    output_format: "question_set",
    example_activity: {
      instructions: "Add the missing sound to complete each word.",
      content: ["__ip (ship)", "fi__ (fish)"],
    },
  },
  {
    template_id: "phonics-sentence-completion",
    subject: "Phonics",
    skill_area: "Applying phonics in context",
    activity_type: "Sentence completion",
    suitable_year_groups: EARLY_READING_YEARS,
    estimated_minutes: 10,
    delivery_methods: PAPER_OR_INTERACTIVE,
    input_needed_from_ai: ["target graphemes or phonemes", "decodable sentences", "missing-word options"],
    output_format: "sentence_set",
    example_activity: {
      instructions: "Choose the decodable word that completes each sentence.",
      content: ["The ___ is in the pond. (fish / ship)", "The ___ sails away. (fish / ship)"],
    },
  },
  {
    template_id: "reading-retrieval-questions",
    subject: "Reading",
    skill_area: "Retrieval",
    activity_type: "Retrieval questions",
    suitable_year_groups: ALL_PRIMARY_YEARS,
    estimated_minutes: 10,
    delivery_methods: PAPER_INTERACTIVE_OR_QUIZ,
    input_needed_from_ai: ["source text", "number of questions", "student reading level"],
    output_format: "question_set",
    example_activity: {
      instructions: "Answer using information stated in the text.",
      content: ["Where did Mina find the key?", "What time did the train leave?"],
    },
  },
  {
    template_id: "reading-vocabulary-meaning",
    subject: "Reading",
    skill_area: "Vocabulary",
    activity_type: "Vocabulary - meaning of words",
    suitable_year_groups: ALL_PRIMARY_YEARS,
    estimated_minutes: 10,
    delivery_methods: PAPER_INTERACTIVE_OR_QUIZ,
    input_needed_from_ai: ["source text", "target vocabulary", "age-appropriate meanings"],
    output_format: "question_set",
    example_activity: {
      instructions: "Explain what each highlighted word means in the text.",
      content: ["What does 'enormous' mean?", "What does 'hesitated' mean?"],
    },
  },
  {
    template_id: "reading-vocabulary-synonyms",
    subject: "Reading",
    skill_area: "Vocabulary",
    activity_type: "Vocabulary - synonym of words",
    suitable_year_groups: ALL_PRIMARY_YEARS,
    estimated_minutes: 8,
    delivery_methods: PAPER_INTERACTIVE_OR_QUIZ,
    input_needed_from_ai: ["source text or target words", "valid synonyms", "student reading level"],
    output_format: "question_set",
    example_activity: {
      instructions: "Choose a synonym for each word.",
      content: ["enormous -> huge", "quick -> rapid"],
    },
  },
  {
    template_id: "reading-inference-questions",
    subject: "Reading",
    skill_area: "Inference",
    activity_type: "Inference questions",
    suitable_year_groups: ALL_PRIMARY_YEARS,
    estimated_minutes: 12,
    delivery_methods: PAPER_INTERACTIVE_OR_QUIZ,
    input_needed_from_ai: ["source text", "inference focus", "supporting evidence for answers"],
    output_format: "question_set",
    example_activity: {
      instructions: "Use clues from the text to answer.",
      content: ["How is Mina feeling? Give one clue.", "Why did Tariq hide the letter?"],
    },
  },
  {
    template_id: "reading-sequencing",
    subject: "Reading",
    skill_area: "Comprehension and chronology",
    activity_type: "Sequencing",
    suitable_year_groups: ALL_PRIMARY_YEARS,
    estimated_minutes: 10,
    delivery_methods: PAPER_OR_INTERACTIVE,
    input_needed_from_ai: ["source text", "events or steps to sequence", "correct order"],
    output_format: "sorting_groups",
    example_activity: {
      instructions: "Put the events in the order they happened.",
      content: ["Mina found a map.", "Mina followed the path.", "Mina opened the chest."],
    },
  },
  {
    template_id: "reading-prediction",
    subject: "Reading",
    skill_area: "Prediction",
    activity_type: "Prediction",
    suitable_year_groups: ALL_PRIMARY_YEARS,
    estimated_minutes: 8,
    delivery_methods: PAPER_OR_INTERACTIVE,
    input_needed_from_ai: ["source text excerpt", "prediction prompt", "relevant textual clues"],
    output_format: "question_set",
    example_activity: {
      instructions: "Predict what may happen next and explain why.",
      content: ["What might Mina do with the key? Use one clue from the text."],
    },
  },
  {
    template_id: "reading-evidence-hunt",
    subject: "Reading",
    skill_area: "Using evidence",
    activity_type: "Evidence hunt",
    suitable_year_groups: ALL_PRIMARY_YEARS,
    estimated_minutes: 12,
    delivery_methods: PAPER_OR_INTERACTIVE,
    input_needed_from_ai: ["source text", "claims or questions", "matching quotations or evidence"],
    output_format: "matching_pairs",
    example_activity: {
      instructions: "Find and copy evidence that supports each statement.",
      content: ["Mina was nervous. -> 'Her hands began to shake.'"],
    },
  },
  {
    template_id: "times-tables-fact-recall",
    subject: "Times Tables",
    skill_area: "Multiplication fact fluency",
    activity_type: "Fact recall",
    suitable_year_groups: KEY_STAGE_TWO_YEARS,
    estimated_minutes: 5,
    delivery_methods: [
      "Using my previously made times table app",
      "Hit the Button style game",
      "Worksheet",
      "Interactive activity",
      "Quiz",
      "External app",
    ],
    input_needed_from_ai: ["target times tables", "number of questions", "difficulty or response-time target"],
    output_format: "timed_question_set",
    example_activity: {
      instructions: "Answer as many facts as you can in one minute.",
      content: ["6 x 4 = ?", "7 x 8 = ?", "9 x 3 = ?"],
    },
  },
  {
    template_id: "times-tables-missing-number",
    subject: "Times Tables",
    skill_area: "Multiplication fact fluency",
    activity_type: "Missing number",
    suitable_year_groups: KEY_STAGE_TWO_YEARS,
    estimated_minutes: 8,
    delivery_methods: [
      "Using my previously made times table app",
      "Hit the Button style game",
      "Worksheet",
      "Interactive activity",
      "Quiz",
    ],
    input_needed_from_ai: ["target times tables", "missing-number positions", "number of questions"],
    output_format: "question_set",
    example_activity: {
      instructions: "Fill in each missing number.",
      content: ["__ x 6 = 42", "8 x __ = 32"],
    },
  },
  {
    template_id: "times-tables-related-facts",
    subject: "Times Tables",
    skill_area: "Multiplicative relationships",
    activity_type: "Related facts",
    suitable_year_groups: KEY_STAGE_TWO_YEARS,
    estimated_minutes: 10,
    delivery_methods: PAPER_INTERACTIVE_OR_QUIZ,
    input_needed_from_ai: ["known multiplication facts", "related facts to derive", "student year group"],
    output_format: "question_set",
    example_activity: {
      instructions: "Use the first fact to complete the related facts.",
      content: ["If 6 x 4 = 24, then 60 x 4 = __", "If 6 x 4 = 24, then 24 / 6 = __"],
    },
  },
  {
    template_id: "times-tables-division-links",
    subject: "Times Tables",
    skill_area: "Inverse operations",
    activity_type: "Division links",
    suitable_year_groups: KEY_STAGE_TWO_YEARS,
    estimated_minutes: 10,
    delivery_methods: [
      "Using my previously made times table app",
      "Hit the Button style game",
      "Worksheet",
      "Interactive activity",
      "Quiz",
    ],
    input_needed_from_ai: ["target times tables", "division facts", "number of questions"],
    output_format: "question_set",
    example_activity: {
      instructions: "Use multiplication facts to solve each division.",
      content: ["42 / 6 = ?", "56 / 7 = ?"],
    },
  },
  {
    template_id: "times-tables-timed-challenge",
    subject: "Times Tables",
    skill_area: "Multiplication fact fluency",
    activity_type: "Timed challenge",
    suitable_year_groups: KEY_STAGE_TWO_YEARS,
    estimated_minutes: 5,
    delivery_methods: [
      "Using my previously made times table app",
      "Hit the Button style game",
      "Worksheet",
      "Interactive activity",
      "Quiz",
      "External app",
    ],
    input_needed_from_ai: ["target times tables", "time limit", "question count", "personal-best target"],
    output_format: "timed_question_set",
    example_activity: {
      instructions: "Complete 20 mixed multiplication facts in two minutes.",
      content: ["Track: correct answers, errors, and completion time."],
    },
  },
  {
    template_id: "arithmetic-fluency-questions",
    subject: "Arithmetic",
    skill_area: "Calculation fluency",
    activity_type: "Fluency questions",
    suitable_year_groups: ALL_PRIMARY_YEARS,
    estimated_minutes: 10,
    delivery_methods: PAPER_INTERACTIVE_OR_QUIZ,
    input_needed_from_ai: ["target operation or skill", "number range", "number of questions", "student year group"],
    output_format: "question_set",
    example_activity: {
      instructions: "Calculate each answer.",
      content: ["46 + 27 = ?", "81 - 35 = ?", "7 x 6 = ?"],
    },
  },
  {
    template_id: "arithmetic-worked-example",
    subject: "Arithmetic",
    skill_area: "Calculation methods",
    activity_type: "Worked example",
    suitable_year_groups: ALL_PRIMARY_YEARS,
    estimated_minutes: 10,
    delivery_methods: ["Worksheet", "Interactive activity"],
    input_needed_from_ai: ["target calculation method", "example calculation", "step-by-step explanation", "follow-up questions"],
    output_format: "worked_example_and_questions",
    example_activity: {
      instructions: "Study the example, then use the same method.",
      content: ["Example: 46 + 27 = 73 using column addition.", "Now solve: 38 + 45."],
    },
  },
  {
    template_id: "arithmetic-error-spotting",
    subject: "Arithmetic",
    skill_area: "Reasoning about calculations",
    activity_type: "Error spotting",
    suitable_year_groups: ALL_PRIMARY_YEARS,
    estimated_minutes: 10,
    delivery_methods: PAPER_INTERACTIVE_OR_QUIZ,
    input_needed_from_ai: ["target calculation skill", "plausible incorrect working", "correct method and answer"],
    output_format: "worked_example_and_questions",
    example_activity: {
      instructions: "Find the mistake, explain it, and correct the answer.",
      content: ["Sam says 46 + 27 = 613. What mistake did Sam make?"],
    },
  },
  {
    template_id: "arithmetic-independent-practice",
    subject: "Arithmetic",
    skill_area: "Independent calculation",
    activity_type: "Independent practice",
    suitable_year_groups: ALL_PRIMARY_YEARS,
    estimated_minutes: 15,
    delivery_methods: PAPER_INTERACTIVE_OR_QUIZ,
    input_needed_from_ai: ["target calculation skill", "graduated question set", "answer key"],
    output_format: "question_set",
    example_activity: {
      instructions: "Solve each question independently and show your working.",
      content: ["135 + 248 = ?", "506 - 179 = ?", "34 x 6 = ?"],
    },
  },
  {
    template_id: "arithmetic-word-questions",
    subject: "Arithmetic",
    skill_area: "Applying arithmetic",
    activity_type: "Word questions",
    suitable_year_groups: ALL_PRIMARY_YEARS,
    estimated_minutes: 12,
    delivery_methods: PAPER_INTERACTIVE_OR_QUIZ,
    input_needed_from_ai: ["target operation or skill", "age-appropriate contexts", "number range", "answers"],
    output_format: "question_set",
    example_activity: {
      instructions: "Choose the correct operation and solve each problem.",
      content: ["A box holds 6 pencils. How many pencils are in 8 boxes?"],
    },
  },
  {
    template_id: "arithmetic-two-step-problems",
    subject: "Arithmetic",
    skill_area: "Multi-step problem solving",
    activity_type: "2-step problems",
    suitable_year_groups: ["Year 2", "Year 3", "Year 4", "Year 5", "Year 6"],
    estimated_minutes: 15,
    delivery_methods: PAPER_INTERACTIVE_OR_QUIZ,
    input_needed_from_ai: ["target operations", "age-appropriate contexts", "number range", "worked answers"],
    output_format: "question_set",
    example_activity: {
      instructions: "Solve each problem using two calculations.",
      content: ["A shop has 48 apples, sells 19, then receives 24 more. How many apples are there now?"],
    },
  },
  {
    template_id: "arithmetic-missing-number-problems",
    subject: "Arithmetic",
    skill_area: "Inverse operations and algebraic thinking",
    activity_type: "Missing number problems",
    suitable_year_groups: ALL_PRIMARY_YEARS,
    estimated_minutes: 10,
    delivery_methods: PAPER_INTERACTIVE_OR_QUIZ,
    input_needed_from_ai: ["target operations", "number range", "missing-number positions", "answer key"],
    output_format: "question_set",
    example_activity: {
      instructions: "Find the missing number in each calculation.",
      content: ["__ + 27 = 65", "84 - __ = 39", "6 x __ = 42"],
    },
  },
  {
    template_id: "arithmetic-practical-measuring-money-time",
    subject: "Arithmetic",
    skill_area: "Practical mathematics",
    activity_type: "Practical measuring, money and time problems",
    suitable_year_groups: ALL_PRIMARY_YEARS,
    estimated_minutes: 20,
    delivery_methods: ["Worksheet", "Interactive activity", "External app"],
    input_needed_from_ai: ["practical skill focus", "available resources", "age-appropriate scenario", "questions and answers"],
    output_format: "practical_task",
    example_activity: {
      instructions: "Use the price list to work out each answer.",
      content: ["A drink costs 85p and fruit costs 47p. What is the total?", "How much change from GBP 2?"],
    },
  },
  {
    template_id: "writing-sentence-improvement",
    subject: "Writing",
    skill_area: "Sentence composition",
    activity_type: "Sentence improvement",
    suitable_year_groups: ALL_PRIMARY_YEARS,
    estimated_minutes: 12,
    delivery_methods: PAPER_OR_INTERACTIVE,
    input_needed_from_ai: ["starter sentences", "target writing features", "student year group", "example improvements"],
    output_format: "sentence_set",
    example_activity: {
      instructions: "Improve each sentence by adding precise detail.",
      content: ["The dog ran. -> The muddy spaniel sprinted across the field."],
    },
  },
  {
    template_id: "writing-punctuation-correction",
    subject: "Writing",
    skill_area: "Punctuation",
    activity_type: "Punctuation correction",
    suitable_year_groups: ALL_PRIMARY_YEARS,
    estimated_minutes: 10,
    delivery_methods: PAPER_INTERACTIVE_OR_QUIZ,
    input_needed_from_ai: ["target punctuation", "sentences containing errors", "corrected sentences"],
    output_format: "sentence_set",
    example_activity: {
      instructions: "Rewrite each sentence with correct punctuation.",
      content: ["where are you going asked mina"],
    },
  },
  {
    template_id: "writing-vocabulary-upgrade",
    subject: "Writing",
    skill_area: "Vocabulary choice",
    activity_type: "Vocabulary upgrade",
    suitable_year_groups: ALL_PRIMARY_YEARS,
    estimated_minutes: 10,
    delivery_methods: PAPER_OR_INTERACTIVE,
    input_needed_from_ai: ["sentences or passage", "words to improve", "age-appropriate replacement vocabulary"],
    output_format: "sentence_set",
    example_activity: {
      instructions: "Replace the underlined words with more precise vocabulary.",
      content: ["The big wave hit the boat. -> The towering wave struck the boat."],
    },
  },
  {
    template_id: "writing-sentence-combining",
    subject: "Writing",
    skill_area: "Sentence composition",
    activity_type: "Sentence combining",
    suitable_year_groups: ALL_PRIMARY_YEARS,
    estimated_minutes: 12,
    delivery_methods: PAPER_OR_INTERACTIVE,
    input_needed_from_ai: ["short sentence groups", "target conjunctions or structures", "model combined sentences"],
    output_format: "sentence_set",
    example_activity: {
      instructions: "Combine each group into one effective sentence.",
      content: ["The rain fell. Mina kept walking. -> Although the rain fell, Mina kept walking."],
    },
  },
  {
    template_id: "writing-editing-task",
    subject: "Writing",
    skill_area: "Editing and proofreading",
    activity_type: "Editing task",
    suitable_year_groups: ALL_PRIMARY_YEARS,
    estimated_minutes: 15,
    delivery_methods: PAPER_OR_INTERACTIVE,
    input_needed_from_ai: ["passage containing deliberate errors", "editing focus", "corrected passage", "student year group"],
    output_format: "sentence_set",
    example_activity: {
      instructions: "Edit the passage for spelling, punctuation, and clarity.",
      content: ["mina walkt slowly she didnt want to be late"],
    },
  },
  {
    template_id: "writing-grammar-questions",
    subject: "Writing",
    skill_area: "Grammar",
    activity_type: "Grammar questions",
    suitable_year_groups: ALL_PRIMARY_YEARS,
    estimated_minutes: 10,
    delivery_methods: PAPER_INTERACTIVE_OR_QUIZ,
    input_needed_from_ai: ["target grammar concept", "student year group", "question set", "answer key"],
    output_format: "question_set",
    example_activity: {
      instructions: "Answer each grammar question.",
      content: ["Underline the verb: Mina opened the old chest.", "Choose the correct pronoun: Mina gave it to (he / him)."],
    },
  },
  {
    template_id: "writing-rewrite-in-new-tense",
    subject: "Writing",
    skill_area: "Verb tense",
    activity_type: "Rewrite the sentence in a new tense",
    suitable_year_groups: ALL_PRIMARY_YEARS,
    estimated_minutes: 10,
    delivery_methods: PAPER_INTERACTIVE_OR_QUIZ,
    input_needed_from_ai: ["source sentences", "target tense", "correct rewritten sentences"],
    output_format: "sentence_set",
    example_activity: {
      instructions: "Rewrite each sentence in the past tense.",
      content: ["Mina opens the door. -> Mina opened the door."],
    },
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

