// Static, developer-authored content (not user-submitted) — rendered via
// dangerouslySetInnerHTML in src/app/(site)/privacy/page.tsx, same pattern
// as src/lib/content/rules.ts. Written informally (no registered legal
// entity/INN referenced — "администрация Hikoya" throughout, matching how
// rules.ts is worded) rather than fabricating company registration details
// nobody confirmed. Have this reviewed properly before treating it as a
// finished, compliance-grade document. Update in place when data handling
// changes — there's no CMS/admin UI for this by design.

export const PRIVACY_HTML_RU = `
<h1>Политика конфиденциальности Hikoya</h1>
<p><strong>Последнее обновление:</strong> 24.09.2026</p>
<p>Эта политика объясняет, какие данные собирает платформа <strong>Hikoya</strong>, зачем, как они используются и хранятся, и какие права есть у вас в отношении своих данных.</p>
<p>Используя платформу, вы соглашаетесь с этой политикой.</p>

<h1>1. Какие данные мы собираем</h1>
<h3>1.1. Данные аккаунта</h3>
<p>При регистрации и использовании аккаунта мы получаем:</p>
<ul>
<li>адрес электронной почты;</li>
<li>пароль (хранится в зашифрованном виде, мы не видим его в открытом виде);</li>
<li>имя пользователя, отображаемое имя, фотографию профиля и описание «о себе», если вы их указали;</li>
<li>данные от Google, если вы входите через Google-аккаунт (имя, email, аватар — в объёме, который предоставляет сама Google);</li>
<li>жанровые интересы, если вы указали их для персонализации ленты «Для вас».</li>
</ul>
<h3>1.2. Контент, который вы создаёте</h3>
<p>Опубликованные истории и главы, комментарии, отзывы, заявки на доске заявок, списки чтения, лайки, подписки на авторов и подборки — то есть всё, что вы сами добавляете на платформу.</p>
<h3>1.3. Технические данные</h3>
<p>Данные об использовании сайта: IP-адрес, тип устройства и браузера, посещённые страницы, действия на платформе. Часть этих данных собирается через файлы cookie — подробнее в <strong>Политике использования cookie</strong>.</p>
<h3>1.4. Telegram</h3>
<p>Если вы привязываете аккаунт к нашему Telegram-боту или обращаетесь через него в поддержку, мы получаем ваш Telegram ID и содержание обращения — это нужно, чтобы присылать уведомления и отвечать на вопросы.</p>

<h1>2. Зачем мы используем эти данные</h1>
<p>Мы используем собранные данные, чтобы:</p>
<ul>
<li>создать и поддерживать ваш аккаунт, авторизовать вход;</li>
<li>показывать опубликованные вами истории другим читателям;</li>
<li>персонализировать ленту и рекомендации;</li>
<li>отправлять уведомления о новых главах, комментариях, подписках и статусе заявок (через сайт и/или Telegram);</li>
<li>обеспечивать модерацию и безопасность платформы, рассматривать жалобы и обращения;</li>
<li>анализировать использование платформы через Google Analytics, чтобы улучшать её работу;</li>
<li>отвечать на обращения в поддержку.</li>
</ul>
<p>Мы не продаём ваши персональные данные третьим лицам и не передаём их для рекламных рассылок сторонних компаний.</p>

<h1>3. Кому мы можем передавать данные</h1>
<p>Часть данных обрабатывается сервисами, которые технически обеспечивают работу платформы:</p>
<ul>
<li><strong>Supabase</strong> — база данных, аутентификация и хранение файлов (аватары, обложки, изображения глав);</li>
<li><strong>Google Analytics</strong> — статистика посещаемости (обезличенная и агрегированная для целей анализа);</li>
<li><strong>Telegram</strong> — доставка уведомлений и обращений в поддержку, если вы ими пользуетесь.</li>
</ul>
<p>Эти сервисы обрабатывают данные в объёме, необходимом для их функции, и по своим собственным политикам конфиденциальности.</p>
<p>Мы можем раскрыть данные, если это требуется по закону или необходимо для защиты прав платформы, пользователей или третьих лиц.</p>

<h1>4. Публичность данных</h1>
<p>Некоторые данные видны другим пользователям и посетителям сайта по умолчанию: отображаемое имя, имя пользователя, фото профиля, описание «о себе», опубликованные истории, комментарии и публичная активность (лайки, подписки, если не скрыты).</p>
<p>Адрес электронной почты и пароль никогда не показываются публично.</p>

<h1>5. Хранение данных</h1>
<p>Мы храним данные, пока ваш аккаунт активен. После удаления аккаунта мы удаляем или обезличиваем персональные данные в разумные сроки, за исключением случаев, когда более долгое хранение требуется по закону или необходимо для разрешения спора, обеспечения безопасности или исполнения наших обязательств.</p>
<p>Опубликованные истории и главы могут быть удалены автором самостоятельно в любой момент — подробнее в <strong>Правилах платформы</strong>.</p>

<h1>6. Cookie</h1>
<p>Платформа использует файлы cookie для входа в аккаунт, сохранения языка и темы оформления, ограниченного доступа к главам для гостей и аналитики. Подробный список и назначение каждого вида cookie — в <strong>Политике использования cookie</strong>.</p>

<h1>7. Ваши права</h1>
<p>В отношении своих персональных данных вы можете:</p>
<ul>
<li>просматривать и редактировать данные профиля в настройках аккаунта;</li>
<li>менять пароль или способ входа;</li>
<li>удалять опубликованные истории, главы и комментарии;</li>
<li>запросить у нас копию своих данных или их удаление, написав в поддержку;</li>
<li>удалить аккаунт целиком.</li>
</ul>
<p>Мы стараемся обрабатывать такие обращения в разумные сроки. Обратите внимание: удаление аккаунта необратимо, и мы не гарантируем восстановление данных после удаления.</p>

<h1>8. Дети и несовершеннолетние</h1>
<p>Платформа не предназначена для детей младше 13 лет — мы не собираем данные о возрасте намеренно, но просим не создавать аккаунт, если вам меньше 13 лет, без согласия родителя или опекуна.</p>
<p>Отдельные произведения могут содержать материалы, подходящие не для всех возрастов, и маркируются соответствующим образом — см. <strong>Правила платформы</strong>.</p>

<h1>9. Безопасность</h1>
<p>Мы применяем разумные технические меры для защиты данных: шифрование паролей, защищённое соединение (HTTPS), ограничение доступа к данным внутри команды. Полностью исключить риски невозможно ни для одной онлайн-платформы, поэтому мы также просим вас не передавать данные для входа другим людям и использовать надёжный пароль.</p>

<h1>10. Изменение политики</h1>
<p>Мы можем время от времени обновлять эту политику по мере развития платформы. Актуальная версия всегда доступна на этой странице. При существенных изменениях мы постараемся обратить на них внимание пользователей.</p>

<h1>11. Контакты</h1>
<p>Вопросы о данных, запросы на их изменение или удаление — пишите нам:</p>
<p><strong>Telegram:</strong> <a href="https://t.me/hikoya_auth_bot" target="_blank" rel="noopener noreferrer">@hikoya_auth_bot</a></p>
<p><strong>Сайт:</strong> <a href="https://hikoya.org">hikoya.org</a></p>
<p><strong>Последнее обновление:</strong> 24.09.2026<br/><strong>Версия:</strong> 1.0</p>
`;

