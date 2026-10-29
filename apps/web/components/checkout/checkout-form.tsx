"use client"

import { Check, Landmark, Lock } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"

import {
  advanceRatio,
  formatToman,
  planList,
  plans,
  type PlanId,
} from "@/lib/plans"

type CheckoutFormProps = {
  initialPlan: PlanId
}

function CheckoutForm({ initialPlan }: CheckoutFormProps) {
  const [planId, setPlanId] = useState<PlanId>(initialPlan)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const plan = plans[planId]
  const advance = Math.round(plan.price * advanceRatio)

  return (
    <form
      onSubmit={(event) => event.preventDefault()}
      className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-14"
    >
      <div className="space-y-12">
        <fieldset>
          <legend className="text-lg font-medium">۱. انتخاب پلن</legend>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {planList.map((item) => {
              const selected = item.id === planId

              return (
                <label
                  key={item.id}
                  className={cn(
                    "relative flex cursor-pointer flex-col gap-2 rounded-2xl border border-border bg-card/40 p-5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/40",
                    selected && "border-foreground/50 bg-card"
                  )}
                >
                  <input
                    type="radio"
                    name="plan"
                    value={item.id}
                    checked={selected}
                    onChange={() => setPlanId(item.id)}
                    className="sr-only"
                  />
                  <span className="flex items-center justify-between">
                    <span className="text-base font-semibold">{item.name}</span>
                    {selected ? (
                      <Check aria-hidden="true" className="size-4" />
                    ) : null}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {formatToman(item.price)}
                  </span>
                  <span className="text-xs text-muted-foreground/80">
                    {item.deliveryDays}
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-lg font-medium">۲. مشخصات شما</legend>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fullName">نام و نام خانوادگی</Label>
              <Input
                id="fullName"
                name="fullName"
                autoComplete="name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">نام کسب‌وکار (اختیاری)</Label>
              <Input id="company" name="company" autoComplete="organization" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">شماره موبایل</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                inputMode="tel"
                dir="ltr"
                autoComplete="tel"
                placeholder="09123456789"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">ایمیل</Label>
              <Input
                id="email"
                name="email"
                type="email"
                dir="ltr"
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="brief">شرح مختصر پروژه</Label>
              <Textarea
                id="brief"
                name="brief"
                placeholder="نوع کسب‌وکار، صفحات یا قابلیت‌های مورد نیاز، نمونه سایت‌های مورد علاقه..."
              />
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-lg font-medium">۳. روش پرداخت</legend>
          <div className="mt-5 rounded-2xl border border-border bg-card/40 p-5 opacity-90">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl border border-border">
                  <Landmark aria-hidden="true" className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-medium">
                    پرداخت آنلاین با درگاه سداد (بانک ملی)
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    پرداخت با تمام کارت‌های عضو شتاب
                  </p>
                </div>
              </div>
              <Badge variant="warning">در حال فعال‌سازی</Badge>
            </div>
            <p className="mt-4 text-xs leading-6 text-muted-foreground">
              درگاه سداد هنوز فعال نشده و پرداخت آنلاین در حال حاضر در دسترس
              نیست. پس از فعال شدن، همین صفحه شما را به صفحه امن پرداخت بانک
              منتقل می‌کند. تا آن زمان می‌توانید درخواست مشاوره دهید و هماهنگی
              پرداخت از طریق تیم ما انجام می‌شود.
            </p>
          </div>
        </fieldset>

        <div className="flex items-start gap-3">
          <input
            id="terms"
            type="checkbox"
            checked={acceptedTerms}
            onChange={(event) => setAcceptedTerms(event.target.checked)}
            className="mt-1 size-4 accent-white"
          />
          <Label
            htmlFor="terms"
            className="text-sm leading-6 font-normal text-muted-foreground"
          >
            <span>
              <Link
                href="/terms"
                className="text-foreground underline underline-offset-4"
              >
                قوانین و شرایط
              </Link>{" "}
              سفارش خدمات وب را خوانده‌ام و می‌پذیرم.
            </span>
          </Label>
        </div>
      </div>

      <aside className="lg:sticky lg:top-28 lg:self-start">
        <div className="rounded-2xl border border-border bg-card/60 p-6 sm:p-7">
          <h2 className="text-lg font-medium">خلاصه سفارش</h2>

          <dl className="mt-6 space-y-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">پلن</dt>
              <dd className="font-medium">{plan.name}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">زمان تحویل</dt>
              <dd>{plan.deliveryDays}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">پشتیبانی</dt>
              <dd>{plan.support}</dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-border pt-3">
              <dt className="text-muted-foreground">مبلغ کل پروژه</dt>
              <dd>{formatToman(plan.price)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="font-medium">
                پیش‌پرداخت ({new Intl.NumberFormat("fa-IR").format(advanceRatio * 100)}٪)
              </dt>
              <dd className="text-base font-semibold">
                {formatToman(advance)}
              </dd>
            </div>
          </dl>

          <ul className="mt-6 space-y-2 border-t border-border pt-5">
            {plan.features.map((feature) => (
              <li
                key={feature}
                className="flex items-start gap-2 text-xs leading-6 text-muted-foreground"
              >
                <Check
                  aria-hidden="true"
                  className="mt-1 size-3.5 shrink-0"
                />
                {feature}
              </li>
            ))}
          </ul>

          <Button
            type="submit"
            size="lg"
            disabled
            className="mt-7 w-full"
            aria-describedby="pay-status"
          >
            <Lock aria-hidden="true" className="size-4" />
            پرداخت با درگاه سداد (غیرفعال)
          </Button>
          <p
            id="pay-status"
            className="mt-3 text-center text-xs leading-6 text-muted-foreground"
          >
            درگاه پرداخت سداد هنوز فعال نشده است.
          </p>

          <Link
            href="/contact-us"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "mt-4 w-full"
            )}
          >
            درخواست مشاوره و هماهنگی پرداخت
          </Link>
        </div>
      </aside>
    </form>
  )
}

export { CheckoutForm }
