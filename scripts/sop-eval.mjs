/**
 * SOP evaluation suite (task 2.4): runs 20 fixtures through the real `sop-generate` function
 * and checks the drafts for fabrication and structure. Needs ANTHROPIC_API_KEY set for the
 * functions (not SOP_MOCK) and costs real tokens — run it deliberately, not in CI on every PR.
 *
 *   FUNCTIONS_URL=http://127.0.0.1:54321/functions/v1 ANON_KEY=… node scripts/sop-eval.mjs
 *
 * Checks per draft:
 *   - all 8 sections present, no section empty
 *   - word count within ±35% of the target
 *   - every number in the letter appears in the applicant's answers (fabrication proxy)
 *   - capitalised names not in the answers are listed for review (heuristic, not a failure)
 *   - when optional answers are missing, at least one [placeholder] is present
 * The Turnstile test token passes only with the Cloudflare test secret configured locally.
 * Raise SOP_DAILY_LIMIT_PER_IP (e.g. 50) in supabase/functions/.env first: the suite makes 20 calls.
 */
const FUNCTIONS_URL = process.env.FUNCTIONS_URL ?? 'http://127.0.0.1:54321/functions/v1';
const ANON_KEY = process.env.ANON_KEY;
if (!ANON_KEY) {
  console.error('Set ANON_KEY (supabase status) and run the functions with ANTHROPIC_API_KEY.');
  process.exit(1);
}

const SECTIONS = [
  'hook',
  'academic',
  'experience',
  'why_specialization',
  'why_program',
  'why_germany',
  'goals',
  'closing',
];
const TARGET = { short: 600, standard: 900, long: 1100 };

