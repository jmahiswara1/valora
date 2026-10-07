# Pusat Notifikasi Valora

Extend the existing white/forest/cream account workspace. Use a flat activity
list with a sage unread surface and explicit Baru label. Keep item titles
secondary to the event heading; date/time is tertiary. Do not use product
images, nested cards, gradients, or decorative charts.

Entry points: authenticated public/account bell, account sidebar/drawer, and
dashboard. Bell opens a keyboard-accessible preview of five recent events;
the full page provides status/category filters and pagination. Preserve 44 px
targets, visible focus, and account isolation. Mobile public cart stays hidden;
account Market shortcut moves to the drawer at ≤600 px.

Read acknowledgement follows server confirmation. Opening the preview does
not read events. Failed counts are unknown rather than zero; failed reads
reconcile and display persistent feedback across navigation. In an unread
filter, removal waits for DOM update before moving focus.

Visual acceptance: 320/390/430/768/1440 px, bounded preview, no overflow,
readable long titles, independent row link/read control, and clear empty/error
states. Document actual API and browser test results separately.
