# Building Materials Trade Calculator

A lightweight, zero-dependency, open-source web calculator for international building materials buyers, contractors, and export sales teams.

Built with pure HTML, CSS, and modular vanilla JavaScript — runs directly on GitHub Pages or offline from `index.html` with no build step.

## Features

### 1. Container Load & Freight Ratio Calculator (CBM / 20GP / 40GP / 40HQ)
- **Dual Volume + Payload Weight Constraints**: Models both usable container volume (`28 / 58 / 68 CBM`) and destination payload limits (Standard International `25t / 26.5t` vs. North America Road Limit `19.5t / 20t`).
- **Mixed-Cargo Manifest**: Built-in editable presets for porcelain tiles, large-format sintered stone, marble/quartz slabs, flat-pack and assembled custom cabinets, aluminum windows/doors, interior doors, sanitary ware, and custom cargo items.
- **LCL vs. FCL Optimization**: Evaluates LCL (using maritime `1:1000 W/M` revenue ton billing) alongside optimal `20GP / 40GP / 40HQ` combinations to recommend the lowest estimated shipping plan.
- **Binding Constraint & Mixed-Load Insights**: Highlights whether a shipment is **Weight-Limited** (typical for tiles/stone) or **Volume-Limited** (typical for cabinets/doors) and surfaces remaining space/weight capacity.
- **Freight-to-Cargo Ratio**: Includes editable reference freight rates for major China-origin shipping routes to estimate ocean freight as a percentage of FOB cargo value.

### 2. Tile & Stone Wastage & Budget Estimator
- **Metric & Imperial Units**: Instant conversion between `m² / mm` and `sq ft / in`.
- **Laying Pattern Presets**: Standard wastage allowances for Straight Lay (`7%`), Running Bond / 1/3 Offset (`10%`), Diagonal 45° (`15%`), Herringbone / Chevron (`18%`), Large Slab / Bookmatch (`15%`), or custom `%`.
- **Full-Carton / Full-Slab Rounding**: Calculates exact piece count, rounds up to factory-shippable full cartons/slabs, and estimates gross weight and packed CBM.
- **One-Click Container Export**: Sends the calculated full-carton tile or slab order directly into the Container Manifest.

### Utility & Workflow
- **EN / 中文 Bilingual UI** (English default).
- **Copy Plain-Text Summary** formatted for WhatsApp or email.
- **Print / Save as PDF** with dedicated print stylesheet.
- **Local Persistence** via `localStorage` + one-click Sample Villa mixed-container dataset.

## Container Reference Parameters

| Container | Internal CBM | Usable CBM* | Standard Max Payload | North America Road Limit |
|---|---:|---:|---:|---:|
| `20GP` | 33.2 CBM | 28 CBM | 25,000 kg (25.0 t) | 19,500 kg (19.5 t) |
| `40GP` | 67.7 CBM | 58 CBM | 26,500 kg (26.5 t) | 20,000 kg (20.0 t) |
| `40HQ` | 76.3 CBM | 68 CBM | 26,500 kg (26.5 t) | 20,000 kg (20.0 t) |

*\*Usable CBM accounts for pallet clearances, A-frame crates, and non-stackable void space (~85–88% of theoretical internal volume).*

## Project Structure

```text
building-materials-calculator/
├── index.html          # Main application markup & WebApplication JSON-LD
├── css/
│   └── styles.css      # Minimal industrial UI + responsive + @media print
├── js/
│   ├── presets.js      # Container specs, material densities, route & tile presets
│   ├── i18n.js         # EN / ZH localization dictionary
│   ├── calculator.js   # Pure calculation engine (browser + Node testable)
│   └── app.js          # UI state, DOM rendering, localStorage, export actions
├── README.md
└── LICENSE
```

## Quick Start & GitHub Pages Deployment

### Run Locally
Open `index.html` directly in any modern browser, or serve locally:

```bash
python3 -m http.server 8080
```

### Deploy on GitHub Pages
1. Push this repository to GitHub (e.g., `main` branch).
2. Open **Settings → Pages**.
3. Set **Source** to **Deploy from a branch**, select `main` and `/ (root)`, then save.
4. Access the live tool at `https://<your-username>.github.io/<repo-name>/`.

## Disclaimer

All container usable capacities, material packaging weights/volumes, and reference route freight figures are indicative industry averages for early-stage budgeting. Always verify exact factory packing lists and current freight forwarder quotes prior to booking.

## License

MIT License — maintained by [George Build](https://george-build.com/).
