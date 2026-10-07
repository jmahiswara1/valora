# Favorit — 2026-10-04

Extend the existing public Market and account visual language. White, Forest/
Green, Cream and Sage; Plus Jakarta Sans; rounded item cards; no shadow or
rounded outer page frame. Scope: account favorites, public and account navigation,
Market/home/related cards, and listing detail.

Use a separate sibling button and link inside each market card. Heart controls
have a 44px target and 36px visual surface. Filled green means server-confirmed
membership. Pending/unknown/error states do not claim the item is unsaved.
Guest login returns to detail without automatically saving through a URL.

The account list at /app/favorit uses four columns from 1024px and two below,
retaining compact mobile cards. Reuse photos/current public projection for active
listings. Reserved/unavailable cards preserve only the original public title,
saved date, and availability; no retained photo, price, or private details.

Batch membership reads per collection; account-scoped TanStack Query cache;
confirmed mutations; shared pending state; retry/reconciliation; private lists.
After a removal, focus moves only after the DOM reflects the updated list. Error
feedback survives an uncertain removal that is later reconciled.

Public heart remains visible on mobile while notification/cart stay hidden.
The account toolbar switches the Market label to a Store icon on phones so the
new heart and profile controls fit at 320px. Sidebar/drawer include Favorit.

API/privacy/database smoke scenarios and fixture browser checks are documented
in docs/23-favorites.md. Browser captures remain local under .local/wishlist.
