# Kojeflow — hostel operations prototype

Interactive clickable prototype (single self-contained HTML file, works offline).

- **Live:** open `index.html` in any browser, or publish via GitHub Pages
- **Language:** EN / UK — switch in Settings
- **Roles:** Admin, Team Member, House Manager, Visa Coordinator, Viewer — switch in "View as role"

## Publish on GitHub Pages

1. Push this folder to a repo.
2. Settings → Pages → Source: `main` / root.
3. The prototype opens at `https://<user>.github.io/<repo>/`.

## Contents

| File | What it is |
|---|---|
| `index.html` | The whole prototype: markup, logic, fonts, floor-plan image, data — no external requests |

## Interactive Floor Plan

Dashboard → **Floor plan** (or the sidebar item). Admin / Team Member can enter **Edit plan** to
drag a rectangle over a room, map it to an unmapped room of that property, rename or re-sort plans,
upload more plans, edit or archive individual beds, and change a room's type.

Built from the Kojeflow TZ and feedback docs. Terminology follows the Kojeflow terminology sheet
(Properties / Beds / Finance / In Transit–Received).
