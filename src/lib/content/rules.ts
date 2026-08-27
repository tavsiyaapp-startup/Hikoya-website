// Static, developer-authored content (not user-submitted) — rendered via
// dangerouslySetInnerHTML in src/app/(site)/rules/page.tsx without going
// through sanitizeHtml(), since that allowlist is scoped to the chapter
// rich-text editor's schema and doesn't include h3/ul/li/a. Source: the
// user's "Правила использования.docx", converted with mammoth, with
// [НАЗВАНИЕ]/[Название] filled in as "Hikoya" and the contact section's
// placeholders filled with the real support channels. Update in place when
// the rules change — there's no CMS/admin UI for this by design.

export const RULES_HTML_RU = `
<h1>Правила платформы Hikoya</h1>
<p><strong>Последнее обновление:</strong> 27.08.2026</p>
<p>Мы создаём <strong>Hikoya</strong> как пространство, где можно писать, публиковать, читать и обсуждать книги и другие литературные произведения.</p>
<p>Чтобы платформа оставалась комфортным и безопасным местом для авторов и читателей, у нас есть несколько простых правил.</p>
<p>Используя платформу, вы соглашаетесь соблюдать эти правила.</p>

<h1>1. Общие правила</h1>
<h3>1.1.</h3>
<p>Используйте платформу по назначению — для публикации, чтения, поиска и обсуждения литературных произведений.</p>
<h3>1.2.</h3>
<p>Уважайте других пользователей. Вы можете не соглашаться с автором, критиковать произведение и выражать своё мнение, но не переходите на оскорбления, угрозы и травлю.</p>
<h3>1.3.</h3>
<p>Не выдавайте себя за другого человека и не используйте чужой аккаунт без разрешения его владельца.</p>
<h3>1.4.</h3>
<p>Не создавайте аккаунты для спама, мошенничества, распространения рекламы или других действий, которые мешают работе платформы.</p>
<h3>1.5.</h3>
<p>Не публикуйте личную информацию других людей без их согласия.</p>
<h3>1.6.</h3>
<p>Не используйте платформу для распространения вирусов, вредоносных файлов, программ или ссылок.</p>
<h3>1.7.</h3>
<p>Не пытайтесь получить несанкционированный доступ к аккаунтам других пользователей, системам платформы или закрытой информации.</p>

<h1>2. Правила для авторов</h1>
<h3>2.1. Публикуйте то, что принадлежит вам</h3>
<p>Вы можете размещать:</p>
<ul>
<li>собственные произведения;</li>
<li>произведения, созданные в соавторстве;</li>
<li>произведения, на публикацию которых у вас есть разрешение;</li>
<li>другие материалы, которыми вы имеете право распоряжаться.</li>
</ul>
<p>Не публикуйте чужие произведения целиком и не выдавайте их за свои.</p>
<h3>2.2. Права остаются у автора</h3>
<p>Если произведение написано вами, <strong>вы остаётесь его автором</strong>.</p>
<p>Публикация книги на Hikoya не означает, что вы передаёте платформе авторские права на своё произведение.</p>
<h3>2.3. Вы можете публиковаться где угодно</h3>
<p>Мы не требуем эксклюзивности.</p>
<p>Вы можете одновременно публиковать своё произведение на других платформах, в социальных сетях, на собственном сайте или отправлять его издательству.</p>
<h3>2.4. Ответственность за произведение</h3>
<p>Автор самостоятельно отвечает за содержание произведения, которое он публикует.</p>
<p>Пожалуйста, перед публикацией убедитесь, что:</p>
<ul>
<li>произведение действительно принадлежит вам либо у вас есть право его публиковать;</li>
<li>вы не используете чужой текст без разрешения;</li>
<li>используемые изображения, иллюстрации и обложки можно использовать;</li>
<li>публикация произведения не нарушает права других людей.</li>
</ul>

<h1>3. Мы — платформа, а не автор и не издатель</h1>
<h3>3.1.</h3>
<p>Hikoya предоставляет техническую площадку, на которой пользователи могут самостоятельно публиковать, хранить, читать и обсуждать произведения.</p>
<h3>3.2.</h3>
<p>Произведения размещаются непосредственно пользователями. <strong>Ответственность за содержание опубликованного материала несёт пользователь, который его разместил.</strong></p>
<h3>3.3.</h3>
<p>Hikoya не является автором произведений, опубликованных пользователями, и не отвечает за их содержание, взгляды, мнения, оценки или высказывания.</p>
<h3>3.4.</h3>
<p>Размещение произведения на платформе не означает, что Hikoya одобряет или поддерживает идеи, взгляды или содержание этого произведения.</p>
<h3>3.5.</h3>
<p>Мы не являемся издательством каждой книги, опубликованной на платформе, и не утверждаем каждое произведение перед публикацией.</p>
<h3>3.6.</h3>
<p>Мы стараемся поддерживать порядок на платформе и реагировать на обращения пользователей, но не можем заранее проверить каждую публикацию и каждый комментарий.</p>
<h3>3.7.</h3>
<p>Если вы обнаружили материал, который нарушает правила платформы или ваши права, сообщите нам. Мы рассмотрим обращение и при необходимости примем меры.</p>
<p><strong>Простая идея Hikoya: автор отвечает за свою книгу, а мы предоставляем место, где её можно опубликовать и найти читателей.</strong></p>

<h1>4. Правила для читателей</h1>
<p>Читайте, добавляйте книги в библиотеку, подписывайтесь на авторов, оставляйте отзывы и обсуждайте произведения.</p>
<p>Но помните:</p>
<ul>
<li>не выдавайте чужой текст за свой;</li>
<li>не копируйте и не распространяйте книги целиком без разрешения автора;</li>
<li>не загружайте произведения на другие платформы без разрешения автора;</li>
<li>не продавайте чужие произведения;</li>
<li>не используйте чужие произведения в коммерческих целях без соответствующего разрешения;</li>
<li>не изменяйте произведение и не распространяйте изменённую версию без разрешения правообладателя.</li>
</ul>
<p><strong>Если вы нашли книгу на нашей платформе, это не означает, что вы получили права на неё.</strong></p>

<h1>5. Комментарии и отзывы</h1>
<p>Мы хотим, чтобы читатели могли свободно обсуждать книги, а авторы — получать обратную связь.</p>
<p>Вы можете:</p>
<ul>
<li>критиковать произведение;</li>
<li>обсуждать сюжет и персонажей;</li>
<li>делиться впечатлениями;</li>
<li>соглашаться или не соглашаться с автором;</li>
<li>давать конструктивную критику;</li>
<li>рекомендовать или не рекомендовать книгу другим читателям.</li>
</ul>
<p>Нельзя:</p>
<ul>
<li>оскорблять автора или читателей;</li>
<li>угрожать;</li>
<li>травить или преследовать пользователей;</li>
<li>публиковать чужие личные данные;</li>
<li>спамить;</li>
<li>заниматься навязчивой рекламой;</li>
<li>намеренно провоцировать конфликты;</li>
<li>выдавать чужие мысли или тексты за свои.</li>
</ul>
<p><strong>«Мне не понравилась книга» — нормально.<br/>«Ты бездарность, и тебе здесь не место» — уже нет.</strong></p>

<h1>6. Что нельзя публиковать</h1>
<p>На платформе запрещён контент, который:</p>
<ul>
<li>нарушает права других людей;</li>
<li>содержит угрозы;</li>
<li>призывает к насилию;</li>
<li>используется для травли или преследования;</li>
<li>раскрывает личные данные других людей без оснований;</li>
<li>используется для мошенничества;</li>
<li>содержит вредоносные файлы или ссылки;</li>
<li>является спамом;</li>
<li>используется для обмана пользователей;</li>
<li>нарушает правила платформы.</li>
</ul>
<p>Для отдельных категорий произведений могут действовать дополнительные возрастные или контентные ограничения.</p>

<h1>7. Плагиат и жалобы</h1>
<p>Мы хотим, чтобы авторы могли быть уверены, что их произведения не будут присваивать другие пользователи.</p>
<p>Если вы обнаружили произведение, которое, по вашему мнению, является плагиатом вашей работы или нарушает ваши права, сообщите нам.</p>
<p>В обращении желательно указать:</p>
<ul>
<li>название спорного произведения;</li>
<li>ссылку на него;</li>
<li>ссылку на оригинальное произведение;</li>
<li>описание проблемы;</li>
<li>информацию, которая поможет нам разобраться в ситуации.</li>
</ul>
<p>Мы можем связаться с автором произведения и запросить дополнительную информацию.</p>
<p>На время рассмотрения обращения материал может быть временно скрыт.</p>

<h1>8. Модерация</h1>
<p>Мы не хотим удалять книги или комментарии без причины.</p>
<p>Но если материал нарушает правила платформы, мы можем:</p>
<ul>
<li>попросить пользователя изменить материал;</li>
<li>удалить отдельный комментарий;</li>
<li>скрыть произведение;</li>
<li>ограничить отдельные функции аккаунта;</li>
<li>временно заблокировать аккаунт;</li>
<li>удалить аккаунт при серьёзных или повторных нарушениях.</li>
</ul>
<p>Мы стараемся учитывать обстоятельства каждого случая.</p>
<p>Если вы считаете, что материал был удалён ошибочно, вы можете обратиться к администрации.</p>

<h1>9. Удаление произведения</h1>
<p>Автор может удалить своё произведение с платформы, если такая функция доступна в его аккаунте.</p>
<p>После удаления произведение перестаёт отображаться другим пользователям.</p>
<p>Мы рекомендуем авторам самостоятельно хранить резервные копии своих произведений.</p>
<p>Удаление аккаунта или произведения не должно быть единственным местом хранения вашей книги.</p>

<h1>10. Возрастные ограничения</h1>
<p>Некоторые произведения могут содержать темы или материалы, которые подходят не для всех возрастов.</p>
<p>Если на платформе предусмотрена возрастная маркировка, автор должен указывать её для своего произведения.</p>
<p>Читатель самостоятельно выбирает произведения с учётом указанной возрастной категории.</p>

<h1>11. Аккаунт</h1>
<h3>11.1.</h3>
<p>Для доступа к отдельным функциям может потребоваться регистрация.</p>
<h3>11.2.</h3>
<p>При создании аккаунта используйте достоверную информацию.</p>
<h3>11.3.</h3>
<p>Не передавайте данные для входа другим людям.</p>
<h3>11.4.</h3>
<p>Вы отвечаете за действия, совершённые через ваш аккаунт, поэтому следите за его безопасностью.</p>
<h3>11.5.</h3>
<p>Если вы заметили подозрительную активность в аккаунте, сообщите нам.</p>
<h3>11.6.</h3>
<p>Вы можете прекратить использование платформы и удалить аккаунт.</p>

<h1>12. Техническая работа платформы</h1>
<p>Hikoya — это технологический сервис, поэтому иногда могут возникать технические проблемы.</p>
<p>Платформа может временно быть недоступна из-за:</p>
<ul>
<li>технических работ;</li>
<li>обновлений;</li>
<li>устранения ошибок;</li>
<li>сбоев оборудования или программного обеспечения;</li>
<li>проблем с интернет-соединением;</li>
<li>работы сторонних сервисов;</li>
<li>других технических обстоятельств.</li>
</ul>
<p>Мы стараемся поддерживать стабильную работу платформы и восстанавливать доступ к функциям как можно быстрее.</p>

<h1>13. Изменение правил</h1>
<p>По мере развития Hikoya мы можем добавлять новые функции, менять существующие и обновлять правила.</p>
<p>Актуальная версия правил всегда будет доступна на платформе.</p>
<p>Если изменения будут существенными, мы постараемся обратить на них внимание пользователей.</p>

<h1>14. Обратная связь</h1>
<p>Если у вас есть вопрос, предложение, жалоба на контент или сообщение о нарушении авторских прав, свяжитесь с нами:</p>
<p><strong>Telegram:</strong> <a href="https://t.me/hikoya_auth_bot" target="_blank" rel="noopener noreferrer">@hikoya_auth_bot</a></p>
<p><strong>Сайт:</strong> <a href="https://hikoyaa.vercel.app">hikoyaa.vercel.app</a></p>
<p>Мы внимательно относимся к обращениям пользователей и стараемся отвечать в разумные сроки.</p>

<h1>15. Наш главный принцип</h1>
<p>Hikoya создаётся прежде всего <strong>для авторов и читателей</strong>.</p>
<p>Мы хотим, чтобы автор мог спокойно публиковать свою работу, находить читателей и получать обратную связь, а читатель — открывать новые книги и общаться с людьми, которые любят литературу.</p>
<p>Поэтому главное правило платформы простое:</p>
<p><strong>Публикуй своё. Уважай чужое. Общайся нормально.</strong></p>
<p><strong>Последнее обновление:</strong> 27.08.2026<br/><strong>Версия правил:</strong> 1.0</p>
`;

