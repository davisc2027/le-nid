// Le Nid: AudioWorklet that turns the microphone into 16 kHz mono frames of 20 ms.
// Posts { pcm: Float32Array(320), sumSq, count } where sumSq/count describe the original-rate samples of that frame
// (so the main thread gets an exact level without a second analyser). Nothing leaves the device from here.
class LeNidCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 16000; // input samples per output sample (3 at 48 kHz)
    this.need = this.ratio;
    this.acc = 0;
    this.out = new Float32Array(320);
    this.n = 0;
    this.sumSq = 0;
    this.count = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      const x = ch[i];
      this.sumSq += x * x;
      this.count++;
      let w = 1;
      while (w > 1e-9) {
        const take = Math.min(w, this.need);
        this.acc += x * take;
        this.need -= take;
        w -= take;
        if (this.need <= 1e-9) {
          this.out[this.n++] = this.acc / this.ratio;
          this.acc = 0;
          this.need = this.ratio;
          if (this.n === this.out.length) {
            this.port.postMessage({ pcm: this.out, sumSq: this.sumSq, count: this.count }, [this.out.buffer]);
            this.out = new Float32Array(320);
            this.n = 0;
            this.sumSq = 0;
            this.count = 0;
          }
        }
      }
    }
    return true;
  }
}
registerProcessor("le-nid-capture", LeNidCapture);
