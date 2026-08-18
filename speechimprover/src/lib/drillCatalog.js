// Targeted drill sets — one rich set per scored attribute, plus a warm-up pool.
// Every drill has several `variants` (tagged text or prompts) so the same drill
// never has to show the same words twice in a row. Tags follow ElevenLabs v3
// audio-tag syntax ([whispers], [excited], [pause] …, CAPITALS = stress) — they
// are display cues; scoring always uses the stripped plain text (see emotive.js).
//
// modes: read | free | twister | breath (non-verbal, completion-assessed).

const D = (attr, id, title, mode, durationSec, instructions, variants, extra = {}) => ({
  id: `drill-${attr}-${id}`, attr, title, mode, durationSec, instructions, variants, ...extra,
});

export const DRILLS = [
  // ───────────────────────── PACE ─────────────────────────
  D('pace', 'metronome', 'Metronome read (120 wpm)', 'read', 60,
    'Read on a steady internal beat — roughly two words per second. Stretch the vowels of the CAPITAL words; that alone caps your speed. Breathe at every [pause].',
    [
      '[steady] The train left the station at seven, [pause] and the fields outside turned slowly from grey to GOLD. [pause] Nobody in the carriage spoke. [pause] A child pressed her nose to the glass and counted the telegraph poles… [pause] one, [pause] two, [pause] three, [pause] until the counting became a kind of sleep.',
      '[steady] To make good bread you need only four things: [pause] flour, [pause] water, [pause] salt, [pause] and TIME. [pause] The first three you can buy. [pause] The last one you have to GIVE, [pause] and most people who fail at bread [slowly] simply would not give it.',
      '[steady] The lighthouse keeper climbed the same ninety steps every evening. [pause] He knew each one by the sound it made. [pause] The seventh creaked; [pause] the fortieth was worn smooth in the middle; [pause] the last one, [slowly] he always took with both hands on the rail.',
      '[steady] A map is not the territory. [pause] It leaves things out on PURPOSE, [pause] because a map that showed everything would be as large as the land itself, [pause] and just as hard to fold.',
    ]),
  D('pace', 'contrast', 'Pace contrast — rushed vs measured', 'read', 60,
    'The first half is marked [rushed]: let it run away with you. At [slowly], drop the shoulders, land every final consonant, and halve your speed. Feel the difference in your neck.',
    [
      '[rushed] I have to get to the station and the taxi hasn’t come and my phone is at four percent and I think I left the oven on — [slowly] and then I stopped. [pause] I put the bag down. [pause] I breathed. [pause] The train was not for another HOUR.',
      '[rushed] There are seven things on the list and we need them all before noon, milk, eggs, tape, batteries, stamps, the parcel, the KEYS — [slowly] the keys. [pause] Which, [pause] as it turned out, [pause] were in my hand the whole time.',
      '[rushed] Everyone said the meeting would be short and it wasn’t and then someone asked a question and then someone answered a different question entirely — [slowly] so I did the one thing that always works. [pause] I said: [emphatic] “Let’s take that offline.”',
    ]),
  D('pace', 'longline', 'Long-sentence pacing', 'read', 60,
    'These sentences are long on purpose. Plan a breath at each [pause] before you begin the sentence, then carry the thought-group evenly to the punctuation — no sprint to the finish.',
    [
      '[steady] The old bridge, [pause] which had carried carts and then cars and then, for one strange summer, a travelling circus, [pause] finally closed on a Tuesday, [pause] with no ceremony at all, [pause] just a man in a yellow jacket and a length of red-and-white tape.',
      '[steady] If you have ever tried to explain to a child why the sky is blue, [pause] and then, when they asked why the sunset is red, found that you did not actually know, [pause] then you already understand the difference between having an answer [pause] and having an UNDERSTANDING.',
      '[steady] The recipe called for patience, [pause] which is not sold in shops, [pause] and for a heavy pan, [pause] which is, [pause] and for the kind of low, steady heat that most people give up on [pause] about six minutes before it starts to work.',
    ]),
  D('pace', 'explain', 'Walk-and-talk explanation', 'free', 75,
    'Explain the topic as if walking beside someone — at walking pace. Every time you finish a sentence, take one full breath before the next. Aim for calm, not fast.',
    [
      'Explain how to make a cup of tea to someone who has never seen a kettle.',
      'Explain the rules of a game you know well — but only the first three rules, slowly.',
      'Give directions from your front door to the nearest shop, landmark by landmark.',
      'Explain why the moon looks bigger near the horizon (it’s fine to guess).',
      'Describe how you would teach a dog to sit, step by step.',
    ]),
  D('pace', 'countdown', 'Numbers on a beat', 'read', 40,
    'Count as written, one number per beat, a full [pause] where marked. Numbers expose rushing instantly — keep the last five as slow as the first five.',
    [
      '[steady] One, two, three, four, five, [pause] six, seven, eight, nine, TEN. [pause] Ten, nine, eight, seven, six, [pause] five, four, three, two, ONE.',
      '[steady] Twenty, nineteen, eighteen, seventeen, [pause] sixteen, fifteen, fourteen, thirteen, [pause] twelve, eleven, [slowly] ten. [pause] Nine, eight, seven, [slowly] six, five, four, [pause] three, two, one, [emphatic] ZERO.',
      '[steady] January, February, March, [pause] April, May, June, [pause] July, August, September, [pause] October, November, [slowly] December.',
    ]),

  // ───────────────────────── CLARITY ─────────────────────────
  D('clarity', 'endings', 'Word-ending drill', 'read', 45,
    'Every word here ends in a hard consonant. Finish EACH one — feel the tongue tip tap for t/d, the back of the tongue release for k/g. Slow first, then normal speed.',
    [
      '[emphatic] The BLACK CAT SAT on the FLAT MAT and LOOKED at the LOCKED DOOR. [pause] It KICKED, it PICKED, it TAPPED, it RAPPED, [pause] and at LAST it SLEPT.',
      '[emphatic] He KEPT the RECEIPT in the LEFT POCKET of a JACKET that DIDN’T FIT. [pause] The FACT is, [pause] it NEVER HAD.',
      '[emphatic] STRICT, EXACT, DIRECT, CORRECT: [pause] the ARCHITECT CHECKED the PRODUCT and MARKED it PERFECT.',
      '[emphatic] The BAND PLAYED and the CROWD STAYED, [pause] SOAKED and COLD and GLAD, [pause] until the LAST CHORD FADED.',
    ]),
  D('clarity', 'overart', 'Over-articulation read', 'read', 50,
    'Exaggerate: open the jaw a finger-width, move the lips more than feels natural, and land every consonant. Then read the same text once at 80% of that — that 80% is your new normal.',
    [
      '[emphatic] Particularly peculiar people prefer properly prepared pineapple. [pause] Their tolerance for tepid, tasteless tea is TERRIBLY limited.',
      '[emphatic] The bright kite lifted lightly, [pause] drifting past the distant rooftops at sunset, [pause] tugging its taut string like a small, determined DOG.',
      '[emphatic] Distinctly, deliberately, definitely: [pause] the delegates decided to debate the details on Wednesday, [pause] not Thursday.',
      '[emphatic] Twelve twinkling stars settled slowly over the still, silver lake, [pause] and the little boat’s bell tinkled once, [pause] then TWICE.',
    ]),
  D('clarity', 'minpairs', 'Minimal pairs', 'twister', 45,
    'Each pair differs by one sound. Say them so a listener with their eyes closed could tell them apart. Slow and precise beats fast and blurry.',
    [
      '[emphatic] Ship — sheep. [pause] Bit — beat. [pause] Fill — feel. [pause] Sit — seat. [pause] Live — leave. [pause] Ship, sheep; bit, beat; fill, feel.',
      '[emphatic] Bat — pat. [pause] Dime — time. [pause] Goat — coat. [pause] Vine — fine. [pause] Zip — sip. [pause] Bat, pat; dime, time; goat, coat.',
      '[emphatic] Thin — tin. [pause] Then — den. [pause] Three — free. [pause] Bath — bat. [pause] Breathe — breeze. [pause] Thin, tin; three, free; bath, bat.',
      '[emphatic] Right — light. [pause] Rock — lock. [pause] Arrive — alive. [pause] Pray — play. [pause] Correct — collect. [pause] Right, light; rock, lock.',
    ]),
  D('clarity', 'whisper', 'Whisper read', 'read', 45,
    'Read the WHOLE thing in a stage whisper — no voice, only breath. Without pitch to carry it, only consonants make you intelligible. Then read it aloud and keep the consonants.',
    [
      '[whispers] Somewhere in the house a clock was ticking. [pause] The cat knew exactly where, [pause] and was not telling.',
      '[whispers] Don’t wake them yet. [pause] The bread is in the oven, the coffee is nearly done, [pause] and for six more minutes [pause] the morning is entirely OURS.',
      '[whispers] Listen. [pause] Under the wind there is a smaller sound — [pause] a gate, [pause] a latch, [pause] a foot on gravel.',
    ]),
  D('clarity', 'jaw', 'Jaw-release sentences', 'read', 40,
    'Put a knuckle gently between your back teeth for the first line to feel the open-jaw space, remove it, and keep that space for the rest. Vowels should feel roomy.',
    [
      '[warmly] Ah, [pause] how far away the water is. [pause] Our father always said the harbour was FARTHER than it looked.',
      '[warmly] Open the window, [pause] call the dog, [pause] and pour the last of the coffee — [pause] the whole afternoon is wide OPEN.',
      '[warmly] Autumn arrives on the orchard road, [pause] all amber and ochre, [pause] and nobody hurries anywhere at ALL.',
    ]),

  // ───────────────────────── FILLERS ─────────────────────────
  D('fillers', 'pausenot', 'Pause, don’t fill', 'free', 60,
    'Answer the prompt. Every time you feel an “um” coming, close your lips and take a silent breath through the nose instead. Silence is allowed — sound-fillers are not.',
    [
      'What did you do yesterday, in order, from waking up to lunch?',
      'Describe the room you are in to someone who cannot see it.',
      'What is one thing you changed your mind about in the last year, and why?',
      'Recommend a book, film, or album — and say who it is NOT for.',
      'Explain what you do for a living (or study) to a curious ten-year-old.',
      'What would you do with an unexpected free afternoon tomorrow?',
    ]),
  D('fillers', 'prep', 'PREP answers (Point · Reason · Example · Point)', 'free', 75,
    'Structure kills fillers: state your POINT in one sentence, give one REASON, one EXAMPLE, then restate the point. Pause between the four parts — plan the next part in the silence.',
    [
      'Should schools start later in the morning?',
      'Is it better to rent or to buy a home?',
      'Should everyone learn to cook at least five dishes?',
      'Are open-plan offices a good idea?',
      'Is it worth learning a second language as an adult?',
    ]),
  D('fillers', 'tagged', 'Scripted pauses read', 'read', 50,
    'This text puts a [pause] exactly where an “um” would usually go. Read it, honouring every pause with silence — feel how the pause sounds MORE confident, not less.',
    [
      '[steady] So the plan is this. [pause] We leave at eight. [pause] We take the coast road, [pause] because the motorway will be blocked, [pause] and we stop once — [pause] once — [pause] for coffee.',
      '[steady] The thing about my grandmother was, [pause] she never raised her voice. [pause] She lowered it. [pause] And somehow [pause] that was worse.',
      '[steady] I think — [pause] no, I KNOW — [pause] that the second draft was better. [pause] Shorter, [pause] clearer, [pause] and it actually said what we meant.',
    ]),
  D('fillers', 'rapid', 'Rapid-fire questions', 'free', 60,
    'Answer each question in ONE clean sentence, then stop. Breathe. Next. Do not start a sentence until you know its last word.',
    [
      'What is your favourite season — and why? [pause] What did you have for breakfast? [pause] Where would you go for a week alone? [pause] What is one skill you wish you had? [pause] What is the best thing about where you live?',
      'Cats or dogs? [pause] Mountains or sea? [pause] Early bird or night owl? [pause] What was the last thing that made you laugh? [pause] What is one rule you would add to your workplace?',
      'Name a food you refuse to eat. [pause] Name a song you never skip. [pause] Name a place you would live if money were no object. [pause] Name a habit you are proud of. [pause] Name one you are not.',
    ]),
  D('fillers', 'onebreath', 'One-breath statements', 'read', 40,
    'Each line is one full statement on one breath: inhale low, say the whole line, land the final word, STOP. No sound between lines — just the breath.',
    [
      '[emphatic] The report is finished and it is on your desk. [pause] I recommend we ship on Friday. [pause] If that changes I will tell you before noon.',
      '[emphatic] I disagree, and here is why. [pause] The data covers only one quarter. [pause] We should wait for the second before we decide.',
      '[emphatic] Thank you for coming. [pause] We have three items today. [pause] Let’s start with the budget.',
    ]),

  // ───────────────────────── VARIETY / NON-REPETITION ─────────────────────────
  D('nonRepetition', 'banned', 'Banned words', 'free', 60,
    'Speak on the topic for 60 seconds WITHOUT the banned words. When you reach for one, pause and find another. The pause is where vocabulary grows.',
    [
      'Describe your favourite meal — banned: good, nice, delicious, really, very.',
      'Describe the weather where you are — banned: nice, bad, cold, hot, kind of.',
      'Talk about your commute or route to work/school — banned: like, basically, thing, stuff, actually.',
      'Describe a person you admire — banned: amazing, great, awesome, really, so.',
      'Explain why you enjoy a hobby — banned: fun, cool, love, like, just.',
    ]),
  D('nonRepetition', 'ladder', 'Synonym ladder', 'read', 45,
    'Each line climbs through near-synonyms. Read them so each word sounds DIFFERENT — a small shift of colour on every rung. This trains your ear for range.',
    [
      '[warmly] Big, [pause] large, [pause] huge, [pause] vast, [pause] enormous, [pause] IMMENSE. [pause] Small, [pause] little, [pause] tiny, [pause] minute, [pause] MINUSCULE.',
      '[warmly] Walk, [pause] stroll, [pause] amble, [pause] wander, [pause] march, [pause] STRIDE. [pause] Say, [pause] state, [pause] declare, [pause] insist, [pause] PROCLAIM.',
      '[warmly] Happy, [pause] glad, [pause] cheerful, [pause] delighted, [pause] elated, [pause] OVERJOYED. [pause] Sad, [pause] low, [pause] gloomy, [pause] mournful, [pause] DESOLATE.',
    ]),
  D('nonRepetition', 'richread', 'Rich-vocabulary read', 'read', 60,
    'A passage dense with precise words. Read it once for meaning, then aloud — give each unusual word its full weight rather than skating over it.',
    [
      '[warmly] The market at dawn was a lattice of colour: [pause] saffron and cinnabar, [pause] the dull pewter of fish on ice, [pause] the bruised purple of aubergines stacked in ziggurats. [pause] Vendors bartered in a patois of shouts and shrugs, [pause] and above it all the gulls kept their raucous vigil.',
      '[warmly] He was a meticulous, [pause] slightly querulous man, [pause] given to long silences and sudden, [pause] incandescent enthusiasms. [pause] To his colleagues he was inscrutable; [pause] to his garden, [pause] apparently, [pause] he was an open book.',
      '[warmly] The river here is sluggish and opaque, [pause] the colour of milky tea, [pause] and it moves with a kind of indolent certainty toward a sea it has never seen [pause] and does not need to.',
    ]),
  D('nonRepetition', 'object', 'Object in three ways', 'free', 60,
    'Pick the object. Describe it three times, twenty seconds each: first its LOOK, then its USE, then its HISTORY (invent it). No repeated adjectives across the three.',
    [
      'A coffee mug.',
      'A pair of shoes.',
      'A house key.',
      'An umbrella.',
      'A wristwatch.',
      'A wooden chair.',
    ]),

  // ───────────────────────── RESONANT DEPTH ─────────────────────────
  D('resonantDepth', 'yawnsigh', 'Yawn-sigh into words', 'read', 45,
    'Each line starts with a sigh: begin a yawn, sigh “ahh” DOWN, feel the larynx drop — and speak the line without letting it climb back up. Chest, not throat.',
    [
      '[sighs] Ahh… [slowly] Monday morning, [pause] and the whole long week ahead of us.',
      '[sighs] Ahh… [slowly] The last of the light is going off the water now.',
      '[sighs] Ahh… [slowly] Well. [pause] That is that, then. [pause] Nothing more to be done tonight.',
      '[sighs] Ahh… [slowly] Come in, [pause] sit down, [pause] there is no hurry at all.',
    ]),
  D('resonantDepth', 'hum', 'Hum-to-speech', 'read', 45,
    'Hand flat on the sternum. Hum “mmm” until you feel the buzz under your palm, then open straight into the words WITHOUT losing the buzz. If it thins out, hum again.',
    [
      '[softly] Mmmm… [slowly] many mornings mean more music. [pause] Mmmm… [slowly] my mother made marmalade in May.',
      '[softly] Mmmm… [slowly] the moon moved over the mountain. [pause] Mmmm… [slowly] warm bread, [pause] warm room, [pause] warm welcome.',
      '[softly] Mmmm… [slowly] the number nine on my new home. [pause] Mmmm… [slowly] the calm before the morning.',
    ]),
  D('resonantDepth', 'lowslow', 'Low, slow read', 'read', 60,
    'Speak on the exhale of a low belly breath (hand on the stomach — it should move OUT on the inhale). Slow, unhurried, warm; let every sentence settle downward at its end.',
    [
      '[slowly] [warmly] There is a kind of quiet that only comes after snow. [pause] The road is soft, [pause] the roofs are heavy, [pause] and every sound arrives a little late, [pause] as if it had further to come.',
      '[slowly] [warmly] Sit with me a while. [pause] The fire has caught, [pause] the dog is asleep, [pause] and whatever it is [pause] can wait until morning.',
      '[slowly] [warmly] The oldest tree in the valley has seen four hundred winters. [pause] It is in no hurry. [pause] Neither, [pause] this evening, [pause] am I.',
    ]),
  D('resonantDepth', 'grounded', 'Grounded statements', 'free', 60,
    'Stand, knees soft, weight even. Say five true, plain statements about your day — each on its own low breath, each ending lower than it began. No lift at the ends.',
    [
      'Five things you did today, stated as facts, in a low, settled voice.',
      'Five things you can see right now, one slow sentence each.',
      'Introduce yourself — name, where you are, what you do — as if to a room that must take you seriously.',
      'Read out five items from your shopping or to-do list as if each were a verdict.',
    ]),

  // ───────────────────────── EXPRESSIVENESS ─────────────────────────
  D('expressiveness', 'switch', 'Emotion switch', 'read', 60,
    'The SAME line, four ways. Commit fully to each tag — face, hands, breath. The bigger the swing between versions, the more range you build.',
    [
      '[cheerfully] The train is late again. [pause] [sad] The train is late again. [pause] [angry] The train is late again. [pause] [whispers] The train is late again.',
      '[excited] I found the keys. [pause] [sarcastic] I found the keys. [pause] [nervous] I found the keys. [pause] [warmly] I found the keys.',
      '[curious] You’re coming with us? [pause] [emphatic] You’re coming with us. [pause] [laughs] You’re coming with us! [pause] [softly] You’re coming with us.',
      '[cheerfully] It’s going to rain all week. [pause] [sighs] It’s going to rain all week. [pause] [dramatic tone] It’s going to rain… all week. [pause] [mischievously] It’s going to rain all week.',
    ]),
  D('expressiveness', 'storytime', 'Storytime read', 'read', 60,
    'Read to an imaginary five-year-old. Every CAPITAL word is a pitch peak — go a musical third higher on it, then let the phrase fall. Overdo it by 30%.',
    [
      '[warmly] Once upon a time, [pause] in a kingdom HIGH above the clouds, [pause] there lived a very SMALL dragon [pause] with a very BIG voice — [excited] and OH, [pause] how that voice could ROAR!',
      '[warmly] Deep in the wood there was a door, [pause] and behind the door there was a stair, [pause] and at the top of the stair… [whispers] there was a mouse [pause] [excited] wearing a HAT!',
      '[warmly] The little boat did not want to go to sea. [pause] [sad] “It’s too BIG,” she said. [pause] [warmly] “Yes,” said the harbour, [pause] “and so are YOU, [pause] [excited] you just don’t know it yet!”',
      '[warmly] Every night the moon asked the owl the same question: [pause] [curious] “Who?” [pause] And every night the owl answered: [pause] [mischievously] “Who do you THINK?”',
    ]),
  D('expressiveness', 'sportscast', 'Sportscaster', 'read', 45,
    'Call the play. Pace builds, pitch climbs, and the CAPITAL words go up and out — then the [pause] drops you back down to start the next build.',
    [
      '[excited] She takes it on the left, [pause] cuts inside — one defender, [pause] TWO — [pause] she shoots — [shouting] and it’s IN! [pause] [laughs] Unbelievable. [pause] [warmly] Absolutely unbelievable.',
      '[steady] Final lap. [pause] [excited] He’s closing on the leader — [pause] two seconds, [pause] one second — [pause] they’re side by side into the last corner — [shouting] and he takes it on the LINE!',
      '[steady] Match point. [pause] [softly] The stadium is silent. [pause] [excited] Serve — return — long rally — [pause] a lob — [pause] she’s under it — [shouting] SMASH! [pause] [warmly] Game, set, and match.',
    ]),
  D('expressiveness', 'peaks', 'Pitch peaks', 'read', 45,
    'One CAPITAL word per sentence — that is your peak. Everything else is a valley. Land the peak higher and slightly longer, then let the sentence fall away.',
    [
      '[warmly] It wasn’t the money that bothered her — [pause] it was the WAY he said it. [pause] She had heard that tone BEFORE. [pause] And she was not going to hear it AGAIN.',
      '[warmly] The house had FOUR doors. [pause] Three of them opened onto the garden. [pause] The fourth… [pause] opened onto NOTHING.',
      '[warmly] You can learn a language in a YEAR. [pause] You can learn an instrument in FIVE. [pause] Patience [pause] takes a LIFETIME.',
    ]),

  // ───────────────────────── NON-NASAL ─────────────────────────
  D('nonNasal', 'openvowel', 'Open-vowel read', 'read', 45,
    'These lines are heavy with “ah / oh / aw”. Lift the soft palate as at the start of a yawn and keep that arch on every vowel — the sound goes forward to the teeth, not up into the nose.',
    [
      '[warmly] All along the harbour wall the water rolled and fell, [pause] and far off a foghorn called, [pause] low and slow, [pause] to nobody at all.',
      '[warmly] Ah, [pause] the old orchard road, [pause] the tall oaks and the hollow log where the owls call after dark.',
      '[warmly] Draw the bath, [pause] pour the water, [pause] open the window and let the warm evening in.',
    ]),
  D('nonNasal', 'contrast', 'Nasal ↔ oral contrast', 'read', 45,
    'Alternate: the m/n words SHOULD buzz in the nose; the vowel words should NOT. Pinch the nose lightly on the vowel words — if the sound changes, the palate has dropped. Lift it.',
    [
      '[steady] Mmm — ahh. [pause] Nnn — ohh. [pause] Ng — aww. [pause] Many — [pause] valley. [pause] Moon — [pause] boat. [pause] Nine — [pause] tide.',
      '[steady] Hum — [pause] hall. [pause] Name — [pause] gate. [pause] Mine — [pause] tie. [pause] Sing — [pause] sigh. [pause] Man — [pause] bad. [pause] Ring — [pause] ride.',
      '[steady] Morning — [pause] awning. [pause] Numb — [pause] cub. [pause] Sung — [pause] sub. [pause] Onion — [pause] audio.',
    ]),
  D('nonNasal', 'yawnlift', 'Yawn-lift sentences', 'read', 40,
    'Yawn (really) before each line. Feel the soft palate rise and the throat open — then speak the line while it is still up. If it drops, yawn again.',
    [
      '[softly] Yawn… [pause] [warmly] the whole hall was open and golden and quiet.',
      '[softly] Yawn… [pause] [warmly] a tall glass of cold water on a hot afternoon.',
      '[softly] Yawn… [pause] [warmly] the boat rolled slowly out over the broad, calm water.',
    ]),

  // ───────────────────────── NO UPTALK ─────────────────────────
  D('noUptalk', 'declare', 'Declaratives', 'read', 45,
    'Every sentence is a statement. On the last word: drop the chin a touch, add a little weight, finish the breath, and let the pitch step DOWN like the last stair. Nothing rises.',
    [
      '[emphatic] The meeting is at nine. [pause] The room is booked. [pause] The slides are done. [pause] We are ready.',
      '[emphatic] I read the report. [pause] I disagree with the conclusion. [pause] Here is what I would do instead.',
      '[emphatic] My name is on the door. [pause] The decision was mine. [pause] I stand by it.',
      '[emphatic] The bridge is closed. [pause] The detour adds ten minutes. [pause] We leave at seven.',
    ]),
  D('noUptalk', 'pairs', 'Question vs statement pairs', 'read', 50,
    'Each pair: first the QUESTION (rise at the end — that is what a rise is for), then the STATEMENT with the same words, falling. Hear the difference; own the fall.',
    [
      '[curious] You’re leaving tomorrow? [pause] [emphatic] You’re leaving tomorrow. [pause] [curious] The report is finished? [pause] [emphatic] The report is finished. [pause] [curious] This is the right room? [pause] [emphatic] This is the right room.',
      '[curious] It’s going to rain? [pause] [emphatic] It’s going to rain. [pause] [curious] She said yes? [pause] [emphatic] She said yes. [pause] [curious] We start on Monday? [pause] [emphatic] We start on Monday.',
      '[curious] That’s the plan? [pause] [emphatic] That’s the plan. [pause] [curious] You’ve read it? [pause] [emphatic] You’ve read it. [pause] [curious] It works? [pause] [emphatic] It works.',
    ]),
  D('noUptalk', 'closers', 'Closing lines', 'read', 40,
    'The last sentence of a talk is where uptalk sneaks in. Each of these is a closer. Say it as if you can HEAR the full stop: “…period.” Then stay silent for two seconds.',
    [
      '[emphatic] That is why we should build it. [pause] Thank you.',
      '[emphatic] The choice is simple, and it is ours. [pause] Let’s make it.',
      '[emphatic] We tried it their way. [pause] Now we try it mine.',
      '[emphatic] That is the whole plan. [pause] There is nothing else to add.',
    ]),
  D('noUptalk', 'opinions', 'Opinions as facts', 'free', 60,
    'State five opinions as if they were established facts. Falling endings. If a sentence rises, say it again — lower — until it lands.',
    [
      'Five opinions about food, stated as facts.',
      'Five opinions about how a good meeting should run.',
      'Five opinions about your city or town.',
      'Five opinions about mornings.',
    ]),

  // ───────────────────────── PROJECTION ─────────────────────────
  D('projection', 'backwall', 'Back-of-the-room read', 'read', 50,
    'Pick a spot on the far wall. Every sentence goes THERE — supported from the belly, not squeezed from the throat. The last word of each sentence must arrive as loud as the first.',
    [
      '[emphatic] Ladies and gentlemen, [pause] welcome. [pause] Tonight we have three speakers, [pause] one short film, [pause] and — I am told — [pause] CAKE.',
      '[emphatic] Can everyone at the back hear me? [pause] Good. [pause] Then let’s begin, [pause] and let’s begin with the most important thing: [pause] the DEADLINE.',
      '[emphatic] The doors will close in five minutes. [pause] Please take your seats. [pause] Phones to silent, [pause] questions to the END.',
    ]),
  D('projection', 'lastword', 'Last-word energy', 'read', 45,
    'The final word of every sentence is in CAPITALS — that is the word most speakers drop. Keep the abdominal wall gently engaged through it; imagine it landing across the room.',
    [
      '[emphatic] We start on MONDAY. [pause] The budget is APPROVED. [pause] The team is READY. [pause] Nothing is going to stop us NOW.',
      '[emphatic] The answer is NO. [pause] The reason is SIMPLE. [pause] The timing is WRONG. [pause] Ask me again in SPRING.',
      '[emphatic] Turn left at the CHURCH. [pause] Follow the river to the BRIDGE. [pause] The house is the one with the red DOOR.',
    ]),
  D('projection', 'toast', 'Toast / announcement', 'free', 60,
    'You are on your feet, glass raised, and the room is loud. Breathe low, aim at the far corner, and keep every sentence full to its final word.',
    [
      'Give a 45-second toast at a friend’s birthday.',
      'Announce a change of plan to a large, chattering group.',
      'Welcome a room of new starters on their first morning.',
      'Call a family in from the garden for dinner — with authority.',
      'Open a school assembly with a short announcement.',
    ]),
  D('projection', 'pulses', 'Diaphragm pulses', 'breath', 40,
    'Hand on the belly. Short, sharp “HA! HA! HA!” pulses — the hand should jump OUT on each one. Ten pulses, breathe, ten more. This is the engine projection runs on.',
    [
      'HA! HA! HA! HA! HA! [pause] (breathe) [pause] HA! HA! HA! HA! HA!',
      'HO! HO! HO! HO! HO! [pause] (breathe) [pause] HEY! HEY! HEY! HEY! HEY!',
    ]),
  D('projection', 'countup', 'Supported count-up', 'read', 40,
    'Count from one to twenty on ONE breath, keeping every number as full as the first. If it thins, stop, breathe low, and start again from where you were.',
    [
      '[emphatic] One, two, three, four, five, six, seven, eight, nine, ten, [pause] eleven, twelve, thirteen, fourteen, fifteen, sixteen, seventeen, eighteen, nineteen, TWENTY.',
      '[emphatic] A, B, C, D, E, F, G, [pause] H, I, J, K, L, M, N, O, P, [pause] Q, R, S, T, U, V, [pause] W, X, Y, and ZED.',
    ]),

  // ───────────────────────── BREATH & PAUSING ─────────────────────────
  D('breath', 'phrasemark', 'Phrase-marked read', 'read', 60,
    'A [pause] marks a quiet low breath — take one at EVERY mark, even if you don’t need it. You are training the habit of refilling before you are empty.',
    [
      '[steady] When the tide goes out, [pause] the whole beach changes. [pause] Pools appear where there was only sand, [pause] and the gulls come down to see what the sea has left. [pause] Then, [pause] just as slowly, [pause] it all comes back.',
      '[steady] The recipe is simple. [pause] Warm the milk. [pause] Melt the butter into it. [pause] Add the flour a spoon at a time, [pause] stirring, [pause] always stirring, [pause] until it thickens.',
      '[steady] He wrote the letter three times. [pause] The first was too long. [pause] The second was too angry. [pause] The third [pause] he sent.',
    ]),
  D('breath', 'longline', 'Long-line breath planning', 'read', 60,
    'No pause marks here — YOU decide. Read once silently and mark, in your head, where you will breathe. Then read aloud: full low breath at each mark, none in between.',
    [
      '[steady] The road out of the valley climbs for nearly two miles through pine and then birch and then nothing but heather, and at the top there is a cairn where people leave stones, and from there on a clear day you can see all the way to the sea.',
      '[steady] If you have never watched a potter centre clay on a wheel, it looks like nothing is happening for a long time and then, in the space of a breath, everything is happening at once, and the lump becomes a bowl.',
      '[steady] The library was open late on Thursdays, and on those nights the reading room filled with students and pensioners and one man who came every week to read the same atlas, page by page, from the front.',
    ]),
  D('breath', 'box', 'Box breathing', 'breath', 60,
    'In for four, hold for four, out for four (a soft “sss”), hold for four. Four rounds. Belly moves, shoulders don’t.',
    [
      'In… 2, 3, 4 — hold… 2, 3, 4 — sss… 2, 3, 4 — hold… 2, 3, 4. Repeat ×4.',
    ]),
  D('breath', 'sustain', 'Sustained “sss” / “shh”', 'breath', 45,
    'One low breath, then the longest steady “sss” you can — even, not loud. Rest. Then “shh”. Then a hummed “mmm”. Aim to lengthen each week.',
    [
      'Sssssssssss… [pause] Shhhhhhhhh… [pause] Mmmmmmmmm…',
      'Ffffffffff… [pause] Vvvvvvvvvv… [pause] Zzzzzzzzzz…',
    ]),
  D('breath', 'onebreathcount', 'Countdown on one breath', 'read', 40,
    'Low breath, then count DOWN as far as you can on one breath at speaking pace, evenly. Note the number. Do it three times; the third should beat the first.',
    [
      '[steady] Twenty, nineteen, eighteen, seventeen, sixteen, fifteen, fourteen, thirteen, twelve, eleven, ten, nine, eight, seven, six, five, four, three, two, one.',
      '[steady] Thirty, twenty-nine, twenty-eight, twenty-seven, twenty-six, twenty-five, twenty-four, twenty-three, twenty-two, twenty-one, twenty…',
    ]),
];

