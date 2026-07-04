// worker.js — runs aeroSolver off the main thread (GitHub Pages safe)
import { aeroSolver } from './solver.js?v=uas-pressure-potentials-20260704j';

let stopRequested = false;

self.onmessage = (ev) => {
  const msg = ev.data || {};
  if (msg.type === 'stop') { stopRequested = true; return; }
  if (msg.type !== 'run') return;

  stopRequested = false;
  const params = msg.params;

  try{
    const out = aeroSolver(params, {
      onProgress: (k, it) => {
        if (k % 10 === 0) self.postMessage({ type:'progress', k, it });
      },
      shouldStop: () => stopRequested
    });

    const outLite = {
      loads: out.loads,
      LESP: Array.from(out.LESP),
      Gamma: Array.from(out.Gamma),
      stagnationPoint: Array.from(out.stagnationPoint),
      kelvinResidual: Array.from(out.kelvinResidual),
      fourier: out.fourier,
      pressure: out.pressure,
      pressureReference: out.pressureReference,
      surfaceX: Array.from(out.surfaceX),
      surfaceVelocity: out.surfaceVelocity,
      flowfield: out.flowfield,
      stopped: !!out.stopped
    };

    self.postMessage({ type:'done', out: outLite });
  } catch(e){
    self.postMessage({ type:'error', message: (e && e.message) ? e.message : String(e) });
  }
};
