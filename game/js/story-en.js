/* RUSTY BARREL — English content pack (R007) */
(function () {
  const RB = (window.RB = window.RB || {});

  RB.EN = {
    prologue: [
      'The ferry left me on the pier at 03:13. The return trip is in twenty-four hours.',
      'I am a fisheries inspector. They sent me to shut down the Barrel — a fish plant that burned in 1985 and has been listed as sealed ever since.',
      'The order was signed by my mother. She died nine years ago.',
      'At the bottom, a note: Do not read the tags aloud. Do not answer knocking. Do not stay the night.',
      'I did not believe in ghosts. I believed in handwriting.'
    ],
    deathMessages: [
      'You have been processed. The original cannot be found.',
      'A new line appeared in the ledger. It is signed by you.',
      'You did not die. You were transferred to another position.',
      'Instruction No. 1: do not read the tags aloud.',
      'They do not eat. They process.',
      'Your time has been recorded. 03:13.'
    ],
    tips: [
      'The flashlight holds the Quiet ones. But the Wet ones come to the light.',
      'Every document you read raises the shift STRESS.',
      'Time recording (Q) lowers attention, but paper rustles far.',
      'Bullets do not kill. They buy time.',
      'The Quiet ones come back. Always.',
      'The seed is shown in pause. One seed — the same plant.'
    ],
    notes: {
      n1: { code: 'ORDER No. 13', title: 'INSPECTOR INSTRUCTIONS', text: '1. Do not read the tags aloud.\n2. Do not answer knocking.\n3. Do not stay the night in the brine hall.\n4. If an employee offers you a position — decline politely.\n\nSigned: O. Savina.' },
      n2: { code: 'LEDGER · SHIFT 1985', title: 'PLAN AND FACT', text: 'Plan: 9,000 barrels.\nFact: 8,991 barrels.\n\nShortage: 9.\n\nShift supervisor: We will process the ninth next year. She has already arrived.' },
      n3: { code: 'LETTER WITHOUT ADDRESS', title: 'ENVELOPE', text: 'Kirill.\n\nCome to the plant. Do not believe what they told you about the fire.\n\nI did not die. I simply moved to another position.\n\nMama.' },
      n4: { code: 'RECIPE No. 13', title: 'BRINE', text: 'Salt-13 — 313 g.\nFlood water — 9 l.\nCarrier blood — 1 glass.\n\nTemperature: 36.6 C.\n\nStir clockwise until the solution becomes warm.\n\nDo not taste it. It is sweet.' },
      n5: { code: 'WALL INSCRIPTION · RED CHALK', title: 'ON THE WALL', text: 'THEY DO NOT EAT.\nTHEY PROCESS.' },
      n6: { code: 'TECHNICAL NOTE', title: 'ABOUT THE CONVEYOR', text: 'The belt was stopped in 1986.\n\nBut every night it moves three metres.\n\nExactly the length of one person.\n\nWe measured it. It moves from 03:13 to 03:16.' },
      n7: { code: 'FIELD NOTE', title: 'THREE TIMES', text: 'I read her name three times, as taught.\n\nAnastasia Petrovna Guryeva, nine years old.\n\nShe opened her eyes and said: Cold.\n\nI answered: I will warm up soon.' },
      n8: { code: 'LAST SHIFT', title: 'LAST SHIFT', text: 'The plan is short by nine barrels.\n\nI cannot stop the shift. It does not understand the word closed.\n\nIt only understands plan.\n\nLet the boy come. He is the ninth. He will finish it.' },
      n9: { code: 'BROTHERHOOD RULES', title: 'RULES OF THE BROTHERHOOD', text: '1. A name is read aloud.\n2. Immersion is voluntary.\n3. The doubter stays on the shore.\n4. The accountant is always right.\n5. The barrel does not open from inside.\n\nWhoever breaks these will be processed out of turn.' },
      n10: { code: 'LAST TRANSMISSION', title: 'LAST TRANSMISSION', text: 'Lighthouse Quiet calling shore. The shift did not come out.\n\nThey are singing in the hall. The water is warm.\n\nPlease respond.\n\nPlease respond.\n\nPlease respond.' },
      n11: { code: 'PHOTOGRAPH', title: 'ON THE BACK', text: 'The photo shows a boy about ten and a woman in an apron. On the back: Kirill, 1983. Do not read your tag. Even if they ask politely.' },
      n12: { code: 'BARREL No. 9', title: 'BARREL', text: 'It hums louder than the others.\n\nIf you put your ear to it, you can hear someone breathing inside.\n\nNine times a minute.\n\nDo not put your ear to it. Put paper.' },
      n13: { code: 'VISITOR LOG · 1983', title: 'THE NINTH', text: '12.10 — Savin K. A., inspector. In 03:13. Out — dash.\n13.10 — Savin K. A., inspector. In 03:13. Out — dash.\n14.10 — Savin K. A., inspector. In 03:13. Out — dash.\n\nThe same hand. The same date. Different ink.' },
      n14: { code: 'ORDER No. 9', title: 'ON THE STAFF POSITION', text: 'The position of inspector is to be considered permanent.\nVacating the position is done by processing a new carrier.\n\nThe shift does not end. The shift passes to the next.\n\nDirector: O. Savina.' },
      n15: { code: 'CHILD DRAWING', title: 'THE GIRL AND THE BARREL', text: 'The drawing shows the plant, the sea and nine barrels. A man in a cap sits in the ninth.\n\nAt the bottom, in a child hand: Papa will come when they count to nine.\n\nThere are salt stains on the back.' },
      n16: { code: 'INSPECTION REPORT · 1994', title: 'THE PIER', text: 'The pier is empty. The ferry did not come.\nThere is an oil stain on the water shaped like a man.\n\nThe visitor log already has my signature.\nI have not signed yet.' },
      n17: { code: 'TELEGRAM', title: 'DO NOT COME', text: 'KIRILL COME DO NOT COME COME\nMAMA ALIVE MAMA NOT ALIVE\nSALT REMEMBERS YOU\nSTOP' },
      n18: { code: 'SHIFT ASSIGNMENT', title: 'CONVEYOR', text: 'Norm: 9 barrels per hour.\nDefects: do not count.\nIf a barrel resists — report to the shift supervisor.\n\nDo not open the ninth. The ninth opens you.' },
      n19: { code: 'MECHANIC NOTE', title: 'BY SOUND', text: 'If you hear knocking — do not knock back.\nIf you hear steps — stand still.\nIf you hear your name — it is not you being called.\n\nIt is you being processed.' },
      n20: { code: 'LAB DIARY', title: 'SAMPLE 13', text: 'Salt-13 manifests memory in tissue.\nThe carrier remembers what he never saw.\nAfter the ninth dose the carrier begins to remember other shifts.\n\nSide effect: he believes he is an inspector.' },
      n21: { code: 'X-RAY', title: 'TWO SKELETONS', text: 'The image shows two skeletons in one body.\nOne adult. One child.\n\nPhysician: Kim.\nNote: the patient claims there is no child.' },
      n22: { code: 'AUTOPSY PROTOCOL', title: 'EMPTY BARREL', text: 'Barrel No. 9 opened.\nInside: brine, hair, a button.\nNo body.\n\nWitness signature: Savin K. A.\nDate: tomorrow.' },
      n23: { code: 'KIM LETTER', title: 'SERUM', text: 'Kirill.\nIf you are reading this, I did not make it.\nThe serum does not heal. It returns a name.\n\nOne name. One. Do not mix it up.' },
      n24: { code: 'CHOIR RULES', title: 'THIRTY VOICES', text: '1. Sing evenly.\n2. Do not say names aloud.\n3. Do not open your eyes during the shift.\n4. If a voice asks — stay silent.\n\nWhoever breaks these becomes the shift.' },
      n25: { code: 'LIST OF NINE', title: 'PROCESSED', text: '1. Savin K. A.\n2. Savin K. A.\n3. Savin K. A.\n4. Savin K. A.\n5. Savin K. A.\n6. Savin K. A.\n7. Savin K. A.\n8. Savin K. A.\n9. Savin K. A.\n\nThe handwriting is different every time. The name is one.' },
      n26: { code: 'IGNAT SERMON', title: 'ON POSITION', text: 'A man is a position held until the end of the shift.\nThe shift does not end. The man ends.\n\nDo not be afraid. We will process you carefully.' },
      n27: { code: 'DEBT RECEIPT', title: 'TOKENS', text: 'Received: 9 tokens.\nShifts worked: 0.\n\nThe debt passes by inheritance.\nHeir: Savin K. A.\n\nPayment accepted in salt, blood or name.' },
      n28: { code: 'MEDICAL CARD', title: 'GURYEVA A. P.', text: 'Age: 9 years, 9 months, 9 days.\nDiagnosis: does not grow up.\nCause: held by the shift.\n\nTreatment: say the full name and let go.\nPrognosis: unknown.' },
      n29: { code: 'LAST SHIFT', title: '03:13', text: '03:13 — ferry.\n03:13 — entry.\n03:13 — barrel opened.\n03:13 — shift accepted.\n\nEvery clock at the plant shows the same time.\nExcept mine.' },
      n30: { code: 'TAG No. 9', title: 'SAVIN K. A.', text: 'Surname: Savin.\nName: Kirill.\nPatronymic: Andreevich.\nYear: 1983.\n\nPosition: inspector.\nStatus: on shift.\n\nDo not read aloud.' }
    },
    noteComments: {
      n1: 'I knew this rhythm. It has been knocking in my temples since the pier.',
      n2: 'Nine barrels. I am the ninth.',
      n3: 'This is my mother hand. But the letter smells of brine.',
      n4: 'It is sweet. I remember that smell from childhood.',
      n5: 'Someone wrote this in blood. Or in what replaces it.',
      n6: 'Three metres a night. Exactly one person.',
      n7: 'He read the name three times. I would too.',
      n8: 'He knew I would come. He waited.',
      n9: 'He rolled his wife in. I cannot stop thinking: did she ask?',
      n10: 'Light angers them. Light calls them. I have heard this before.',
      n11: 'The photograph is mine. But I do not remember it being taken.',
      n12: 'Nine times. I count with her.',
      n13: 'Three identical signatures. I do not remember any of them.',
      n14: 'The position is permanent. The person is expendable.',
      n15: 'I drew this as a child. Or I was shown the drawing and told it was mine.',
      n16: 'The ferry did not come. So there is no return trip.',
      n17: 'The telegram was sent from 1985. Or from today.',
      n18: 'The ninth barrel opens you. I have heard this already.',
      n19: 'Do not answer. I repeat it like a prayer.',
      n20: 'So I am a side effect.',
      n21: 'Two skeletons. One child. I do not want to know whose.',
      n22: 'The signature is dated tomorrow. I signed in advance.',
      n23: 'One name. I have only one.',
      n24: 'Thirty voices. I hear thirty-one.',
      n25: 'Nine identical names. One of them is mine.',
      n26: 'He talks about a position as if it were medicine.',
      n27: 'The debt passes by inheritance. I am the inheritance.',
      n28: 'She is nine years, nine months and nine days old. Always.',
      n29: 'Every clock shows 03:13. Mine does too.',
      n30: 'My tag. Do not read it aloud.'
    },
    chapters: {
      1: {
        title: 'CHECKPOINT', date: 'ORDER 13 · 12.10.1994',
        intro: [
          'The ferry left me on the pier at 03:13. The return trip is in twenty-four hours.',
          'The plant greeted me with the smell of dill and rust. The gates were open.',
          'The last entry in the visitor log was in my handwriting. Dated tomorrow.',
          'The watchman came out to meet me and did not arrive. His pass lay on the floor. The photo was erased, the signature remained: Savin K. A.',
          'They were singing in the yard. Not in formation. The way people sing when they work.'
        ],
        outro: ['The turnstile let me through and wrote me down.', 'Now there are two lines in the log.', 'Both are mine.'],
        goals: [{ text: 'Open the workshop', itemLabel: 'Workshop key' }]
      },
      2: {
        title: 'WORKSHOP', date: 'ORDER 13 · 23:40',
        intro: [
          'The workshop smelled of brine and hot fat.',
          'The conveyor stood still, but the belt was wet. Barrels lay on it. Eighteen.',
          'Each had a tag. The tags had names. The nineteenth barrel was empty.',
          'Its tag bore my name. And the date: 1983.',
          'The loudspeaker turned itself on: Welcome to the shift.'
        ],
        outro: ['I shut off the brine. The conveyor jerked and stopped.', 'A printer started inside the wall.', 'It printed one line: Shortage: 9.'],
        goals: [{ text: 'Shut down three brine lines', itemLabel: 'Valve' }]
      },
      3: {
        title: 'LABORATORY', date: 'ORDER 13 · 01:15',
        intro: [
          'The laboratory was disconnected in 1986.',
          'The lamps under the ceiling were on.',
          'An observation journal lay on the table. The last entry was dated today. My handwriting.',
          'A tag stood in a jar of formalin. It read: Savin Kirill Andreevich, 1983.',
          'I do not remember 1983. I remember only cold.'
        ],
        outro: ['Kim said: You died in 83. I do not know how you do this.', 'I said: Habit.', 'He did not laugh.'],
        goals: [{ text: 'Take the archive card', itemLabel: 'Archive card' }]
      },
      4: {
        title: 'ARCHIVE', date: 'ORDER 13 · 03:02',
        intro: [
          'The archive was not flooded. It was filled.',
          'Shelves went into the dark. On every shelf, a folder with a shift number.',
          'In the reading room stood the brothers. Thirty people in white robes. They were singing.',
          'At the end of the corridor a barrel hummed.',
          'Ignat turned and smiled like a cook who had been waiting for guests.'
        ],
        outro: ['Power returned. Every folder opened at once.', 'On the first page of each was my photograph.', 'Caption: Shift 9. Arrived.'],
        goals: [{ text: 'Start the archive generator', itemLabel: 'Fuse' }]
      },
      5: {
        title: 'CAISSON No. 9', date: 'ORDER 13 · 04:44',
        intro: [
          'The caisson was empty, except for the barrel.',
          'It stood in the centre — rusty, warm. A girl in a white coat sat on the lid and counted something.',
          'Nine years, nine months, nine days, she said. You are late for the shift.',
          'Behind her stood the brothers. They were not singing. They were waiting.',
          'The loudspeaker clicked: Shift 9, proceed with your duties.'
        ],
        outro: [],
        goals: [{ text: 'Open caisson 9', itemLabel: 'Caisson key' }]
      }
    },
    npcs: {
      zoya: {
        role: 'gatekeeper', story: 'The first Quiet one. She has held the gate since 1961.',
        quest: { title: 'Stamp', desc: 'Place the stamp exactly in the frame on the order.', reward: 'Gates open. Access to the archive.' },
        lines: {
          first: ['Order.', 'Here.', 'The stamp is not in place. An order without a stamp is just paper.', 'Place it straight. In the frame. Not like last time.'],
          quest: ['The stamp is in your hand, the frame is on the form. Three tries.', 'If you miss, you go through the window. Only thieves and dead men use our window.'],
          done: ['Go through. And do not run: the workshop floor is slippery.', 'Savina? The packer. Processed in 85. I checked the tag personally. All in order.'],
          idle: ['You will not pass without a stamp. Even if you are a fire. Especially if you are a fire.']
        },
        schedule: {
          1: ['Night. The gate is locked. I will not open before morning.', 'You have the order? Show me. No stamp, no entry.'],
          5: ['Morning. I am still here. The gate is open.', 'Go. I will wait.']
        }
      },
      grisha: {
        role: 'stoker', story: 'He burned his wife tag. Since then he burns one every night.',
        quest: { title: 'Pressure', desc: 'Build steam: turn the pipes from the boiler to the turbine.', reward: 'A can of petrol. Passage to the boiler room.' },
        lines: {
          first: ['You the replacement?', 'No.', 'Pity. The replacement was good. He burned.', 'Build steam. I cannot make it alone.'],
          quest: ['The boiler holds pressure for sixty seconds. Then it blows. Move.'],
          done: ['Take the can. Do not thank me. I did not do it for you.', 'For her. So she has something to burn.'],
          idle: ['Do not open the ninth. It looks back.']
        },
        schedule: {
          2: ['The boiler room breathes. I hold the pressure.', 'Do not touch the valve unless you must.'],
          4: ['The choir is singing in the archive. I will close the line when you say.']
        }
      },
      vera: {
        role: 'radio operator', story: 'The voice of the lighthouse. She died in 1985 but keeps sending reports.',
        quest: { title: 'Frequency', desc: 'Tune the radio: catch three carriers in the noise.', reward: 'Coast guard channel. Route map.' },
        lines: {
          first: ['Lighthouse Quiet, the shift did not come out. Please respond.', 'I hear you.', 'Oh. A living one. Well then.', 'Do not hang up. I have spread across every frequency.'],
          quest: ['Three carriers. Search by noise. I will prompt you.'],
          done: ['I cannot leave. But I can call for you.', 'Tell Zoya that I did send it after all.'],
          idle: ['In silence you can hear me not breathing.']
        },
        schedule: {
          4: ['The frequency is alive. I hear them between the static.', 'Do not answer if they say your name.']
        }
      },
      timka: {
        role: 'boy', story: 'He has been eleven for nine years. He lives in the ventilation.',
        quest: { title: 'Three Barrels', desc: 'Play the shell game: guess which barrel hides the key.', reward: 'Ventilation map. A stash of supplies.' },
        lines: {
          first: ['Who are you?', 'Kirill.', 'I am Timka. Will you play with me?', 'First give me back the flashlight.', 'Nope. First we play.'],
          quest: ['Three barrels, one key. Three rounds. Do not cheat — I can see.'],
          done: ['Fine, you are honest. Take the map.', 'Just do not tell my mother I am here.'],
          idle: ['Asya is nice. She just cannot play. She only counts.']
        },
        schedule: {
          2: ['I hid. There are many of them.', 'Do not make noise. They hear steps.'],
          3: ['I saw her counting.', 'She counts names. Yours too.']
        }
      },
      kim: {
        role: 'doctor', story: 'A hydrobiologist. He invented preservation. Now he looks for a way to let go.',
        quest: { title: 'X-Ray', desc: 'Find three differences in the images.', reward: 'Serum. The truth about Kirill. Asya full name.' },
        lines: {
          first: ['Are you alive?', 'Relatively. You too?', 'I do not know. I have not checked.', 'Help me. I see poorly. I am no longer sure I see correctly.'],
          quest: ['Two images. Three differences. Salt in the lungs, an extra joint, a tag in the stomach.'],
          done: ['Here is the serum. One dose.', 'And remember: her name is Anastasia Petrovna Guryeva. Not Asya.'],
          idle: ['She is not evil. She is a child kept at work for thirty years.']
        },
        schedule: {
          3: ['I have not slept for three days.', 'The serum is almost ready. A little more.']
        }
      },
      slava: {
        role: 'mechanic', story: 'He locked the shift in 1985. Since then he fears silence.',
        quest: { title: 'Wires', desc: 'Connect six pairs of wires without crossing them.', reward: 'Lower tier power. Access to the caisson.' },
        lines: {
          first: ['Light! Turn on the light! Do not turn it off!', 'I did not turn it off.', 'They all say that.'],
          quest: ['Six pairs. Colour to colour. If it shorts, we both burn.'],
          done: ['Here. Now you can see downstairs.', 'Just do not look into the ninth.'],
          idle: ['They are not evil. They are just at work. Understand? Still.']
        },
        schedule: {
          2: ['The wires are chewed. I can fix them.', 'Give me a minute.'],
          4: ['I have the switch. Stay close.']
        }
      },
      ignat: {
        role: 'preacher', story: 'The cook who first called salt a miracle.',
        quest: { title: 'Choir', desc: 'Repeat the knocking rhythm with the cult.', reward: 'A robe. Passage to the ritual without a fight.' },
        lines: {
          first: ['New? Not one of us. Never mind, everyone was not one of us once.', 'I am an inspector.', 'Inspector is also a position. We have many positions.', 'Sing with us. The shift likes it when you keep time.'],
          quest: ['Count the beats. Five. Then seven. Then nine. Do not lose it.'],
          done: ['You kept time. Now you are a brother.', 'Do not thank me: brotherhood is a duty.'],
          idle: ['The shift is people who did not quit their jobs.']
        },
        schedule: {
          1: ['The shift is starting. You are late.', 'No. You are exactly on time.'],
          4: ['The choir is waiting.', 'Say the name — and it will end.']
        }
      },
      asya: {
        role: 'accountant', story: 'The director daughter. She did not grow up. She counts names.',
        quest: { title: 'Counting Rhyme', desc: 'Repeat the sequence of knocks.', reward: 'The right to say her full name.' },
        lines: {
          first: ['You came. I was counting. Nine years, nine months, nine days.', 'I did not want to.', 'Nobody wants to. Then they get used to it.', 'Shall we play? I count, you repeat.'],
          quest: ['One. Two. Three. Do not lose it. If you lose it, we start the shift again.'],
          done: ['You hear the rhythm. Good.', 'Now say my name. Not Asya. The real one.'],
          idle: ['Asya is not a name. It is a position.']
        },
        schedule: {
          5: ['I counted to nine.', 'Now it is your turn.']
        }
      }
    },
    scenes: {
      capture: { kicker: 'ACT 2 · ABDUCTION', title: 'THE SACK', subtitle: 'THE CULT', lines: ['A blow from behind. A sack over the head. Strange hands hold me firmly, but without anger — the way one holds a sack of flour.', 'Do not struggle, inspector. We will not kill you. We will process you.', 'It smells of dill, salt and wet cloth.', 'Asya voice somewhere nearby counts steps: one, two, three...'] },
      cell: { kicker: 'ACT 2 · THE CELL', title: 'THE NINTH PLACE', subtitle: 'YOU ARE ALREADY ON THE LIST', lines: ['A cage made of barrel hoops. Around my neck, a tag with my name and the date 1983.', 'My revolver lies in the corner. The rounds are gone. The belt is cut.', 'Beyond the wall they are singing. The voices are even, like a metronome.', 'On the floor, in chalk: DO NOT ANSWER.'] },
      interrogation: { kicker: 'ACT 2 · INTERROGATION', title: 'IGNAT', subtitle: 'THE PREACHER', lines: ['Ignat sits down opposite and places a ladle on the floor.', 'You came for your sister. There is no sister anymore. There is a position.', 'Say you saw barrel No. 9, and I will let you die as a man.', 'You can lie. You can agree. You can stay silent.'] },
      escape: { kicker: 'ACT 2 · ESCAPE', title: 'VENTILATION', subtitle: 'QUIETLY', lines: ['While the brothers sing, you knock out a rusty bar.', 'The corridor behind the cell smells of hot metal.', 'Somewhere above, an elevator starts. The doors open with a metal screech.', 'You do not know yet that you have a head start — and a price.'] },
      procession: { kicker: 'ACT 1 · PROCESSION', title: 'BEARERS', subtitle: 'THEY ARE NOT IN A HURRY', lines: ['People in white coats walk down the corridor. They carry a barrel on their shoulders.', 'The barrel is wet. Brine drips from it, and the drops hiss on the floor.', 'The first bearer nods to you like a colleague.', 'The ninth. Straight down the corridor. Do not turn.'] },
      conveyor: { kicker: 'ACT 2 · CONVEYOR', title: 'THE BELT', subtitle: 'IT IS STILL TURNING', lines: ['The conveyor stands still, but the belt is wet and warm.', 'Eighteen barrels lie on it. The nineteenth is empty.', 'The empty barrel tag bears your name and the year 1983.', 'The loudspeaker clicks: Shift 9, proceed.'] },
      cult: { kicker: 'ACT 4 · ARCHIVE', title: 'CHOIR', subtitle: 'THIRTY BROTHERS', lines: ['Thirty people in white robes stand around the barrels. Each has a tag on the neck.', 'They are not singing. They are counting: one, two, three...', 'Ignat raises the ladle and everyone falls silent.', 'The shift does not end, he says. The shift passes to the next.'] },
      mother: { kicker: 'ACT 3 · PACKING HALL', title: 'MOTHER', subtitle: 'THE QUIET ONE', lines: ['A woman in an apron stands by the conveyor. She lays cans in rows of nine.', 'You recognise her hands. You recognise the scar on her wrist.', 'She does not raise her head. Can after can. Nine. Nine. Nine.', 'You say: Mama. She freezes for a second. Then takes the next can.'] },
      asya: { kicker: 'ACT 5 · CAISSON', title: 'COUNTING RHYME', subtitle: 'ASYA', lines: ['A girl sits on the barrel lid and swings her legs. The water beneath her is warm.', 'Nine years, nine months, nine days, she says. You are late.', 'She holds out a tag. Your name and 1983 are stamped on it.', 'Do not read it aloud, she says. I will check.'] },
      bossBarrel: { kicker: 'DEFEAT', title: 'THE BARREL', subtitle: 'THEY ROLL YOU IN', lines: ['The Overseer hits you in the stomach. You fall to your knees.', 'He lifts you carefully, like a technician, and lowers you into the barrel.', 'The brine is warm. It smells sweet.', 'The lid closes. The light goes out.', 'Outside, someone says: Shift accepted.'] }
    },
    endings: {
      horror: { kicker: 'BAD ENDING · THE CHOIR', title: 'CHOIR', lines: ['I read my tag aloud.', 'Savin Kirill Andreevich, 1983.', 'The shift answered in chorus. Thirty voices, not one alive.', 'Asya smiled and climbed down from the barrel. Now I can grow up, she said.', 'I stayed by the loudspeaker. My voice now sounds every night:', 'Shift accepted. Proceed with your duties.'] },
      salt: { kicker: 'BAD ENDING · YOU ARE ALIVE', title: 'SALT', lines: ['I reached the lighthouse and lit the lamp.', 'A boat picked me up at 05:40. The sailor asked what happened to my hand.', 'I said I cut it on a can.', 'A month later the first patients appeared at the harbour hospital. Their lungs held salt water.', 'Two months later a fish shop opened in town. Barrels stood in the window.', 'I am alive. I am the only one who knows the truth. Nobody believes me.'] },
      embargo: { kicker: 'NORMAL ENDING', title: 'EMBARGO', lines: ['Grisha set the line on fire. Slava held the switch until the generator drowned.', 'The well collapsed with a sound like someone closing a mouth.', 'The coast guard arrived forty minutes later. The island was declared a quarantine zone.', 'Kim did not come out. Timka was not found. Zoya refused to leave her post.', 'I survived. I received a new position — inspector for closed facilities.', 'Every night I hear knocking. Nine times. It is not a request. It is a time stamp.'] },
      quiet: { kicker: 'PERFECT ENDING', title: 'QUIET SHORE', lines: ['Kim poured the serum into the well. Vera called the boat. Timka led the people out through the ventilation.', 'Zoya opened the gates. Slava did not let go of the switch. Grisha burned the line. Ignat led the cult to the shore and surrendered.', 'I said her full name: Anastasia Petrovna Guryeva, nine years old.', 'She said thank you — and became cold water.', 'I stayed by the well. I did not need to leave: I was a copy already.', 'Nine years later Timka received a letter without an address. Inside were a tag reading Savin K. A. and a note:', 'The shift is closed. Leave is granted.'] }
    },
    endingScenes: {
      horror: { kicker: 'END · CHOIR', title: 'SHIFT ACCEPTED', lines: ['You read your tag aloud. Your voice is as even as at a planning meeting.', 'Thirty voices answer in chorus. Not one is alive.', 'Asya smiles and climbs down from the barrel.', 'Now you are the voice from the loudspeaker.'] },
      salt: { kicker: 'END · SALT', title: 'THE SHORE', lines: ['The lighthouse burns. A boat moves toward the island.', 'You are alive. Behind you, the plant keeps working.', 'In a month the harbour hospital will see its first patients with salt water in their lungs.'] },
      embargo: { kicker: 'END · EMBARGO', title: 'QUARANTINE', lines: ['Grisha sets the line on fire, Slava holds the switch.', 'The well closes with a sound like someone shutting a mouth.', 'The coast guard sets a quarantine. You survived. Not everyone did.'] },
      quiet: { kicker: 'END · QUIET SHORE', title: 'THE NAME', lines: ['You say her full name: Anastasia Petrovna Guryeva, nine years old.', 'She says thank you and becomes cold water.', 'Kim pours the serum. Vera calls the boat. Timka leads the people out.', 'You stay by the well. It is your choice.'] }
    },
    finaleChoices: {
      horror: { label: 'Read your tag', hint: 'The shift is waiting. Always.' },
      salt: { label: 'Go to the lighthouse', hint: 'Do not look back. Do not close it.' },
      embargo: { label: 'Flood the well', hint: 'Grisha and Slava are needed.' },
      quiet: { label: 'Say her name', hint: 'All eight NPCs, Kim serum and three photo clues are needed.' }
    },
    shop: {
      armor: 'Salt-worker armour', craft_medkit: 'Craft a medkit', repair: 'Repair and treat injuries',
      ammo_pistol: 'Ammo 9x18 (16)', ammo_shotgun: 'Ammo 12 ga (8)', ammo_ak: 'Ammo 5.45 (30)',
      ammo_flame: 'Flamethrower mix (40)', ammo_harpoon: 'Harpoons (2)', medkit: 'VIK medkit',
      food: 'Barrel canned food', battery: 'Battery', painkiller: 'Painkiller', adrenaline: 'Adrenaline',
      salt: 'Dose Salt-13', weapon_shotgun: 'Shotgun', weapon_ak74: 'AK-74N', weapon_flamethrower: 'Flamethrower',
      laser: 'Laser sight', trade_photo: 'Trade a photo clue to the fishermen', fish_ammo: 'Ammo 12 ga (12)',
      fish_med: 'Fisherman medkit', fish_salt: 'Salt-13 (trade)', fish_armor: 'Salted jacket'
    },
    weapons: { pistol: 'PM', shotgun: 'SHOTGUN', ak74: 'AK-74N', flamethrower: 'FLAMETHROWER', harpoon: 'HARPOON' },
    prompts: {
      'ПРОЧИТАТЬ ДОКУМЕНТ': 'READ DOCUMENT', 'ВЗЯТЬ: ': 'TAKE: ', 'ГОВОРИТЬ: ': 'TALK: ',
      'РЫЧАГ ОПУЩЕН': 'LEVER LOWERED', 'ДЁРНУТЬ РЫЧАГ': 'PULL LEVER',
      'СФОТОГРАФИРОВАТЬ УЛИКУ': 'PHOTOGRAPH CLUE', 'ОТКРЫТЬ ТАЙНИК': 'OPEN STASH',
      'ЛИФТ ВВЕРХ': 'ELEVATOR UP', 'ЛИФТ ВНИЗ': 'ELEVATOR DOWN', 'ВОЙТИ В ДВЕРЬ': 'ENTER DOOR',
      'ВЫЙТИ': 'EXIT', 'ЛЕБЁДКА': 'WINCH', 'НАДЗИРАТЕЛЬ': 'OVERSEER', 'ТОРГОВЕЦ': 'TRADER',
      'ПОДОБРАТЬ: ': 'PICK UP: ', 'БОЧКА №9': 'BARREL No. 9', 'ЗАПЕРТО: ': 'LOCKED: ',
      'ВЗЯТЬ КЛЮЧ': 'TAKE KEY', 'ПРЕСС ОПУЩЕН': 'PRESS LOWERED', 'НАЖАТЬ ПРЕСС': 'PRESS BUTTON',
      'СИГИЛ АКТИВЕН': 'SIGIL ACTIVE', 'РЕШИТЬ СИГИЛ': 'SOLVE SIGIL', 'ИГРАТЬ В КОСТИ': 'PLAY DICE',
      'ВЫЙТИ ИЗ УКРЫТИЯ': 'LEAVE SHELTER', 'СПРЯТАТЬСЯ': 'HIDE', 'ГОЛОВОЛОМКА РЕШЕНА': 'PUZZLE SOLVED',
      'РЕШИТЬ: ': 'SOLVE: ', 'ОТКРЫТЬ СЕКРЕТНУЮ КОМНАТУ': 'OPEN SECRET ROOM',
      'ОСВОБОДИТЬ РАБОЧЕГО': 'FREE THE WORKER', 'ЗАМОК: ': 'LOCK: '
    },
    rooms: {
      'ПРОХОДНАЯ': 'CHECKPOINT', 'БУХГАЛТЕРИЯ': 'ACCOUNTING', 'КАБИНЕТ': 'OFFICE',
      'СКЛАД': 'WAREHOUSE', 'ТАРНЫЙ СКЛАД': 'CRATE STORE', 'КЛАДОВАЯ': 'PANTRY',
      'ЦЕХ': 'WORKSHOP', 'ЛИНИЯ': 'LINE', 'РАЗДЕЛОЧНЫЙ': 'CUTTING ROOM',
      'ЛАБОРАТОРИЯ': 'LABORATORY', 'ПАЛАТА': 'WARD', 'ПРОЦЕДУРНАЯ': 'TREATMENT ROOM',
      'БОЙЛЕРНАЯ': 'BOILER ROOM', 'ЩИТОВАЯ': 'SWITCHBOARD', 'НАСОСНАЯ': 'PUMP ROOM',
      'АРХИВ': 'ARCHIVE', 'КАРТОТЕКА': 'CARD INDEX', 'ЧИТАЛЬНЫЙ ЗАЛ': 'READING ROOM',
      'ВОРОТА': 'GATES', 'ШЛЮЗ': 'AIRLOCK', 'ПОГРУЗОЧНАЯ': 'LOADING BAY',
      'КЕССОН': 'CAISSON', 'НИЖНИЙ ЯРУС': 'LOWER TIER', 'ЗАТОПЛЕННЫЙ ЦЕХ': 'FLOODED HALL',
      'Причал': 'Pier', 'Ворота цеха': 'Workshop gates', 'Лестница': 'Stairs',
      'Коридор лабораторий': 'Lab corridor', 'Приёмный покой': 'Admissions',
      'Кабинет директора': 'Director office', 'Щитовая': 'Switchboard',
      'Спуск': 'Descent', 'Кессон 9': 'Caisson 9', 'КОМНАТА': 'ROOM'
    }
  };

  RB.L = {
    en() { return !!(RB.I18n && RB.I18n.lang === 'en'); },
    note(n) {
      if (!n) return n;
      const e = this.en() && RB.EN.notes[n.id];
      return e ? Object.assign({}, n, e) : n;
    },
    noteComment(id) {
      if (!this.en()) return (RB.Story.noteComments || {})[id];
      return RB.EN.noteComments[id] || (RB.Story.noteComments || {})[id];
    },
    chapter(c) {
      if (!this.en() || !c) return c;
      const e = RB.EN.chapters[c.id];
      if (!e) return c;
      return Object.assign({}, c, {
        title: e.title, date: e.date, intro: e.intro, outro: e.outro,
        goals: (c.goals || []).map((g, i) => {
          const eg = (e.goals || [])[i] || {};
          return Object.assign({}, g, { text: eg.text || g.text, itemLabel: eg.itemLabel || g.itemLabel });
        })
      });
    },
    npc(n) {
      if (!this.en() || !n) return n;
      const e = RB.EN.npcs[n.id];
      if (!e) return n;
      const lines = {};
      for (const k in n.lines) lines[k] = (e.lines && e.lines[k]) || n.lines[k];
      const schedule = {};
      for (const k in (n.schedule || {})) schedule[k] = (e.schedule && e.schedule[k]) || n.schedule[k];
      return Object.assign({}, n, {
        role: e.role || n.role, story: e.story || n.story,
        quest: Object.assign({}, n.quest, e.quest || {}),
        lines, schedule
      });
    },
    scene(s, id) {
      if (!this.en() || !s) return s;
      const e = RB.EN.scenes[id];
      return e ? Object.assign({}, s, e) : s;
    },
    ending(e) {
      if (!this.en() || !e) return e;
      const t = RB.EN.endings[e.id];
      return t ? Object.assign({}, e, t) : e;
    },
    endingScene(s, id) {
      if (!this.en() || !s) return s;
      const e = RB.EN.endingScenes[id];
      return e ? Object.assign({}, s, e) : s;
    },
    choice(c) {
      if (!this.en()) return c;
      const e = RB.EN.finaleChoices[c.id];
      return e ? Object.assign({}, c, e) : c;
    },
    shop(item) {
      if (!this.en()) return item;
      return Object.assign({}, item, { name: RB.EN.shop[item.id] || item.name });
    },
    room(name) {
      if (!this.en()) return name;
      return RB.EN.rooms[name] || name;
    },
    weapon(id) {
      if (!this.en()) return null;
      return RB.EN.weapons[id] || null;
    },
    prompt(text) {
      if (!this.en() || !text) return text;
      const map = RB.EN.prompts;
      if (map[text]) return map[text];
      const keys = Object.keys(map).filter((k) => k.endsWith(': ')).sort((a, b) => b.length - a.length);
      for (const k of keys) {
        if (text.startsWith(k)) return map[k] + text.slice(k.length);
      }
      return text;
    }
  };
})();
