// Texts of src/membership.js (061, German): joining, join requests, families, "I take part", leaving
export default {
  // Families (008): rules and frozen members during a running draw (009)
  'membership.familyNameRule': 'Der Name der Familie muss 1 bis 40 Zeichen lang sein.',
  'membership.familySize': 'Eine Familie muss aus 2 bis {max} Personen bestehen.',
  'membership.familyNotFound': 'Familie nicht gefunden.',
  'membership.memberNotFound': 'Teilnehmer nicht gefunden.',
  'membership.alreadyInFamily': '{name} ist bereits in der Familie «{family}».',
  'membership.familyFrozen': 'Die Familie lässt sich nicht ändern, solange die Runde «{title}» mit erfolgter Auslosung läuft: Sonst ließen sich die Paare über den Austausch von Teilnehmern erraten. Änderungen sind nach ihrem Ende möglich.',
  // Log: family - name and members, "I take part"
  'membership.audit.familySave': '«{name}»: {people}',
  'membership.audit.familyDelete': '«{name}»',
  'membership.audit.isParticipant': 'macht mit',
  'membership.audit.notParticipant': 'macht nicht mit',
  'membership.afterDraw': 'Nach der Auslosung geht das nicht mehr. Bitte {owner.gen}, dich in die Auslosung aufzunehmen.',
  // Participant leaving (035)
  'membership.leaveAfterDraw': 'Die Auslosung hat bereits stattgefunden. Um auszutreten, wende dich an den Inhaber oder die Admins.',
  'membership.leaveFinished': 'Die Runde ist beendet – austreten ist nicht mehr möglich.',
  'membership.leaveNotice': '🚪 <b>{name}</b> verlässt die Runde {title}.',
  'membership.openEventButton': '🛠 Runde öffnen',
  // Returning removed people (010)
  'membership.notRemoved': 'Diese Person ist nicht unter den Entfernten.',
  // Joining and join requests (008)
  'membership.joinedNotice': '👋 <b>{name}</b> macht jetzt bei der Runde {title} mit',
  'membership.request': '🙋 <b>{name}</b> möchte bei der Runde {title} mitmachen.',
  'membership.requestWithUsername': '🙋 <b>{name}</b> (@{username}) möchte bei der Runde {title} mitmachen.',
  'membership.acceptButton': '✅ Annehmen',
  'membership.rejectButton': '❌ Ablehnen',
  'membership.requestNotFound': 'Beitrittsanfrage nicht gefunden.',
  'membership.requestDecided': 'Über die Beitrittsanfrage wurde bereits entschieden.',
  'membership.approveFinished': 'Die Runde ist beendet – aufnehmen ist nicht mehr möglich.',
  'membership.approveClosed': 'Die Anmeldung für die Runde «{title}» ist geschlossen – öffne sie, um die Beitrittsanfrage anzunehmen.',
  // Decision on a join request: to the participant and to the other admins
  'membership.approvedAfterDraw': '🎉 Beitrittsanfrage angenommen – du bist in der Runde {title}! Die Auslosung hat schon stattgefunden – {owner.nom} nimmt dich in sie auf, der Bot sagt dir dann Bescheid. Schreib in der Zwischenzeit deinen Wunschzettel.',
  'membership.approved': '🎉 Beitrittsanfrage angenommen – du bist in der Runde {title}! Öffne die App und schreib deinen Wunschzettel für deinen Wichtel.',
  'membership.requestRejected': 'Deine Beitrittsanfrage für die Runde {title} wurde abgelehnt. Falls das ein Fehler ist, wende dich an den Inhaber oder einen Admin.',
  'membership.approvedBy': '✅ <b>{by}</b> hat die Beitrittsanfrage von <b>{name}</b> für die Runde {title} angenommen.',
  'membership.rejectedBy': '❌ <b>{by}</b> hat die Beitrittsanfrage von <b>{name}</b> für die Runde {title} abgelehnt.',
};
