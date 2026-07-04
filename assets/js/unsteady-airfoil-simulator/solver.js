// Direct linear discrete-vortex implementation of the thesis-exact attached-flow model.
// Camber enters through the full B_n series. The matched-asymptotic finite-radius
// correction regularizes pressure and surface velocity at the leading edge.

export function aeroSolver(params, hooks = {}) {
  const {
    Uref, c, t, alpha, h,
    dalpha: dalphaInput,
    d2alpha: d2alphaInput,
    dh: dhInput,
    d2h: d2hInput,
    xp = 0.25, xref = 0.25,
    nAterm = 80,
    nascentBeta = 0.5,

    // --- performance knobs (safe defaults for browser) ---
    // Max number of wake vortices kept for physics + visualization.
    // (Oldest vortices are purged in chunks.)
    maxWake = 0,
    // Save a wake snapshot at every time step.
    wakeSaveStride = 1,
    // Wake self-induction model: a negative value uses every shed vortex, zero disables
    // wake-wake influence, and a positive value applies an index-neighborhood approximation.
    wakeWakeNeighbors = -1
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
  if (m < 2) throw new Error("Airfoil needs at least 3 points.");
  if (!Number.isInteger(nAterm) || nAterm < 2 || nAterm > m){
    throw new Error(`Fourier terms must be an integer between 2 and ${m}.`);
  }
  if (!Number.isFinite(nascentBeta) || nascentBeta <= 0 || nascentBeta >= 1){
    throw new Error("Nascent-vortex placement beta must lie strictly between 0 and 1.");
  }
  const camberCoefficients = finiteSeries(params.camberCoefficients, [0]);
  const thicknessCoefficients = finiteSeries(params.thicknessCoefficients, [0, 0]);
  const leadingEdgeRadius = 0.5*Math.pow(thicknessCoefficients[0] || 0, 2);

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

  // Midpoint grid in theta. The UI supplies cosine-spaced chord nodes, so panel
  // centers correspond to theta midpoints and the Fourier quadrature is uniform.
  const theta = new Float64Array(m);
  for (let i=0;i<m;i++){
    theta[i] = (i + 0.5)*Math.PI/m;
    const xTheta = 0.5*(1 - Math.cos(theta[i]));
    const x1 = coords[i][0], y1 = coords[i][1];
    const x2 = coords[i+1][0], y2 = coords[i+1][1];
    const span = x2 - x1;
    const fraction = Math.abs(span) < 1e-14 ? 0.5 : (xTheta - x1)/span;
    xc[i] = xTheta;
    yc[i] = y1 + fraction*(y2 - y1);
  }
  const dtheta = Math.PI/m;

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

  // --- lifting coefficients B_n and physical-time derivatives ---
  const B = new Array(it);
  const dB = new Array(it);

  const dalpha = validSeries(dalphaInput, it) ? Float64Array.from(dalphaInput) : firstDerivativeForward(dt, alpha);
  const d2alpha = validSeries(d2alphaInput, it) ? Float64Array.from(d2alphaInput) : secondDerivativeForward(dt, alpha);
  const dh = validSeries(dhInput, it) ? Float64Array.from(dhInput) : firstDerivativeForward(dt, h);
  const d2h = validSeries(d2hInput, it) ? Float64Array.from(d2hInput) : secondDerivativeForward(dt, h);

  for (let k=0;k<it;k++){
    const a = alpha[k];
    const sa = Math.sin(a), ca = Math.cos(a);
    const vt = Uref*ca + dh[k]*sa;
    const dvt = -Uref*sa*dalpha[k] + d2h[k]*sa + dh[k]*ca*dalpha[k];
    const row = new Float64Array(nAterm);
    const drow = new Float64Array(nAterm);
    row[0] = -sa + (dh[k]/Uref)*ca + (c/Uref)*dalpha[k]*(xp - 0.5)
      + (vt/Uref)*(camberCoefficients[0] || 0);
    drow[0] = -ca*dalpha[k] + (d2h[k]/Uref)*ca
      - (dh[k]/Uref)*sa*dalpha[k] + (c/Uref)*d2alpha[k]*(xp - 0.5)
      + (dvt/Uref)*(camberCoefficients[0] || 0);
    for (let mode=1; mode<nAterm; mode++){
      const eta = camberCoefficients[mode] || 0;
      row[mode] = 2*(vt/Uref)*eta + (mode === 1 ? (c*dalpha[k])/(2*Uref) : 0);
      drow[mode] = 2*(dvt/Uref)*eta + (mode === 1 ? (c*d2alpha[k])/(2*Uref) : 0);
    }
    B[k] = row;
    dB[k] = drow;
  }

  // --- outputs ---
  const out = {
    loads: new Array(it),      // [Cn, Cs, CL, CD, Cm]
    LESP: new Float64Array(it),
    Gamma: new Float64Array(it),
    stagnationPoint: new Float64Array(it),
    kelvinResidual: new Float64Array(it),
    fourier: new Array(it),    // A_0 ... A_N at every time step
    pressure: new Array(it),   // {delta, upper, lower}
    surfaceVelocity: new Array(it), // {upper, lower}, normalized by Uref
    flowfield: {
      TE: new Array(it),              // sparse wake snapshots for animation
      LE: new Array(it),              // reserved for future LESP-triggered LEV snapshots
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

  // --- main loop ---
  let stop = false;
  const shouldStop = (typeof hooks.shouldStop === 'function') ? hooks.shouldStop : null;

  for (let k=0;k<it;k++){
    if (shouldStop && shouldStop()) { stop = true; break; }
    hooks.onProgress && hooks.onProgress(k, it);

    // inertial coords of collocation points: (coord - xp*c)*exp(-i alpha) - U t + i h
    const a = alpha[k];
    const ca = Math.cos(a), sa = Math.sin(a);
    const Bk = B[k];
    const dBk = dB[k];
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

    // Modal contribution of the previously shed wake.
    const lambdaBase = sFourier(scaleArray(W, 1.0/Uref), dtheta, I_theta, nAterm);
    const A0Base = -2*(lambdaBase[0] + Bk[0]);
    const A1Base =  2*(lambdaBase[1] + Bk[1]);
    const GammaBase = 0.5*Math.PI*c*Uref*(A0Base + 0.5*A1Base);

    // Nascent TE vortex placement, Eq. (122). In this fixed frame the airfoil translates
    // through still fluid, which is equivalent to the thesis freestream/body-frame form.
    const teX = coords[nNodes - 1][0]*c - xpAbs;
    const teY = coords[nNodes - 1][1]*c;
    const TERe = teX*ca + teY*sa - Uref*t[k];
    const TEIm = -teX*sa + teY*ca + h[k];
    let wakeTeRe = 0;
    let wakeTeIm = 0;
    for (let j=0;j<nWake;j++){
      const dx = TERe - wakeRe[j];
      const dy = TEIm - wakeIm[j];
      const r2 = dx*dx + dy*dy;
      if (r2 < 1e-24) continue;
      const factor = wakeG[j]/(2*Math.PI*r2);
      wakeTeRe += dy*factor;
      wakeTeIm -= dx*factor;
    }
    const vTe = Uref*ca + dh[k]*sa
      + wakeTeRe*tanRe[m-1] + wakeTeIm*tanIm[m-1];
    const offset = nascentBeta*Math.max(Math.abs(vTe), 1e-8*Uref)*dt;
    const newVRe = TERe + offset*tanRe[m-1];
    const newVIm = TEIm + offset*tanIm[m-1];

    // Direct linear DVM closure. The modal response to the nascent vortex is linear
    // in its circulation, so Kelvin's condition is solved once, algebraically.
    const Wunit = inducedDownwashFromSingleVortex(
      zRe, zIm, norRe, norIm, newVRe, newVIm, 1
    );
    const lambdaUnit = sFourier(scaleArray(Wunit, 1.0/Uref), dtheta, I_theta, nAterm);
    const A0Influence = -2*lambdaUnit[0];
    const A1Influence =  2*lambdaUnit[1];
    const dGammaDg = 0.5*Math.PI*c*Uref*(A0Influence + 0.5*A1Influence);
    const denominator = 1 + dGammaDg;
    if (!Number.isFinite(denominator) || Math.abs(denominator) < 1e-12){
      throw new Error(`Singular trailing-edge vortex solve at time step ${k + 1}.`);
    }

    const oldWakeGamma = sum(wakeG);
    const g0 = -(GammaBase + oldWakeGamma)/denominator;
    if (!Number.isFinite(g0)){
      throw new Error(`Non-finite trailing-edge circulation at time step ${k + 1}.`);
    }

    const lambdaKelvin = new Float64Array(nAterm);
    for (let j=0;j<nAterm;j++){
      lambdaKelvin[j] = lambdaBase[j] + g0*lambdaUnit[j];
    }
    const GammaKelvinBound = GammaBase + g0*dGammaDg;
    out.kelvinResidual[k] = GammaKelvinBound + oldWakeGamma + g0;

    // track global max |Gamma| for stable color scaling
    maxAbsG = Math.max(maxAbsG, Math.abs(g0));

    // store wake vortex
    wakeRe.push(newVRe); wakeIm.push(newVIm); wakeG.push(g0);
    out.vortices.TE.push({ z:{re:newVRe, im:newVIm}, G:g0 });


    // LESP and bound circulation
    out.LESP[k] = -2*(lambdaKelvin[0] + Bk[0]);
    out.Gamma[k] = GammaKelvinBound;
    const vtNormalized = ca + (dh[k]/Uref)*sa;
    out.stagnationPoint[k] = Math.abs(vtNormalized) > 1e-12
      ? 0.25*Math.pow(out.LESP[k]/vtNormalized, 2)
      : NaN;
    const fourierCoefficients = new Float64Array(nAterm);
    fourierCoefficients[0] = out.LESP[k];
    for (let mode=1; mode<nAterm; mode++){
      fourierCoefficients[mode] = 2*(lambdaKelvin[mode] + Bk[mode]);
    }
    out.fourier[k] = fourierCoefficients;

    // gamma distribution + Gamma weights vector
    const gammaOut = calcGamma({
      lambda: lambdaKelvin,
      B: Bk,
      Uref, c, theta, dtheta, I_sin_theta
    });
    // Matched-asymptotic, finite-radius distributions: thesis Eqs. (120) and (122).
    // These retain the complete camber B_n series while removing the sharp-edge
    // singularity from the displayed pressure and surface velocities.
    const tauScale = c/(2*Uref);
    const Bprime = new Float64Array(nAterm);
    for (let mode=0; mode<nAterm; mode++) Bprime[mode] = tauScale*dBk[mode];
    const deltaCp = new Float64Array(m);
    const velocityUpper = new Float64Array(m);
    const velocityLower = new Float64Array(m);
    const cpUpper = new Float64Array(m);
    const cpLower = new Float64Array(m);
    for (let i=0;i<m;i++){
      const th = theta[i];
      const s = Math.sin(th);
      const cs = Math.cos(th);
      const regularizedLeadingEdge = Math.sqrt(2)/Math.sqrt(1 + leadingEdgeRadius - cs)
        - Math.tan(th/4);
      let pressureJump = 2*out.LESP[k]*regularizedLeadingEdge - 4*Bprime[0]*s;
      for (let mode=1; mode<nAterm; mode++){
        pressureJump += 4*Bk[mode]*Math.sin(mode*th);
      }
      if (nAterm > 1) pressureJump -= Bprime[1]*Math.sin(2*th);
      for (let mode=2; mode<nAterm; mode++){
        pressureJump += 2*Bprime[mode]*(
          Math.sin((mode - 1)*th)/(mode - 1)
          - Math.sin((mode + 1)*th)/(mode + 1)
        );
      }
      deltaCp[i] = pressureJump;

      const x = Math.max(1e-14, xc[i]);
      const baseVelocity = vtNormalized*Math.sqrt(x)/Math.sqrt(x + leadingEdgeRadius/2);
      const matchedLiftingVelocity = 0.5*(
        gammaOut.gamma[i]/Uref
        + out.LESP[k]*(1/Math.sqrt(x + leadingEdgeRadius/2) - 1/Math.sqrt(x))
      );
      velocityUpper[i] = baseVelocity + matchedLiftingVelocity;
      velocityLower[i] = baseVelocity - matchedLiftingVelocity;
      const meanCp = 1 - 0.5*(
        velocityUpper[i]*velocityUpper[i] + velocityLower[i]*velocityLower[i]
      );
      cpUpper[i] = meanCp - 0.5*pressureJump;
      cpLower[i] = meanCp + 0.5*pressureJump;
    }
    out.pressure[k] = { delta: deltaCp, upper: cpUpper, lower: cpLower };
    out.surfaceVelocity[k] = { upper: velocityUpper, lower: velocityLower };

    // General cambered-airfoil loads, thesis Eqs. (82), (83), and (99)-(104).
    const B1 = Bk[1] || 0;
    const B2 = Bk[2] || 0;
    const B0prime = Bprime[0] || 0;
    const B1prime = Bprime[1] || 0;
    const B2prime = Bprime[2] || 0;
    const B3prime = Bprime[3] || 0;
    const Cn = Math.PI*(out.LESP[k] + B1) - Math.PI*(B0prime - 0.5*B2prime);
    const Cs = 0.5*Math.PI*out.LESP[k]*out.LESP[k];

    const CL = Cn*Math.cos(a) + Cs*Math.sin(a);
    const CD = Cn*Math.sin(a) - Cs*Math.cos(a);

    const Cm = (xref - 0.25)*Cn + (Math.PI/4)*(B2 - B1)
      + (Math.PI/4)*(B0prime - 0.25*B1prime - 0.5*B2prime + 0.25*B3prime);

    out.loads[k] = [Cn, Cs, CL, CD, Cm];

    // Snapshot belongs to the current instant; roll-up advances the wake to k + 1.
    if (k === 0 || k === it-1 || (wakeSaveStride > 0 && (k % wakeSaveStride === 0))){
      saveWakeSnapshot(k);
    }

    if (k < it - 1){
      convectWake({
        dt, wakeRe, wakeIm, wakeG,
        boundGammaWeights: gammaOut.GammaWeights,
        boundZRe: zRe, boundZIm: zIm,
        wakeWakeNeighbors
      });
      purgeWakeIfNeeded();
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

function finiteSeries(values, fallback){
  const source = values && typeof values.length === 'number' ? values : fallback;
  const result = Float64Array.from(source, Number);
  for (let i=0; i<result.length; i++){
    if (!Number.isFinite(result[i])) throw new Error("Airfoil coefficient data must be finite.");
  }
  return result;
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

function sFourier(W, dtheta, I_theta, nAterm){
  const n = nAterm - 1;
  const lambda = new Float64Array(nAterm);
  let meanSum = 0;
  for (let i=0;i<W.length;i++) meanSum += W[i];
  lambda[0] = (dtheta/Math.PI)*meanSum;

  // Midpoint quadrature on the uniform theta grid.
  for (let j=0;j<n;j++){
    let modalSum = 0;
    for (let i=0;i<W.length;i++) modalSum += W[i]*I_theta[i][j];
    lambda[j+1] = (2*dtheta/Math.PI)*modalSum;
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

function calcGamma({lambda, B, Uref, c, theta, dtheta, I_sin_theta}){
  const m = theta.length;
  const n = lambda.length - 1;

  const A0 = -2*(lambda[0] + (B[0] || 0));
  const An = new Float64Array(n);
  for (let j=0;j<n;j++){
    An[j] = 2*(lambda[j+1] + (B[j + 1] || 0));
  }

  // gamma*sin(theta) is finite at the leading edge and is the natural integration variable.
  const gammaSin = new Float64Array(m);
  for (let i=0;i<m;i++){
    let modal = 0;
    const row = I_sin_theta[i];
    for (let j=0;j<n;j++) modal += An[j]*row[j];
    gammaSin[i] = Uref*A0*(1 + Math.cos(theta[i])) + Uref*modal;
  }

  // Point-vortex weights for the bound-sheet induction integral.
  const w = new Float64Array(m);
  for (let i=0;i<m;i++){
    w[i] = 0.5*c*gammaSin[i]*dtheta;
  }

  const gamma = new Float64Array(m);
  for (let i=0;i<m;i++){
    const s = Math.sin(theta[i]);
    gamma[i] = gammaSin[i]/s;
  }

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

  // Wake-wake roll-up. Negative bandwidth means the full DVM interaction.
  const wakeVindRe = new Float64Array(nWake);
  const wakeVindIm = new Float64Array(nWake);
  if (wakeWakeNeighbors !== 0){
    const bw = wakeWakeNeighbors < 0
      ? nWake
      : Math.min(wakeWakeNeighbors|0, nWake);
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
