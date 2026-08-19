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
  {
    id: 'f-th',
    label: 'F vs TH — free / three',
    ipa: '/f/ vs /θ/',
    viseme: 'TH',
    tip: 'For “f” the upper teeth touch the lower LIP; for “th” the tongue tip comes out between the teeth. Look in a mirror — you should see the tongue for every “th”.',
    commonError: 'replacing “th” with “f”, so “three” becomes “free” and “both” becomes “boaf”.',
    pairs: ['free / three', 'first / thirst', 'fought / thought', 'deaf / death', 'roof / Ruth'],
    prompt:
      'Three free thoughts: first the thirst, then the fourth path, then both. Ruth thought the roof was thin; her father found it thick.',
  },
  {
    id: 'b-v',
    label: 'B vs V — berry / very',
    ipa: '/b/ vs /v/',
    viseme: 'FV',
    tip: 'For “b” both lips press and POP apart. For “v” the lips never meet: upper teeth rest on the lower lip and the air keeps flowing with voice behind it.',
    commonError: 'popping the lips on “v”, so “very” sounds like “berry” and “vote” like “boat”.',
    pairs: ['berry / very', 'boat / vote', 'ban / van', 'curb / curve', 'marble / marvel'],
    prompt:
      'Very berry. Vote for the boat. The van was banned. Drive the curve by the curb and marvel at the marble.',
  },
  {
    id: 'p-b',
    label: 'P vs B — aspiration & voicing',
    ipa: '/p/ vs /b/',
    viseme: 'MBP',
    tip: 'Both close the lips; “p” releases a puff of air with no voice, “b” has voice and no puff. Hold a hand a few centimetres from your mouth — it should feel the puff on every “p” and nothing on “b”.',
    commonError: 'a “p” with no air behind it, which listeners hear as “b” (and vice versa).',
    pairs: ['pat / bat', 'pear / bear', 'cap / cab', 'rope / robe', 'simple / symbol'],
    prompt:
      'Pat the bat. A pear beside a bear. The cap is in the cab, the rope on the robe. Peter put a pound of pepper in the paper bag.',
  },
  {
    id: 't-flap',
    label: 'Middle T — water / better',
    ipa: '/t/ → [ɾ] or [ʔ]',
    viseme: 'TDNL',
    tip: 'Between vowels a “t” can stay a crisp tap of the tongue tip on the ridge. Aim for a clean, light tap — not a swallowed glottal stop, and not a heavy hammered T either.',
    commonError: 'dropping it entirely — “wa’er”, “bu’er”, “impor’ant” — which reads as mumbling on a recording.',
    words: ['water', 'better', 'letter', 'little', 'important', 'thirty'],
    prompt:
      'A little better water. Write the letter about the important meeting at thirty minutes past. Butter, matter, later, city.',
  },
  {
    id: 'h-onset',
    label: 'H — the breathy onset',
    ipa: '/h/',
    viseme: 'HH',
    tip: 'Open the throat and simply breathe out into the vowel — no squeeze, no grunt. The “h” is air, not a consonant you build with the tongue.',
    commonError: 'dropping it (“’ouse”, “’ard”) or replacing it with a hard glottal kick.',
    words: ['house', 'hard', 'behind', 'whole', 'perhaps', 'ahead'],
    prompt:
      'How hard he hit the high hedge behind the house. Perhaps the whole herd is ahead of us; who knows how far.',
  },
  {
    id: 'k-g',
    label: 'K vs G — back / bag',
    ipa: '/k/ vs /g/',
    viseme: 'KG',
    tip: 'The BACK of the tongue seals against the soft palate for both; “k” releases voiceless with a little air, “g” releases with the voice already running. Feel the throat buzz for “g” and nothing for “k”.',
    commonError: 'unvoicing final “g”, so “bag” becomes “back” and “dog” becomes “dock”.',
    pairs: ['back / bag', 'coat / goat', 'lock / log', 'pick / pig', 'dock / dog'],
    prompt:
      'Put the bag on his back. The goat wore a coat. A log on the lock; a pig to pick. The dog sat on the dock.',
  },
  {
    id: 'y-j',
    label: 'Y vs J — yellow / jello',
    ipa: '/j/ vs /dʒ/',
    viseme: 'Y',
    tip: 'For “y” the tongue glides up and forward with no contact — the air never stops. For “j” the tongue blade touches behind the ridge and BREAKS the air before releasing.',
    commonError: 'turning every “y” into a “j”, so “year” sounds like “jeer” and “yet” like “jet”.',
    pairs: ['yellow / jello', 'year / jeer', 'yet / jet', 'use / juice', 'yam / jam'],
    prompt:
      'A yellow jar of jam and a yam. Not yet — the jet leaves next year. Use the juice; you have used it up already.',
  },
  {
    id: 'er-vowel',
    label: 'ER — bird / word',
    ipa: '/ɜːr/',
    viseme: 'ER',
    tip: 'Bunch the middle of the tongue and curl it slightly back, lips barely rounded, and hold the sound — it is a vowel, not a quick “uh” with an “r” bolted on.',
    commonError: 'flattening it to “uh” (“wuhd” for “word”) or over-curling it into a growl.',
    words: ['bird', 'word', 'first', 'thirty', 'nurse', 'earth'],
    prompt:
      'The early bird heard the third word first. A nurse in a purple shirt turned thirty on the thirty-first, here on this earth.',
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
