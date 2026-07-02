// solver.js — minimal JS port of aero_solver.m (U‑TAS v1.1)
// NOTE: This is a faithful structural port for the thin-airfoil data shipped with this repo.
//       For thick/cambered airfoils, you will likely need to revisit the theta mapping and panel geometry.

export function aeroSolver(params, hooks = {}) {
  const {
    Uref, c, t, alpha, h,
    dalpha: dalphaInput,
    d2alpha: d2alphaInput,
    dh: dhInput,
    d2h: d2hInput,
    xp = 0.25, xref = 0.25,
    nAterm = 80,
    iterMax = 100,
    tol = 1e-6,

    // --- performance knobs (safe defaults for browser) ---
    // Max number of wake vortices kept for physics + visualization.
    // (Oldest vortices are purged in chunks.)
    maxWake = 800,
    // Save a wake snapshot at every time step.
    wakeSaveStride = 1,
    // Wake self-induction model: 0 disables wake-wake influence;
    // otherwise, each vortex interacts only with neighbors within +/- wakeWakeNeighbors indices.
    wakeWakeNeighbors = 120
  } = params;

  const it = t.length;
  if (it < 3) throw new Error("Kinematics need at least three time samples.");
  const dt = t[1] - t[0];
  if (!Number.isFinite(dt) || dt <= 0) throw new Error("Kinematics require a positive uniform time step.");

  // --- airfoil geometry ---
  // coords are arrays of [x,y] in body frame, chord-normalized (0..1).
  const coords = params.airfoil; // length nNodes
  const nNodes = coords.length;

  // panels between nodes -> panel_center length = nNodes-1
  const m = nNodes - 1;               // collocation count
  const N = m - 1;                    // matches MATLAB: N = length(panel)-1
  if (m < 2) throw new Error("Airfoil needs at least 3 points.");

  const xc = new Float64Array(m);
  const yc = new Float64Array(m);
  const panelAngle = new Float64Array(m);

  for (let i = 0; i < m; i++) {
    const x1 = coords[i][0], y1 = coords[i][1];
    const x2 = coords[i+1][0], y2 = coords[i+1][1];
    xc[i] = 0.5*(x1 + x2);
    yc[i] = 0.5*(y1 + y2);
    panelAngle[i] = Math.atan2(y2 - y1, x2 - x1);
  }

  // theta mapping: theta = acos(1 - 2*x_center) (assumes x in [0,1])
  const theta = new Float64Array(m);
  for (let i=0;i<m;i++){
    const x = xc[i];
    theta[i] = Math.acos(1 - 2*x);
  }
  const dtheta = theta[1] - theta[0];

  // Precompute trig tables (MATLAB: I.theta and I.sin_theta)
  const n = nAterm - 1; // number of An terms (n>=1)
  const I_theta = new Array(m);      // m x n
  const I_sin_theta = new Array(m);  // m x n
  for (let i=0;i<m;i++){
    const rowC = new Float64Array(n);
    const rowS = new Float64Array(n);
    const th = theta[i];
    const sin_th = Math.sin(th);
    for (let j=0;j<n;j++){
      const k = j+1; // 1..n
      rowC[j] = Math.cos(k*th);
      rowS[j] = Math.sin(k*th)*sin_th;
    }
    I_theta[i]=rowC;
    I_sin_theta[i]=rowS;
  }

  // --- kinematics coefficients B, dB (calc_B) ---
  const B0 = new Float64Array(it);
  const B1 = new Float64Array(it);
  const dB0 = new Float64Array(it);
  const dB1 = new Float64Array(it);

  const dalpha = validSeries(dalphaInput, it) ? Float64Array.from(dalphaInput) : firstDerivativeForward(dt, alpha);
  const d2alpha = validSeries(d2alphaInput, it) ? Float64Array.from(d2alphaInput) : secondDerivativeForward(dt, alpha);
  const dh = validSeries(dhInput, it) ? Float64Array.from(dhInput) : firstDerivativeForward(dt, h);
  const d2h = validSeries(d2hInput, it) ? Float64Array.from(d2hInput) : secondDerivativeForward(dt, h);

  for (let k=0;k<it;k++){
    const a = alpha[k];
    const sa = Math.sin(a), ca = Math.cos(a);
    B0[k]  = -sa + (dh[k]/Uref)*ca + (c/Uref)*dalpha[k]*(xp - 0.5);
    dB0[k] = -ca*dalpha[k] + (d2h[k]/Uref)*ca - (dh[k]/Uref)*sa*dalpha[k] + (c/Uref)*d2alpha[k]*(xp - 0.5);
    B1[k]  = (c*dalpha[k])/(2*Uref);
    dB1[k] = (c*d2alpha[k])/(2*Uref);
  }

  // --- outputs ---
  const out = {
    loads: new Array(it),      // [Cn, Cs, CL, CD, Cm]
    LESP: new Float64Array(it),
    Gamma: new Float64Array(it),
    gamma: new Array(it),      // bound-vorticity distribution along the airfoil
    pressure: new Array(it),   // Float64Array(m)
    flowfield: {
      TE: new Array(it),              // sparse wake snapshots for animation
      wakeSaveStride,
      // global max |Gamma| in the wake (for stable color scaling)
      maxAbsG: 0
    },
    vortices: { TE: [] }       // each item: {z:{re,im}, G}
  };

  // --- wake storage (dynamic arrays) ---
  const wakeRe = []; // positions
  const wakeIm = [];
  const wakeG  = [];

  let maxAbsG = 0;

  // purge policy: remove old vortices in chunks to avoid O(n) shift every step
  const purgeChunk = Math.max(50, Math.floor(0.25 * Math.max(0, maxWake)));
  function purgeWakeIfNeeded(){
    const nWake = wakeG.length;
    if (maxWake > 0 && nWake > (maxWake + purgeChunk)){
      const nPurge = Math.min(purgeChunk, nWake - maxWake);
      wakeRe.splice(0, nPurge);
      wakeIm.splice(0, nPurge);
      wakeG.splice(0, nPurge);
    }
  }

  function saveWakeSnapshot(k){
    // store typed arrays (fast + compact) for visualization
    out.flowfield.TE[k] = {
      re: Float32Array.from(wakeRe),
      im: Float32Array.from(wakeIm),
      G:  Float32Array.from(wakeG)
    };
  }

  // lambda storage for time-derivative
  let lambdaOld = new Float64Array(nAterm);

  // --- main loop ---
  let stop = false;
  const shouldStop = (typeof hooks.shouldStop === 'function') ? hooks.shouldStop : null;

  for (let k=0;k<it;k++){
    if (shouldStop && shouldStop()) { stop = true; break; }
    hooks.onProgress && hooks.onProgress(k, it);

    // inertial coords of collocation points: (coord - xp*c)*exp(-i alpha) - U t + i h
    const a = alpha[k];
    const ca = Math.cos(a), sa = Math.sin(a);
    const zRe = new Float64Array(m);
    const zIm = new Float64Array(m);
    const xpAbs = xp*c;

    for (let i=0;i<m;i++){
      const xr = (xc[i]*c - xpAbs);
      const yi = (yc[i]*c);
      // (xr + i*yi)*exp(-i a)
      const rotRe = xr*ca + yi*sa;
      const rotIm = -xr*sa + yi*ca;
      zRe[i] = rotRe - Uref*t[k];
      zIm[i] = rotIm + h[k];
    }

    // tangent/normal in inertial (only need for complex_dot)
    // tangent = exp(i*panelAngle)*exp(-i alpha); normal = tangent*exp(i*pi/2)
    const tanRe = new Float64Array(m);
    const tanIm = new Float64Array(m);
    const norRe = new Float64Array(m);
    const norIm = new Float64Array(m);
    for (let i=0;i<m;i++){
      const ang = panelAngle[i] - a;
      const tr = Math.cos(ang), ti = Math.sin(ang);
      tanRe[i]=tr; tanIm[i]=ti;
      norRe[i]=-ti; norIm[i]=tr;
    }

    // wake induced velocity at bound points
    const nWake = wakeG.length;
    let W = new Float64Array(m);
    if (nWake > 0){
      const VindRe = new Float64Array(m);
      const VindIm = new Float64Array(m);
      for (let j=0;j<nWake;j++){
        const vRe = wakeRe[j], vIm = wakeIm[j];
        const G = wakeG[j];
        for (let i=0;i<m;i++){
          const dx = zRe[i] - vRe;
          const dy = zIm[i] - vIm;
          const r2 = dx*dx + dy*dy;
          if (r2 === 0) continue;
          const fac = 1.0/(2*Math.PI*r2);
          // pv = -i*(P-V)/(2*pi*r^2) => (dy - i*dx)/(2*pi*r^2)
          const pvRe = dy*fac;
          const pvIm = -dx*fac;
          VindRe[i] += pvRe*G;
          VindIm[i] += pvIm*G;
        }
      }
      // W = -real(normal*conj(Vind))
      for (let i=0;i<m;i++){
        W[i] = - ( norRe[i]*VindRe[i] + norIm[i]*VindIm[i] );
      }
    }

    // Fourier coefficients lambda from W/U
    const lambda = sFourier(scaleArray(W, 1.0/Uref), theta, dtheta, I_theta, nAterm);

    // provisional Gamma_bound from lambda and B
    const A0 = -lambda[0] - B0[k];
    const A1 =  lambda[1] + B1[k];
    let Gamma_bound = Math.PI*c*Uref*(A0 + 0.5*A1);

    // shed new vortex position at TE: use last collocation point as TE proxy
    const TERe = zRe[m-1], TEIm = zIm[m-1];
    let newVRe, newVIm;
    if (k > 0){
      const prevRe = wakeRe[nWake-1], prevIm = wakeIm[nWake-1];
      newVRe = (2/3)*TERe + (1/3)*prevRe;
      newVIm = (2/3)*TEIm + (1/3)*prevIm;
    } else {
      newVRe = TERe + 0.5*Uref*dt;
      newVIm = TEIm;
    }

    // Solve Kelvin for new vortex circulation using secant-like Newton
    let g0 = -0.01, g1 = 0.0;
    let f0 = 1.0,  f1 = Gamma_bound + sum(wakeG); // like MATLAB init

    let lambdaKelvin = lambda;
    let GammaKelvinBound = Gamma_bound;

    for (let iter=0; iter<iterMax && Math.abs(f0) > tol; iter++){
      // induced by new vortex at bound points: Vind_new = g0 * pv(z, newV)
      const Wnew = inducedDownwashFromSingleVortex(zRe, zIm, norRe, norIm, newVRe, newVIm, g0);
      const Wtot = addArrays(W, Wnew);
      lambdaKelvin = sFourier(scaleArray(Wtot, 1.0/Uref), theta, dtheta, I_theta, nAterm);

      const A0k = -lambdaKelvin[0] - B0[k];
      const A1k =  lambdaKelvin[1] + B1[k];
      GammaKelvinBound = Math.PI*c*Uref*(A0k + 0.5*A1k);

      f0 = GammaKelvinBound + g0 + sum(wakeG);
      const dfdg = (f0 - f1)/(g0 - g1);
      f1 = f0;
      g1 = g0;
      g0 = g0 - f0/dfdg;
      if (!Number.isFinite(g0)) { g0 = 0; break; }
    }

    // finalize lambda and dlambda
    const dlambda = new Float64Array(nAterm);
    for (let j=0;j<nAterm;j++) dlambda[j] = (lambdaKelvin[j] - lambdaOld[j])/dt;
    lambdaOld = lambdaKelvin;
    // track global max |Gamma| for stable color scaling
    if (Number.isFinite(g0)) maxAbsG = Math.max(maxAbsG, Math.abs(g0));

    // store wake vortex
    wakeRe.push(newVRe); wakeIm.push(newVIm); wakeG.push(g0);
    out.vortices.TE.push({ z:{re:newVRe, im:newVIm}, G:g0 });


    // LESP and bound circulation
    out.LESP[k] = -lambdaKelvin[0] - B0[k];
    out.Gamma[k] = GammaKelvinBound;

    // gamma distribution + Gamma weights vector
    const gammaOut = calcGamma({
      lambda: lambdaKelvin, dlambda,
      B0: B0[k], B1: B1[k], dB0: dB0[k], dB1: dB1[k],
      Uref, c, theta, dtheta, I_sin_theta
    });
    out.gamma[k] = gammaOut.gamma;

    // pressure (matches MATLAB expression)
    const pr = new Float64Array(m);
    for (let i=0;i<m;i++){
      const th = theta[i];
      const s = Math.sin(th);
      const cs = Math.cos(th);
      const term1 = out.LESP[k]*(1+cs)/s;
      const term2 = (B1[k] - dB0[k])*s;
      const term3 = -dB1[k]*Math.sin(2*th);
      pr[i] = 4*(term1 + term2) + term3;
    }
    out.pressure[k] = pr;

    // loads (matches MATLAB)
    const Cn = -2*Math.PI*(lambdaKelvin[0] + B0[k] - 0.5*B1[k]) - Math.PI*c/(2*Uref)*dB0[k];
    const Cs =  2*Math.PI*out.LESP[k]*out.LESP[k];

    const CL = Cn*Math.cos(a) + Cs*Math.sin(a);
    const CD = Cn*Math.sin(a) - Cs*Math.cos(a);

    const Cm = (xref - 0.25)*Cn - (Math.PI/4)*B1[k] + (Math.PI*c/(8*Uref))*(dB0[k] - 0.25*dB1[k]);

    out.loads[k] = [Cn, Cs, CL, CD, Cm];

    // convect wake
    convectWake({
      dt, wakeRe, wakeIm, wakeG,
      boundGammaWeights: gammaOut.GammaWeights,
      boundZRe: zRe, boundZIm: zIm,
      wakeWakeNeighbors
    });

    // keep wake bounded (physics + visualization)
    purgeWakeIfNeeded();

    // save wake snapshots sparsely for animation
    if (k === 0 || k === it-1 || (wakeSaveStride > 0 && (k % wakeSaveStride === 0))){
      saveWakeSnapshot(k);
    }
  }
  out.flowfield.maxAbsG = maxAbsG;
  out.stopped = stop;
  return out;
}


