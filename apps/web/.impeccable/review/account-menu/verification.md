# Account menu review

The navbar account icon now opens an account popover instead of navigating directly to `/app/profil`.

## Behavior

- Authenticated users get Ringkasan (`/app`), Profil saya (`/app/profil`), and Keluar.
- Guests get Masuk and Daftar.
- Escape closes the popover and restores focus to its trigger; a pointer press outside closes it.
- The mobile navbar's account link now opens Ringkasan, leaving profile navigation as an explicit menu choice.

## Visual review

Guest-state screenshots cover the Home and Market headers at 1440px, 390px, and 320px. The 320px popover stays within the viewport. `inspection.json` records visible menu links, Escape and outside-click behavior, focus restoration, and document width. Authenticated options are wired to the shared session state; the screenshot capture used a fresh guest session.
