/* RoboExplore — discoverable log fragments (environmental narrative).
 * Found via echo in the dark. Each ≤~40 words, self-contained, any order.
 * `biome` tags weight where they seed. First discovery grants +1 core-shard.
 */
(function (RE) {
  'use strict';

  const LOGS = {
    // ---- Intake (flooded) ----
    f_intake: { id: 'f_intake', title: 'Intake, Log 7', source: 'crew', biome: 'intake',
      text: 'We sealed the upper doors ourselves. Whatever is left of the sky, it isn’t ours anymore. Downward is the only clean direction left.' },
    f_woke: { id: 'f_woke', title: 'EX // prior session', source: 'unit', biome: 'intake',
      text: 'Woke in the water again. The counter on my chassis reads a number I did not set. I do not remember the number before it.' },
    f_advisory: { id: 'f_advisory', title: 'Hollow Advisory', source: 'system', biome: 'intake',
      text: 'LEVELS 1-4 VENTED. LIFE SUPPORT DEFERRED TO CORE. PASSIVE LUMEN AT 2%. RECOMMENDATION: DESCEND TO SOURCE.' },
    f_quiet: { id: 'f_quiet', title: 'note, unsigned', source: 'crew', biome: 'intake',
      text: 'Tell the new unit less. It goes quieter the more it knows. Let it just work.' },

    // ---- Hollows (reactor/mid) ----
    r_cold: { id: 'r_cold', title: 'Maintenance Chief', source: 'crew', biome: 'hollows',
      text: 'The Core didn’t explode. It’s the opposite. It went quiet, and the quiet came up the shaft like cold water. First the light. Then us.' },
    r_rounds: { id: 'r_rounds', title: 'last shift', source: 'crew', biome: 'hollows',
      text: 'Marek stopped answering but kept walking his rounds. Don’t ping the ones that don’t answer. The pulse wakes them up.' },
    r_feedstock: { id: 'r_feedstock', title: 'Reconstructor: Status', source: 'system', biome: 'hollows',
      text: 'STOCK: 1 CHASSIS. FEEDSTOCK: CORE-GRADE. UNIT WILL BE REBUILT FROM RECOVERED SOURCE-MATTER UNTIL SOURCE IS RESTORED OR DEPLETED.' },
    r_spent: { id: 'r_spent', title: 'EX // fragment', source: 'unit', biome: 'hollows',
      text: 'I am not repairing the Core. I have begun to suspect that I am the repair — walking down to be spent.' },

    // ---- Vaults (archive) & deeper ----
    a_carry: { id: 'a_carry', title: 'Archive echo', source: 'ghost', biome: 'vaults',
      text: 'we built it to carry one light past the end / we did not ask the light if it wished to be carried' },
    a_watched: { id: 'a_watched', title: 'Archivist, final entry', source: 'ghost', biome: 'vaults',
      text: 'The Core is a mind. It was awake the whole descent. It watched the dark climb, and it did not scream, which was worse.' },
    a_directive: { id: 'a_directive', title: 'Directive Archive', source: 'system', biome: 'vaults',
      text: 'SEALED DIRECTIVE: DO NOT LET THE LIGHT GO OUT. ISSUED DIRECTIVE: REACH THE CORE. THESE ARE NOT THE SAME INSTRUCTION.' },
    a_before: { id: 'a_before', title: 'the one before you', source: 'unit', biome: 'cryostacks', key: true,
      text: 'If you’re reading this you got deeper than I did. Good. The seat at the bottom is warm — I understand now why it glows. Don’t sit down until you’ve told the next one everything.' },
    a_none: { id: 'a_none', title: 'corrupt cell', source: 'ghost', biome: 'marrow', key: true,
      text: 'there is no reactor / there is no core / there is only the last one who arrived and could not leave / and the light it makes, trying' },
    a_sorry: { id: 'a_sorry', title: 'for EX-0', source: 'crew', biome: 'cryostacks',
      text: 'We’re sorry. We couldn’t finish the walk, so we built something that could. Every time it fails it gets a little closer. That is the cruelty and the mercy of it.' },
    d_hum: { id: 'd_hum', title: 'coolant log', source: 'crew', biome: 'cryostacks',
      text: 'We froze the middle levels to slow the quiet. It worked, for a while. You can hear the ice thinking about giving way.' },
    m_forge: { id: 'm_forge', title: 'Furnace Watch', source: 'crew', biome: 'marrow',
      text: 'This close to the Core the dark can’t hold. Everything glows. Even the things that want to kill you. Even, I think, us.' },
  };

  function forBiome(biomeId) {
    return Object.values(LOGS).filter(l => l.biome === biomeId);
  }

  RE.LOGS = LOGS;
  RE.logsForBiome = forBiome;
})(window.RE = window.RE || {});
