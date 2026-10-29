import type { Metadata } from "next"

import { CheckoutForm } from "@/components/checkout/checkout-form"
import { PageHero } from "@/components/page-hero"
import { SiteContainer } from "@/components/site-container"
import { isPlanId } from "@/lib/plans"

export const metadata: Metadata = {
  title: "ثبت سفارش",
  description:
    "پلن طراحی و برنامه‌نویسی وب‌سایت را انتخاب و سفارش خود را ثبت کنید. پرداخت آنلاین با درگاه سداد به‌زودی فعال می‌شود.",
}

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { plan } = await searchParams
  const initialPlan = isPlanId(plan) ? plan : "pro"

  return (
    <>
      <PageHero
        eyebrow="ثبت سفارش / پرداخت"
        title="سفارش پروژه شما"
        description="پلن را انتخاب کنید، مشخصات خود را وارد کنید و سفارش را ثبت کنید. پرداخت آنلاین با درگاه سداد در حال فعال‌سازی است."
      />
      <section className="py-16 sm:py-24">
        <SiteContainer>
          <CheckoutForm initialPlan={initialPlan} />
        </SiteContainer>
      </section>
    </>
  )
}