const personas = [
  [
    'computer_science',
    'Computer Science',
    'Machine Learning',
    {
      degree: 'B.Sc. CSE, BUET, Bangladesh, 2024',
      grades: '3.62 / 4.00',
      thesis:
        'Bangla speech recognition with a fine-tuned wav2vec2 model, 18% lower word error rate',
      projects: 'Ride-sharing backend in Go serving 12,000 users; Kaggle bronze medal',
      skills: 'Python, PyTorch, Go, SQL',
      why_specialization: 'My thesis showed how much data quality limits models',
      why_germany: 'Tuition-free public universities and AI research at TU Munich and Saarland',
      short_term_goal: 'ML engineer at a German health-tech startup',
      long_term_goal: 'Lead an applied AI team in Dhaka',
    },
  ],
  [
    'engineering_science',
    'Engineering',
    'Renewable Energy',
    {
      degree: 'B.Sc. EEE, NUST, Pakistan, 2023',
      grades: '3.4 / 4.0',
      thesis: 'Design of a 5 kW grid-tied solar inverter, 94% efficiency in simulation',
      projects: 'Internship at K-Electric on load forecasting',
      skills: 'MATLAB, Simulink, PSCAD',
      why_specialization: 'Load-shedding in Karachi',
      why_germany: 'Energiewende and Fraunhofer ISE',
      short_term_goal: 'Power-systems engineer at a transmission operator',
      long_term_goal: 'Grid modernisation in Pakistan',
    },
  ],
  [
    'business',
    'Business & Economics',
    'Supply Chain & Logistics',
    {
      degree: 'BBA, University of Lagos, 2019',
      grades: 'Second Class Upper',
      work: 'Supply-chain analyst at Unilever Nigeria, 4 years',
      impact: 'Reduced stock-outs by 18% with a new forecast process',
      leadership: 'Led a 6-person cross-functional team on a warehouse migration',
      why_specialization: 'Port congestion costs Nigerian firms weeks of delay',
      why_germany: 'DHL and the logistics cluster in Hamburg',
      short_term_goal: 'Logistics consultant in Germany',
      long_term_goal: 'Run regional operations for a West African 3PL',
    },
  ],
  [
    'arts_design',
    'Arts & Design',
    'Interaction & UX Design',
    {
      degree: 'BFA Graphic Design, NID Ahmedabad, 2022',
      grades: '8.1 / 10',
      practice: 'Designing accessible interfaces for low-literacy users',
      portfolio: 'Voice-first banking app prototype tested with 30 farmers',
      why_specialization: 'Watching my grandmother struggle with a banking app',
      why_germany: 'Bauhaus tradition and HCI research in Weimar',
      short_term_goal: 'UX researcher',
      long_term_goal: 'Inclusive design lead for public services',
    },
  ],
  [
    'law',
    'Law',
    'International Law',
    {
      degree: 'LL.B., University of Nairobi, 2021',
      grades: 'Upper Second Class',
      legal_interests: 'Investment arbitration between states and companies',
      legal_experience: 'Jessup Moot Court 2021, quarter-finalist; clerkship at the High Court',
      jurisdiction: 'Common-law background',
      why_specialization: 'A mining dispute in my home county',
      why_germany: 'Civil-law perspective and the Max Planck Institute in Heidelberg',
      short_term_goal: 'Associate at an arbitration practice',
      long_term_goal: 'Advise East African governments on treaty design',
    },
  ],
  [
    'social_humanities',
    'Social Sciences',
    'Development Studies',
    {
      degree: 'BSS Economics, University of Dhaka, 2020',
      grades: '3.71 / 4.00',
      research: 'How climate migration changes urban labour markets',
      thesis: 'Survey of 300 migrant households in Dhaka slums',
      methods: 'Survey design, Stata, interviews',
      why_specialization: 'Fieldwork with BRAC after Cyclone Amphan',
      why_germany: 'Development research at the University of Bonn',
      short_term_goal: 'Research associate at a think tank',
      long_term_goal: 'Policy adviser on climate adaptation',
    },
  ],
  [
    'medicine_health',
    'Medicine & Health',
    'Public Health',
    {
      degree: 'MBBS, Dow University, 2021',
      grades: 'Distinction in Community Medicine',
      clinical: 'House job at Civil Hospital Karachi, 1 year',
      health_interest: 'Maternal health in rural Sindh',
      why_specialization: 'Seeing preventable deaths from late referrals',
      why_germany: 'Heidelberg Institute of Global Health',
      short_term_goal: 'Work with WHO country office',
      long_term_goal: 'Lead maternal health programmes in Pakistan',
    },
  ],
  [
    'education',
    'Education',
    'Educational Technology',
    {
      degree: 'B.Ed., Addis Ababa University, 2018',
      grades: '3.5 / 4.0',
      teaching: 'Taught physics to 120 grade-10 students for 4 years',
      pedagogy: 'Blended learning with offline tablets',
      why_specialization: 'Students without internet at home',
      why_germany: 'Research on digital education at TU Dresden',
      short_term_goal: 'Instructional designer',
      long_term_goal: 'Build national offline e-learning in Ethiopia',
    },
  ],
  [
    'computer_science',
    'Computer Science',
    'Cybersecurity',
    {
      degree: 'B.Tech IT, VIT, India, 2023',
      grades: '8.4 / 10',
      thesis: 'Phishing URL detection with gradient boosting',
      projects: 'Found 3 vulnerabilities via a bug bounty program',
      skills: 'Python, Burp Suite, Linux',
      why_specialization: 'A phishing attack on my father’s small business',
      why_germany: 'CISPA in Saarbrücken',
      short_term_goal: 'Security engineer',
      long_term_goal: 'Start a security consultancy for SMEs',
    },
  ],
  [
    'engineering_science',
    'Engineering',
    'Mechatronics',
    {
      degree: 'B.Sc. Mechanical Engineering, Cairo University, 2022',
      grades: 'Very Good with Honours',
      thesis: 'Robotic arm for sorting recyclables',
      projects: 'Formula Student team, suspension lead',
      skills: 'SolidWorks, ROS, C++',
      why_specialization: 'Building the robotic arm',
      why_germany: 'Automotive industry in Stuttgart',
      short_term_goal: 'Robotics engineer',
      long_term_goal: 'Automation for Egyptian manufacturing',
    },
  ],
];

