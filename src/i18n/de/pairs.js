// Texts of src/pairs.js (061, German): draw, insertion, removal, cancellation, giftee swap
export default {
  // Why the draw is impossible (pairs.reason.<problem type of draw.js>); {name} - participant name
  'pairs.reason.too_few': 'Es braucht mindestens 2 Teilnehmer.',
  'pairs.reason.ring_too_few': 'Für die Kreisauslosung braucht es mindestens 3 Teilnehmer – oder schalte die Kreisauslosung in den Einstellungen aus.',
  'pairs.reason.ring_impossible': 'Mit diesen Ausschlüssen geht es wohl nicht ohne gegenseitige Paare. Versuch es noch einmal; klappt es nicht, entferne einige Ausschlüsse oder schalte die Kreisauslosung aus.',
  'pairs.reason.no_receivers': '{name} kann niemanden beschenken – prüfe die Ausschlüsse.',
  'pairs.reason.no_givers': '{name} kann von niemandem beschenkt werden – prüfe die Ausschlüsse.',
  'pairs.reason.search_exhausted': 'Eine Verteilung ließ sich nicht schnell finden – versuch es noch einmal. Klappt es nicht, entferne einige Ausschlüsse oder schalte die Kreisauslosung aus.',
  'pairs.reason.fixed_block': 'Die festen Paare stehen im Weg: Mit ihnen lassen sich nicht alle nach den Regeln verteilen. {owner.nomCap} kann einige feste Paare entfernen.',
  'pairs.reason.too_strict': 'Zu viele Ausschlüsse: Alle so zu verteilen, dass sie eingehalten werden, klappt nicht. Entferne einige Ausschlüsse.',
  // Participant without a name in the reason
  'pairs.familiesBlock': 'Die Familien stehen im Weg: Familienmitglieder beschenken sich nicht gegenseitig, und so lassen sich nicht alle verteilen. Schalte «Familien berücksichtigen» oder die Kreisauslosung aus.',
  // Draw
  'pairs.drawn': '🎄 <b>Die Auslosung in der Runde {title} ist erfolgt!</b>\n\nÖffne die App und schau in den Tab «Wichtelkind», um zu erfahren, wen du beschenkst. Verrate es niemandem 🤫',
  'pairs.drawnButton': '🎁 Wichtelkind ansehen',
  'pairs.drawFinished': 'Die Runde ist beendet.',
  'pairs.drawRace': 'Teilnehmer, Ausschlüsse oder Familien haben sich während der Auslosung geändert – versuch es noch einmal.',
  'pairs.notDrawn': 'Die Auslosung hat nicht stattgefunden.',
  // Pairs after a change of members: to the new participant and to a Santa with a new giftee
  'pairs.inserted': '🎄 <b>Du bist dabei!</b> Die Auslosung der Runde {title} ist für dich erfolgt – schau in den Tab «Wichtelkind» 🤫',
  'pairs.newWard': '🔄 In der Runde {title} haben sich die Teilnehmer geändert, und du hast jetzt <b>ein neues Wichtelkind</b>. Schau in den Tab «Wichtelkind».',
  'pairs.lookButton': '🎁 Ansehen',
  // Removing and inserting a participant
  'pairs.notMember': 'Diese Person nimmt an dieser Runde nicht teil.',
  'pairs.removeBlocked': 'Der Teilnehmer lässt sich nicht entfernen, ohne Ausschlüsse oder die Kreisauslosung zu verletzen. Lockere die Ausschlüsse.',
  'pairs.removed': 'Du wurdest aus der Runde {title} entfernt. Falls das ein Fehler ist, wende dich an den Inhaber oder einen Admin.',
  'pairs.alreadyInDraw': 'Der Teilnehmer ist bereits in der Auslosung.',
  'pairs.insertBlocked': 'Der Teilnehmer lässt sich nicht aufnehmen, ohne die Regeln zu verletzen: Alle, deren Wichtelkind sich ändern könnte, haben ihr Geschenk schon bereit, oder Ausschlüsse stehen im Weg. Du kannst die Auslosung in der Gefahrenzone aufheben und neu auslosen.',
  // Giftee swap (048): rules without names (pairs.swapRule.<rule>), refusals and the message to Santa
  'pairs.swapRule.self': 'Einer der beiden beschenkt den anderen: Nach dem Tausch würde sich jemand selbst beschenken.',
  'pairs.swapRule.exclusion': 'Ausschlüsse: Einer der beiden würde jemanden beschenken, den er laut Ausschluss nicht beschenken darf.',
  'pairs.swapRule.family': 'Familien: Einer der beiden würde ein Mitglied seiner eigenen Familie beschenken.',
  'pairs.swapRule.ring': 'Kreisauslosung: Es entstünde ein gegenseitiges Paar – zwei würden sich gegenseitig beschenken.',
  'pairs.swapRule.fixed': 'Feste Paare: Der Tausch würde ein Paar auflösen, das du festgelegt hast.',
  'pairs.swapRule.history': 'Frühere Paare: Einer der beiden würde dieselbe Person beschenken wie in der vorigen Runde.',
  'pairs.swapRevealed': 'Das Geheimnis ist bereits gelüftet – Wichtelkinder lassen sich nicht mehr tauschen.',
  'pairs.swapTwo': 'Wähle zwei verschiedene Teilnehmer.',
  'pairs.notInDraw': 'Der Teilnehmer ist nicht in der Auslosung.',
  'pairs.swapStale': 'Die Paare haben sich bereits geändert – öffne den Tausch erneut.',
  'pairs.swapSelf': 'Diese beiden lassen sich nicht tauschen – wähle ein anderes Paar.',
  'pairs.swapRulesChanged': 'Die Auslosungsregeln für diesen Tausch haben sich geändert – prüfe noch einmal.',
  'pairs.swapNotice': '🔄 Der Inhaber hat die Auslosung der Runde {title} geändert: Du hast jetzt <b>ein neues Wichtelkind</b>. Das bisherige Paar gilt nicht mehr, der Chat darin wurde gelöscht. Schau in den Tab «Wichtelkind».',
  // Cancelling the draw (007) and forced cancellation (012)
  'pairs.cancelFinished': 'Die Runde ist beendet – die Auslosung lässt sich nicht aufheben.',
  'pairs.cancelRevealed': 'Das Geheimnis ist bereits gelüftet – die Auslosung lässt sich nicht aufheben.',
  'pairs.cancelBlocked': 'Aufheben ist nicht möglich: Jemand hat sein Wichtelkind schon angesehen oder ein Chat hat begonnen.',
  'pairs.cancelled': '↩️ In der Runde {title} wurde <b>die Auslosung aufgehoben</b>. Dein Wunschzettel bleibt erhalten. Sobald neu ausgelost wird, meldet sich der Bot.',
  'pairs.forceCancelled': '↩️ Der Inhaber hat in der Runde {title} <b>die Auslosung aufgehoben</b>. Das bisherige Paar gilt nicht mehr, die Chats mit deinem Wichtel und deinem Wichtelkind wurden gelöscht. Dein Wunschzettel bleibt erhalten. Sobald neu ausgelost wird, meldet sich der Bot.',
  // Log details
  'pairs.auditText.members': 'Teilnehmer: {n}',
  'pairs.auditText.changed': 'Paare geändert: {n}',
  'pairs.auditText.removed': 'Paare entfernt: {n}',
};
