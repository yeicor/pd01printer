/**
 * PDF Loader Module
 *
 * Uses pdf.js to render PDF pages as images for printing.
 * Lazily loads pdf.js only when needed to keep bundle size small.
 */

export interface PDFPageInfo {
  pageNumber: number;
  width: number;
  height: number;
}

export interface PDFDocumentInfo {
  numPages: number;
  pages: PDFPageInfo[];
}

export interface PDFRenderOptions {
  /** Scale factor for rendering (higher = more detail, default: 2.0) */
  scale?: number;
  /** Page number to render (1-indexed, default: 1) */
  page?: number;
}

// Types for pdf.js (simplified)
interface PDFDocumentProxy {
  numPages: number;
  getPage(pageNumber: number): Promise<PDFPageProxy>;
  destroy(): Promise<void>;
}

interface PDFPageProxy {
  getViewport(options: { scale: number }): PDFViewport;
  render(options: {
    canvasContext: CanvasRenderingContext2D;
    viewport: PDFViewport;
  }): { promise: Promise<void> };
}

interface PDFViewport {
  width: number;
  height: number;
}

interface PDFJSLib {
  getDocument(
    src: string | ArrayBuffer | { data: ArrayBuffer },
  ): { promise: Promise<PDFDocumentProxy> };
  GlobalWorkerOptions: { workerSrc: string };
}

// Module state
let pdfjs: PDFJSLib | null = null;
let loadPromise: Promise<PDFJSLib> | null = null;

/**
 * Lazily load pdf.js library
 */
async function loadPdfJs(): Promise<PDFJSLib> {
  if (pdfjs) {
    return pdfjs;
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    // Load pdf.js from CDN
    const PDFJS_VERSION = "4.0.379";
    const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;

    // Create script element for the main library
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `${PDFJS_CDN}/pdf.min.js`;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load pdf.js"));
      document.head.appendChild(script);
    });

    // Get the library from window
    const lib = (window as unknown as { pdfjsLib: PDFJSLib }).pdfjsLib;
    if (!lib) {
      throw new Error("pdf.js not found on window");
    }

    // Set worker source
    lib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.js`;

    pdfjs = lib;
    return lib;
  })();

  return loadPromise;
}

/**
 * Check if a file is a PDF
 */
export function isPDF(file: File): boolean {
  return (
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  );
}

/**
 * Get information about a PDF document
 */
export async function getPDFInfo(file: File): Promise<PDFDocumentInfo> {
  const lib = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();

  const doc = await lib.getDocument({ data: arrayBuffer }).promise;

  const pages: PDFPageInfo[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1.0 });
    pages.push({
      pageNumber: i,
      width: viewport.width,
      height: viewport.height,
    });
  }

  await doc.destroy();

  return {
    numPages: doc.numPages,
    pages,
  };
}

/**
 * Render a PDF page to an HTMLImageElement
 */
export async function renderPDFPage(
  file: File,
  options: PDFRenderOptions = {},
): Promise<HTMLImageElement> {
  const { scale = 2.0, page = 1 } = options;

  const lib = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();

  const doc = await lib.getDocument({ data: arrayBuffer }).promise;

  if (page < 1 || page > doc.numPages) {
    await doc.destroy();
    throw new Error(
      `Invalid page number: ${page}. Document has ${doc.numPages} pages.`,
    );
  }

  const pdfPage = await doc.getPage(page);
  const viewport = pdfPage.getViewport({ scale });

  // Create canvas for rendering
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const ctx = canvas.getContext("2d")!;

  // Fill with white background (PDFs may have transparency)
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Render the page
  await pdfPage.render({
    canvasContext: ctx,
    viewport,
  }).promise;

  await doc.destroy();

  // Convert canvas to image
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to create image from PDF"));
    img.src = canvas.toDataURL("image/png");
  });
}

/**
 * Render all pages of a PDF as images
 */
export async function renderAllPDFPages(
  file: File,
  options: Omit<PDFRenderOptions, "page"> = {},
): Promise<HTMLImageElement[]> {
  const info = await getPDFInfo(file);
  const images: HTMLImageElement[] = [];

  for (let i = 1; i <= info.numPages; i++) {
    const img = await renderPDFPage(file, { ...options, page: i });
    images.push(img);
  }

  return images;
}

/**
 * Check if pdf.js is already loaded
 */
export function isPDFJSLoaded(): boolean {
  return pdfjs !== null;
}
