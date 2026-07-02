// worker.js — runs aeroSolver off the main thread (GitHub Pages safe)
import { aeroSolver } from './solver.js?v=uas-layout-order-20260629';

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
      pressure: out.pressure,
      gamma: out.gamma,
      flowfield: out.flowfield,
      stopped: !!out.stopped
    };

    self.postMessage({ type:'done', out: outLite });
  } catch(e){
    self.postMessage({ type:'error', message: (e && e.message) ? e.message : String(e) });
  }
};