// ---------------- math helpers ----------------

function sum(arr){ let s=0; for (let i=0;i<arr.length;i++) s+=arr[i]; return s; }

function validSeries(arr, n){
  if (!arr || typeof arr.length !== 'number' || arr.length !== n) return false;
  for (let i=0; i<n; i++){
    if (!Number.isFinite(Number(arr[i]))) return false;
  }
  return true;
}

function firstDerivativeForward(dt, f){
  const n=f.length;
  const d=new Float64Array(n);
  for (let i=0;i<n-1;i++) d[i]=(f[i+1]-f[i])/dt;
  d[n-1]=d[n-2];
  return d;
}
function secondDerivativeForward(dt, f){
  const n=f.length;
  const d2=new Float64Array(n);
  // forward 2nd derivative for interior (like MATLAB second_derivative_forward)
  for (let i=0;i<n-2;i++) d2[i]=(f[i]-2*f[i+1]+f[i+2])/(dt*dt);
  d2[n-2]=d2[n-3];
  d2[n-1]=d2[n-3];
  return d2;
}

function scaleArray(a, s){
  const out=new Float64Array(a.length);
  for (let i=0;i<a.length;i++) out[i]=a[i]*s;
  return out;
}
function addArrays(a,b){
  const out=new Float64Array(a.length);
  for (let i=0;i<a.length;i++) out[i]=a[i]+b[i];
  return out;
}

