/**
 * Public corporation contact details, configured through OBH_PHONE,
 * OBH_EMAIL, and OBH_ADDRESS. These are safe to render in server components;
 * no NEXT_PUBLIC_ prefix is required because the contact page is server-rendered.
 */
export type ContactDetails = {
  phone?: string
  email?: string
  address?: string
}

export function getContactDetails(): ContactDetails {
  return {
    phone: process.env.OBH_PHONE?.trim() || undefined,
    email: process.env.OBH_EMAIL?.trim() || undefined,
    address: process.env.OBH_ADDRESS?.trim() || undefined,
  }
}

export function phoneHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`
}
