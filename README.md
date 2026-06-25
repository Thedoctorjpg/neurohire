# NeuroHire

Safe, anonymous reporting for neurodiverse and disabled jobseekers in New Zealand.

NeuroHire is a single-page HTML form that lets people document inaccessible or discriminatory hiring experiences — at application, assessment, interview, or offer stage — without requiring an account or exposing personal details unless they choose to.

## Live demo

After enabling GitHub Pages on this repo, the form is available at:

**https://thedoctorjpg.github.io/neurohire/**

## Features

- **Four-step flow** — Opportunity → What happened → Impact → Review & submit
- **Anonymous by default** — contact email is optional
- **Mobile-friendly** — responsive layout with Tailwind CSS
- **No backend required** — submissions via [Formspree](https://formspree.io)
- **Static hosting** — one `index.html` file; works on GitHub Pages, Netlify, or any static host

## Quick start

### 1. Clone the repo

```bash
git clone https://github.com/Thedoctorjpg/neurohire.git
cd neurohire
```

### 2. Configure Formspree

1. Create a free form at [formspree.io](https://formspree.io).
2. Open `index.html` and replace the placeholder in the form `action`:

```html
action="https://formspree.io/f/YOUR_FORM_ID"
```

Use your real Formspree form ID (e.g. `https://formspree.io/f/xyzabcde`).

### 3. Run locally

Open `index.html` in a browser, or serve the folder:

```bash
# Python 3
python -m http.server 8080
```

Then visit `http://localhost:8080`.

### 4. Deploy

**GitHub Pages**

1. Push this repo to GitHub.
2. Go to **Settings → Pages**.
3. Source: **Deploy from branch** → `main` → `/ (root)`.
4. Save. The site will be live at `https://<username>.github.io/neurohire/`.

**Other hosts**

Upload `index.html` to Netlify, Cloudflare Pages, or any static file host.

## Form fields

| Step | Fields |
|------|--------|
| **1. Opportunity** | Company (optional), job title, hiring stage, date |
| **2. What happened** | Issue types, description, accommodation requests |
| **3. Impact** | Effects on wellbeing/opportunity, notes, support preference |
| **4. Submit** | Review summary, optional email, consent, submit |

Submissions are sent to your Formspree inbox. Configure Formspree notifications and spam filtering in the Formspree dashboard.

## Privacy

- Reports are anonymous unless the user enters a contact email.
- No cookies or analytics are built into this form.
- Third-party resources loaded: Tailwind CSS CDN, Font Awesome CDN, Formspree (on submit only).
- Operators are responsible for how submitted data is stored, used, and disclosed under applicable law (e.g. NZ Privacy Act 2020).

## Project structure

```
neurohire/
├── index.html   # Complete single-file form
├── README.md
└── LICENSE
```

## Contributing

Issues and pull requests are welcome. Please keep the form accessible, privacy-preserving, and suitable for static hosting.

## Author

**David Logan** — [GitHub](https://github.com/Thedoctorjpg) · [LinkedIn](https://www.linkedin.com/in/david-logan-b33777309)

## License

MIT License — see [LICENSE](LICENSE).