function intRule(f, dx){
  const nx = f.length;
  let I=0;
  if (nx % 2 === 1){
    // Simpson
    let sum2=0, sum4=0;
    for (let i=2;i<=nx-3;i+=2) sum2 += f[i];
    for (let i=1;i<=nx-2;i+=2) sum4 += f[i];
    I = (dx/3)*(f[0] + f[nx-1] + 2*sum2 + 4*sum4);
  } else {
    // trapezoid
    let s=0;
    for (let i=1;i<nx-1;i++) s += f[i];
    I = (dx/2)*(f[0] + f[nx-1] + 2*s);
  }
  return I;
}

function sFourier(W, theta, dtheta, I_theta, nAterm){
  const n = nAterm - 1;
  const lambda = new Float64Array(nAterm);
  // A0
  lambda[0] = (1/Math.PI)*intRule(W, dtheta);
  // An
  for (let j=0;j<n;j++){
    const tmp = new Float64Array(W.length);
    for (let i=0;i<W.length;i++) tmp[i] = W[i]*I_theta[i][j];
    lambda[j+1] = (2/Math.PI)*intRule(tmp, dtheta);
  }
  return lambda;
}

function inducedDownwashFromSingleVortex(zRe,zIm,norRe,norIm,vRe,vIm,G){
  const m=zRe.length;
  const W=new Float64Array(m);
  for (let i=0;i<m;i++){
    const dx=zRe[i]-vRe, dy=zIm[i]-vIm;
    const r2=dx*dx+dy*dy;
    if (r2===0) continue;
    const fac=1.0/(2*Math.PI*r2);
    const pvRe=dy*fac;
    const pvIm=-dx*fac;
    const VindRe=pvRe*G, VindIm=pvIm*G;
    W[i] = - (norRe[i]*VindRe + norIm[i]*VindIm);
  }
  return W;
}

