# Terraposter

**Maps, styled to belong on walls.**

Create personalized city map posters from any location worldwide. Add custom titles, subtitles, and your name. Download high-quality, print-ready artwork. Completely free, runs entirely in your browser.

---

## Live Demo

**https://sidshot.github.io/Terraposter**

---

## Features

- Search any city or use GPS location
- Add custom title, subtitle, and name
- 17 professionally designed themes
- Portrait, square, and landscape formats
- Adjustable map radius (2-25km)
- High-definition PNG export (3000x4000px)
- Share to Twitter, Instagram, Reddit, WhatsApp, Telegram
- 100% client-side - no data stored, no server required

---

## Technology

- HTML5 Canvas for rendering
- OpenStreetMap data via Overpass API
- Nominatim geocoding
- Browser Geolocation API
- Vanilla JavaScript (ES6 modules)

---

## Local Development

```bash
git clone https://github.com/Sidshot/Terraposter.git
cd Terraposter
python -m http.server 8080
```

Open http://localhost:8080

---

## Deployment

Hosted on GitHub Pages. Any push to `main` triggers automatic deployment.

---

## Credits

- Map data: OpenStreetMap contributors
- Geocoding: Nominatim
- Inspiration: originalankur/maptoposter

---

## License

MIT License
