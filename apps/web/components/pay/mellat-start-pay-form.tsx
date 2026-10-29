"use client"

import { useEffect, useRef } from "react"

import { MELLAT_STARTPAY_URL } from "@/server/payments/providers/mellat-constants"

/**
 * Behpardakht's StartPay page only accepts a POST carrying `RefId`, sent from
 * the merchant's registered domain, so the browser posts it from here.
 */
export function MellatStartPayForm({ refId }: { refId: string }) {
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    formRef.current?.submit()
  }, [])

  return (
    <main
      id="main-content"
      className="flex min-h-dvh items-center justify-center px-4 py-12"
    >
      <form
        ref={formRef}
        action={MELLAT_STARTPAY_URL}
        method="post"
        className="text-center"
      >
        <input type="hidden" name="RefId" value={refId} />
        <p className="text-sm text-muted-foreground">
          در حال انتقال به درگاه پرداخت به‌پرداخت ملت…
        </p>
        <button type="submit" className="mt-4 text-xs underline">
          اگر منتقل نشدید، اینجا را بزنید
        </button>
      </form>
    </main>
  )
}
