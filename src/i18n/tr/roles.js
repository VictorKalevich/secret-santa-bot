// Texts of src/roles.js (060): bot owner, event owner and admins (063), participation transfer. {name}, {from}, {to},
// {actor}, {who} in messages - names (HTML), {title} - the event title in quotes (HTML)
export default {
  // App button under a message about new rights
  'roles.openButton': "🛠 Aç",
  'roles.botOwner.byLink': "⚠️ Bot sahipliği kurulum sayfasındaki bağlantıyla devredildi; yeni bot sahibi: <b>{name}</b>. Etkinliklerin sende kalıyor.\n\nBu sen değilsen ve önceden konuşulmadıysa ADMIN_SECRET değerini değiştir (bkz. README), kurulum sayfasını aç ve yeni sahip bağlantısını kullan.",
  'roles.botOwner.transferred': "👑 <b>Bot sahipliği sana devredildi.</b> Bot günlüğü, tüm etkinlikler ve sahipliği devretme uygulamada: ⚙️ «Ayarlar» → «Bot sahibi».",
  'roles.botOwner.notice': "ℹ️ <b>{name}</b> artık bot sahibi.",
  // Passing the bot owner rights
  'roles.transferTarget': "Sahiplik yalnızca kayıtlı bir kişiye devredilebilir.",
  'roles.alreadyOwnerSelf': "Sahip zaten sensin.",
  'roles.alreadyTransferred': "Sahiplik zaten devredildi.",
  // Event admins
  'roles.alreadyAdmin': "Bu kişi zaten yönetici.",
  'roles.notAdmin': "Bu kişi yönetici değil.",
  'roles.grantMember': "Yalnızca etkinliğin bir katılımcısı atanabilir.",
  'roles.revokeOwner': "Sahibin yetkileri kaldırılamaz. Önce etkinlik sahipliğini devret.",
  'roles.granted': "🛠 <b>{title} etkinliğine yönetici olarak atandın.</b>\n\nArtık etkinliği yönetebilirsin: davetler, istisnalar, çekiliş, hatırlatmalar. Eşleşmeleri yalnızca etkinliğin sahibi, denetim görünümünde açabilir.",
  'roles.grantedNotice': "ℹ️ <b>{name}</b> artık {title} etkinliğinin yöneticisi.",
  'roles.revoked': "{title} etkinliğindeki yöneticiliğin kaldırıldı. Bu etkinliğe katılıyorsan her zamanki gibi oynamaya devam ediyorsun.",
  'roles.revokedNotice': "ℹ️ <b>{name}</b> artık {title} etkinliğinin yöneticisi değil.",
  // Event ownership
  'roles.owner.already': "Bu kişi zaten sahip.",
  'roles.owner.target': "Sahiplik yalnızca etkinliğin bir katılımcısına ya da yöneticisine devredilebilir.",
  'roles.owner.alreadyPassed': "Sahiplik zaten devredildi.",
  'roles.owner.toNew': "👑 <b>Artık {title} etkinliğinin sahibisin.</b> Yönetici atıyor, denetim görünümünü açıyor, etkinliği sıfırlayıp siliyorsun — hepsi uygulamada.",
  'roles.owner.toPrev': "ℹ️ {title} etkinliğinin yeni sahibi: <b>{who}</b>. Sen yönetici olarak kalıyorsun.",
  'roles.owner.notice': "ℹ️ {title} etkinliğinin yeni sahibi: <b>{who}</b>.",
  'roles.transfer.twoRecords': "İki farklı kayıt seç.",
  'roles.transfer.staffTarget': "Katılım, sahibin ya da bir yöneticinin hesabına taşınamaz.",
  'roles.transfer.noOld': "Eski kayıt bulunamadı.",
  'roles.transfer.unregistered': "Yeni hesap kaydı tamamlamalı (bota ismini yazmalı).",
  'roles.transfer.inDraw': "Yeni hesap «{title}» etkinliğinin çekilişinde zaten var — başka bir kayıt seç.",
  'roles.transfer.toNew': "🔁 Bot sahibi, Gizli Noel Baba'daki katılımını bu hesaba taşıdı: mektuplar, alıcılar, yazışmalar ve etkinlik geçmişi korundu.",
  'roles.transfer.toOld': "🔁 Gizli Noel Baba'daki katılımın <b>{to}</b> hesabına taşındı. Taşıma istemediysen bot sahibiyle iletişime geç.",
  'roles.transfer.notice': "🔁 <b>{actor}</b> katılımı taşıdı: <b>{from}</b> → <b>{to}</b>.",
  'roles.audit.newOwner': "→ {name}",
  'roles.audit.accountMoved': "{from} → {to}",
};