function calcGamma({lambda, dlambda, B0, B1, dB0, dB1, Uref, c, theta, dtheta, I_sin_theta}){
  const m = theta.length;
  const n = lambda.length - 1;

  // lambda_n = lambda(2:end); adjust lambda_n(2) += B1 (MATLAB indexing)
  const lambda_n = new Float64Array(n);
  for (let j=0;j<n;j++) lambda_n[j]=lambda[j+1];
  if (n >= 2) lambda_n[1] += B1;

  // sum_{n} lambda_n[n]*sin(n*theta)*sin(theta)
  const sumLam = new Float64Array(m);
  for (let i=0;i<m;i++){
    let s=0;
    const row = I_sin_theta[i];
    for (let j=0;j<n;j++) s += lambda_n[j]*row[j];
    sumLam[i]=s;
  }

  const gamma_sin = new Float64Array(m);
  for (let i=0;i<m;i++){
    const th=theta[i];
    gamma_sin[i] = -2*Uref*(lambda[0] + B0)*(1+Math.cos(th)) + 2*Uref*sumLam[i];
  }

  // GammaWeights: tri-diagonal apply then * (dtheta/8)*(c/2)
  const w = new Float64Array(m);
  for (let i=0;i<m;i++){
    let val = 6*gamma_sin[i];
    if (i===0) val = 3*gamma_sin[i] + gamma_sin[i+1];
    else if (i===m-1) val = gamma_sin[i-1] + 3*gamma_sin[i];
    else val = gamma_sin[i-1] + 6*gamma_sin[i] + gamma_sin[i+1];
    w[i] = (c/2) * val * (dtheta/8);
  }

  // gamma = gamma_sin/sin(theta) (avoid division by zero at endpoints)
  const gamma = new Float64Array(m);
  for (let i=0;i<m;i++){
    const s = Math.sin(theta[i]);
    gamma[i] = (Math.abs(s) < 1e-12) ? 0 : (gamma_sin[i]/s);
  }

  // dlambda section not required for convection in this port (kept for future)
  return { gamma, GammaWeights: w };
}