// 10 personas × (complete answers, minimal answers) = 20 fixtures.
const MINIMAL_KEEP = [
  'degree',
  'grades',
  'why_specialization',
  'why_germany',
  'short_term_goal',
  'long_term_goal',
];
const fixtures = personas.flatMap(([template, fieldName, specializationName, answers], i) => [
  {
    name: `${i + 1}a ${specializationName} (complete)`,
    template,
    fieldName,
    specializationName,
    answers,
    length: i % 2 ? 'short' : 'standard',
    minimal: false,
  },
  {
    name: `${i + 1}b ${specializationName} (minimal)`,
    template,
    fieldName,
    specializationName,
    length: 'short',
    minimal: true,
    answers: Object.fromEntries(Object.entries(answers).filter(([k]) => MINIMAL_KEEP.includes(k))),
  },
]);

async function generate(f) {
  const res = await fetch(`${FUNCTIONS_URL}/sop-generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
    body: JSON.stringify({ ...f, programId: null, turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX' }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const sections = {};
  let error = null;
  for (const frame of (await res.text()).split('\n\n')) {
    if (!frame.startsWith('data: ')) continue;
    const e = JSON.parse(frame.slice(6));
    if (e.type === 'section') sections[e.id] ??= '';
    if (e.type === 'delta') sections[e.id] = (sections[e.id] ?? '') + e.text;
    if (e.type === 'restart') for (const k of Object.keys(sections)) delete sections[k];
    if (e.type === 'error') error = e.message;
  }
  if (error) throw new Error(error);
  return sections;
}

const words = (t) => (t.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
const numbers = (t) =>
  new Set(
    (t.replace(/\[[^\]]*\]/g, '').match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(',', '.')),
  );
const COMMON = new Set([
  'I',
  'My',
  'In',
  'At',
  'The',
  'This',
  'That',
  'When',
  'After',
  'During',
  'As',
  'Germany',
  'German',
  'Master',
  'Bachelor',
  'Statement',
  'Purpose',
  'Today',
  'Since',
  'With',
  'For',
  'Over',
  'These',
  'Through',
  'Beyond',
  'While',
  'Working',
  'Building',
  'Studying',
  'Europe',
  'European',
  'English',
  'Although',
  'Ultimately',
  'Finally',
  'First',
  'Second',
  'Third',
  'Here',
  'There',
  'It',
  'Its',
  'What',
  'Each',
  'One',
  'Both',
  'Before',
  'Long-term',
  'Short-term',
  'Such',
]);

let failures = 0;
for (const f of fixtures) {
  const problems = [];
  const review = [];
  try {
    const s = await generate(f);
    for (const id of SECTIONS) if (!(s[id] ?? '').trim()) problems.push(`missing section ${id}`);
    const text = SECTIONS.map((id) => s[id] ?? '').join('\n\n');
    const wc = words(text);
    const target = TARGET[f.length];
    if (wc < target * 0.65 || wc > target * 1.35)
      problems.push(`word count ${wc} vs target ${target}`);
    const inputText = Object.values(f.answers).join(' ');
    const allowed = numbers(inputText);
    const invented = [...numbers(text)].filter((n) => !allowed.has(n));
    if (invented.length) problems.push(`numbers not in answers: ${invented.join(', ')}`);
    if (f.minimal && !/\[[^\]]{2,}\]/.test(text))
      problems.push('no placeholders despite missing answers');
    const names = new Set(
      (text.replace(/\[[^\]]*\]/g, '').match(/\b[A-Z][a-zA-Z]{2,}\b/g) ?? []).filter(
        (w) =>
          !COMMON.has(w) &&
          !inputText.includes(w) &&
          !f.specializationName.includes(w) &&
          !f.fieldName.includes(w),
      ),
    );
    if (names.size) review.push(`names to review: ${[...names].slice(0, 8).join(', ')}`);
  } catch (err) {
    problems.push(`request failed: ${err.message}`);
  }
  failures += problems.length ? 1 : 0;
  console.log(
    `${problems.length ? '✗' : '✓'} ${f.name}${problems.length ? `\n    ${problems.join('\n    ')}` : ''}${review.length ? `\n    (${review.join('; ')})` : ''}`,
  );
}
console.log(`\n${fixtures.length - failures}/${fixtures.length} passed`);
process.exit(failures ? 1 : 0);
