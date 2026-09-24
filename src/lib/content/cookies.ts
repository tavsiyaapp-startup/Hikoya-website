// Static, developer-authored content (not user-submitted) — same pattern as
// src/lib/content/rules.ts and privacy.ts. The cookie categories listed
// here are grounded in what the app actually sets: Supabase auth session
// cookies, the locale/theme cookies read in src/lib/i18n/locale-server.ts
// and src/lib/theme-server.ts, GUEST_READ_COOKIE from src/lib/constants.ts,
// and Google Analytics (wired up in src/app/layout.tsx via
// NEXT_PUBLIC_GA_MEASUREMENT_ID). Update in place if that set changes.

export const COOKIES_HTML_RU = `
<h1>Политика использования cookie</h1>
<p><strong>Последнее обновление:</strong> 24.09.2026</p>
<p>Эта страница объясняет, какие файлы cookie использует <strong>Hikoya</strong> и зачем.</p>

<h1>1. Что такое cookie</h1>
<p>Cookie — это небольшие текстовые файлы, которые сайт сохраняет в вашем браузере. Они позволяют сайту запоминать вас между визитами: например, что вы вошли в аккаунт или на каком языке хотите видеть интерфейс.</p>

<h1>2. Какие cookie мы используем</h1>
<h3>2.1. Необходимые (без них сайт не будет работать корректно)</h3>
<ul>
<li><strong>Сессия входа</strong> — хранит токены авторизации, чтобы вы оставались в системе между посещениями и не вводили пароль заново.</li>
<li><strong>Язык интерфейса</strong> — запоминает выбор между русским и узбекским языком.</li>
<li><strong>Тема оформления</strong> — запоминает выбор светлой или тёмной темы.</li>
</ul>
<h3>2.2. Функциональные</h3>
<ul>
<li><strong>Учёт бесплатных глав для гостей</strong> — если вы читаете без регистрации, этот cookie запоминает, какие главы вы уже открывали, чтобы правильно посчитать бесплатный лимит.</li>
</ul>
<h3>2.3. Аналитические</h3>
<ul>
<li><strong>Google Analytics</strong> (сторонний сервис) — собирает обезличенную статистику посещаемости: какие страницы просматривают, как долго, с какого устройства. Это помогает нам понимать, что работает хорошо, а что нужно улучшить. Подробнее — в <a href="https://policies.google.com/technologies/cookies" target="_blank" rel="noopener noreferrer">политике cookie Google</a>.</li>
</ul>

<h1>3. Сколько хранятся cookie</h1>
<p>Сессия входа и настройки языка/темы хранятся, пока вы не выйдете из аккаунта или не очистите cookie в браузере. Cookie Google Analytics имеют собственный срок хранения, установленный Google.</p>

<h1>4. Как управлять cookie</h1>
<p>Вы можете в любой момент удалить или заблокировать cookie через настройки своего браузера. Обратите внимание: если заблокировать необходимые cookie, вход в аккаунт и часть функций сайта могут перестать работать.</p>
<p>Отключить Google Analytics отдельно от остальных cookie можно расширением <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer">Google Analytics Opt-out</a>.</p>

<h1>5. Согласие</h1>
<p>При первом посещении сайта мы показываем уведомление о том, что используем cookie. Продолжая пользоваться платформой, вы соглашаетесь с этой политикой.</p>

<h1>6. Изменение политики</h1>
<p>Если состав используемых cookie изменится, мы обновим эту страницу. Актуальная версия всегда доступна здесь.</p>

<h1>7. Контакты</h1>
<p>Вопросы о cookie — пишите нам:</p>
<p><strong>Telegram:</strong> <a href="https://t.me/hikoya_yoz" target="_blank" rel="noopener noreferrer">@hikoya_yoz</a></p>
<p><strong>Последнее обновление:</strong> 24.09.2026<br/><strong>Версия:</strong> 1.0</p>
`;

