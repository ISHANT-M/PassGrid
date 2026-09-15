# PassGrid

PassGrid is a browser tool for turning an ordinary photo into a print-ready
sheet of passport-sized photographs. Upload a photo, pick a country preset
or a custom size, choose the paper you're going to print on, and PassGrid
detects the face, crops and centers it, lays out a grid, and gives you back
a PDF (or a single high-resolution JPEG) ready to print.

Everything runs in the browser. There is no backend and no upload to a
server — the image never leaves the user's machine.

## Features

- Face detection to automatically center and crop the photo (falls back to
  a plain centered crop if no face is found)
- Built-in size presets: India, US, UK, Schengen/EU, China, Canada,
  Australia, Japan, plus a custom size field
- Paper size options: A4, US Letter, 4x6 in, 5x7 in
- Adjustable margins and spacing between photos, with optional cut guides
- Optional one-click enhancement (brightness, contrast, sharpening) for
  photos taken in poor lighting
- Export as a print-ready PDF grid or a single high-quality JPEG

## Tech stack

Plain HTML, CSS and JavaScript. No build step, no framework, no bundler.
This keeps the project easy to read, easy to deploy for free, and fast to
load.

Two libraries are loaded from a CDN at runtime:

- [face-api.js](https://github.com/justadudewhohacks/face-api.js) for face
  detection (TinyFaceDetector model)
- [jsPDF](https://github.com/parallax/jsPDF) for generating the PDF grid

Everything else — cropping, resizing, the enhancement filters, the grid
layout math — is plain canvas code in `app.js`.

## Running it locally

No install step is required. Any static file server works, for example:

```
npx serve .
```

or just open `index.html` directly in a browser. Face detection needs the
page to be served over `http://` or `https://` (not `file://`) in most
browsers, so a local server is recommended over double-clicking the file.

## Project structure

```
index.html      Page structure and layout
styles.css      All styling
app.js          Upload, face detection, cropping, grid layout, PDF/JPEG export
assets/         Favicon and logo (SVG)
```

## Deployment

This is a static site, so it can be hosted for free on any static hosting
provider. A few options:

- **GitHub Pages** — push this repo to GitHub, then enable Pages in the
  repository settings (Settings > Pages > Deploy from branch > main).
  The site will be live at `https://ISHANT-M.github.io/passgrid`.
- **Netlify** — drag and drop the project folder onto
  [app.netlify.com/drop](https://app.netlify.com/drop), or connect the
  GitHub repo for automatic redeploys on every push.
- **Vercel** — import the GitHub repo at [vercel.com/new](https://vercel.com/new)
  and deploy with the default static settings.
- **Cloudflare Pages** — connect the repo at
  [pages.cloudflare.com](https://pages.cloudflare.com); no build command
  needed since there's nothing to compile.

Any of these work well for a static, no-backend project like this one.
GitHub Pages is the simplest if the code is already going to live on
GitHub.

## Limitations

- Face detection runs a lightweight model in the browser. It works well for
  a single, front-facing, well-lit face, but can miss faces in poor
  lighting, at an angle, or wearing certain accessories. When it can't find
  a face, the tool falls back to a centered crop.
- This tool helps produce a correctly sized and cropped photo, but does not
  guarantee compliance with every country's official passport photo rules
  (background color, headwear rules, expression, etc). Check your country's
  requirements before submitting a printed photo.

## Credits

Developed by Ishant Mehndiratta — [github.com/ISHANT-M](https://github.com/ISHANT-M)
