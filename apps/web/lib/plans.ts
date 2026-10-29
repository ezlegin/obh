/**
 * Website-development plans offered by OBH. Prices are in toman and are the
 * single source of truth for the home page and the checkout page.
 */
export const planIds = ["starter", "pro", "ultra"] as const

export type PlanId = (typeof planIds)[number]

export type Plan = {
  id: PlanId
  name: string
  tagline: string
  /** Total project price in toman. */
  price: number
  deliveryDays: string
  support: string
  highlighted?: boolean
  features: string[]
}

export const plans: Record<PlanId, Plan> = {
  starter: {
    id: "starter",
    name: "استارتر",
    tagline: "برای کسب‌وکارهای کوچک و شروع حضور آنلاین",
    price: 15_000_000,
    deliveryDays: "۱۰ تا ۱۴ روز کاری",
    support: "۱ ماه پشتیبانی",
    features: [
      "وب‌سایت معرفی تا ۵ صفحه",
      "طراحی اختصاصی و واکنش‌گرا (موبایل و دسکتاپ)",
      "فرم تماس و اتصال به ایمیل",
      "سئوی پایه و نقشه سایت",
      "نصب گواهی SSL و راه‌اندازی روی هاست",
    ],
  },
  pro: {
    id: "pro",
    name: "پرو",
    tagline: "برای شرکت‌ها و برندهایی که محتوای زنده دارند",
    price: 45_000_000,
    deliveryDays: "۲۵ تا ۳۰ روز کاری",
    support: "۳ ماه پشتیبانی",
    highlighted: true,
    features: [
      "وب‌سایت شرکتی تا ۱۵ صفحه با طراحی اختصاصی",
      "پنل مدیریت محتوا و بلاگ",
      "سئوی فنی و بهینه‌سازی سرعت",
      "اتصال به درگاه پرداخت و ابزارهای تحلیل",
      "پنل چندکاربره با سطح دسترسی",
      "آموزش تیم شما برای مدیریت سایت",
    ],
  },
  ultra: {
    id: "ultra",
    name: "اولترا",
    tagline: "برای فروشگاه اینترنتی و اپلیکیشن وب سفارشی",
    price: 100_000_000,
    deliveryDays: "۶۰ تا ۹۰ روز کاری",
    support: "۱۲ ماه پشتیبانی",
    features: [
      "فروشگاه اینترنتی یا اپلیکیشن وب سفارشی",
      "پنل کاربری، سبد خرید و مدیریت سفارش‌ها",
      "اتصال به درگاه‌های پرداخت و سرویس‌های پیامکی",
      "طراحی رابط کاربری و تجربه کاربری کامل",
      "پیاده‌سازی API و اتصال به سیستم‌های دیگر",
      "پایش، پشتیبان‌گیری و گزارش‌های دوره‌ای",
    ],
  },
}

export const planList = planIds.map((id) => plans[id])

/** Share of the price paid when the order is placed. */
export const advanceRatio = 0.5

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && (planIds as readonly string[]).includes(value)
}

export function formatToman(amount: number) {
  return `${new Intl.NumberFormat("fa-IR").format(amount)} تومان`
}