function convectWake({dt, wakeRe, wakeIm, wakeG, boundGammaWeights, boundZRe, boundZIm, wakeWakeNeighbors = 0}){
  const nWake = wakeG.length;
  if (nWake === 0) return;

  // bound influence on wake: -GammaWeights * pv(boundZ, wakePos)
  const boundVindRe = new Float64Array(nWake);
  const boundVindIm = new Float64Array(nWake);

  for (let j=0;j<nWake;j++){
    const vRe = wakeRe[j], vIm = wakeIm[j];
    let sRe=0, sIm=0;
    for (let i=0;i<boundGammaWeights.length;i++){
      const dx = boundZRe[i] - vRe;
      const dy = boundZIm[i] - vIm;
      const r2 = dx*dx + dy*dy;
      if (r2===0) continue;
      const fac=1.0/(2*Math.PI*r2);
      const pvRe = dy*fac;
      const pvIm = -dx*fac;
      sRe += boundGammaWeights[i]*pvRe;
      sIm += boundGammaWeights[i]*pvIm;
    }
    boundVindRe[j] = -sRe;
    boundVindIm[j] = -sIm;
  }

  // wake-wake influence (optional, bandwidth-limited for performance)
  const wakeVindRe = new Float64Array(nWake);
  const wakeVindIm = new Float64Array(nWake);
  if (wakeWakeNeighbors > 0){
    const bw = Math.min(wakeWakeNeighbors|0, nWake);
    for (let j=0;j<nWake;j++){
      const pjRe = wakeRe[j], pjIm = wakeIm[j];
      let sRe=0, sIm=0;
      const k0 = Math.max(0, j - bw);
      const k1 = Math.min(nWake - 1, j + bw);
      for (let k=k0;k<=k1;k++){
        const dx = pjRe - wakeRe[k];
        const dy = pjIm - wakeIm[k];
        const r2 = dx*dx + dy*dy;
        if (r2===0) continue;
        const fac=1.0/(2*Math.PI*r2);
        const pvRe = dy*fac;
        const pvIm = -dx*fac;
        const G = wakeG[k];
        sRe += pvRe*G;
        sIm += pvIm*G;
      }
      wakeVindRe[j]=sRe;
      wakeVindIm[j]=sIm;
    }
  }

  // update positions
  for (let j=0;j<nWake;j++){
    const vRe = boundVindRe[j] + wakeVindRe[j];
    const vIm = boundVindIm[j] + wakeVindIm[j];
    wakeRe[j] += dt*vRe;
    wakeIm[j] += dt*vIm;
  }
}
