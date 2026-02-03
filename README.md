# PD01 Label Printer

A modern web application for printing labels on PD01/GB01 thermal printers using Web Bluetooth. Features intelligent image splitting for large labels that can be printed in vertical strips and pasted together.

![PD01 Label Printer](https://img.shields.io/badge/Web-Bluetooth-blue) ![License](https://img.shields.io/badge/License-MIT-green) ![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)

## Features

### 🖨️ Printer Support
- **Web Bluetooth** - Connect to PD01/GB01 thermal printers directly from your browser
- **PD01 Protocol** - Full implementation of the proprietary BLE protocol
- **Real-time Progress** - Live print progress tracking with status updates

### 🖼️ Image Processing
- **Multiple Dithering Algorithms** - Floyd-Steinberg, Atkinson, Ordered (Bayer), and simple threshold
- **Image Adjustments** - Brightness, contrast, sharpening, gamma correction
- **Auto-optimization** - Images are automatically resized to 384px width (200 DPI)
- **Invert Support** - For printing dark images on thermal paper

### ✂️ Label Splitting
- **Vertical Strip Splitting** - Split large images into printer-width strips
- **Alignment Marks** - Optional alignment marks for easy reassembly
- **Assembly Preview** - See how strips will look when pasted together
- **Rotate Support** - Rotate images 90° for optimal split orientation

### 📝 Text Labels
- **Built-in Text Editor** - Create text labels without external software
- **Customizable Fonts** - Adjustable size, weight, and styling
- **Word Wrapping** - Automatic text wrapping to fit printer width
- **Border Option** - Add borders to text labels

### 🌐 Progressive Web App
- **Offline Support** - Works offline after first load
- **Installable** - Install as a native-like app on any device
- **Responsive Design** - Works on desktop and mobile devices

## Getting Started

### Prerequisites

- A modern browser with Web Bluetooth support (Chrome, Edge, Opera)
- A PD01, GB01, or compatible thermal printer
- Node.js 18+ (for development)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/pd01printer.git
cd pd01printer

# Install dependencies
npm install

# Start development server
npm run dev
```

### Building for Production

```bash
# Build the application
npm run build

# Preview the production build
npm run preview
```

## Usage

### Connecting to a Printer

1. Click the **"Connect Printer"** button in the header
2. Select your PD01/GB01 printer from the Bluetooth device list
3. The connection indicator will turn green when connected

### Printing an Image

1. **Upload an Image** - Drag and drop or click to upload images
2. **Adjust Settings** - Use the processing controls to optimize the image
3. **Preview** - Switch between Original, Processed, and Split views
4. **Print** - Click the Print button to send to the printer

### Creating Text Labels

1. Expand the **"Create Text Label"** section
2. Enter your text
3. Adjust font size, bold, and border options
4. Click **"Create Label"**

### Printing Large Labels

For labels wider than 384 pixels:

1. Upload your large label image
2. The app automatically splits it into vertical strips
3. View the **Split** preview to see all strips
4. Alignment marks help you paste strips together accurately
5. Print all strips and assemble by matching the alignment marks

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
│   │   ├── printer/          # Printer protocol implementation
│   │   │   ├── protocol.ts   # PD01 command protocol & CRC8
│   │   │   ├── bluetooth.ts  # Web Bluetooth connection
│   │   │   └── printer.ts    # High-level printer API
│   │   └── image/
│   │       ├── processor.ts  # Image processing & dithering
│   │       ├── splitter.ts   # Label splitting logic
│   │       └── text-optimizer.ts  # Text rendering
│   ├── store/
│   │   └── index.ts          # Zustand state management
│   ├── hooks/
│   │   └── usePrinter.ts     # Printer React hook
│   ├── components/           # React components
│   ├── App.tsx               # Main application
│   ├── main.tsx              # Entry point
│   └── index.css             # Tailwind CSS styles
├── public/                   # Static assets
├── .github/workflows/
│   └── deploy.yml            # GitHub Pages deployment
└── package.json
```

## Protocol Reference

The PD01 printer uses a proprietary BLE protocol with the following structure:

```
[0x51] [0x78] [CMD] [0x00] [LEN_LO] [LEN_HI] [DATA...] [CRC8] [0xFF]
```

### Key Commands

| Command | Hex | Description |
|---------|-----|-------------|
| GET_STATE | 0xA3 | Query device state |
| SET_QUALITY | 0xA4 | Set 200 DPI quality |
| SET_ENERGY | 0xAF | Set print darkness |
| LATTICE_START | 0xA6 | Begin print sequence |
| PRINT_ROW | 0xA2 | Send bitmap row |
| FEED_PAPER | 0xBD | Feed paper lines |
| LATTICE_END | 0xA6 | End print sequence |

### Print Specifications

- **Paper Width**: 384 dots (58mm at 200 DPI)
- **Bytes per Line**: 48 (384 / 8 bits)
- **Bit Order**: LSB first
- **1 = Black** (burn), **0 = White** (no burn)

## GitHub Pages Deployment

The project includes a GitHub Actions workflow for automatic deployment:

1. Push to `main` or `master` branch
2. GitHub Actions builds the project
3. Automatically deploys to GitHub Pages

To enable:
1. Go to repository Settings → Pages
2. Set Source to "GitHub Actions"

## Development

### Available Scripts

```bash
npm run dev       # Start development server
npm run build     # Build for production
npm run preview   # Preview production build
npm run lint      # Run ESLint
npm run typecheck # Run TypeScript type checking
```

### Technologies Used

- **React 18** - UI framework
- **TypeScript 5** - Type safety
- **Vite 5** - Build tool
- **Tailwind CSS 3** - Styling
- **Zustand 5** - State management
- **Lucide React** - Icons
- **Vite PWA** - Progressive Web App support

## Troubleshooting

### "Web Bluetooth not supported"
- Use Chrome, Edge, or Opera
- Ensure you're on HTTPS (or localhost)
- Enable Web Bluetooth in browser flags if needed

### Printer not found
- Ensure the printer is powered on
- Check that Bluetooth is enabled on your device
- Try moving closer to the printer

### Print quality issues
- Adjust the **Energy** setting for darker prints
- Use **Atkinson** dithering for text/line art
- Increase **Contrast** and **Sharpen** for text

### Strips not aligning
- Enable **Alignment Marks** in settings
- Match the triangular marks when pasting
- Use strip numbers at top/bottom as reference

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [catprinter](https://github.com/rbaron/catprinter) - Protocol research and Python implementation
- [PD01 Protocol Documentation](https://github.com/rhnvrm/catprinter/blob/master/docs/pd01-protocol.md) - Protocol specification

## Related Projects

- [rbaron/catprinter](https://github.com/rbaron/catprinter) - Python CLI for cat printers
- [WerWolv/PythonCatPrinter](https://github.com/WerWolv/PythonCatPrinter) - Protocol reverse engineering