// Warm-up pool: rotated into programs so it isn't breath + hum every single day.
export const WARMUPS = [
  { id: 'warm-breath', title: 'Breath support warm-up', attrs: ['breath', 'projection'], instructions: 'Take 5 slow breaths into your belly (not your shoulders). On each exhale, make a steady “sss” for as long as is comfortable. Record the final two exhales.', prompt: 'Sssssss… (steady exhale) — repeat for two breaths.' },
  { id: 'warm-hum', title: 'Humming & resonance', attrs: ['resonantDepth', 'nonNasal'], instructions: 'Hum gently up and down your comfortable pitch range to wake up resonance. Keep it relaxed — never strained.', prompt: 'Hmmmm — glide gently up, then down, a few times.' },
  { id: 'warm-trill', title: 'Lip trills', attrs: ['breath', 'projection'], instructions: 'Loose lips, steady air: “brrrrr” on a comfortable pitch, then glide up and down. If the lips stop, the air stopped — support from the belly.', prompt: 'Brrrrrrr — flat, then glide up… and down.' },
  { id: 'warm-siren', title: 'Sirens', attrs: ['expressiveness', 'resonantDepth'], instructions: 'On “ng” or “oo”, slide smoothly from your lowest comfortable note to your highest and back — an ambulance, not a staircase. Three times.', prompt: 'Ng-oooo — low → high → low, smooth.' },
  { id: 'warm-jaw', title: 'Jaw & tongue release', attrs: ['clarity', 'nonNasal'], instructions: 'Massage the jaw hinge, let the jaw hang, then “yah-yah-yah” with a floppy jaw. Stick the tongue out and “lah-lah-lah”. Silly is correct.', prompt: 'Yah-yah-yah-yah… lah-lah-lah-lah… (loose jaw, loose tongue).' },
  { id: 'warm-tongue', title: 'Tongue trill & twist', attrs: ['clarity'], instructions: 'Rolled “rrrr” (or a fast “d-d-d” if you can’t roll), then “ta-ka-ta-ka” quickly and evenly for ten seconds.', prompt: 'Rrrrrrrr… ta-ka-ta-ka-ta-ka-ta-ka…' },
];

export function demoDrills() {
  const attrs = new Set(DRILLS.map((d) => d.attr));
  console.assert(attrs.size === 10, 'a set for every attribute: ' + [...attrs].join(','));
  console.assert(DRILLS.every((d) => d.variants.length >= 1 && d.id.startsWith('drill-')), 'every drill has variants');
  const ids = DRILLS.map((d) => d.id);
  console.assert(new Set(ids).size === ids.length, 'unique ids');
  console.assert(DRILLS.filter((d) => d.attr === 'expressiveness').every((d) => d.variants.every((v) => /\[/.test(v))), 'expressive drills are tagged');
  return { drills: DRILLS.length, variants: DRILLS.reduce((n, d) => n + d.variants.length, 0) };
}
