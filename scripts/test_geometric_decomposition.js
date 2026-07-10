'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

require(path.join(__dirname, '..', 'assets', 'js', 'geometric-decomposition-tool.js'));

const api = globalThis.UNSAEROFdmb;

function runNaca(code) {
  return api.runExtraction(api.generateNaca4(code, 181), { stations: 60 });
}

function close(actual, expected, tolerance, label) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected} ± ${tolerance}, received ${actual}`);
}

function interpolateRows(rows, x, key) {
  if (x <= rows[0].x) return rows[0][key];
  if (x >= rows.at(-1).x) return rows.at(-1)[key];
  let lo = 0;
  let hi = rows.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (rows[mid].x < x) lo = mid;
    else hi = mid;
  }
  const a = rows[lo];
  const b = rows[hi];
  const t = (x - a.x) / (b.x - a.x);
  return a[key] + t * (b[key] - a[key]);
}

const symmetric = runNaca('0012');
assert.ok(symmetric.summary.converged, 'NACA 0012 decomposition must converge.');
assert.equal(symmetric.reconstruction.count, 401, 'The reconstructed surface must default to 401 nodes.');
assert.ok(symmetric.reconstruction.rows[1].x < 1e-4, 'Cosine spacing must strongly cluster reconstruction nodes at the leading edge.');
assert.ok(symmetric.reconstruction.maxError < 1e-8, 'Dense NACA 0012 reconstruction must match the spline surface.');
assert.ok(Math.abs(symmetric.summary.maxCamber) < 1e-6, 'NACA 0012 must remain symmetric.');
close(symmetric.summary.maxThickness, 0.12, 0.002, 'NACA 0012 maximum thickness');
close(symmetric.summary.xmaxThickness, 0.30, 0.025, 'NACA 0012 maximum-thickness position');
close(symmetric.summary.leadingEdgeRadius, 1.1019 * 0.12 ** 2, 0.002, 'NACA 0012 leading-edge radius');
assert.ok(symmetric.summary.nonlinearResidual < 1e-8, 'NACA 0012 nonlinear residual must be below 1e-8.');
close(symmetric.summary.maxThickness, 2 * Math.max(...symmetric.rows.map(row => row.thickness)), 2e-4, 'summary full-thickness convention');
assert.match(api.toCsv(symmetric), /x_c;z_c_linear;dz_c_linear_dx;z_t_linear_vertical;dz_t_linear_dx;z_c_initial_cubic;z_c_nonlinear;dz_c_nonlinear_dx;z_t_nonlinear_normal;dz_t_nonlinear_dx;x_upper;z_upper;x_lower;z_lower/, 'CSV must export distributions, derivatives, the cubic initial guess, and nonlinear surface intersections.');
assert.match(api.toCsv(symmetric), /alpha_deg;alpha_rad;c_l_linear;c_m_c4_linear;c_l_nonlinear;c_m_c4_nonlinear;c_l_exact;c_m_c4_exact/, 'CSV must export the Eq. 51-54 aerodynamic polar curves.');
assert.match(api.toCsv(symmetric), /cl_max_inviscid_linear=.*alpha_cl_max_linear_deg=.*cl_max_inviscid_nonlinear=.*alpha_cl_max_nonlinear_deg=/s, 'CSV metadata must export maximum inviscid lift and its angle of attack.');
assert.equal(symmetric.coefficients.eta.linear.length, 9, 'Default camber order must provide eta_0 through eta_8.');
assert.equal(symmetric.coefficients.beta.nonlinear.length, 5, 'Default thickness order must provide beta_0 through beta_4.');
assert.ok(symmetric.coefficients.eta.nonlinear.every(value => Math.abs(value) < 1e-7), 'Symmetric-airfoil nonlinear eta coefficients must vanish.');
assert.ok(symmetric.rows.every(row => Number.isFinite(row.linearCamberSlope) && Number.isFinite(row.slope) && Number.isFinite(row.linearThicknessSlope) && Number.isFinite(row.thicknessSlope)), 'All exported distribution derivatives must be finite.');
const customOrders = api.runExtraction(api.generateNaca4('0012', 121), { stations: 50, etaOrder: 4, betaOrder: 7 });
assert.equal(customOrders.coefficients.eta.nonlinear.length, 5, 'Camber-order control must set eta_0 through eta_n.');
assert.equal(customOrders.coefficients.beta.nonlinear.length, 8, 'Thickness-order control must set beta_0 through beta_n.');

const rawSymmetric = api.generateNaca4('0012', 81).trim().split(/\n/).map(line => {
  const [x, y] = line.split(/\s+/).map(Number);
  return { x, y };
});
const preparedSymmetric = api.normalizeAndOrderContour(rawSymmetric);
const interpolationSpline = api.buildParametricSpline(preparedSymmetric.points);
const interpolationError = Math.max(...preparedSymmetric.points.map((point, i) => {
  const fitted = interpolationSpline.evaluate(interpolationSpline.parameters[i]).point;
  return Math.hypot(fitted.x - point.x, fitted.y - point.y);
}));
assert.ok(interpolationError < 1e-12, 'The parametric cubic spline must interpolate all surface nodes.');

const cambered = runNaca('2412');
assert.ok(cambered.summary.converged, 'NACA 2412 decomposition must converge.');
assert.ok(cambered.reconstruction.maxError < 1e-8, 'Dense NACA 2412 reconstruction must match the spline surface.');
assert.ok(cambered.summary.maxCamber > 0.0185 && cambered.summary.maxCamber < 0.0205, 'NACA 2412 camber must remain near 2% chord.');
assert.ok(cambered.summary.xmaxCamber > 0.36 && cambered.summary.xmaxCamber < 0.46, 'NACA 2412 camber peak must remain near 40% chord.');
close(cambered.summary.maxThickness, 0.12, 0.002, 'NACA 2412 maximum thickness');
assert.ok(cambered.summary.nonlinearResidual < 1e-8, 'NACA 2412 nonlinear residual must be below 1e-8.');
cambered.rows.forEach((row, i) => {
  const linear = cambered.linearRows[i];
  close(row.linearCamber, 0.5 * (linear.upper.point.y + linear.lower.point.y), 1e-14, `raw linear camber definition at station ${i}`);
  close(row.linearThickness, 0.5 * (linear.upper.point.y - linear.lower.point.y), 1e-14, `raw linear thickness definition at station ${i}`);
});
assert.ok(cambered.rows[0].linearCamber > 1e-3, 'Raw linear NACA 2412 camber must not be constrained to z_c(0)=0.');
assert.ok(Math.abs(cambered.rows.at(-1).linearCamber) > 5e-5, 'Raw linear NACA 2412 camber must not be constrained to z_c(1)=0.');
assert.equal(cambered.rows[0].ycamber, 0, 'Nonlinear FDM-B camber must be zero at the leading edge.');
assert.equal(cambered.rows.at(-1).ycamber, 0, 'Nonlinear FDM-B camber must be zero at the trailing edge.');
const [initialA, initialB] = cambered.summary.initialCubicCoefficients;
assert.ok(cambered.rows.every(row => Math.abs(row.initialCamber - row.x * (1 - row.x) * (initialA + initialB * row.x)) < 1e-12), 'The initial camber must follow one constrained cubic polynomial.');
assert.equal(cambered.rows[0].initialCamber, 0, 'Initial camber must be zero at the leading edge.');
assert.equal(cambered.rows.at(-1).initialCamber, 0, 'Initial camber must be zero at the trailing edge.');

const points = api.generateNaca4('0012', 181).trim().split(/\n/).map(line => line.split(/\s+/).map(Number));
const angle = 23 * Math.PI / 180;
const transformed = points.map(([x, y]) => [
  2.4 + x * Math.cos(angle) - y * Math.sin(angle),
  -0.7 + x * Math.sin(angle) + y * Math.cos(angle)
]);
const transformedText = transformed.reverse().map(point => point.join(' ')).join('\n');
const invariant = api.runExtraction(transformedText, { stations: 60 });
close(invariant.summary.maxCamber, symmetric.summary.maxCamber, 2e-6, 'rotation/order-invariant camber');
close(invariant.summary.maxThickness, symmetric.summary.maxThickness, 2e-6, 'rotation/order-invariant thickness');

const toolHtml = fs.readFileSync(path.join(__dirname, '..', 'source', 'geometric_decomposition_tool.html'), 'utf8');
const toolJs = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'geometric-decomposition-tool.js'), 'utf8');
assert.ok(!toolHtml.includes('Reload selected') && !toolHtml.includes('Recarregar selecionado') && !toolHtml.includes('sample-btn'), 'The obsolete reload-selected button must not be present.');
assert.ok(!toolHtml.includes('Choose a preset or paste') && !toolHtml.includes('Escolha um aerofólio ou cole'), 'The input helper sentence must be removed in both languages.');
assert.ok(toolHtml.includes('.preset-row{grid-template-columns:minmax(220px,.45fr) minmax(0,1fr);align-items:start;}'), 'The preset/NACA input row must align controls to the top.');
assert.ok(toolHtml.includes('<option value="NACA4" selected>NACA 4-digit</option>') && toolHtml.includes('<option value="NACA4" selected>NACA de 4 dígitos</option>'), 'The NACA 4-digit preset option must be selected by default in both languages.');
assert.ok(toolHtml.includes('id="naca-surface-nodes-input" type="number" value="40"') && toolHtml.includes('id="naca-surface-nodes-input-pt" type="number" value="40"'), 'The NACA surface-node input must default to 40 in both languages.');
assert.ok(toolHtml.includes('id="samples-input" type="number" min="30" max="80" step="1" value="60"') && toolHtml.includes('id="samples-input-pt" type="number" min="30" max="80" step="1" value="60"'), 'Camber-station input must default to 60 in both languages.');
assert.ok(toolHtml.includes('id="eta-order-input" type="number" min="1" max="20" step="1" value="8"') && toolHtml.includes('id="eta-order-input-pt" type="number" min="1" max="20" step="1" value="8"'), 'Camber-order input must default to n=8 in both languages.');
assert.ok(toolHtml.includes('id="zero-te-thickness-input" type="checkbox"/>') && toolHtml.includes('id="zero-te-thickness-input-pt" type="checkbox"/>'), 'Zero-TE thickness enforcement must be off by default in both languages.');
assert.ok(toolHtml.includes('id="plot-geom-le"') && toolHtml.includes('id="plot-geom-te"') && toolHtml.includes('id="plot-geom-le-pt"') && toolHtml.includes('id="plot-geom-te-pt"'), 'Airfoil-surface LE/TE detail plots must exist in both languages.');
assert.ok((toolHtml.match(/exact-key" hidden/g) || []).length >= 4, 'Thickness and camber toggle legends must include hidden Exact keys in both languages.');
assert.ok(toolHtml.includes('id="toggle-chord"') && toolHtml.includes('id="toggle-chord-pt"') && toolHtml.includes('id="toggle-reconstruction-chord"') && toolHtml.includes('id="toggle-reconstruction-chord-pt"'), 'Airfoil-surface and nonlinear-reconstruction plots must expose chord toggles in both languages.');
assert.ok(toolHtml.includes('id="toggle-camber-exact"') && toolHtml.includes('id="toggle-camber-linear"') && toolHtml.includes('id="toggle-camber-nonlinear"') && toolHtml.includes('id="toggle-thickness-exact"') && toolHtml.includes('id="toggle-thickness-linear"') && toolHtml.includes('id="toggle-thickness-nonlinear"'), 'Camber and thickness analysis legends must be checkbox plot toggles.');
assert.ok(toolHtml.includes('id="plot-aero-cl"') && toolHtml.includes('id="plot-aero-cm"') && toolHtml.includes('id="plot-aero-cl-pt"') && toolHtml.includes('id="plot-aero-cm-pt"'), 'Aerodynamic quantities must include Cl-alpha and Cm-alpha plots in both languages.');
assert.ok(toolHtml.includes('id="toggle-aero-exact"') && toolHtml.includes('id="toggle-aero-linear"') && toolHtml.includes('id="toggle-aero-nonlinear"') && toolHtml.includes('id="toggle-aero-exact-pt"') && toolHtml.includes('id="toggle-aero-linear-pt"') && toolHtml.includes('id="toggle-aero-nonlinear-pt"'), 'Aerodynamic polar legends must expose Exact/Linear/Nonlinear checkbox toggles in both languages.');
assert.ok(toolHtml.indexOf('id="plot-aero-cl"') < toolHtml.indexOf('id="aero-quantities"') && toolHtml.indexOf('id="plot-aero-cl-pt"') < toolHtml.indexOf('id="aero-quantities-pt"'), 'Aerodynamic polar plots must appear before the quantity table in both languages.');
assert.ok(toolHtml.includes('plot-layer-toggles{justify-content:center') && toolHtml.includes('border-top:1.5px dashed #1874cd') && toolHtml.includes('repeating-linear-gradient(to right,#d946ef') && toolHtml.includes('border-top:1.4px solid #000000'), 'The analysis toggle legends must be centered and use thin black Exact, thin dashed DodgerBlue3 Linear, and thick dot-dashed magenta Nonlinear keys.');
assert.ok(toolJs.includes("const LINEAR_COLOR = '#1874cd'") && toolJs.includes("const NONLINEAR_COLOR = '#d946ef'") && toolJs.includes("const EXACT_COLOR = '#000000'") && toolJs.includes("const CHORD_COLOR = '#0f766e'") && toolJs.includes("width: 1.25, dash: '7 5'") && toolJs.includes("width: 2.45, dash: '9 4 1.5 4'") && toolJs.includes('denseExactXValues(count = 1001)'), 'Exact NACA plots must use dense analytical curves with the requested analysis colors and line styles.');
assert.ok(!toolHtml.includes('Surface reconstruction from discrete coordinates') && !toolHtml.includes('Reconstrução da superfície a partir das coordenadas discretas'), 'The nonlinear-reconstruction explanatory caption must be removed in both languages.');
assert.ok(toolHtml.indexOf('id="summary-cards"') < toolHtml.indexOf('aria-label="Reconstruction layers"') && toolHtml.indexOf('aria-label="Reconstruction layers"') < toolHtml.indexOf('id="plot-reconstruction"'), 'English nonlinear-reconstruction cards, legend, and plot must appear in the requested order.');
assert.ok(toolHtml.includes('.reconstruction-panel .results-list{grid-template-columns:repeat(2') && toolHtml.includes('.reconstruction-actions{margin-top:.95rem;justify-content:center;}'), 'Nonlinear-reconstruction summary cards must fill the row and the download action must be centered.');
assert.ok(toolJs.includes('showZeroReference !== false') && toolJs.includes("height: 350, showZeroReference: false") && toolJs.includes("squarePlotFitWidth: true, showZeroReference: false"), 'Surface and reconstruction plots must let the chord replace the native z=0 reference line.');
assert.ok(toolJs.includes('function localQuadraticSlopes') && toolJs.includes('const displaySlopes = localQuadraticSlopes') && toolJs.includes('const normalSlopes = finiteDifferenceSlopes'), 'Displayed numerical camber derivatives must use smoothed local slopes without changing the FDM-B normal-intersection slopes.');
assert.ok(toolJs.includes('function airfoilPlotLabel') && toolJs.includes('plotLabel: airfoilPlotLabel()'), 'Main surface and reconstruction plots must label the selected airfoil.');
assert.ok(toolJs.indexOf('if (exactData && toggleChecked(toggles.exact)) series.push(exactSeries(exactData));') < toolJs.indexOf('if (toggleChecked(toggles.linear)) series.push(linearSeries(linearData));'), 'Exact analysis curves must be inserted before Linear curves.');
assert.ok(toolJs.includes("xMin: 0, xMax: 0.1") && toolJs.includes("xMin: 0.9, xMax: 1") && toolJs.includes("detailOptions(0, 0.1") && toolJs.includes("detailOptions(0.9, 1"), 'All LE/TE detail plots must use [0, 0.1] and [0.9, 1.0] x-axis windows.');
assert.ok(toolHtml.indexOf('<h2>Camber analysis</h2>') < toolHtml.indexOf('<h2>Thickness analysis</h2>'), 'The English analysis blocks must show Camber before Thickness.');
assert.ok(toolHtml.indexOf('<h2>Análise de cambagem</h2>') < toolHtml.indexOf('<h2>Análise de espessura</h2>'), 'The Portuguese analysis blocks must show Camber before Thickness.');
assert.ok(toolJs.includes('function ticksForRange') && toolJs.includes("stroke: '#94a3b8'") && toolJs.includes("'stroke-dasharray': '5 5'") && !toolJs.includes("const grid = make('g'"), 'Plots must use clean tick marks and a zero marker instead of major grids.');
assert.ok((toolHtml.match(/class="summary-quantity-grid"/g) || []).length >= 2, 'Summary geometric and aerodynamic quantity cards must be stacked in both languages.');
assert.ok(toolJs.includes('function aerodynamicCoefficientsAtAlpha') && toolJs.includes('Math.PI * Math.sin(2 * alpha)') && toolJs.includes('0.5 * Math.PI * cosAlpha2') && toolJs.includes('Math.atan(eta0 - eta1)'), 'Aerodynamic quantities and plots must follow the model equations 51-54.');
assert.ok(toolJs.includes('aerodynamic_model_equations=51-54') && toolJs.includes('aerodynamic_lift_definition=C_l=C_n*cos(alpha)') && toolJs.includes('normalForce * cosAlpha'), 'Downloaded data and plots must use Cl = Cn cos(alpha).');
assert.ok(toolJs.includes('aerodynamic_polar_alpha_range_deg=-10,50') && toolJs.includes('function aerodynamicAlphaGrid(minDegrees = -10, maxDegrees = 50') && toolJs.includes("xMin: -10, xMax: 50, xlabel: 'α (deg)'"), 'Downloaded data and plots must use the requested -10 to 50 degree alpha range.');
assert.ok(toolJs.includes('includeZeroY') && toolJs.includes('zeroPad') && toolJs.includes('svgAeroLift') && toolJs.includes('svgAeroMoment'), 'Aerodynamic plots must force a visible y=0 horizontal reference line.');
assert.ok(toolJs.includes('analysisToggles.aerodynamic') && toolJs.includes("'toggle-aero-exact'") && toolJs.includes("'toggle-aero-nonlinear'"), 'Aerodynamic polar checkbox state must be wired into rendering and language sync.');
assert.ok(toolJs.includes('function aerodynamicMaximumLift') && toolJs.includes('Maximum inviscid lift, C<sub>l,max</sub>') && toolJs.includes('Sustentação invíscida máxima, C<sub>l,max</sub>'), 'Aerodynamic table must include maximum inviscid lift and its angle of attack.');
const nacaGenerated40 = api.generateNaca4SurfaceNodes('2412', 40).trim().split(/\n/);
assert.equal(nacaGenerated40.length, 40, 'NACA UI generation must emit the requested total number of surface nodes.');
const nacaGeneratedSample = api.runExtraction(`# NACA 2412 generated preset\n# surface_nodes=40\nNACA 2412\n${nacaGenerated40.join('\n')}`, { stations: 60, etaOrder: 8, betaOrder: 4 });
assert.equal(nacaGeneratedSample.summary.inputPoints, 40, 'The generated NACA 2412 sample must feed 40 surface nodes into the initial cubic interpolation.');
const nacaExact = api.naca4ExactAnalysis('2412', nacaGeneratedSample.rows.map(row => row.x), { etaOrder: 8, betaOrder: 4 });
close(nacaExact.summary.geometric.maxCamber, 0.02, 1e-12, 'NACA 2412 exact maximum camber');
close(nacaExact.summary.geometric.xmaxCamber, 0.4, 1e-12, 'NACA 2412 exact maximum-camber position');
close(nacaExact.summary.geometric.maxThickness, 0.12, 2e-4, 'NACA 2412 exact maximum thickness');
close(nacaGeneratedSample.summary.maxCamber, nacaExact.summary.geometric.maxCamber, 1e-4, 'FDM-B NACA 2412 maximum camber against closed-form exact');
close(nacaGeneratedSample.summary.xmaxCamber, nacaExact.summary.geometric.xmaxCamber, 0.01, 'FDM-B NACA 2412 maximum-camber station against closed-form exact');
close(nacaGeneratedSample.rows[0].slope, 0.1, 0.002, 'FDM-B NACA 2412 leading-edge camber slope against closed-form exact');
close(nacaGeneratedSample.rows.at(-1).slope, -0.06666666666666667, 0.002, 'FDM-B NACA 2412 trailing-edge camber slope against closed-form exact');
close(nacaExact.rows[0].x, 0, 1e-15, 'NACA 2412 exact camber must start at the leading edge.');
close(nacaExact.rows[0].camber, 0, 1e-15, 'NACA 2412 exact z_c(0) must be zero.');
close(nacaExact.rows.at(-1).x, 1, 1e-15, 'NACA 2412 exact camber must end at the trailing edge.');
close(nacaExact.rows.at(-1).camber, 0, 1e-15, 'NACA 2412 exact z_c(1) must be zero.');
assert.equal(nacaExact.coefficients.eta.length, 9, 'NACA exact camber coefficients must follow the requested eta order.');
assert.equal(nacaExact.coefficients.beta.length, 5, 'NACA exact thickness coefficients must follow the requested beta order.');
close(nacaExact.coefficients.eta[0], 0.004492886379393434, 1e-14, 'NACA 2412 exact eta_0 from closed-form equation');
close(nacaExact.coefficients.eta[1], 0.040747570800428165, 1e-14, 'NACA 2412 exact eta_1 from closed-form equation');
close(nacaExact.coefficients.eta[2], 0.006930638233188229, 1e-14, 'NACA 2412 exact eta_2 from closed-form equation');
close(nacaExact.coefficients.beta[0], 0.17814, 1e-14, 'NACA 2412 exact beta_0 from thickness equation');
close(nacaExact.coefficients.beta[4], -0.0609, 1e-14, 'NACA 2412 exact beta_4 from open-TE thickness equation');
assert.ok(Number.isFinite(nacaExact.summary.aerodynamic.zeroLiftAngleDegrees), 'NACA exact zero-lift angle must be finite.');
assert.ok(Number.isFinite(nacaExact.summary.aerodynamic.quarterChordMoment), 'NACA exact quarter-chord moment must be finite.');
close(nacaExact.summary.aerodynamic.zeroLiftAngle, Math.atan(nacaExact.coefficients.eta[0] - nacaExact.coefficients.eta[1]), 1e-14, 'NACA exact zero-lift angle must use equation 53.');
const naca0012Exact = api.naca4ExactAnalysis('0012', [0, 0.5, 1], { etaOrder: 8, betaOrder: 4 });
close(naca0012Exact.summary.aerodynamic.maximumLift, 4 * Math.PI / (3 * Math.sqrt(3)), 1e-10, 'Symmetric-airfoil inviscid maximum lift must follow Cl = 2π sin(alpha) cos²(alpha).');
close(naca0012Exact.summary.aerodynamic.maximumLiftAlphaDegrees, Math.atan(1 / Math.sqrt(2)) * 180 / Math.PI, 1e-6, 'Symmetric-airfoil maximum-lift angle must match the theoretical inviscid optimum.');
nacaGeneratedSample.summary.exact = nacaExact.summary;
const polarCsvRows = api.toCsv(nacaGeneratedSample).split(/\r?\n/).slice(-241);
const firstPolar = polarCsvRows[0].split(';').map(Number);
const lastPolar = polarCsvRows.at(-1).split(';').map(Number);
close(firstPolar[0], -10, 1e-12, 'Downloaded aerodynamic polar must begin at -10 degrees.');
close(lastPolar[0], 50, 1e-12, 'Downloaded aerodynamic polar must end at 50 degrees.');
const alphaFirst = firstPolar[1];
const cnFirst = Math.PI * Math.sin(2 * alphaFirst) + 2 * Math.PI * (nacaExact.summary.aerodynamic.eta1MinusEta0) * Math.cos(alphaFirst) ** 2;
close(firstPolar[6], cnFirst * Math.cos(alphaFirst), 1e-11, 'Downloaded exact lift polar must use Cl = Cn cos(alpha).');
assert.match(api.toCsv(nacaGeneratedSample), /cl_max_inviscid_exact=.*alpha_cl_max_exact_deg=/s, 'CSV metadata must export exact maximum inviscid lift when exact NACA values are available.');
const denseExactGrid = Array.from({ length: 1001 }, (_, index) => index / 1000);
const nacaExactDense = api.naca4ExactAnalysis('2412', denseExactGrid, { etaOrder: 6, betaOrder: 4 });
close(nacaExactDense.rows[0].camber, 0, 1e-15, 'Dense exact plot data must keep z_c(0)=0.');
close(nacaExactDense.rows.at(-1).camber, 0, 1e-15, 'Dense exact plot data must keep z_c(1)=0.');
const nacaCamberErrors = nacaGeneratedSample.rows.map(row => row.ycamber - interpolateRows(nacaExactDense.rows, row.x, 'camber'));
assert.ok(Math.max(...nacaCamberErrors.map(Math.abs)) < 1e-4, 'FDM-B NACA 2412 camber curve must closely track the closed-form exact curve.');
assert.equal(nacaExactDense.coefficients.eta.length, 7, 'NACA exact eta coefficients must be available for the requested eta order.');
assert.equal(nacaExactDense.coefficients.beta.length, 5, 'NACA exact beta coefficients must be available for the UI table.');
assert.ok(!toolJs.includes('prepared?.transformPoint'), 'The UI Exact NACA plot must use native closed-form coordinates, not the fitted-spline transform.');
assert.ok(toolHtml.includes('v=20260710-aero-clmax'), 'The page must load the aerodynamic maximum-lift script version.');
const defaultSample = api.runExtraction(`# NACA 2412 generated preset\n# surface_nodes=40\nNACA 2412\n${nacaGenerated40.join('\n')}`, { stations: 60, etaOrder: 8, betaOrder: 4, reconstructionNodes: 401 });
assert.equal(defaultSample.summary.inputPoints, 40, 'The default generated NACA 2412 sample must use 40 surface nodes.');
assert.equal(defaultSample.reconstruction.count, 401, 'The default page sample must complete dense reconstruction.');
assert.equal(defaultSample.reconstruction.warning, undefined, 'The default page sample must not fall back to the coarse solver reconstruction.');
assert.ok(defaultSample.reconstruction.fallbackCount < 25, 'Only a limited number of singular edge/detail nodes may use vertical pairing.');
assert.ok(defaultSample.reconstruction.rows.every(row => Number.isFinite(row.reconstructedUpper.x) && Number.isFinite(row.reconstructedLower.y)), 'The default page sample must produce finite reconstructed surfaces.');

console.log('Cubic-spline decomposition validation passed: NACA cases, transformed coordinates, and the default generated NACA 2412 page sample.');
