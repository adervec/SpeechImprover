// Targeted drills for the English sounds learners most often struggle with.
// Each entry pairs a physical articulation cue (what the lips/tongue actually do)
// and the typical error with sound-dense practice text. The text doubles as the
// prompt for the real-time lip/tongue/jaw model in Practice, so the learner can
// watch the ideal gesture for the very sound they are drilling.
//
//   viseme  links to a key posture in articulation.js (VISEMES) for reference.

export const TROUBLE_SOUNDS = [
  {
    id: 'r',
    label: 'R — the rhotic',
    ipa: '/r/',
    viseme: 'R',
    tip: 'Bunch the tongue up and back so it floats free — the tip points up but never touches the roof of the mouth — and round the lips slightly.',
    commonError: 'letting it collapse into a “w”, or tapping/rolling it.',
    words: ['red', 'road', 'around', 'rare', 'berry', 'river'],
    prompt:
      'Red, road, around, rare. Around the rugged rocks the ragged rascal ran, while the red lorry carried rare cherries down the railroad.',
  },
  {
    id: 'l',
    label: 'L — clear and dark',
    ipa: '/l/',
    viseme: 'TDNL',
    tip: 'Press the tongue TIP firmly to the ridge behind your top teeth and let the voice flow around the sides of the tongue.',
    commonError: 'dropping the tip so “l” turns into a “w” or a vowel — “miwk” for “milk”.',
    words: ['light', 'yellow', 'little', 'fully', 'ball', 'will'],
    prompt:
      'Light, yellow, little, fully. Little Billy filled the yellow wool ball, then calmly walked it all the way to the well.',
  },
  {
    id: 'r-l',
    label: 'R vs L — minimal pairs',
    ipa: '/r/ vs /l/',
    viseme: 'R',
    tip: 'Switch cleanly between the floating, bunched “r” and the tip-anchored “l”. Feel the tip touch the ridge for every “l” and float free for every “r”.',
    commonError: 'merging the two so “rake” and “lake” sound the same.',
    pairs: ['right / light', 'road / load', 'rake / lake', 'fry / fly', 'correct / collect', 'pirate / pilot'],
    prompt:
      'Right, light. Road, load. Rake, lake. The light is right by the lake; first fry it, then fly away, and please collect the correct list.',
  },
  {
    id: 'th',
    label: 'TH — voiced & voiceless',
    ipa: '/θ/ and /ð/',
    viseme: 'TH',
    tip: 'Rest the tongue tip lightly between your teeth and push air past it — voiceless for “think”, then add a voiced buzz for “this”.',
    commonError: 'replacing it with “t/d” (“dis” for “this”) or “f/v” (“fink” for “think”).',
    words: ['think', 'thirty', 'thick', 'this', 'those', 'weather'],
    prompt:
      'Thirty-three thick thistles. I think this thing is thinner than those. They bathe their brother together in rather smooth weather.',
  },
  {
    id: 's-z',
    label: 'S / Z — sibilant control',
    ipa: '/s/ and /z/',
    viseme: 'SZ',
    tip: 'Aim a thin, focused stream of air down the centre groove of the tongue toward nearly-closed teeth. “s” is breath only; “z” adds voice.',
    commonError: 'a lisp — the tip pokes the teeth and slushes like “th” instead of grooving the airflow.',
    words: ['sun', 'sister', 'sixty', 'buzz', 'zebra', 'please'],
    prompt:
      'Sally’s sister sells sixty-six silk scarves by the seashore, and the busy bees buzz as the zebras graze in the breeze.',
  },
  {
    id: 'sh-ch-j',
    label: 'SH / CH / J — post-alveolar',
    ipa: '/ʃ/ /tʃ/ /dʒ/',
    viseme: 'SH',
    tip: 'Pull the tongue blade back just behind the ridge and round the lips a little. “sh” flows; “ch” and “j” start with a quick stop, then release into “sh”.',
    commonError: 'fronting them toward “s”, so “ship” drifts to “sip”.',
    words: ['she', 'shiny', 'chosen', 'chef', 'judge', 'cheese'],
    prompt:
      'She chose a shiny gem, and the cheerful chef judged the cheap, chunky cheese while the children chatted by the shore.',
  },
  {
    id: 'v-w',
    label: 'V vs W',
    ipa: '/v/ vs /w/',
    viseme: 'FV',
    tip: 'For “v”, touch your top teeth to your bottom lip and buzz. For “w”, keep the teeth off the lip and round the lips into a tight circle.',
    commonError: 'using the same lip-rounding for both, so “vine” and “wine” merge.',
    pairs: ['vine / wine', 'vest / west', 'veil / wail', 'verse / worse'],
    prompt:
      'We vow to view the wide vine. Victor went west when the weather grew very vivid, and the wine beside the vine was worse than the verse.',
  },
  {
    id: 'ng',
    label: 'NG — velar nasal',
    ipa: '/ŋ/',
    viseme: 'KG',
    tip: 'Raise the BACK of the tongue to the soft palate and send the sound through the nose — the tongue tip stays down and relaxed.',
    commonError: 'adding a hard “g” or swapping in “n” — “sing-guh” or “runnin’”.',
    words: ['sing', 'ringing', 'bringing', 'long', 'morning', 'running'],
    prompt:
      'The singer is bringing a ringing song. Long mornings, ringing bells, and running rivers keep the evening humming along.',
  },
  {
    id: 'final-consonants',
    label: 'Final consonants & clusters',
    ipa: '-t -d -k -s',
    viseme: 'TDNL',
    tip: 'Finish each word — actually release the final -t, -d, -k, -s — and give consonant clusters their full crispness instead of swallowing them.',
    commonError: 'dropping word endings so “asked” becomes “ass” and “facts” becomes “fac”.',
    words: ['walked', 'asked', 'facts', 'lists', 'texts', 'gifts'],
    prompt:
      'He walked, talked, and asked. The facts, the lists, the texts, and the gifts arrived; he kept the strict, crisp contracts intact.',
  },
  {
    id: 'ee-ih',
    label: 'EE vs IH — sheep / ship',
    ipa: '/iː/ vs /ɪ/',
    viseme: 'EE',
    tip: 'For “ee” (sheep) spread the lips wide and tense the tongue high and forward; for “ih” (ship) relax — shorter, lower and looser.',
    commonError: 'making both vowels the same so “leave” and “live”, or “seat” and “sit”, sound identical.',
    pairs: ['sheep / ship', 'seat / sit', 'feel / fill', 'leave / live', 'heat / hit'],
    prompt:
      'He will sit on the seat. These ships let the sheep slip and sleep. Please fill the feeling, leave the living, and heat what you hit.',
  },
];

export const TROUBLE_SOUND_MAP = Object.fromEntries(TROUBLE_SOUNDS.map((t) => [t.id, t]));

// Compose the coaching instructions shown above the prompt in Practice.
export function troubleInstructions(t) {
  let s = t.tip;
  if (t.commonError) s += ` Watch out for: ${t.commonError}`;
  if (t.pairs?.length) s += ` Minimal pairs: ${t.pairs.join(', ')}.`;
  return s;
}
