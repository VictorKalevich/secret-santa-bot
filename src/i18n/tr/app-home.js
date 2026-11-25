// Texts of app part 03-home (060): the "My events" home screen and the "New event" sheet (063)
export default {
  'app.home.unsaved': 'Mektup kaydedilmedi. Kaydetmeden çıkılsın mı?',
  'app.home.toEvents': "Etkinlik listesine dön",
  'app.home.you': "  (sen)",
  'app.home.finished': "bitti",
  'app.home.active': "devam ediyor",
  'app.home.notMember': "katılmıyorsun",
  // Home screen (063): running and finished events; {n} - number of finished ones
  'app.home.greet': "Merhaba, {name}!",
  'app.home.going': "Devam edenler",
  'app.home.done': "Bitenler · {n}",
  'app.home.empty.create': "Henüz etkinlik yok. Kendi etkinliğini oluştur — düğme aşağıda — ya da bir etkinliğin davet bağlantısını iste.",
  'app.home.empty.join': "Henüz hiçbir etkinliğe katılmıyorsun. Bir etkinliğin davet bağlantısını iste.",
  // Bot owner in someone else's event (063): notice above "Info" and "Manage"
  'app.home.guest': "Burada bot sahibi olarak bulunuyorsun: etkinliğin listelerinde yoksun, yöneticilere giden mesajlar sana gelmez. Yaptığın değişiklikler etkinliğin günlüğüne kaydedilir.",
  // New event (007: from a template; 063: the creator is the owner, limit); {year} is the next year
  'app.home.create.button': "🎄 Etkinlik oluştur",
  'app.home.create.title': "Yeni etkinlik",
  'app.home.create.hint': 'Etkinliğin adını yaz',
  'app.home.create.name': "Etkinlik adı",
  'app.home.create.placeholder': 'Yılbaşı {year} — aile',
  'app.home.create.noTemplate': "Şablonsuz — sıfırdan",
  'app.home.create.fromTemplate': "Şablon: {title}",
  'app.home.create.invite': "Şablonun katılımcılarını davet et",
  'app.home.create.templateHint': "Şablondan bütçe, yer, notlar, çekiliş kuralları ve istisnalar kopyalanır. Tarihler kopyalanmaz.",
  'app.home.create.participate': "Ben de katılıyorum",
  // Limit (063): {n} - how many more are allowed; {limit} - the limit per 12 months, {date} - when a slot frees up
  'app.home.create.left': {
    one: "12 ay içinde {n} etkinlik daha oluşturabilirsin.",
    other: "12 ay içinde {n} etkinlik daha oluşturabilirsin.",
  },
  'app.home.create.full': "12 ay içinde en fazla {limit} etkinlik oluşturulabilir. Sonraki etkinlik {date} tarihinden itibaren oluşturulabilir.",
  'app.home.create.done': "🎄 Etkinlik oluşturuldu",
  'app.home.create.doneInvited': "🎄 Etkinlik oluşturuldu, davet: {count}",
  'app.home.create.doneInviteError': "🎄 Etkinlik oluşturuldu. {error}",
};
