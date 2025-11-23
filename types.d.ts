export {}

declare global {
    const maplibregl: typeof import("maplibre-gl");
    const html2canvas: typeof import('html2canvas').default
    const L: typeof import('leaflet')
    const pako: typeof import('pako')
    const Panzoom: typeof import('@panzoom/panzoom').default
    const Raphael: typeof import('raphael')
}
