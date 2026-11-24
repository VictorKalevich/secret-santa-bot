# Глоссарий: индонезийский (`id`)

Обращение — на «ты» (*kamu*, притяжательное *-mu*: *suratmu*, *Santa-mu*); бот о себе — *aku*; блок поддержки
проекта (`app.event.donate.*`) — *Anda*. Кавычки — «…», как у названий событий, которые подставляет сервер.

| Русский | Индонезийский | Пояснение |
|---|---|---|
| Тайный Санта | Secret Santa | название игры и бота, так говорят в Индонезии; «твой Тайный Санта» — *Secret Santa-mu* |
| Санта | Santa | дефис перед суффиксом у иностранного слова: *Santa-mu* |
| подопечный | penerima kado | «получатель подарка»; рядом со словом *kado* и в коротких подписях — *penerima* (вкладка «Penerima», чип «belum membuka penerima») |
| событие | acara | |
| комната | ruang | «Ruang N», «🚪 Buat ruang»; не *perusahaan* (компания) |
| владелец (комнаты) | pemilik | падежей нет — все формы `common.owner.*` одинаковые, `nomCap` — *Pemilik* |
| владелец бота | pemilik bot | все формы одинаковые, `nomCap` — *Pemilik bot* |
| администратор | admin | так принято в индонезийских приложениях |
| организаторы | penyelenggara | редко; обычно «pemilik dan admin» |
| участник | peserta | |
| письмо (Санте) | surat (untuk Santa) | |
| жеребьёвка | undian | провести — *lakukan undian*; проведена — *sudah dilakukan* |
| кольцевая жеребьёвка | undian melingkar | метка — *(melingkar)* |
| взаимная пара | pasangan timbal balik | |
| исключение | pengecualian | |
| закреплённая пара | pasangan tetap | закрепить — *tetapkan pasangan* |
| семья | keluarga | «Учитывать семьи» — *Perhitungkan keluarga* |
| заявка | permintaan bergabung | в коротких отказах и кнопках — *permintaan* |
| обращение | tiket | «тикет поддержки»; взять — *ambil*, передать — *alihkan*, ведёт — *ditangani* |
| ответственный (за обращение) | penanggung jawab | ничьё — *tanpa penanggung jawab* |
| служебный просмотр | tampilan khusus | |
| опасная зона | zona berbahaya | |
| журнал действий | log aktivitas | журнал события / общий / бота — *Log acara / Log umum / Log bot* |
| история (событий) | riwayat | |
| открытка | kartu | «Kartu ucapan» сокращено до *kartu* |
| маска | topeng | надел маску — *memakai topeng*; сняли — *dilepas* |
| раскрытие | pengungkapan | раскрыть Сант — *ungkap para Santa*; тайна раскрыта — *rahasia terungkap* |
| образец (событие-шаблон) | templat | |
| переписка (Санта ↔ подопечный) | obrolan | |
| чат с ботом / в Telegram | chat | Telegram-чат, не переписка в приложении |
| подарок | kado | обмен подарками — *tukar kado* |
| подарок готов | kado siap | |
| подарок получен / «получил» | kado diterima / diterima | |
| вручение, дата вручения | tukar kado, tanggal tukar kado | |
| посылка | paket | |
| отправка | pengiriman | отметить отправку — *tandai sudah dikirim* |
| трек-номер | nomor resi | так в Индонезии называют номер отслеживания |
| служба доставки | jasa pengiriman | |
| адрес доставки | alamat pengiriman | |
| регистрация | pendaftaran | открыта / закрыта — *dibuka / ditutup* |
| приглашение | undangan | |
| пригласительная ссылка | tautan undangan | |
| ссылка | tautan | ссылка владельца — *tautan pemilik* |
| удалить (человека из события) | keluarkan | удалённые — *yang dikeluarkan*; данные, события, комнаты — *hapus* |
| перенос участия | pemindahan keikutsertaan | перенести — *pindahkan* |
| назначить / снять администратора | tunjuk / copot | |
| передать права владельца | serahkan hak pemilik | |
| напоминание | pengingat | |
| объявление | pengumuman | |
| бюджет | anggaran | пример — *maks. Rp100.000* |
| черновик | draf | опубликовать — *terbitkan* |
| автожеребьёвка | undian otomatis | |
| полный сброс | reset total | сбросить — *reset* |
| завершить / завершено | selesaikan / selesai | идёт — *berlangsung* |
| Управление (вкладка) | Kelola | |
| Письмо / Подопечный / Инфо (вкладки) | Surat / Penerima / Info | |
| Параметры | Pengaturan | |
| Настройка (страница /setup) | Penyiapan | чтобы не путать с *Pengaturan* события |
| «Я участвую» | Aku ikut | |
| Профиль | Profil | |
| Уведомления | Notifikasi | |
| Язык | Bahasa | «Как в Telegram» — *Sesuai Telegram* |
| Сохранить / Сохранено | Simpan / Tersimpan | |
| Отмена (действия) | Batal | отменить — *batalkan* |
| Готово | Selesai | |
| Закрыть | Tutup | |
| Открыть | Buka | |
| Создать | Buat | |
| Отправить | Kirim | |
| Ответить | Balas | |

## Слова подтверждения

| Ключ | Слово |
|---|---|
| `app.core.word.open` | BUKA |
| `app.core.word.leave` | KELUAR |
| `app.core.word.delete` | HAPUS |
| `app.core.word.reset` | RESET |
| `app.core.word.cancel` | BATAL |

## Формы и даты

- Формы числа: у индонезийского одна категория — `other` (`Intl.PluralRules('id')`).
- Дата — `{day} {month}` («25 November»), месяцы в обоих списках одинаковые; дни недели — Sen, Sel, Rab, Kam, Jum,
  Sab, Min; время — «pukul {time}»; `app.core.locale` — `id`.
