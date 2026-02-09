# PD01 Label Printer

A modern web application for printing labels on PD01/GB01 thermal printers using Web Bluetooth. Features intelligent image processing, automatic feature detection for optimal scaling, PDF support, and vertical strip splitting for wide labels.

![PD01 Label Printer](https://img.shields.io/badge/Web-Bluetooth-blue) ![License](https://img.shields.io/badge/License-MIT-green)

## Features

### 🖨️ Printer Connection
- **Web Bluetooth** - Connect directly from your browser
- **PD01 Protocol** - Full implementation of the proprietary BLE protocol
- **Real-time Progress** - Live print progress with status updates
- **Adjustable Print Darkness** - Control energy level for different paper types

### 🖼️ Image Processing
- **PDF Support** - Import PDF files, automatically rendered as images
- **No Dithering by Default** - Optimized for high-quality text and graphics
- **Multiple Dithering Options** - Floyd-Steinberg, Atkinson, Ordered, Threshold
- **Image Adjustments** - Brightness, contrast, sharpening, gamma correction
- **Invert Colors** - For printing dark images on thermal paper

### 🔍 Smart Feature Detection
- **Automatic Initial Scale** - Analyzes image to detect smallest features and sets optimal scale
- **Min Feature Heuristic** - Detects minimum distance between brightness transitions
- **Never Zooms In** - Default scale only reduces, never enlarges to preserve quality

### 📐 Continuous Scale Control
- **Smooth Scale Slider** - Set any scale from 5% to 300%
- **Automatic Strip Calculation** - Strips follow the scale automatically
- **Quick Strip Presets** - One-click buttons for 1, 2, 3, or 4 strips
- **Real-time Dimensions** - See output size in cm and pixels as you adjust

### ✂️ Label Splitting
- **Vertical Strip Splitting** - Split wide images for the 384px printer width
- **Separated View Toggle** - Checkbox to show individual strips alongside assembled preview
- **Zero Padding Default** - Maximize paper usage
- **Optional Alignment Marks** - Help with reassembly when enabled

### 📏 Improved Preview
- **Smooth Zoom Slider** - Continuous zoom from 10% to 400%
- **Mouse Wheel Zoom** - Scroll to zoom in/out
- **Pan & Drag** - Navigate around large previews with click-drag
- **Actual Size Button** - Quick access to 100% printed size view
- **Proper Canvas Sizing** - Preview properly handles all zoom levels without cropping

### ✏️ Enhanced Text Label Creator
- **Text Alignment** - Left, center, or right alignment options
- **Adjustable Padding** - Default 0px, adjustable up to 32px
- **Live Preview** - See your label as you type and adjust settings
- **Compact Layout** - Uses only required height for components
- **Font Size Range** - 12px to 72px for any label size

### ⚙️ Progressive Disclosure
- **Clean Default UI** - Essential controls visible at a glance
- **Advanced Settings** - Collapsible panel for image adjustments
- **Quick Access** - Transform controls always visible for common operations

### 🌐 Progressive Web App
- **Offline Support** - Works offline after first load
- **Installable** - Add to home screen on any device
- **Responsive Design** - Works on desktop and mobile

## Getting Started

### Prerequisites

- A modern browser with Web Bluetooth support (Chrome, Edge, Opera)
- A PD01, GB01, MX, or compatible thermal printer
- Node.js 18+ (for development)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/pd01printer.git
cd pd01printer

# Install dependencies
npm install

# Start development server
npm run dev
```

### Production Build

```bash
npm run build
npm run preview
```

## Usage Guide

### Basic Workflow

1. **Connect Printer** - Click "Connect Printer" and select your device
2. **Upload Image** - Drag & drop images or PDFs, or click to upload
3. **Adjust Scale** - Use the scale slider to set your desired size
4. **Preview** - Check the preview, toggle "Show Separated" to see individual strips
5. **Print** - Click "Print X Strips" to send to printer

### Scale Controls

The **Scale** panel provides smooth, continuous control:

- **Scale Slider** - Drag to set any scale from 5% to 300%
- **Quick Presets** - Click "1 strip", "2 strips", etc. for common sizes
- **Auto Detection** - Images are automatically scaled based on feature analysis

The number of strips updates automatically as you adjust the scale.

### Understanding Dimensions

All dimensions are shown in both pixels and centimeters:
- **Printer Width**: 384px = 4.9cm (at 200 DPI)
- **Output Size**: Shows final printed dimensions
- **Strip Width**: Individual strip measurements

### Preview Navigation

- **Zoom Slider** - Smooth control from 10% to 400%
- **Mouse Wheel** - Scroll to zoom in/out
- **Drag to Pan** - Click and drag to move around the preview
- **1:1 Button** - Shows exact printed size on your screen
  - Shows a warning icon (⚠️) when DPI hasn't been calibrated
  - Click the ruler icon (📏) next to it to calibrate your display
- **Calibration** - Manual DPI calibration for accurate 1:1 preview
  - Measure a 5cm reference bar on your screen with a ruler
  - Enter the actual measurement to calibrate display size
  - Calibration persists across sessions in browser storage
- **Show Separated** - Checkbox to display individual strips below the assembled view

### Creating Text Labels

1. Click the "Text" button in the upload area
2. Enter your text in the panel
3. Adjust font size with the slider (12-72px)
4. Set padding (default: 0px)
5. Choose alignment (left, center, right)
6. Toggle Bold and Border options
7. See the live preview update as you type
8. Click "Create Label"

### Importing PDFs

Simply drag & drop a PDF file or select it from the file picker:
- All pages are automatically imported as separate images
- PDFs are rendered at 2x scale for high quality
- Each page gets automatic feature detection and scaling
- Each page can be printed independently

### Printing Tips

- **For Text/Graphics**: Keep dithering set to "None"
- **For Photos**: Try "Floyd-Steinberg" or "Atkinson" dithering
- **For Thin Paper**: Reduce print darkness in settings
- **For Wide Labels**: Adjust scale and check strip count

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome 70+ | ✅ Full |
| Edge 79+ | ✅ Full |
| Opera 57+ | ✅ Full |
| Firefox | ❌ No Web Bluetooth |
| Safari | ❌ No Web Bluetooth |

## Project Structure

```
pd01printer/
├── src/
│   ├── lib/
│   │   ├── printer/           # Printer protocol
│   │   │   ├── protocol.ts    # PD01 commands & CRC8
│   │   │   ├── bluetooth.ts   # Web Bluetooth connection
│   │   │   └── printer.ts     # High-level API
│   │   └── image/
│   │       ├── processor.ts   # Dithering & adjustments
│   │       ├── splitter.ts    # Strip splitting
│   │       ├── transform.ts   # Scale, crop, rotate
│   │       ├── text-optimizer.ts  # Text rendering
│   │       └── pdf.ts         # PDF loading (lazy)
│   ├── store/
│   │   └── index.ts           # Zustand state
│   ├── hooks/
│   │   └── usePrinter.ts      # React printer hook
│   ├── App.tsx                # Main UI
│   └── main.tsx               # Entry point
├── public/                    # Static assets
├── .github/workflows/
│   └── deploy.yml             # GitHub Pages CI/CD
└── package.json
```

## Technical Details

### Print Specifications

| Property | Value |
|----------|-------|
| Paper Width | 384 dots (4.9cm at 200 DPI) |
| Resolution | 200 DPI |
| Bytes per Line | 48 |
| Bit Order | LSB first |
| Black Pixel | 1 (burn) |
| White Pixel | 0 (no burn) |

### Protocol Format

```
[0x51] [0x78] [CMD] [0x00] [LEN_LO] [LEN_HI] [DATA...] [CRC8] [0xFF]
```

### Key Commands

| Command | Hex | Description |
|---------|-----|-------------|
| GET_STATE | 0xA3 | Query device state |
| SET_QUALITY | 0xA4 | Set 200 DPI |
| SET_ENERGY | 0xAF | Set print darkness |
| LATTICE_START | 0xA6 | Begin print |
| PRINT_ROW | 0xA2 | Send bitmap row |
| FEED_PAPER | 0xBD | Feed paper |
| LATTICE_END | 0xA6 | End print |

### Feature Detection Algorithm

The application uses a heuristic based on minimum distance between brightness transitions:

1. Convert image to binary (black/white)
2. Sample horizontal and vertical lines
3. Measure distances between consecutive transitions
4. Take the 10th percentile as the minimum feature size
5. Calculate scale to make minimum feature = 3 pixels
6. Never zoom in (scale ≤ 1.0) to preserve quality

## GitHub Pages Deployment

The project auto-deploys on push to `main`:

1. Go to repository Settings → Pages
2. Set Source to "GitHub Actions"
3. Push to `main` branch

## Development

### Available Scripts

```bash
npm run dev       # Development server
npm run build     # Production build
npm run preview   # Preview production
npm run lint      # ESLint
npm run typecheck # TypeScript check
```

### Tech Stack

- **React 18** - UI framework
- **TypeScript 5** - Type safety
- **Vite 5** - Build tool
- **Tailwind CSS 3** - Styling
- **Zustand 5** - State management
- **Lucide React** - Icons
- **PDF.js** - PDF rendering (bundled, lazy-loaded)
- **Vite PWA** - Progressive Web App

## Troubleshooting

### "Web Bluetooth not supported"
- Use Chrome, Edge, or Opera
- Ensure HTTPS (or localhost)
- Check browser flags for Web Bluetooth

### Printer not found
- Power cycle the printer
- Enable Bluetooth on your device
- Move closer to the printer
- Try disconnecting other Bluetooth devices

### Poor print quality
- Increase print darkness in settings
- For photos, try dithering algorithms
- For text, ensure dithering is "None"
- Increase contrast and sharpening

### Text too small after printing
- Check the initial auto-scaling message
- Manually increase the scale if needed
- Use more strips for larger output

### 1:1 preview not accurate on mobile/phone
- The 1:1 button may show a warning icon (⚠️) indicating uncalibrated DPI
- Click the ruler icon (📏) to open the calibration dialog
- Use a physical ruler to measure the 5cm blue bar on your screen
- Enter your measurement and save to calibrate
- Calibration is saved and persists across sessions

### Strips don't align
- Enable alignment marks in Advanced Settings
- Use a ruler to align edges
- Print on a flat surface

### "Failed to load PDF"
- PDF.js is bundled locally and loads automatically when needed
- Try refreshing the page
- Check browser console for specific errors

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push branch (`git push origin feature/amazing`)
5. Open Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- [catprinter](https://github.com/rbaron/catprinter) - Protocol research
- [PD01 Protocol Documentation](https://github.com/rhnvrm/catprinter/blob/master/docs/pd01-protocol.md)
- [PDF.js](https://mozilla.github.io/pdf.js/) - PDF rendering engine (bundled)

## Related Projects

- [rbaron/catprinter](https://github.com/rbaron/catprinter) - Python CLI
- [WerWolv/PythonCatPrinter](https://github.com/WerWolv/PythonCatPrinter) - Protocol RE