export const COOKIES_HTML_UZ = `
<h1>Cookie fayllaridan foydalanish siyosati</h1>
<p><strong>Oxirgi yangilanish:</strong> 24.09.2026</p>
<p>Ushbu sahifa <strong>Hikoya</strong> qanday cookie fayllaridan foydalanishini va buning sababini tushuntiradi.</p>

<h1>1. Cookie nima</h1>
<p>Cookie — sayt brauzeringizda saqlaydigan kichik matnli fayllar. Ular saytga sizni tashriflar orasida "eslab qolish" imkonini beradi: masalan, akkauntga kirganligingizni yoki interfeysni qaysi tilda koʻrishni xohlaganingizni.</p>

<h1>2. Biz qanday cookie fayllardan foydalanamiz</h1>
<h3>2.1. Zarur (ularsiz sayt toʻgʻri ishlamaydi)</h3>
<ul>
<li><strong>Kirish sessiyasi</strong> — avtorizatsiya tokenlarini saqlaydi, shunda siz tashriflar orasida tizimda qolasiz va parolni qayta kiritmaysiz.</li>
<li><strong>Interfeys tili</strong> — rus va oʻzbek tili oʻrtasidagi tanlovni eslab qoladi.</li>
<li><strong>Dizayn mavzusi</strong> — yorugʻ yoki qorongʻi mavzu tanlovini eslab qoladi.</li>
</ul>
<h3>2.2. Funksional</h3>
<ul>
<li><strong>Mehmonlar uchun bepul boblar hisobi</strong> — agar roʻyxatdan oʻtmasdan oʻqisangiz, bu cookie qaysi boblarni allaqachon ochganingizni eslab qoladi, bepul limitni toʻgʻri hisoblash uchun.</li>
</ul>
<h3>2.3. Analitik</h3>
<ul>
<li><strong>Google Analytics</strong> (uchinchi tomon xizmati) — tashrif statistikasini shaxssiz holda toʻplaydi: qaysi sahifalar koʻriladi, qancha vaqt, qaysi qurilmadan. Bu bizga nima yaxshi ishlayotganini va nimani yaxshilash kerakligini tushunishga yordam beradi. Batafsil — <a href="https://policies.google.com/technologies/cookies" target="_blank" rel="noopener noreferrer">Google cookie siyosati</a>da.</li>
</ul>

<h1>3. Cookie qancha vaqt saqlanadi</h1>
<p>Kirish sessiyasi va til/mavzu sozlamalari siz akkauntdan chiqmaguningizcha yoki brauzerda cookie'larni tozalamaguningizcha saqlanadi. Google Analytics cookie'lari Google tomonidan belgilangan oʻz saqlash muddatiga ega.</p>

<h1>4. Cookie'larni qanday boshqarish mumkin</h1>
<p>Siz istalgan vaqtda brauzeringiz sozlamalari orqali cookie'larni oʻchirishingiz yoki bloklashingiz mumkin. Eʼtibor bering: zarur cookie'larni bloklasangiz, akkauntga kirish va saytning baʼzi funksiyalari ishlamay qolishi mumkin.</p>
<p>Google Analytics'ni boshqa cookie'lardan alohida oʻchirish uchun <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer">Google Analytics Opt-out</a> kengaytmasidan foydalanishingiz mumkin.</p>

<h1>5. Rozilik</h1>
<p>Saytga birinchi tashrifingizda biz cookie'lardan foydalanishimiz haqida bildirishnoma koʻrsatamiz. Platformadan foydalanishni davom ettirib, siz ushbu siyosatga rozilik bildirasiz.</p>

<h1>6. Siyosatni oʻzgartirish</h1>
<p>Foydalaniladigan cookie'lar tarkibi oʻzgarsa, biz ushbu sahifani yangilaymiz. Dolzarb versiya doim shu yerda mavjud boʻladi.</p>

<h1>7. Aloqa</h1>
<p>Cookie haqida savollar — bizga yozing:</p>
<p><strong>Telegram:</strong> <a href="https://t.me/hikoya_yoz" target="_blank" rel="noopener noreferrer">@hikoya_yoz</a></p>
<p><strong>Oxirgi yangilanish:</strong> 24.09.2026<br/><strong>Versiya:</strong> 1.0</p>
`;
