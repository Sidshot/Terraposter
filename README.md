# 🗺️ Terraposter

> **Maps, styled to belong on walls.**

Transform any city into a stunning, personalized map poster. Add your name, customize the text, and download print-ready artwork. Free forever.

---

## ✨ Features

- **🌍 Any City** - Search any location or use GPS
- **✏️ Personalize** - Add custom title, subtitle, and your name
- **🎨 17 Themes** - Noir, Cyberpunk, Japanese Ink, and more
- **📐 3 Sizes** - Portrait, Square, Landscape
- **🔍 Adjustable Radius** - 2km to 25km coverage
- **📸 High Quality** - 3000×4000px print-ready PNG
- **📤 Social Sharing** - Twitter, Instagram, Reddit, WhatsApp, Telegram
- **💰 Free Forever** - No sign-up, no fees, runs in your browser

---

## 🚀 Try It

**[Open Terraposter →](https://your-username.github.io/terraposter)**

---

## 🏠 Local Development

```bash
# Clone
git clone https://github.com/your-username/terraposter.git
cd terraposter

# Run
python -m http.server 8080
# or: npx serve
```

Open http://localhost:8080

---

## 📁 Structure

```
terraposter/
├── index.html          # Main page
├── logo.png            # Logo
├── css/styles.css      # Styling
├── js/
│   ├── app.js          # App controller
│   ├── themes.js       # 17 themes
│   ├── data-fetcher.js # API calls
│   └── map-renderer.js # Canvas rendering
└── README.md
```

---

## 🚢 Deploy

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR-USERNAME/terraposter.git
git push -u origin main
```

Enable Pages: **Settings → Pages → Source: main**

---

## 🙏 Credits

- [OpenStreetMap](https://www.openstreetmap.org/) - Map data
- [originalankur/maptoposter](https://github.com/originalankur/maptoposter) - Inspiration

---

MIT License