export const RULES_HTML_UZ = `
<h1>Hikoya platformasi qoidalari</h1>
<p><strong>Oxirgi yangilanish:</strong> 27.08.2026</p>
<p>Biz <strong>Hikoya</strong>ni kitoblar va boshqa adabiy asarlarni yozish, chop etish, oʻqish va muhokama qilish mumkin boʻlgan makon sifatida yaratamiz.</p>
<p>Platforma mualliflar va oʻquvchilar uchun qulay va xavfsiz joy boʻlib qolishi uchun bizda bir nechta sodda qoidalar bor.</p>
<p>Platformadan foydalanib, siz ushbu qoidalarga rioya qilishga rozilik bildirasiz.</p>

<h1>1. Umumiy qoidalar</h1>
<h3>1.1.</h3>
<p>Platformadan maqsadiga muvofiq foydalaning — adabiy asarlarni chop etish, oʻqish, qidirish va muhokama qilish uchun.</p>
<h3>1.2.</h3>
<p>Boshqa foydalanuvchilarni hurmat qiling. Siz muallif bilan rozi boʻlmasligingiz, asarni tanqid qilishingiz va fikringizni bildirishingiz mumkin, lekin haqorat, tahdid va bezorilikka oʻtmang.</p>
<h3>1.3.</h3>
<p>Boshqa odamning oʻrnida boʻlib koʻrinmang va egasining ruxsatisiz boshqa birovning akkauntidan foydalanmang.</p>
<h3>1.4.</h3>
<p>Spam, firibgarlik, reklama tarqatish yoki platforma ishiga xalaqit beradigan boshqa harakatlar uchun akkaunt yaratmang.</p>
<h3>1.5.</h3>
<p>Boshqa odamlarning shaxsiy maʼlumotlarini ularning roziligisiz eʼlon qilmang.</p>
<h3>1.6.</h3>
<p>Platformani viruslar, zararli fayllar, dasturlar yoki havolalarni tarqatish uchun ishlatmang.</p>
<h3>1.7.</h3>
<p>Boshqa foydalanuvchilarning akkauntlariga, platforma tizimlariga yoki yopiq maʼlumotlarga ruxsatsiz kirishga urinmang.</p>

<h1>2. Mualliflar uchun qoidalar</h1>
<h3>2.1. Oʻzingizga tegishli boʻlgan narsani chop eting</h3>
<p>Siz quyidagilarni joylashtirishingiz mumkin:</p>
<ul>
<li>oʻzingizning asarlaringizni;</li>
<li>hammualliflikda yaratilgan asarlarni;</li>
<li>chop etishga ruxsatingiz bor asarlarni;</li>
<li>oʻzingiz ixtiyor qilish huquqiga ega boshqa materiallarni.</li>
</ul>
<p>Boshqa birovning asarini toʻliq chop etmang va uni oʻzingizniki qilib koʻrsatmang.</p>
<h3>2.2. Huquqlar muallifda qoladi</h3>
<p>Agar asar siz tomoningizdan yozilgan boʻlsa, <strong>siz uning muallifi boʻlib qolasiz</strong>.</p>
<p>Kitobni Hikoyada chop etish platformaga asaringizga boʻlgan mualliflik huquqini topshirishingizni anglatmaydi.</p>
<h3>2.3. Istalgan joyda chop etishingiz mumkin</h3>
<p>Biz eksklyuzivlikni talab qilmaymiz.</p>
<p>Siz oʻz asaringizni boshqa platformalarda, ijtimoiy tarmoqlarda, oʻz saytingizda bir vaqtning oʻzida chop etishingiz yoki nashriyotga yuborishingiz mumkin.</p>
<h3>2.4. Asar uchun javobgarlik</h3>
<p>Muallif chop etayotgan asarining mazmuni uchun mustaqil ravishda javobgardir.</p>
<p>Iltimos, chop etishdan oldin quyidagilarga ishonch hosil qiling:</p>
<ul>
<li>asar haqiqatan ham sizga tegishli yoki uni chop etish huquqiga egasiz;</li>
<li>boshqa birovning matnidan ruxsatsiz foydalanmayapsiz;</li>
<li>foydalanilayotgan rasmlar, illyustratsiyalar va muqovalarni ishlatish mumkin;</li>
<li>asarni chop etish boshqa odamlarning huquqlarini buzmaydi.</li>
</ul>

<h1>3. Biz — platformamiz, muallif yoki nashriyot emasmiz</h1>
<h3>3.1.</h3>
<p>Hikoya foydalanuvchilarga asarlarni mustaqil ravishda chop etish, saqlash, oʻqish va muhokama qilish imkonini beruvchi texnik maydoncha taqdim etadi.</p>
<h3>3.2.</h3>
<p>Asarlarni foydalanuvchilarning oʻzlari joylashtiradi. <strong>Chop etilgan material mazmuni uchun uni joylashtirgan foydalanuvchi javobgardir.</strong></p>
<h3>3.3.</h3>
<p>Hikoya foydalanuvchilar chop etgan asarlarning muallifi emas va ularning mazmuni, qarashlari, fikrlari, baholari yoki fikr-mulohazalari uchun javob bermaydi.</p>
<h3>3.4.</h3>
<p>Asarni platformada joylashtirish Hikoyaning ushbu asarning gʻoyalari, qarashlari yoki mazmunini maʼqullashi yoki qoʻllab-quvvatlashini anglatmaydi.</p>
<h3>3.5.</h3>
<p>Biz platformada chop etilgan har bir kitobning nashriyoti emasmiz va har bir asarni chop etishdan oldin tasdiqlamaymiz.</p>
<h3>3.6.</h3>
<p>Biz platformada tartibni saqlashga va foydalanuvchilar murojaatlariga javob berishga harakat qilamiz, lekin har bir eʼlonni va har bir izohni oldindan tekshira olmaymiz.</p>
<h3>3.7.</h3>
<p>Agar platforma qoidalarini yoki sizning huquqlaringizni buzadigan material topsangiz, bizga xabar bering. Biz murojaatni koʻrib chiqamiz va zarur boʻlsa choralar koʻramiz.</p>
<p><strong>Hikoyaning sodda gʻoyasi: muallif oʻz kitobi uchun javobgar, biz esa uni chop etish va oʻquvchilar topish mumkin boʻlgan joyni taqdim etamiz.</strong></p>

<h1>4. Oʻquvchilar uchun qoidalar</h1>
<p>Oʻqing, kitoblarni kutubxonaga qoʻshing, mualliflarga obuna boʻling, sharh qoldiring va asarlarni muhokama qiling.</p>
<p>Ammo esda tuting:</p>
<ul>
<li>boshqa birovning matnini oʻzingizniki qilib koʻrsatmang;</li>
<li>kitoblarni muallif ruxsatisiz toʻliq nusxalamang va tarqatmang;</li>
<li>asarlarni muallif ruxsatisiz boshqa platformalarga yuklamang;</li>
<li>boshqa birovning asarlarini sotmang;</li>
<li>boshqa birovning asarlaridan tegishli ruxsatsiz tijorat maqsadlarida foydalanmang;</li>
<li>asarni oʻzgartirmang va huquq egasining ruxsatisiz oʻzgartirilgan versiyasini tarqatmang.</li>
</ul>
<p><strong>Platformamizda kitob topganingiz unga huquq olganingizni anglatmaydi.</strong></p>

<h1>5. Izohlar va sharhlar</h1>
<p>Biz oʻquvchilar kitoblarni erkin muhokama qilishlarini, mualliflar esa fikr-mulohaza olishlarini xohlaymiz.</p>
<p>Siz quyidagilarni qilishingiz mumkin:</p>
<ul>
<li>asarni tanqid qilish;</li>
<li>syujet va personajlarni muhokama qilish;</li>
<li>taassurotlaringiz bilan boʻlishish;</li>
<li>muallif bilan rozi boʻlish yoki boʻlmaslik;</li>
<li>konstruktiv tanqid bildirish;</li>
<li>kitobni boshqa oʻquvchilarga tavsiya qilish yoki qilmaslik.</li>
</ul>
<p>Mumkin emas:</p>
<ul>
<li>muallif yoki oʻquvchilarni haqorat qilish;</li>
<li>tahdid qilish;</li>
<li>foydalanuvchilarni bezorilik yoki taʼqib qilish;</li>
<li>boshqa birovning shaxsiy maʼlumotlarini eʼlon qilish;</li>
<li>spam tarqatish;</li>
<li>zoʻrma-zoʻraki reklama qilish;</li>
<li>ataylab nizo chiqarish;</li>
<li>boshqa birovning fikri yoki matnini oʻzinikidek koʻrsatish.</li>
</ul>
<p><strong>«Kitob menga yoqmadi» — normal.<br/>«Sen isteʼdodsizsan, senga bu yerda oʻrin yoʻq» — bu esa yoʻq.</strong></p>

<h1>6. Nimalarni chop etib boʻlmaydi</h1>
<p>Platformada quyidagi kontent taqiqlanadi:</p>
<ul>
<li>boshqa odamlarning huquqlarini buzadigan;</li>
<li>tahdid mazmunidagi;</li>
<li>zoʻravonlikka chaqiruvchi;</li>
<li>bezorilik yoki taʼqib qilish uchun ishlatiladigan;</li>
<li>asossiz ravishda boshqa odamlarning shaxsiy maʼlumotlarini ochib beradigan;</li>
<li>firibgarlik uchun ishlatiladigan;</li>
<li>zararli fayllar yoki havolalarni oʻz ichiga olgan;</li>
<li>spam boʻlgan;</li>
<li>foydalanuvchilarni aldash uchun ishlatiladigan;</li>
<li>platforma qoidalarini buzadigan.</li>
</ul>
<p>Ayrim asar toifalari uchun qoʻshimcha yosh yoki kontent cheklovlari amal qilishi mumkin.</p>

<h1>7. Plagiat va shikoyatlar</h1>
<p>Biz mualliflar oʻz asarlarini boshqa foydalanuvchilar oʻzlashtirib olmasligiga ishonch hosil qilishlarini xohlaymiz.</p>
<p>Agar sizningcha, biror asar sizning ishingiz plagiati boʻlsa yoki huquqlaringizni buzsa, bizga xabar bering.</p>
<p>Murojaatda quyidagilarni koʻrsatish tavsiya etiladi:</p>
<ul>
<li>bahsli asar nomi;</li>
<li>unga havola;</li>
<li>asl asarga havola;</li>
<li>muammoning tavsifi;</li>
<li>vaziyatni tushunishga yordam beradigan maʼlumot.</li>
</ul>
<p>Biz asar muallifi bilan bogʻlanishimiz va qoʻshimcha maʼlumot soʻrashimiz mumkin.</p>
<p>Murojaat koʻrib chiqilayotgan vaqtda material vaqtincha yashirilishi mumkin.</p>

<h1>8. Moderatsiya</h1>
<p>Biz kitoblar yoki izohlarni sababsiz oʻchirishni xohlamaymiz.</p>
<p>Lekin agar material platforma qoidalarini buzsa, biz quyidagilarni qilishimiz mumkin:</p>
<ul>
<li>foydalanuvchidan materialni oʻzgartirishni soʻrash;</li>
<li>alohida izohni oʻchirish;</li>
<li>asarni yashirish;</li>
<li>akkauntning ayrim funksiyalarini cheklash;</li>
<li>akkauntni vaqtincha bloklash;</li>
<li>jiddiy yoki takroriy qoidabuzarliklarda akkauntni oʻchirish.</li>
</ul>
<p>Biz har bir holatning oʻziga xos vaziyatini hisobga olishga harakat qilamiz.</p>
<p>Agar material xato oʻchirilgan deb hisoblasangiz, administratsiyaga murojaat qilishingiz mumkin.</p>

<h1>9. Asarni oʻchirish</h1>
<p>Agar akkauntida bunday funksiya mavjud boʻlsa, muallif oʻz asarini platformadan oʻchirishi mumkin.</p>
<p>Oʻchirilgandan keyin asar boshqa foydalanuvchilarga koʻrinmay qoladi.</p>
<p>Mualliflarga oʻz asarlarining zaxira nusxalarini mustaqil saqlashni tavsiya qilamiz.</p>
<p>Akkaunt yoki asarni oʻchirish kitobingiz saqlanadigan yagona joy boʻlmasligi kerak.</p>

<h1>10. Yosh cheklovlari</h1>
<p>Ayrim asarlar barcha yoshdagilar uchun mos boʻlmagan mavzu yoki materiallarni oʻz ichiga olishi mumkin.</p>
<p>Agar platformada yosh belgisi koʻzda tutilgan boʻlsa, muallif buni oʻz asari uchun koʻrsatishi kerak.</p>
<p>Oʻquvchi koʻrsatilgan yosh toifasini hisobga olib, asarlarni mustaqil tanlaydi.</p>

<h1>11. Akkaunt</h1>
<h3>11.1.</h3>
<p>Ayrim funksiyalardan foydalanish uchun roʻyxatdan oʻtish talab qilinishi mumkin.</p>
<h3>11.2.</h3>
<p>Akkaunt yaratishda ishonchli maʼlumotlardan foydalaning.</p>
<h3>11.3.</h3>
<p>Kirish maʼlumotlaringizni boshqa odamlarga bermang.</p>
<h3>11.4.</h3>
<p>Siz akkauntingiz orqali amalga oshirilgan harakatlar uchun javobgarsiz, shuning uchun uning xavfsizligini kuzatib boring.</p>
<h3>11.5.</h3>
<p>Agar akkauntda shubhali faollikni sezsangiz, bizga xabar bering.</p>
<h3>11.6.</h3>
<p>Siz platformadan foydalanishni toʻxtatishingiz va akkauntni oʻchirishingiz mumkin.</p>

<h1>12. Platformaning texnik ishlashi</h1>
<p>Hikoya — texnologik xizmat, shuning uchun baʼzan texnik muammolar yuzaga kelishi mumkin.</p>
<p>Platforma quyidagi sabablarga koʻra vaqtincha ishlamasligi mumkin:</p>
<ul>
<li>texnik ishlar;</li>
<li>yangilanishlar;</li>
<li>xatolarni bartaraf etish;</li>
<li>uskuna yoki dasturiy taʼminot nosozliklari;</li>
<li>internet aloqasi muammolari;</li>
<li>uchinchi tomon xizmatlarining ishlashi;</li>
<li>boshqa texnik holatlar.</li>
</ul>
<p>Biz platformaning barqaror ishlashini taʼminlashga va funksiyalarga kirishni imkon qadar tezroq tiklashga harakat qilamiz.</p>

<h1>13. Qoidalarni oʻzgartirish</h1>
<p>Hikoya rivojlanishi bilan biz yangi funksiyalar qoʻshishimiz, mavjudlarini oʻzgartirishimiz va qoidalarni yangilashimiz mumkin.</p>
<p>Qoidalarning dolzarb versiyasi doim platformada mavjud boʻladi.</p>
<p>Agar oʻzgarishlar jiddiy boʻlsa, biz foydalanuvchilar eʼtiborini ularga qaratishga harakat qilamiz.</p>

<h1>14. Aloqa</h1>
<p>Agar savolingiz, taklifingiz, kontentga shikoyatingiz yoki mualliflik huquqi buzilishi haqida xabaringiz boʻlsa, biz bilan bogʻlaning:</p>
<p><strong>Telegram:</strong> <a href="https://t.me/hikoya_auth_bot" target="_blank" rel="noopener noreferrer">@hikoya_auth_bot</a></p>
<p><strong>Sayt:</strong> <a href="https://hikoyaa.vercel.app">hikoyaa.vercel.app</a></p>
<p>Biz foydalanuvchilar murojaatlariga eʼtibor bilan yondashamiz va oqilona muddatlarda javob berishga harakat qilamiz.</p>

<h1>15. Bizning asosiy tamoyilimiz</h1>
<p>Hikoya birinchi navbatda <strong>mualliflar va oʻquvchilar uchun</strong> yaratiladi.</p>
<p>Biz muallif oʻz ishini xotirjam chop etishi, oʻquvchilar topishi va fikr-mulohaza olishini, oʻquvchi esa yangi kitoblarni kashf etishi va adabiyotni sevadigan odamlar bilan muloqot qilishini xohlaymiz.</p>
<p>Shuning uchun platformaning asosiy qoidasi sodda:</p>
<p><strong>Oʻzingiznikini chop eting. Boshqalarnikini hurmat qiling. Odob bilan muloqot qiling.</strong></p>
<p><strong>Oxirgi yangilanish:</strong> 27.08.2026<br/><strong>Qoidalar versiyasi:</strong> 1.0</p>
`;
