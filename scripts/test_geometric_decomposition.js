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
assert.equal(symmetric.coefficients.eta.linear.length, 7, 'Default camber order must provide eta_0 through eta_6.');
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
const roughness = values => values.slice(1, -1).reduce((sum, _, i) => sum + (values[i] - 2 * values[i + 1] + values[i + 2]) ** 2, 0);
assert.ok(
  roughness(cambered.initialCamber) < roughness(cambered.rows.map(row => row.linearCamber)),
  'The constrained cubic initial camber must be smoother than the vertical linear extraction.'
);
const [initialA, initialB] = cambered.summary.initialCubicCoefficients;
assert.ok(cambered.rows.every(row => Math.abs(row.initialCamber - row.x * (1 - row.x) * (initialA + initialB * row.x)) < 1e-12), 'The initial camber must follow one constrained cubic polynomial.');
assert.equal(cambered.rows[0].initialCamber, 0, 'Initial camber must be zero at the leading edge.');
assert.equal(cambered.rows.at(-1).initialCamber, 0, 'Initial camber must be zero at the trailing edge.');

const points = api.generateNaca4('2412', 181).trim().split(/\n/).map(line => line.split(/\s+/).map(Number));
const angle = 23 * Math.PI / 180;
const transformed = points.map(([x, y]) => [
  2.4 + x * Math.cos(angle) - y * Math.sin(angle),
  -0.7 + x * Math.sin(angle) + y * Math.cos(angle)
]);
const transformedText = transformed.reverse().map(point => point.join(' ')).join('\n');
const invariant = api.runExtraction(transformedText, { stations: 60 });
close(invariant.summary.maxCamber, cambered.summary.maxCamber, 2e-6, 'rotation/order-invariant camber');
close(invariant.summary.maxThickness, cambered.summary.maxThickness, 2e-6, 'rotation/order-invariant thickness');

const toolHtml = fs.readFileSync(path.join(__dirname, '..', 'source', 'geometric_decomposition_tool.html'), 'utf8');
const sampleMarker = 'const S1223_SAMPLE_DATA = `';
const sampleStart = toolHtml.indexOf(sampleMarker) + sampleMarker.length;
const sampleEnd = toolHtml.indexOf('`;', sampleStart);
assert.ok(sampleStart >= sampleMarker.length && sampleEnd > sampleStart, 'The default Selig S1223 data must be embedded in the tool page.');
const defaultSample = api.runExtraction(toolHtml.slice(sampleStart, sampleEnd), { stations: 60, reconstructionNodes: 401 });
assert.equal(defaultSample.reconstruction.count, 401, 'The default page sample must complete dense reconstruction.');
assert.equal(defaultSample.reconstruction.warning, undefined, 'The default page sample must not fall back to the coarse solver reconstruction.');
assert.ok(defaultSample.reconstruction.fallbackCount < 25, 'Only a limited number of singular edge/detail nodes may use vertical pairing.');
assert.ok(defaultSample.reconstruction.rows.every(row => Number.isFinite(row.reconstructedUpper.x) && Number.isFinite(row.reconstructedLower.y)), 'The default page sample must produce finite reconstructed surfaces.');

console.log('Cubic-spline decomposition validation passed: NACA cases, transformed coordinates, and the default Selig S1223 page sample.');
