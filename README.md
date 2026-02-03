# PD01 Label Printer

A modern web application for printing labels on PD01/GB01 thermal printers using Web Bluetooth. Features intelligent image processing, vertical strip splitting for wide labels, and optional OCR for text extraction.

![PD01 Label Printer](https://img.shields.io/badge/Web-Bluetooth-blue) ![License](https://img.shields.io/badge/License-MIT-green) ![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)

## Features

### 🖨️ Printer Connection
- **Web Bluetooth** - Connect directly from your browser
- **PD01 Protocol** - Full implementation of the proprietary BLE protocol
- **Real-time Progress** - Live print progress with status updates
- **Adjustable Print Darkness** - Control energy level for different paper types

### 🖼️ Image Processing
- **No Dithering by Default** - Optimized for high-quality text and graphics
- **Multiple Dithering Options** - Floyd-Steinberg, Atkinson, Ordered, Threshold (when needed)
- **Image Adjustments** - Brightness, contrast, sharpening, gamma correction
- **Invert Colors** - For printing dark images on thermal paper

### 📐 Scale & Crop
- **Quick Strip Presets** - One-click scaling for 1, 2, 3, or 4 strips
- **Custom Scale** - Fine-grained control from 10% to 300%
- **Auto Trim** - Remove whitespace from image edges automatically
- **Rotate & Flip** - Transform images for optimal printing orientation

### ✂️ Label Splitting
- **Vertical Strip Splitting** - Split wide images for the 384px printer width
- **Zero Padding Default** - Maximize paper usage
- **Optional Alignment Marks** - Help with reassembly when enabled
- **Assembly Preview** - See how strips will look when pasted together

### 🔍 Content Block Detection (Advanced Mode)
- **Automatic Detection** - Find regions of text, barcodes, and QR codes
- **Visual Overlay** - See detected blocks on the original image
- **Block Classification** - Identify content type for each region
- **Rearrangement Ready** - Foundation for block-based layout editing

### 📝 OCR Text Extraction (Advanced Mode)
- **Lazy Loading** - Tesseract.js only downloads when requested (~2MB)
- **Text Extraction** - Extract text from detected content blocks
- **Per-Block OCR** - Run OCR on specific regions of interest

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
2. **Upload Image** - Drag & drop or click to upload
3. **Adjust Size** - Use the "Size & Strips" panel to set scale
4. **Print** - Click "Print X Strips" to send to printer

### Scale Controls

The **Size & Strips** panel lets you control output size:

- **1 Strip** - Scale image to fit printer width (384px)
- **2 Strips** - Double width, prints as 2 vertical strips
- **3/4 Strips** - For larger labels
- **Custom Scale** - Use the slider for precise control

### Simple vs Advanced Mode

Toggle between modes using the button in the header:

**Simple Mode** (Default):
- Size & Strips controls
- Basic image adjustments
- Print controls

**Advanced Mode** (Additional features):
- Transform controls (rotate, flip, trim)
- Content block detection
- OCR text extraction
- Dithering algorithms
- Alignment marks & padding

### Creating Text Labels

1. Expand "Create Text Label" section
2. Enter your text
3. Adjust font size and styling
4. Click "Create Label"

### Printing Tips

- **For Text/Graphics**: Keep dithering set to "None"
- **For Photos**: Try "Floyd-Steinberg" or "Atkinson" dithering
- **For Thin Paper**: Reduce print darkness in settings
- **For Wide Labels**: Use 2-3 strips and align using edge markers

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
│   │       └── ocr.ts         # Lazy-loaded OCR
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
| Paper Width | 384 dots (58mm) |
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
- **Tesseract.js** - OCR (optional, lazy-loaded)
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

### Strips don't align
- Enable alignment marks in Advanced mode
- Use a ruler to align edges
- Print on a flat surface

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
- [Tesseract.js](https://tesseract.projectnaptha.com/) - OCR engine

## Related Projects

- [rbaron/catprinter](https://github.com/rbaron/catprinter) - Python CLI
- [WerWolv/PythonCatPrinter](https://github.com/WerWolv/PythonCatPrinter) - Protocol RE