import type {
  ISeriesPrimitive,
  SeriesAttachedParameter,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  Time,
} from 'lightweight-charts';
import type { CanvasRenderingTarget2D } from 'fancy-canvas';

export interface ChartBoxData {
  id: string;
  fromTime: number;
  toTime: number | null;
  topPrice: number;
  bottomPrice: number;
  fillColor: string;
  borderColor: string;
  label?: string;
}

interface PixelBox {
  x1: number; x2: number;
  y1: number; y2: number;
  fill: string; border: string;
  label?: string;
}

class BoxPaneRenderer implements IPrimitivePaneRenderer {
  constructor(private _boxes: PixelBox[]) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useMediaCoordinateSpace(({ context: ctx }) => {
      for (const b of this._boxes) {
        const left = Math.min(b.x1, b.x2);
        const width = Math.max(1, Math.abs(b.x2 - b.x1));
        const top = Math.min(b.y1, b.y2);
        const height = Math.max(1, Math.abs(b.y2 - b.y1));

        ctx.fillStyle = b.fill;
        ctx.fillRect(left, top, width, height);
        ctx.strokeStyle = b.border;
        ctx.lineWidth = 1;
        ctx.strokeRect(left + 0.5, top + 0.5, Math.max(0, width - 1), Math.max(0, height - 1));

        if (b.label && width > 30) {
          ctx.font = '10px Inter, sans-serif';
          ctx.fillStyle = b.border;
          ctx.textBaseline = 'top';
          ctx.fillText(b.label, left + 3, top + 2);
        }
      }
    });
  }
}

class BoxPaneView implements IPrimitivePaneView {
  private _renderer = new BoxPaneRenderer([]);
  update(boxes: PixelBox[]) { this._renderer = new BoxPaneRenderer(boxes); }
  renderer(): IPrimitivePaneRenderer { return this._renderer; }
}

export class BoxOverlayPrimitive implements ISeriesPrimitive<Time> {
  private _param: SeriesAttachedParameter<Time> | null = null;
  private _data: ChartBoxData[] = [];
  private _paneView = new BoxPaneView();

  attached(param: SeriesAttachedParameter<Time>): void {
    this._param = param;
    this.updateAllViews();
  }

  detached(): void {
    this._param = null;
  }

  setBoxes(boxes: ChartBoxData[]): void {
    this._data = boxes;
    this.updateAllViews();
    this._param?.requestUpdate();
  }

  updateAllViews(): void {
    if (!this._param) return;
    const chart = this._param.chart;
    const series = this._param.series;
    const timeScale = chart.timeScale();
    const rightEdgePx = timeScale.width();

    const pixelBoxes: PixelBox[] = [];
    for (const b of this._data) {
      const x1 = timeScale.timeToCoordinate(b.fromTime as Time);
      const x2 = b.toTime === null ? rightEdgePx : timeScale.timeToCoordinate(b.toTime as Time);
      const y1 = series.priceToCoordinate(b.topPrice);
      const y2 = series.priceToCoordinate(b.bottomPrice);
      if (x1 === null || x2 === null || y1 === null || y2 === null) continue;
      pixelBoxes.push({ x1, x2, y1, y2, fill: b.fillColor, border: b.borderColor, label: b.label });
    }
    this._paneView.update(pixelBoxes);
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this._paneView];
  }
}
