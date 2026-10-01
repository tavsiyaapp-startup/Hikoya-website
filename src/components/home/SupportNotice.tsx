// Temporary urgent notice shown above the hero banner — not locale-driven
// (deliberately, the exact wording was given as-is and shown the same to
// every visitor regardless of site language) and not admin-managed, since
// this is a one-off operational message, not a recurring content type.
// Safe to delete this file and its usage in page.tsx once it's no longer
// needed.
export function SupportNotice() {
  return (
    <div className="mb-6 rounded-[18px] border-2 border-danger/30 bg-danger-bg px-5 py-5 sm:px-8 sm:py-7">
      <p className="mb-3 text-[18px] font-extrabold leading-snug text-danger sm:text-[20px]">
        🚨 SOS: Serverimiz to‘lib qoldi va bizga sizning yordamingiz kerak! 🙏
      </p>
      <div className="whitespace-pre-line text-[14.5px] leading-relaxed text-ink-soft">
        {`Do‘stlar, sizga ikki yangiligimiz bor: biri yaxshi, biri esa unchalik emas.
Yaxshi yangilik — Hikoya platformamiz biz kutganimizdan ham tezroq rivojlanmoqda. ❤️
Yomon yangilik — platformadagi ma’lumotlar hajmi juda ko‘payib, serverimiz to‘lib qoldi va natijada hozircha ishlamayapti. 😔

Biz hozircha barcha ishlarni o‘z kuchimiz va ishtiyoqimiz bilan olib borayotgan startapmiz. Server quvvatini oshirish uchun esa hozircha alohida budjetimiz yo‘q.

Hikoyani qayta ishga tushirish va platformamiz faoliyatini davom ettirish uchun zudlik bilan kuchliroq server tarifini sotib olishimiz kerak.

💰 Yaqin oy uchun server ijarasi — 25$ + 3$ nalog
Agar Hikoya siz uchun ham muhim bo‘lsa, loyihamizni istalgan miqdorda qo‘llab-quvvatlashingiz mumkin. 🙏

Kerakli mablag‘ni yig‘ishimiz bilan server taxminan 15 daqiqa ichida qayta ishga tushadi. 🚀`}
      </div>
      <p className="mt-3.5 text-[15px] font-bold text-ink">
        Loyihani qo‘llab-quvvatlash: <span className="font-extrabold text-danger">5614686808895828</span>{" "}
        Feruza E.
      </p>
    </div>
  );
}
