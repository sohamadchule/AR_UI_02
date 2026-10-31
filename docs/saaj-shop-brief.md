# Brief: a flagship shop website on Akruti — Saaj & Co.

Use this as the prompt for building (or rebuilding) any client storefront.

## The business behind the website

Akruti earns from the shopkeeper. The shopkeeper pays because:

1. **First — visualisation.** Their customers can see a piece in 3D and place it in their own room, at true size, from home, before buying. This is the product. Nothing else a local shop can buy gives them this.
2. **Second — the website itself.** A site that looks better than the big chains, carries the shop's own name and colours, and brings them enquiries.

So the website exists to put the 3D/AR experience in front of buyers and turn it into WhatsApp enquiries and showroom visits.

## The shop

**Saaj & Co.** — a Jaipur atelier, three generations of carpenters and upholsterers near MI Road. Everything is **made to order** (3–4 weeks). Brand kit: Bodoni display type, Karla body, oxblood accent (pink in dark mode), square corners.

Why visualisation matters more here than anywhere: a made-to-order piece doesn't exist yet when you pay for it. Today the buyer imagines it. With Saaj they place it in their room first, approve size and finish, *then* it is built. The site's line: **"Measured twice. Delivered once."**

## Three people must like it

| Who | What they need to see |
|---|---|
| **Buyer** (on a phone, at home) | Real pieces, real prices, real sizes. One tap to see it in their room. Easy to ask a question or book a visit. Feels like a premium shop, not a template. |
| **Shopkeeper** | Their shop, their name, their city, looking better than Pepperfry. Enquiries arriving on their WhatsApp with the product already named. Their craft and story told well. |
| **Akruti (us)** | 3D/AR is the hero of every page, not a feature buried on a product page. Built from data (brand kit + catalogue), so the next shop gets it by adding one entry. Fast, accessible, no broken states. |

## Website structure

1. **Walk-in entrance** — the shop's own façade (for Saaj: Jaipur pink sandstone, arched doorway and windows). Scrolling walks you through the door into the showroom, where the rooms of the catalogue are laid out.
2. **Before the saw** — the visualisation, live: one signature piece in 3D, switch finishes, see its true dimensions and whether it clears a doorway, then "Place it in your room" (AR on phone, QR on desktop).
3. **How a Saaj piece is made** — choose → place it at home → made by hand in Jaipur → delivered and assembled.
4. **The collection** — curated pieces with real product images rendered from the 3D models, prices, finishes; each opens its product page with 3D, AR, size and WhatsApp enquiry.
5. **What customers say** — approved reviews from the database (`/api/reviews`), and a "Write a review" form; the shop approves each one at `/admin/reviews` before it appears.
6. **Visit the atelier** — book a showroom visit or a video call; the request opens on the shop's WhatsApp, ready to send. Address, hours, map.

Header: Shop · Experience · About · Contact, plus call. Footer: "3D & AR by Akruti".

## Acceptance checks (self-test)

- Works at 390 px (phone) and 1440 px (desktop), light and dark, no horizontal scroll, no console errors.
- The walk-in plays smoothly and can be skipped; reduced-motion users get the showroom directly.
- Every product tile shows a real image of that piece in that colour.
- From the home page, a buyer reaches "see it in my room" in one tap.
- Every enquiry path (product, visit booking, contact) lands on WhatsApp or a call with context filled in.
- Turning the flagship layout on for another shop needs only data, no new components.
