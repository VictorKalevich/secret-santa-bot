// Texts of src/api.js (061, German): check pipeline and action handlers. {owner.nom}, {owner.dat} - "der Inhaber" or
// "der Bot-Inhaber" (ownerWord) in the needed case; {word} - the confirmation word of the action.
export default {
  'api.badInitData': 'Der Zugang konnte nicht geprüft werden. Öffne die App erneut aus dem Chat mit dem Bot.',
  'api.unknownAction': 'Unbekannte Aktion',
  'api.noEvent': 'Runde nicht gefunden.',
  'api.chooseRoom': 'Wähle einen Raum.',
  // What is not allowed in a finished round (field finished of the action table)
  'api.closed': 'Die Runde ist beendet – ändern lässt sie sich nicht mehr (möglich sind Ansehen, Aufdecken und Löschen).',
  'api.letterClosed': 'Die Runde ist beendet: Der Wunschzettel ist nur noch lesbar.',
  'api.markClosed': 'Die Runde ist beendet: Die Markierung ist nur noch lesbar.',
  'api.maskClosed': 'Die Runde ist beendet: Die Maske lässt sich nicht mehr ändern.',
  // Confirmation word (field confirm): refusal without the word
  'api.confirm.delete': 'Gib zum Löschen das Wort {word} ein.',
  'api.confirm.leave': 'Gib zum Austreten das Wort {word} ein.',
  'api.confirm.cancel': 'Gib zum Aufheben das Wort {word} ein.',
  'api.confirm.reset': 'Gib zum vollständigen Zurücksetzen das Wort {word} ein.',
  'api.confirm.vault': 'Gib für die Kontrollansicht das Wort {word} ein.',
  // Refusal for non-owners (field owner): api.owner.* - with ownerWord of the room, api.botOwner.* - always the bot owner
  'api.owner.roles': 'Admins ernennen und entfernen kann nur {owner.nom}.',
  'api.owner.vault': 'Die Kontrollansicht steht nur {owner.dat} zur Verfügung.',
  'api.owner.swap': 'Wichtelkinder nach der Auslosung tauschen kann nur {owner.nom}.',
  'api.owner.transfer': 'Die Inhaberrechte übertragen kann nur {owner.nom}.',
  'api.owner.insert': 'Nach der Auslosung jemanden in sie aufnehmen kann nur {owner.nom}.',
  'api.owner.fixed': 'Paare festlegen kann nur {owner.nom}.',
  'api.owner.forceCancel': 'Die Auslosung zwangsweise aufheben kann nur {owner.nom}.',
  'api.owner.eventDelete': 'Die Runde löschen kann nur {owner.nom}.',
  'api.owner.reset': 'Vollständig zurücksetzen kann nur {owner.nom}.',
  'api.botOwner.transfer': 'Teilnahmen auf ein neues Konto übertragen kann nur der Bot-Inhaber.',
  'api.botOwner.companyDelete': 'Einen Raum löschen kann nur der Bot-Inhaber.',
  'api.botOnly': 'Nur für den Bot-Inhaber.',
  // Handlers
  'api.nameRule': 'Der Name muss 1 bis 40 Zeichen lang sein',
  // 061: language choice - code not in the bot languages
  'api.lang.unknown': 'Diese Sprache gibt es nicht.',
  'api.templateNotFound': 'Vorlage nicht gefunden.',
  'api.memberNotFound': 'Teilnehmer nicht gefunden',
  'api.renameAdmin': 'Admins umbenennen kann nur {owner.nom}.',
  'api.renameSelfOnly': 'Diese Person ändert ihren Namen selbst: «Profil» → «✏️ Name ändern».',
  'api.ownerNotTransferred': 'Der Eintrag des Inhabers wird nicht übertragen: Der Inhaber stellt seinen Zugang über einen neuen Inhaber-Link wieder her (ADMIN_SECRET ändern → Seite /setup).',
  'api.removeSelf': 'Du kannst dich nicht selbst entfernen – schalte «Ich mache mit» aus.',
  'api.removeOwner': 'Der Inhaber kann nicht aus der Runde entfernt werden. Zuerst muss er die Inhaberrechte übertragen.',
  'api.removeAdmin': 'Admins entfernen kann nur {owner.nom}.',
  'api.drawDone': 'Die Auslosung hat bereits stattgefunden.',
  'api.chooseOtherEvent': 'Wähle eine andere Runde.',
  'api.inviteFinished': 'Die Runde ist beendet – Einladungen sind nicht mehr möglich.',
};