export const PRIVACY_HTML_UZ = `
<h1>Hikoya maxfiylik siyosati</h1>
<p><strong>Oxirgi yangilanish:</strong> 24.09.2026</p>
<p>Ushbu siyosat <strong>Hikoya</strong> platformasi qanday maʼlumotlarni toʻplashi, nima uchun, ular qanday ishlatilishi va saqlanishi, hamda oʻz maʼlumotlaringizga nisbatan qanday huquqlarga egaligingizni tushuntiradi.</p>
<p>Platformadan foydalanib, siz ushbu siyosatga rozilik bildirasiz.</p>

<h1>1. Qanday maʼlumotlarni toʻplaymiz</h1>
<h3>1.1. Akkaunt maʼlumotlari</h3>
<p>Roʻyxatdan oʻtish va akkauntdan foydalanish jarayonida biz quyidagilarni olamiz:</p>
<ul>
<li>elektron pochta manzili;</li>
<li>parol (shifrlangan holda saqlanadi, biz uni ochiq koʻrinishda koʻrmaymiz);</li>
<li>foydalanuvchi nomi, koʻrsatiladigan ism, profil surati va "o'zim haqimda" tavsifi, agar ularni kiritgan boʻlsangiz;</li>
<li>Google orqali kirsangiz, Google'dan olingan maʼlumotlar (ism, email, avatar — Google taqdim etadigan hajmda);</li>
<li>"Siz uchun" lentasini shaxsiylashtirish uchun koʻrsatgan janr qiziqishlaringiz.</li>
</ul>
<h3>1.2. Siz yaratgan kontent</h3>
<p>Chop etilgan hikoyalar va boblar, izohlar, sharhlar, soʻrovlar doskasidagi murojaatlar, oʻqish roʻyxatlari, layklar, mualliflarga obunalar va tanlanmalar — yaʼni platformaga oʻzingiz qoʻshadigan hamma narsa.</p>
<h3>1.3. Texnik maʼlumotlar</h3>
<p>Saytdan foydalanish haqidagi maʼlumotlar: IP-manzil, qurilma va brauzer turi, tashrif buyurilgan sahifalar, platformadagi harakatlar. Ushbu maʼlumotlarning bir qismi cookie fayllari orqali toʻplanadi — batafsil <strong>Cookie siyosati</strong>da.</p>
<h3>1.4. Telegram</h3>
<p>Agar akkauntingizni Telegram botimizga bogʻlasangiz yoki u orqali yordam xizmatiga murojaat qilsangiz, biz sizning Telegram ID'ingiz va murojaat mazmunini olamiz — bu bildirishnomalar yuborish va savollarga javob berish uchun kerak.</p>

<h1>2. Bu maʼlumotlardan nima uchun foydalanamiz</h1>
<p>Toʻplangan maʼlumotlardan quyidagi maqsadlarda foydalanamiz:</p>
<ul>
<li>akkauntingizni yaratish va yuritish, kirishni avtorizatsiya qilish;</li>
<li>chop etgan hikoyalaringizni boshqa oʻquvchilarga koʻrsatish;</li>
<li>lenta va tavsiyalarni shaxsiylashtirish;</li>
<li>yangi boblar, izohlar, obunalar va soʻrovlar holati haqida bildirishnoma yuborish (sayt va/yoki Telegram orqali);</li>
<li>platforma moderatsiyasi va xavfsizligini taʼminlash, shikoyat va murojaatlarni koʻrib chiqish;</li>
<li>platformani takomillashtirish uchun Google Analytics orqali foydalanishni tahlil qilish;</li>
<li>yordam xizmatiga murojaatlarga javob berish.</li>
</ul>
<p>Biz shaxsiy maʼlumotlaringizni uchinchi shaxslarga sotmaymiz va uchinchi tomon reklama tarqatishlari uchun bermaymiz.</p>

<h1>3. Maʼlumotlarni kimga berishimiz mumkin</h1>
<p>Maʼlumotlarning bir qismini platforma ishlashini texnik taʼminlaydigan xizmatlar qayta ishlaydi:</p>
<ul>
<li><strong>Supabase</strong> — maʼlumotlar bazasi, autentifikatsiya va fayllarni saqlash (avatarlar, muqovalar, bob rasmlari);</li>
<li><strong>Google Analytics</strong> — tashrif statistikasi (tahlil maqsadida shaxssizlantirilgan va umumlashtirilgan);</li>
<li><strong>Telegram</strong> — bildirishnomalar va yordam xizmatiga murojaatlarni yetkazish, agar ulardan foydalansangiz.</li>
</ul>
<p>Bu xizmatlar maʼlumotlarni oʻz funksiyasi uchun zarur hajmda va oʻzining maxfiylik siyosatiga muvofiq qayta ishlaydi.</p>
<p>Qonun talab qilsa yoki platforma, foydalanuvchilar yoki uchinchi shaxslarning huquqlarini himoya qilish uchun zarur boʻlsa, maʼlumotlarni oshkor qilishimiz mumkin.</p>

<h1>4. Maʼlumotlarning ochiqligi</h1>
<p>Baʼzi maʼlumotlar boshqa foydalanuvchilar va sayt tashrif buyuruvchilariga standart holda koʻrinadi: koʻrsatiladigan ism, foydalanuvchi nomi, profil surati, "o'zim haqimda" tavsifi, chop etilgan hikoyalar, izohlar va ochiq faollik (layklar, obunalar, agar yashirilmagan boʻlsa).</p>
<p>Elektron pochta manzili va parol hech qachon ochiq koʻrsatilmaydi.</p>

<h1>5. Maʼlumotlarni saqlash</h1>
<p>Akkauntingiz faol boʻlgan davrda maʼlumotlarni saqlaymiz. Akkaunt oʻchirilgandan keyin shaxsiy maʼlumotlarni oqilona muddatlarda oʻchiramiz yoki shaxssizlantiramiz — bundan tashqari, qonun talab qiladigan yoki nizoni hal qilish, xavfsizlikni taʼminlash yoki oʻz majburiyatlarimizni bajarish uchun uzoqroq saqlash zarur boʻlgan hollar bundan mustasno.</p>
<p>Chop etilgan hikoyalar va boblarni muallif istalgan vaqtda mustaqil oʻchirishi mumkin — batafsil <strong>Platforma qoidalari</strong>da.</p>

<h1>6. Cookie</h1>
<p>Platforma akkauntga kirish, til va mavzu sozlamalarini saqlash, mehmonlar uchun boblarga cheklangan kirish va tahlil uchun cookie fayllaridan foydalanadi. Har bir cookie turi va uning vazifasi haqida batafsil — <strong>Cookie siyosati</strong>da.</p>

<h1>7. Sizning huquqlaringiz</h1>
<p>Shaxsiy maʼlumotlaringizga nisbatan siz quyidagilarni qilishingiz mumkin:</p>
<ul>
<li>akkaunt sozlamalarida profil maʼlumotlarini koʻrish va tahrirlash;</li>
<li>parolni yoki kirish usulini oʻzgartirish;</li>
<li>chop etilgan hikoyalar, boblar va izohlarni oʻchirish;</li>
<li>yordam xizmatiga yozib, maʼlumotlaringiz nusxasini yoki ularni oʻchirishni soʻrash;</li>
<li>akkauntni butunlay oʻchirish.</li>
</ul>
<p>Biz bunday murojaatlarni oqilona muddatlarda koʻrib chiqishga harakat qilamiz. Eʼtibor bering: akkauntni oʻchirish qaytarib boʻlmaydi va oʻchirilgandan keyin maʼlumotlarni tiklashga kafolat bermaymiz.</p>

<h1>8. Bolalar va voyaga yetmaganlar</h1>
<p>Platforma 13 yoshgacha boʻlgan bolalar uchun moʻljallanmagan — biz yosh haqida maʼlumotni ataylab toʻplamaymiz, lekin agar sizga 13 yoshdan kam boʻlsa, ota-ona yoki vasiyning roziligisiz akkaunt yaratmaslikni soʻraymiz.</p>
<p>Alohida asarlar barcha yoshdagilar uchun mos boʻlmagan materiallarni oʻz ichiga olishi mumkin va tegishlicha belgilanadi — qarang <strong>Platforma qoidalari</strong>.</p>

<h1>9. Xavfsizlik</h1>
<p>Biz maʼlumotlarni himoya qilish uchun oqilona texnik choralarni qoʻllaymiz: parollarni shifrlash, himoyalangan ulanish (HTTPS), jamoa ichida maʼlumotlarga kirishni cheklash. Hech qanday onlayn-platforma uchun xavflarni butunlay yoʻqotib boʻlmaydi, shuning uchun sizdan ham kirish maʼlumotlaringizni boshqalarga bermaslikni va ishonchli paroldan foydalanishni soʻraymiz.</p>

<h1>10. Siyosatni oʻzgartirish</h1>
<p>Platforma rivojlanishi bilan biz ushbu siyosatni vaqti-vaqti bilan yangilashimiz mumkin. Dolzarb versiya doim shu sahifada mavjud boʻladi. Jiddiy oʻzgarishlar boʻlsa, foydalanuvchilar eʼtiborini ularga qaratishga harakat qilamiz.</p>

<h1>11. Aloqa</h1>
<p>Maʼlumotlar haqida savollar, ularni oʻzgartirish yoki oʻchirish soʻrovlari — bizga yozing:</p>
<p><strong>Telegram:</strong> <a href="https://t.me/hikoya_auth_bot" target="_blank" rel="noopener noreferrer">@hikoya_auth_bot</a></p>
<p><strong>Sayt:</strong> <a href="https://hikoya.org">hikoya.org</a></p>
<p><strong>Oxirgi yangilanish:</strong> 24.09.2026<br/><strong>Versiya:</strong> 1.0</p>
`;
