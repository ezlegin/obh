import type { Locale } from "@/lib/i18n/config"

type Localized = Record<Locale, string>

export type TeamMember = {
  slug: string
  /** Portrait version; bump it when the photo is replaced so caches pick up the new file. */
  photo: number
  name: Localized
  role: Localized
  department: Localized
  /** Only leadership profiles carry a short biography. */
  bio?: Localized
}

const engineering = { en: "Engineering", fa: "مهندسی" }
const finance = { en: "Finance", fa: "مالی" }
const design = { en: "Design", fa: "طراحی" }
const marketing = { en: "Marketing", fa: "مارکتینگ" }
const operations = { en: "Operations", fa: "عملیات" }
const office = { en: "Office of the CEO", fa: "دفتر مدیرعامل" }

export const leadership: TeamMember[] = [
  {
    slug: "alireza-ezlegini",
    photo: 2,
    name: { en: "Alireza Ezlegini", fa: "علیرضا ازلگینی" },
    role: { en: "Chief Executive Officer", fa: "مدیرعامل" },
    department: office,
    bio: {
      en: "Alireza leads OBH Corporation and sets the direction for its portfolio of digital services and the shared financial platform behind them.",
      fa: "علیرضا مدیریت شرکت OBH را بر عهده دارد و مسیر مجموعه سرویس‌های دیجیتال گروه و پلتفرم مالی مشترک پشت آن‌ها را تعیین می‌کند.",
    },
  },
  {
    slug: "fateme-ahmadi",
    photo: 5,
    name: { en: "Fateme Ahmadi", fa: "فاطمه احمدی" },
    role: { en: "Technical Assistant", fa: "دستیار فنی" },
    department: office,
    bio: {
      en: "Fateme works alongside the CEO on technical planning, coordinating priorities across the engineering team and the group’s services.",
      fa: "فاطمه در کنار مدیرعامل روی برنامه‌ریزی فنی کار می‌کند و اولویت‌ها را میان تیم مهندسی و سرویس‌های گروه هماهنگ می‌کند.",
    },
  },
]

export const team: TeamMember[] = [
  {
    slug: "mohammadamin-borhani",
    photo: 2,
    name: { en: "Mohammad Amin Borhani", fa: "محمدامین برهانی" },
    role: { en: "Marketing Lead", fa: "سرپرست مارکتینگ" },
    department: marketing,
  },
  {
    slug: "ramin-morsali",
    photo: 4,
    name: { en: "Ramin Morsali", fa: "رامین مرسلی" },
    role: { en: "Accounting Lead", fa: "سرپرست حسابداری" },
    department: finance,
  },
  {
    slug: "sara-karimi",
    photo: 2,
    name: { en: "Sara Karimi", fa: "سارا کریمی" },
    role: { en: "Finance Director", fa: "مدیر مالی" },
    department: finance,
  },
  {
    slug: "niloofar-hosseini",
    photo: 2,
    name: { en: "Niloofar Hosseini", fa: "نیلوفر حسینی" },
    role: { en: "Product Designer", fa: "طراح محصول" },
    department: design,
  },
  {
    slug: "amirhossein-tavakoli",
    photo: 3,
    name: { en: "Amirhossein Tavakoli", fa: "امیرحسین توکلی" },
    role: { en: "DevOps Engineer", fa: "مهندس DevOps" },
    department: engineering,
  },
  {
    slug: "maryam-jafari",
    photo: 2,
    name: { en: "Maryam Jafari", fa: "مریم جعفری" },
    role: { en: "Financial Analyst", fa: "تحلیلگر مالی" },
    department: finance,
  },
  {
    slug: "kian-sadeghi",
    photo: 3,
    name: { en: "Kian Sadeghi", fa: "کیان صادقی" },
    role: { en: "Frontend Engineer", fa: "مهندس فرانت‌اند" },
    department: engineering,
  },
  {
    slug: "zahra-mousavi",
    photo: 2,
    name: { en: "Zahra Mousavi", fa: "زهرا موسوی" },
    role: { en: "Operations Manager", fa: "مدیر عملیات" },
    department: operations,
  },
]

export function portraitSrc(member: TeamMember) {
  return `/staff/${member.slug}-v${member.photo}.webp`
}
