# Sharing = Caring

Borrow occasion wear from your friends. Live at https://sharingcaring.nl Browse their wardrobes, borrow a piece and shine at your event.

## How it is built
- `index.html`, `style.css`, `app.js`: the app itself, plain HTML/CSS/JavaScript, hosted on GitHub Pages.
- `lang.js`: the Dutch version of every text. Change a Dutch text there (right-hand side only); anything missing shows in English. People switch language under Edit profile or on the login screen.
- Supabase: login, database and photo storage. `schema.sql` sets up the tables and the rules for who may see what (only accepted friends see each other's pieces, photos and phone numbers).
- `manifest.webmanifest` and the icons let friends add the app to their home screen.

## Fonts
- Acumin Pro Wide and Jazzier come from the Adobe Fonts web project `hxf4jgi` (linked in `index.html`). Font files are never stored in this repository.
- `avatars/` holds crops of Vera's own photos, used as profile picture textures.

## Settings that live outside this repository
- Supabase > Authentication > URL Configuration: Site URL and Redirect URLs point to https://sharingcaring.nl/ (and the old GitHub Pages address).
- Supabase > Authentication > Emails > SMTP: a custom email sender, so sign-up emails reach everyone.

The publishable key in `app.js` is meant to be public. Never put the secret / service_role key in this repository.
