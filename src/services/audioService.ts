// Servicio de audio y hápticos usando Web Audio API nativo
class AudioService {
  private audioCtx: AudioContext | null = null;

  private initCtx() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  // Bip agudo estándar de escáner POS (Honeywell / Zebra)
  playScanBeep() {
    try {
      this.initCtx();
      if (!this.audioCtx) return;

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1950, this.audioCtx.currentTime); // Frecuencia de escáner profesional
      
      gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.08);

      // Vibración háptica en celulares Android
      if (navigator.vibrate) {
        navigator.vibrate(60);
      }
    } catch {
      // Ignorar errores de audio si el navegador bloquea autoplay
    }
  }

  // Tono de alerta doble para producto NO REGISTRADO en eleventa
  playWarningBeep() {
    try {
      this.initCtx();
      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(330, now + 0.12);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.28);

      if (navigator.vibrate) {
        navigator.vibrate([120, 80, 120]);
      }
    } catch {
      // Ignorar
    }
  }

  // Tono de éxito al completar auditoría o cuadrar
  playSuccessBeep() {
    try {
      this.initCtx();
      if (!this.audioCtx) return;

      const notes = [523.25, 659.25, 783.99, 1046.50]; // Acorde mayor ascendente
      notes.forEach((freq, index) => {
        if (!this.audioCtx) return;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        const time = this.audioCtx.currentTime + (index * 0.08);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(0.2, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(time);
        osc.stop(time + 0.12);
      });

      if (navigator.vibrate) {
        navigator.vibrate([80, 50, 100]);
      }
    } catch {
      // Ignorar
    }
  }
}

export const soundService = new AudioService();
