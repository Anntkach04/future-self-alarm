/**
 * Moves the karaoke to the next line exactly `holdMs` after the line's final
 * word is accepted — never on a pause or a timer alone, never twice, and a
 * pending move is cancelled if recognition withdraws the final word or the
 * line changes some other way (e.g. the Continue button).
 */
export class LineTransition {
  private line = -1;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private fired = -1;

  constructor(
    private readonly onAdvance: (fromLine: number) => void,
    private readonly holdMs = 1000,
    private readonly setTimer: (fn: () => void, ms: number) => ReturnType<typeof setTimeout> = setTimeout,
    private readonly clearTimer: (id: ReturnType<typeof setTimeout>) => void = clearTimeout
  ) {}

  /** Call on every recognition update with the current line and its state. */
  update(lineIndex: number, complete: boolean) {
    if (lineIndex !== this.line) {
      this.cancel();
      this.line = lineIndex;
    }
    if (!complete) {
      this.cancel();
      return;
    }
    if (this.timer || this.fired === lineIndex) return;
    this.timer = this.setTimer(() => {
      this.timer = null;
      if (this.line !== lineIndex || this.fired === lineIndex) return;
      this.fired = lineIndex;
      this.onAdvance(lineIndex);
    }, this.holdMs);
  }

  cancel() {
    if (this.timer) this.clearTimer(this.timer);
    this.timer = null;
  }

  /** New recording: allow every line to fire again. */
  reset() {
    this.cancel();
    this.line = -1;
    this.fired = -1;
  }
}
