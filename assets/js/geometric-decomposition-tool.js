(function (global) {
  'use strict';

  const EPS = 1e-12;
  const RED2_COLOR = '#ef4444';
  const LINEAR_COLOR = '#1874cd';
  const NONLINEAR_COLOR = '#d946ef';
  const EXACT_COLOR = '#000000';
  const CHORD_COLOR = '#0f766e';
  const NACA4_OPEN_TE_THICKNESS_PEAK_X = 0.2998278780701443;

  function optionEnabled(value) {
    return value === true || value === 'true' || value === '1' || value === 'on';
  }

  function parseCoordinateText(text) {
    const points = [];
    for (const raw of String(text || '').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const tokens = line.split(/[\s,;]+/).filter(Boolean);
      if (tokens.length < 2) continue;
      const x = Number(tokens[0]);
      const y = Number(tokens[1]);
      if (Number.isFinite(x) && Number.isFinite(y)) points.push({ x, y });
    }
    if (points.length < 8) throw new Error('At least eight valid contour points are required.');
    return points;
  }

  function removeConsecutiveDuplicates(points) {
    const out = [];
    for (const point of points) {
      if (!out.length || Math.hypot(point.x - out[out.length - 1].x, point.y - out[out.length - 1].y) > 1e-11) {
        out.push({ x: point.x, y: point.y });
      }
    }
    if (out.length > 3 && Math.hypot(out[0].x - out[out.length - 1].x, out[0].y - out[out.length - 1].y) < 1e-11) out.pop();
    return out;
  }

  function principalDirection(points) {
    const mean = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    mean.x /= points.length;
    mean.y /= points.length;
    let cxx = 0, cxy = 0, cyy = 0;
    for (const p of points) {
      const x = p.x - mean.x;
      const y = p.y - mean.y;
      cxx += x * x;
      cxy += x * y;
      cyy += y * y;
    }
    const angle = 0.5 * Math.atan2(2 * cxy, cxx - cyy);
    return { x: Math.cos(angle), y: Math.sin(angle) };
  }

  function spread(values) {
    if (!values.length) return Infinity;
    return Math.max(...values) - Math.min(...values);
  }

  function chordCoordinateNormalization(points) {
    const xs = points.map(point => point.x);
    const ys = points.map(point => point.y);
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const yMin = Math.min(...ys);
    const yMax = Math.max(...ys);
    const xSpan = xMax - xMin;
    const ySpan = yMax - yMin;
    if (!(xSpan > EPS) || !(ySpan < 0.7 * xSpan)) return null;
    if (xMin < -0.08 * xSpan || xMin > 0.12 * xSpan) return null;
    if (xMax < 0.75 * xSpan || xMax > 1.35 * xSpan) return null;
    const hasDeclaredLeadingEdge = points.some(point => Math.abs(point.x) <= Math.max(2e-5, 0.0015 * xSpan));
    const chordStartX = hasDeclaredLeadingEdge ? 0 : xMin;
    const chordEndX = Math.abs(xMax - 1) <= 0.08 * Math.max(1, xSpan) ? 1 : xMax;
    const chordLength = chordEndX - chordStartX;
    if (!(chordLength > EPS)) return null;
    const edgeBand = Math.max(2e-5, 0.004 * xSpan);
    const minLeDistance = Math.min(...points.map(point => Math.abs(point.x - chordStartX)));
    const declaredLeBand = minLeDistance + Math.max(1e-8, 1e-7 * xSpan);
    const declaredLeCandidates = hasDeclaredLeadingEdge ? points.filter(point => Math.abs(point.x - chordStartX) <= declaredLeBand) : [];
    const leCandidates = declaredLeCandidates.length ? declaredLeCandidates : points.filter(point => Math.abs(point.x - chordStartX) <= edgeBand);
    const teCandidates = points.filter(point => Math.abs(point.x - chordEndX) <= Math.max(edgeBand, 0.004 * chordLength));
    if (!leCandidates.length || !teCandidates.length) return null;
    const leMeanY = leCandidates.reduce((sum, point) => sum + point.y, 0) / leCandidates.length;
    const lePoint = { x: chordStartX, y: leMeanY };
    const teY = teCandidates.reduce((sum, point) => sum + point.y, 0) / teCandidates.length;
    const chordVector = { x: chordEndX - chordStartX, y: teY - lePoint.y };
    const chord = Math.hypot(chordVector.x, chordVector.y);
    if (!(chord > EPS)) return null;
    const ex = { x: chordVector.x / chord, y: chordVector.y / chord };
    const ey = { x: -ex.y, y: ex.x };
    const transformPoint = point => ({
      x: ((point.x - chordStartX) * ex.x + (point.y - lePoint.y) * ex.y) / chord,
      y: ((point.x - chordStartX) * ey.x + (point.y - lePoint.y) * ey.y) / chord
    });
    let normalized = points.map(transformPoint);
    const firstAtTe = normalized[0].x > 0.82 && normalized[normalized.length - 1].x > 0.82;
    if (!firstAtTe) {
      let start = 0;
      for (let i = 1; i < normalized.length; i++) if (normalized[i].x > normalized[start].x) start = i;
      normalized = normalized.slice(start).concat(normalized.slice(0, start));
    }
    let leIndex = 0;
    for (let i = 1; i < normalized.length; i++) {
      if (Math.hypot(normalized[i].x, normalized[i].y) < Math.hypot(normalized[leIndex].x, normalized[leIndex].y)) leIndex = i;
    }
    if (leIndex < 2 || leIndex > normalized.length - 3) return null;
    const meanFirst = normalized.slice(0, leIndex).reduce((sum, point) => sum + point.y, 0) / leIndex;
    const meanSecond = normalized.slice(leIndex + 1).reduce((sum, point) => sum + point.y, 0) / (normalized.length - leIndex - 1);
    if (meanFirst < meanSecond) {
      normalized.reverse();
      leIndex = normalized.length - 1 - leIndex;
    }
    return {
      points: normalized,
      leIndex,
      chord,
      origin: { x: chordStartX, y: lePoint.y },
      axes: { ex, ey },
      transformPoint,
      chordCoordinateInput: true
    };
  }

  function normalizeAndOrderContour(rawPoints) {
    // Determine the chord independently of translation/rotation, then order TE-upper → LE → TE-lower.
    const points = removeConsecutiveDuplicates(rawPoints);
    if (points.length < 8) throw new Error('Insufficient unique contour points.');
    const chordAligned = chordCoordinateNormalization(points);
    if (chordAligned) return chordAligned;
    let axis = principalDirection(points);
    const normal = { x: -axis.y, y: axis.x };
    const projected = points.map(p => ({
      u: p.x * axis.x + p.y * axis.y,
      v: p.x * normal.x + p.y * normal.y
    }));
    const uMin = Math.min(...projected.map(p => p.u));
    const uMax = Math.max(...projected.map(p => p.u));
    const span = uMax - uMin;
    if (!(span > EPS)) throw new Error('Chord length is zero.');
    const band = Math.max(0.01 * span, EPS);
    const lowSpread = spread(projected.filter(p => p.u <= uMin + band).map(p => p.v));
    const highSpread = spread(projected.filter(p => p.u >= uMax - band).map(p => p.v));
    const teIsHigh = highSpread <= lowSpread;
    if (!teIsHigh) axis = { x: -axis.x, y: -axis.y };

    const chordProjection = points.map(p => p.x * axis.x + p.y * axis.y);
    const pMin = Math.min(...chordProjection);
    const pMax = Math.max(...chordProjection);
    const chordSpan = pMax - pMin;
    const leIndexRaw = chordProjection.indexOf(pMin);
    const le = points[leIndexRaw];
    const teBand = Math.max(0.003 * chordSpan, EPS);
    const teCandidates = points.filter((p, i) => chordProjection[i] >= pMax - teBand);
    const te = teCandidates.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    te.x /= teCandidates.length;
    te.y /= teCandidates.length;
    const chordVector = { x: te.x - le.x, y: te.y - le.y };
    const chord = Math.hypot(chordVector.x, chordVector.y);
    if (!(chord > EPS)) throw new Error('Could not determine a valid leading-edge to trailing-edge chord.');
    const ex = { x: chordVector.x / chord, y: chordVector.y / chord };
    const ey = { x: -ex.y, y: ex.x };
    const initialTransformPoint = p => ({
      x: ((p.x - le.x) * ex.x + (p.y - le.y) * ex.y) / chord,
      y: ((p.x - le.x) * ey.x + (p.y - le.y) * ey.y) / chord
    });
    let normalized = points.map(initialTransformPoint);

    const firstAtTe = normalized[0].x > 0.82 && normalized[normalized.length - 1].x > 0.82;
    if (!firstAtTe) {
      let start = 0;
      for (let i = 1; i < normalized.length; i++) if (normalized[i].x > normalized[start].x) start = i;
      normalized = normalized.slice(start).concat(normalized.slice(0, start));
    }
    let leIndex = 0;
    for (let i = 1; i < normalized.length; i++) if (normalized[i].x < normalized[leIndex].x) leIndex = i;
    if (leIndex < 2 || leIndex > normalized.length - 3) throw new Error('Could not order the contour from trailing edge to leading edge and back.');
    const meanFirst = normalized.slice(0, leIndex).reduce((s, p) => s + p.y, 0) / leIndex;
    const meanSecond = normalized.slice(leIndex + 1).reduce((s, p) => s + p.y, 0) / (normalized.length - leIndex - 1);
    if (meanFirst < meanSecond) {
      normalized.reverse();
      leIndex = normalized.length - 1 - leIndex;
    }
    return { points: normalized, leIndex, chord, origin: le, axes: { ex, ey }, transformPoint: initialTransformPoint };
  }

  function solveLinearSystem(matrix, vector) {
    const n = vector.length;
    const augmented = matrix.map((row, i) => row.slice().concat(vector[i]));
    for (let column = 0; column < n; column++) {
      let pivot = column;
      for (let row = column + 1; row < n; row++) {
        if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row;
      }
      if (Math.abs(augmented[pivot][column]) < 1e-15) throw new Error('A numerical system became singular.');
      [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];
      const diagonal = augmented[column][column];
      for (let j = column; j <= n; j++) augmented[column][j] /= diagonal;
      for (let row = 0; row < n; row++) {
        if (row === column) continue;
        const factor = augmented[row][column];
        if (factor === 0) continue;
        for (let j = column; j <= n; j++) augmented[row][j] -= factor * augmented[column][j];
      }
    }
    return augmented.map(row => row[n]);
  }

  function leastSquares(rows, values, regularization = 1e-12) {
    const columns = rows[0].length;
    const normal = Array.from({ length: columns }, () => new Array(columns).fill(0));
    const rhs = new Array(columns).fill(0);
    for (let i = 0; i < rows.length; i++) {
      for (let j = 0; j < columns; j++) {
        rhs[j] += rows[i][j] * values[i];
        for (let k = 0; k < columns; k++) normal[j][k] += rows[i][j] * rows[i][k];
      }
    }
    for (let i = 0; i < columns; i++) normal[i][i] += regularization;
    return solveLinearSystem(normal, rhs);
  }

  function chordParameters(points) {
    const parameters = [0];
    for (let i = 1; i < points.length; i++) {
      parameters.push(parameters[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
    }
    const total = parameters[parameters.length - 1];
    if (!(total > EPS)) throw new Error('The contour has zero arc length.');
    return parameters.map(value => value / total);
  }

  class NaturalCubicSpline {
    constructor(parameters, values) {
      this.parameters = parameters;
      this.values = values;
      const n = parameters.length;
      const intervals = new Array(n - 1);
      for (let i = 0; i < n - 1; i++) {
        intervals[i] = parameters[i + 1] - parameters[i];
        if (!(intervals[i] > 0)) throw new Error('Spline parameters must be strictly increasing.');
      }
      this.second = new Array(n).fill(0);
      if (n <= 2) return;
      const size = n - 2;
      const lower = new Array(size).fill(0);
      const diagonal = new Array(size);
      const upper = new Array(size).fill(0);
      const rhs = new Array(size);
      for (let j = 0; j < size; j++) {
        const i = j + 1;
        if (j > 0) lower[j] = intervals[i - 1];
        diagonal[j] = 2 * (intervals[i - 1] + intervals[i]);
        if (j < size - 1) upper[j] = intervals[i];
        rhs[j] = 6 * ((values[i + 1] - values[i]) / intervals[i] - (values[i] - values[i - 1]) / intervals[i - 1]);
      }
      for (let i = 1; i < size; i++) {
        const factor = lower[i] / diagonal[i - 1];
        diagonal[i] -= factor * upper[i - 1];
        rhs[i] -= factor * rhs[i - 1];
      }
      const interior = new Array(size);
      interior[size - 1] = rhs[size - 1] / diagonal[size - 1];
      for (let i = size - 2; i >= 0; i--) interior[i] = (rhs[i] - upper[i] * interior[i + 1]) / diagonal[i];
      for (let i = 0; i < size; i++) this.second[i + 1] = interior[i];
    }

    evaluate(parameter) {
      const p = Math.max(this.parameters[0], Math.min(this.parameters[this.parameters.length - 1], parameter));
      let low = 0;
      let high = this.parameters.length - 2;
      while (low < high) {
        const middle = Math.floor((low + high + 1) / 2);
        if (this.parameters[middle] <= p) low = middle;
        else high = middle - 1;
      }
      const i = Math.min(low, this.parameters.length - 2);
      const h = this.parameters[i + 1] - this.parameters[i];
      const a = (this.parameters[i + 1] - p) / h;
      const b = (p - this.parameters[i]) / h;
      const value = a * this.values[i] + b * this.values[i + 1]
        + ((a ** 3 - a) * this.second[i] + (b ** 3 - b) * this.second[i + 1]) * h * h / 6;
      const derivative = (this.values[i + 1] - this.values[i]) / h
        + h * ((1 - 3 * a * a) * this.second[i] + (3 * b * b - 1) * this.second[i + 1]) / 6;
      const second = a * this.second[i] + b * this.second[i + 1];
      return { value, derivative, second };
    }
  }

  function buildParametricSpline(points) {
    const parameters = chordParameters(points);
    const xSpline = new NaturalCubicSpline(parameters, points.map(point => point.x));
    const ySpline = new NaturalCubicSpline(parameters, points.map(point => point.y));
    return {
      parameters,
      evaluate(parameter) {
        const x = xSpline.evaluate(parameter);
        const y = ySpline.evaluate(parameter);
        return {
          point: { x: x.value, y: y.value },
          derivative: { x: x.derivative, y: y.derivative },
          second: { x: x.second, y: y.second }
        };
      }
    };
  }

  function findLeadingEdge(curve, guess, radius = 0.12) {
    let a = Math.max(0.001, guess - radius);
    let b = Math.min(0.999, guess + radius);
    const ratio = (Math.sqrt(5) - 1) / 2;
    let c = b - ratio * (b - a);
    let d = a + ratio * (b - a);
    for (let i = 0; i < 80; i++) {
      if (curve.evaluate(c).point.x < curve.evaluate(d).point.x) {
        b = d;
        d = c;
        c = b - ratio * (b - a);
      } else {
        a = c;
        c = d;
        d = a + ratio * (b - a);
      }
    }
    return 0.5 * (a + b);
  }

  function normalizeSplineChord(prepared, curve, sLE) {
    const leadingEdge = curve.evaluate(sLE).point;
    const first = curve.evaluate(0).point;
    const last = curve.evaluate(1).point;
    const trailingEdge = { x: 0.5 * (first.x + last.x), y: 0.5 * (first.y + last.y) };
    const dx = trailingEdge.x - leadingEdge.x;
    const dy = trailingEdge.y - leadingEdge.y;
    const chord = Math.hypot(dx, dy);
    if (!(chord > EPS)) throw new Error('The spline surface has an invalid chord.');
    const ex = { x: dx / chord, y: dy / chord };
    const ey = { x: -ex.y, y: ex.x };
    const transformPoint = point => ({
      x: ((point.x - leadingEdge.x) * ex.x + (point.y - leadingEdge.y) * ex.y) / chord,
      y: ((point.x - leadingEdge.x) * ey.x + (point.y - leadingEdge.y) * ey.y) / chord
    });
    const transformVector = vector => ({
      x: (vector.x * ex.x + vector.y * ex.y) / chord,
      y: (vector.x * ey.x + vector.y * ey.y) / chord
    });
    const previousTransformPoint = prepared.transformPoint || (point => point);
    prepared.transformPoint = point => transformPoint(previousTransformPoint(point));
    prepared.points = prepared.points.map(transformPoint);
    const transformed = {
      parameters: curve.parameters,
      evaluate(parameter) {
        const state = curve.evaluate(parameter);
        return {
          point: transformPoint(state.point),
          derivative: transformVector(state.derivative),
          second: transformVector(state.second)
        };
      }
    };
    return { curve: transformed, sLE: findLeadingEdge(transformed, sLE, 0.04) };
  }

  function normalFunction(curve, parameter, x, y, slope) {
    const state = curve.evaluate(parameter);
    return {
      state,
      value: state.point.x - x + slope * (state.point.y - y),
      derivative: state.derivative.x + slope * state.derivative.y
    };
  }

  function intersectNormal(curve, interval, x, y, slope, initial) {
    const [a0, b0] = interval;
    let a = a0;
    let b = b0;
    let fa = normalFunction(curve, a, x, y, slope).value;
    let fb = normalFunction(curve, b, x, y, slope).value;
    if (Math.abs(fa) < 1e-13) return { s: a, ...curve.evaluate(a) };
    if (Math.abs(fb) < 1e-13) return { s: b, ...curve.evaluate(b) };
    if (fa * fb > 0) {
      let previousS = a;
      let previousF = fa;
      let found = false;
      for (let i = 1; i <= 80; i++) {
        const testS = a0 + (b0 - a0) * i / 80;
        const testF = normalFunction(curve, testS, x, y, slope).value;
        if (previousF * testF <= 0) {
          a = previousS;
          fa = previousF;
          b = testS;
          fb = testF;
          found = true;
          break;
        }
        previousS = testS;
        previousF = testF;
      }
      if (!found) throw new Error('A camber-line normal at x/c=' + x.toFixed(5) + ' did not intersect both spline surfaces.');
    }
    let parameter = Number.isFinite(initial) && initial > a && initial < b ? initial : 0.5 * (a + b);
    for (let i = 0; i < 45; i++) {
      const current = normalFunction(curve, parameter, x, y, slope);
      if (Math.abs(current.value) < 2e-13) return { s: parameter, ...current.state };
      if (fa * current.value <= 0) {
        b = parameter;
        fb = current.value;
      } else {
        a = parameter;
        fa = current.value;
      }
      let candidate = parameter - current.value / current.derivative;
      if (!Number.isFinite(candidate) || candidate <= a || candidate >= b) candidate = 0.5 * (a + b);
      if (Math.abs(candidate - parameter) < 2e-13) {
        parameter = candidate;
        break;
      }
      parameter = candidate;
    }
    return { s: parameter, ...curve.evaluate(parameter) };
  }

  function verticalFunction(curve, parameter, x) {
    const state = curve.evaluate(parameter);
    return {
      state,
      value: state.point.x - x,
      derivative: state.derivative.x
    };
  }

  function refineVerticalRoot(curve, x, lower, upper, fLower, fUpper) {
    let a = lower;
    let b = upper;
    let fa = fLower;
    let fb = fUpper;
    let parameter = 0.5 * (a + b);
    for (let i = 0; i < 45; i++) {
      const current = verticalFunction(curve, parameter, x);
      if (Math.abs(current.value) < 2e-13) return { s: parameter, ...current.state };
      if (fa * current.value <= 0) {
        b = parameter;
        fb = current.value;
      } else {
        a = parameter;
        fa = current.value;
      }
      let candidate = parameter - current.value / current.derivative;
      if (!Number.isFinite(candidate) || candidate <= a || candidate >= b) candidate = 0.5 * (a + b);
      if (Math.abs(candidate - parameter) < 2e-13) {
        parameter = candidate;
        break;
      }
      parameter = candidate;
    }
    return { s: parameter, ...curve.evaluate(parameter) };
  }

  function verticalIntersections(curve, interval, x) {
    const [a0, b0] = interval;
    const samples = 1200;
    const roots = [];
    const tolerance = 4e-12;
    const addRoot = root => {
      if (!Number.isFinite(root.s) || root.s < a0 - 1e-10 || root.s > b0 + 1e-10) return;
      if (roots.some(existing => Math.abs(existing.s - root.s) < 2e-7)) return;
      roots.push(root);
    };
    let previousS = a0;
    let previous = verticalFunction(curve, previousS, x);
    if (Math.abs(previous.value) < tolerance) addRoot({ s: previousS, ...previous.state });
    for (let i = 1; i <= samples; i++) {
      const currentS = a0 + (b0 - a0) * i / samples;
      const current = verticalFunction(curve, currentS, x);
      if (Math.abs(current.value) < tolerance) addRoot({ s: currentS, ...current.state });
      if (previous.value * current.value < 0) {
        addRoot(refineVerticalRoot(curve, x, previousS, currentS, previous.value, current.value));
      }
      previousS = currentS;
      previous = current;
    }
    return roots;
  }

  function selectVerticalIntersection(curve, interval, x, selector, fallbackInitial) {
    const roots = verticalIntersections(curve, interval, x);
    if (roots.length) return roots.reduce(selector);
    try {
      return intersectNormal(curve, interval, x, 0, 0, fallbackInitial);
    } catch (error) {
      const endpoints = interval.map(s => ({ s, ...curve.evaluate(s) }));
      return endpoints.reduce((best, candidate) =>
        Math.abs(candidate.point.x - x) < Math.abs(best.point.x - x) ? candidate : best
      );
    }
  }

  function finiteDifferenceSlopes(values, dx) {
    const n = values.length;
    const slopes = new Array(n);
    slopes[0] = (4 * values[1] - values[2] - 3 * values[0]) / (2 * dx);
    for (let i = 1; i < n - 1; i++) slopes[i] = (values[i + 1] - values[i - 1]) / (2 * dx);
    slopes[n - 1] = (3 * values[n - 1] - 4 * values[n - 2] + values[n - 3]) / (2 * dx);
    return slopes;
  }

  function localQuadraticSlopes(values, dx, windowSize = 11) {
    const n = values.length;
    const fallback = finiteDifferenceSlopes(values, dx);
    if (n < 5) return fallback;
    const width = Math.min(n, Math.max(5, Math.floor(windowSize) || 11));
    const slopes = new Array(n);
    for (let i = 0; i < n; i++) {
      const start = Math.max(0, Math.min(i - Math.floor(width / 2), n - width));
      const basis = [];
      const targets = [];
      for (let j = start; j < start + width; j++) {
        const u = (j - i) * dx;
        basis.push([1, u, u * u]);
        targets.push(values[j]);
      }
      const coefficients = leastSquares(basis, targets, 1e-14);
      slopes[i] = Number.isFinite(coefficients[1]) ? coefficients[1] : fallback[i];
    }
    return slopes;
  }

  function extractLinear(curve, sLE, stationCount) {
    const count = Math.max(30, Math.min(Number(stationCount) || 60, 100));
    const rows = [];
    const upperS = new Array(count);
    const lowerS = new Array(count);
    for (let i = 0; i < count; i++) {
      const x = i / (count - 1);
      const upper = selectVerticalIntersection(
        curve,
        [0, sLE],
        x,
        (best, candidate) => candidate.point.y > best.point.y ? candidate : best,
        Math.max(0, Math.min(sLE, 1 - x))
      );
      const lower = selectVerticalIntersection(
        curve,
        [sLE, 1],
        x,
        (best, candidate) => candidate.point.y < best.point.y ? candidate : best,
        Math.max(sLE, Math.min(1, sLE + x * (1 - sLE)))
      );
      upperS[i] = upper.s;
      lowerS[i] = lower.s;
      rows.push({
        x,
        ycamber: 0.5 * (upper.point.y + lower.point.y),
        thickness: 0.5 * (upper.point.y - lower.point.y),
        upper,
        lower
      });
    }
    return { rows, upperS, lowerS };
  }

  function fitCubicCamberGuess(rows) {
    // z_c = x(1-x)(a + b x) is cubic and enforces z_c(0)=z_c(1)=0 exactly.
    const basis = rows.map(row => [row.x * (1 - row.x), row.x * row.x * (1 - row.x)]);
    const coefficients = leastSquares(basis, rows.map(row => row.ycamber), 1e-14);
    const values = rows.map(row => row.x * (1 - row.x) * (coefficients[0] + coefficients[1] * row.x));
    values[0] = 0;
    values[values.length - 1] = 0;
    return { values, coefficients };
  }

  function extractNonlinear(curve, sLE, linear, tolerance = 1e-10, options = {}) {
    const zeroTeThickness = optionEnabled(options.zeroTeThickness);
    const count = linear.rows.length;
    const dx = 1 / (count - 1);
    const x = linear.rows.map(row => row.x);
    const cubicGuess = fitCubicCamberGuess(linear.rows);
    let y = cubicGuess.values.slice();
    const initialCamber = y.slice();
    const upperS = linear.upperS.slice();
    const lowerS = linear.lowerS.slice();
    let converged = false;
    let residual = Infinity;
    let iteration = 0;
    for (; iteration < 100; iteration++) {
      const slope = finiteDifferenceSlopes(y, dx);
      const next = y.slice();
      let norm2 = 0;
      for (let i = 1; i < count - 1; i++) {
        const upper = intersectNormal(curve, [0, sLE], x[i], y[i], slope[i], upperS[i]);
        const lower = intersectNormal(curve, [sLE, 1], x[i], y[i], slope[i], lowerS[i]);
        upperS[i] = upper.s;
        lowerS[i] = lower.s;
        const functionValue = upper.point.y + lower.point.y - 2 * y[i];
        const upperDenominator = upper.derivative.x + slope[i] * upper.derivative.y;
        const lowerDenominator = lower.derivative.x + slope[i] * lower.derivative.y;
        const jacobian = slope[i] * upper.derivative.y / upperDenominator
          + slope[i] * lower.derivative.y / lowerDenominator - 2;
        let update = Math.abs(jacobian) > 1e-10 ? -functionValue / jacobian : 0.5 * functionValue;
        update = Math.max(-0.012, Math.min(0.012, update));
        next[i] = y[i] + 0.75 * update;
        norm2 += functionValue * functionValue;
      }
      residual = Math.sqrt(norm2 / Math.max(1, count - 2));
      y = next;
      if (residual < tolerance) {
        converged = true;
        break;
      }
    }

    const normalSlopes = finiteDifferenceSlopes(y, dx);
    const displaySlopes = localQuadraticSlopes(y, dx);
    const rows = [];
    let finalNorm2 = 0;
    let maxReconstructionError = 0;
    for (let i = 0; i < count; i++) {
      const upper = i === 0 ? { s: sLE, ...curve.evaluate(sLE) }
        : i === count - 1 ? { s: 0, ...curve.evaluate(0) }
          : intersectNormal(curve, [0, sLE], x[i], y[i], normalSlopes[i], upperS[i]);
      const lower = i === 0 ? { s: sLE, ...curve.evaluate(sLE) }
        : i === count - 1 ? { s: 1, ...curve.evaluate(1) }
          : intersectNormal(curve, [sLE, 1], x[i], y[i], normalSlopes[i], lowerS[i]);
      const midpointResidual = upper.point.y + lower.point.y - 2 * y[i];
      if (i > 0 && i < count - 1) finalNorm2 += midpointResidual * midpointResidual;
      let thickness = 0.5 * Math.hypot(upper.point.x - lower.point.x, upper.point.y - lower.point.y);
      const inverseNorm = 1 / Math.sqrt(1 + normalSlopes[i] * normalSlopes[i]);
      const normal = { x: -normalSlopes[i] * inverseNorm, y: inverseNorm };
      let reconstructedUpper = { x: x[i] + thickness * normal.x, y: y[i] + thickness * normal.y };
      let reconstructedLower = { x: x[i] - thickness * normal.x, y: y[i] - thickness * normal.y };
      if (zeroTeThickness && i === count - 1) {
        const trailingEdge = {
          x: 0.5 * (upper.point.x + lower.point.x),
          y: 0.5 * (upper.point.y + lower.point.y)
        };
        thickness = 0;
        reconstructedUpper = { ...trailingEdge };
        reconstructedLower = { ...trailingEdge };
      }
      if (i > 0 && i < count - 1) {
        maxReconstructionError = Math.max(
          maxReconstructionError,
          Math.hypot(reconstructedUpper.x - upper.point.x, reconstructedUpper.y - upper.point.y),
          Math.hypot(reconstructedLower.x - lower.point.x, reconstructedLower.y - lower.point.y)
        );
      }
      rows.push({
        x: x[i],
        ycamber: y[i],
        slope: displaySlopes[i],
        thickness,
        xu: upper.point.x,
        yu: upper.point.y,
        xl: lower.point.x,
        yl: lower.point.y,
        reconstructedUpper,
        reconstructedLower,
        linearCamber: linear.rows[i].ycamber,
        linearThickness: linear.rows[i].thickness,
        initialCamber: initialCamber[i]
      });
    }
    residual = Math.sqrt(finalNorm2 / Math.max(1, count - 2));
    const linearCamberSlopes = localQuadraticSlopes(rows.map(row => row.linearCamber), dx);
    const linearThicknessSlopes = finiteDifferenceSlopes(rows.map(row => row.linearThickness), dx);
    const nonlinearThicknessSlopes = finiteDifferenceSlopes(rows.map(row => row.thickness), dx);
    rows.forEach((row, i) => {
      row.linearCamberSlope = linearCamberSlopes[i];
      row.linearThicknessSlope = linearThicknessSlopes[i];
      row.thicknessSlope = nonlinearThicknessSlopes[i];
    });
    return {
      rows,
      initialCamber,
      initialCubicCoefficients: cubicGuess.coefficients,
      iterations: iteration + 1,
      converged: converged && residual < Math.max(tolerance, 5e-10),
      residual,
      maxReconstructionError
    };
  }

  function constrainedLeastSquares(rows, values, constraint, target = 0, regularization = 1e-12) {
    const columns = rows[0].length;
    const normal = Array.from({ length: columns + 1 }, () => new Array(columns + 1).fill(0));
    const rhs = new Array(columns + 1).fill(0);
    for (let i = 0; i < rows.length; i++) {
      for (let j = 0; j < columns; j++) {
        rhs[j] += rows[i][j] * values[i];
        for (let k = 0; k < columns; k++) normal[j][k] += rows[i][j] * rows[i][k];
      }
    }
    for (let i = 0; i < columns; i++) {
      normal[i][i] += regularization;
      normal[i][columns] = constraint[i];
      normal[columns][i] = constraint[i];
    }
    rhs[columns] = target;
    return solveLinearSystem(normal, rhs).slice(0, columns);
  }

  function fitThicknessCoefficients(rows, order = 4, accessor = row => row.thickness, options = {}) {
    const degree = Math.max(1, Math.min(Number(order) || 4, 12));
    const matrix = rows.map(row => {
      const basis = [Math.sqrt(Math.max(0, row.x))];
      for (let k = 1; k <= degree; k++) basis.push(row.x ** k);
      return basis;
    });
    if (optionEnabled(options.zeroTeThickness)) {
      return constrainedLeastSquares(matrix, rows.map(accessor), new Array(degree + 1).fill(1), 0, 1e-12);
    }
    return leastSquares(matrix, rows.map(accessor), 1e-12);
  }

  function interpolateRows(rows, x, accessor) {
    if (x <= rows[0].x) return accessor(rows[0]);
    if (x >= rows[rows.length - 1].x) return accessor(rows[rows.length - 1]);
    let lo = 0;
    let hi = rows.length - 1;
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      if (rows[mid].x <= x) lo = mid;
      else hi = mid;
    }
    const dx = rows[hi].x - rows[lo].x;
    if (Math.abs(dx) < EPS) return 0.5 * (accessor(rows[lo]) + accessor(rows[hi]));
    const fraction = (x - rows[lo].x) / dx;
    return accessor(rows[lo]) * (1 - fraction) + accessor(rows[hi]) * fraction;
  }

  function computeCamberCoefficients(rows, order, accessor) {
    const degree = Math.max(1, Math.min(Number(order) || 6, 20));
    const samples = Math.max(1200, 120 * degree);
    const coefficients = new Array(degree + 1).fill(0);
    for (let i = 0; i < samples; i++) {
      const theta = Math.PI * (i + 0.5) / samples;
      const x = 0.5 * (1 - Math.cos(theta));
      const slope = interpolateRows(rows, x, accessor);
      coefficients[0] += slope / samples;
      for (let n = 1; n <= degree; n++) coefficients[n] += slope * Math.cos(n * theta) / samples;
    }
    return coefficients;
  }

  function computeAerodynamicQuantities(eta) {
    const eta0 = eta[0] || 0;
    const eta1 = eta[1] || 0;
    const eta2 = eta[2] || 0;
    const eta1MinusEta0 = eta1 - eta0;
    const eta2MinusEta1 = eta2 - eta1;
    const zeroLiftAngle = Math.atan(eta0 - eta1);
    const quantities = {
      eta1MinusEta0,
      eta2MinusEta1,
      zeroLiftAngle,
      zeroLiftAngleDegrees: zeroLiftAngle * 180 / Math.PI,
      quarterChordMoment: 0.5 * Math.PI * eta2MinusEta1
    };
    return { ...quantities, ...aerodynamicMaximumLift(quantities) };
  }

  function aerodynamicCoefficientsAtAlpha(aerodynamics, alpha, xReference = 0.25) {
    const cosAlpha = Math.cos(alpha);
    const cosAlpha2 = cosAlpha * cosAlpha;
    const eta1MinusEta0 = Number.isFinite(aerodynamics?.eta1MinusEta0)
      ? aerodynamics.eta1MinusEta0
      : -Math.tan(aerodynamics?.zeroLiftAngle || 0);
    const eta2MinusEta1 = Number.isFinite(aerodynamics?.eta2MinusEta1)
      ? aerodynamics.eta2MinusEta1
      : 2 * (aerodynamics?.quarterChordMoment || 0) / Math.PI;
    const normalForce = Math.PI * Math.sin(2 * alpha) + 2 * Math.PI * eta1MinusEta0 * cosAlpha2;
    const quarterChordMoment = 0.5 * Math.PI * cosAlpha2 * eta2MinusEta1;
    return {
      normalForce,
      lift: normalForce * cosAlpha,
      moment: (xReference - 0.25) * normalForce + quarterChordMoment,
      quarterChordMoment
    };
  }

  function aerodynamicMaximumLift(aerodynamics) {
    const minAlpha = -0.5 * Math.PI + 1e-8;
    const maxAlpha = 0.5 * Math.PI - 1e-8;
    const sampleCount = 900;
    const step = (maxAlpha - minAlpha) / sampleCount;
    const liftAt = alpha => aerodynamicCoefficientsAtAlpha(aerodynamics, alpha, 0.25).lift;
    let bestAlpha = minAlpha;
    let bestLift = liftAt(bestAlpha);
    for (let i = 1; i <= sampleCount; i++) {
      const alpha = minAlpha + step * i;
      const lift = liftAt(alpha);
      if (lift > bestLift) {
        bestAlpha = alpha;
        bestLift = lift;
      }
    }
    let lower = Math.max(minAlpha, bestAlpha - step);
    let upper = Math.min(maxAlpha, bestAlpha + step);
    for (let i = 0; i < 80; i++) {
      const left = lower + (upper - lower) / 3;
      const right = upper - (upper - lower) / 3;
      if (liftAt(left) < liftAt(right)) lower = left;
      else upper = right;
    }
    const alpha = 0.5 * (lower + upper);
    const maxLift = liftAt(alpha);
    return {
      maximumLift: maxLift,
      maximumLiftAlpha: alpha,
      maximumLiftAlphaDegrees: alpha * 180 / Math.PI
    };
  }

  function aerodynamicAlphaGrid(minDegrees = -10, maxDegrees = 50, count = 241) {
    const safeCount = Math.max(2, Math.floor(Number(count) || 121));
    return Array.from({ length: safeCount }, (_, index) => {
      const degrees = minDegrees + (maxDegrees - minDegrees) * index / (safeCount - 1);
      return { degrees, radians: degrees * Math.PI / 180 };
    });
  }

  function aerodynamicCurveData(aerodynamics, quantity, alphaGrid = aerodynamicAlphaGrid()) {
    if (!aerodynamics) return null;
    return alphaGrid.map(sample => {
      const coefficients = aerodynamicCoefficientsAtAlpha(aerodynamics, sample.radians, 0.25);
      return { x: sample.degrees, y: quantity === 'moment' ? coefficients.quarterChordMoment : coefficients.lift };
    });
  }

  function parseNaca4Digits(code) {
    const digits = String(code || '').replace(/\D/g, '').padStart(4, '0').slice(-4);
    return {
      code: digits,
      m: Number(digits[0]) / 100,
      p: Number(digits[1]) / 10,
      t: Number(digits.slice(2)) / 100
    };
  }

  function naca4ClosedFormAt(code, xInput) {
    const { m, p, t } = parseNaca4Digits(code);
    const x = Math.max(0, Math.min(1, Number(xInput) || 0));
    let camber = 0;
    let camberSlope = 0;
    let camberSecondDerivative = 0;
    if (m > 0 && p > 0) {
      if (x < p) {
        camber = m / (p * p) * (2 * p * x - x * x);
        camberSlope = 2 * m / (p * p) * (p - x);
        camberSecondDerivative = -2 * m / (p * p);
      } else {
        camber = m / ((1 - p) ** 2) * ((1 - 2 * p) + 2 * p * x - x * x);
        camberSlope = 2 * m / ((1 - p) ** 2) * (p - x);
        camberSecondDerivative = -2 * m / ((1 - p) ** 2);
      }
    }
    const sqrtX = Math.sqrt(x);
    const thickness = 5 * t * (0.2969 * sqrtX - 0.1260 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1015 * x ** 4);
    const thicknessSlope = x > 0
      ? 5 * t * (0.2969 / (2 * sqrtX) - 0.1260 - 2 * 0.3516 * x + 3 * 0.2843 * x * x - 4 * 0.1015 * x ** 3)
      : Infinity;
    return { x, camber, camberSlope, camberSecondDerivative, thickness, thicknessSlope };
  }

  function naca4SurfacePairAt(code, x) {
    const exact = naca4ClosedFormAt(code, x);
    const theta = Math.atan(exact.camberSlope);
    return {
      upper: {
        x: exact.x - exact.thickness * Math.sin(theta),
        y: exact.camber + exact.thickness * Math.cos(theta)
      },
      lower: {
        x: exact.x + exact.thickness * Math.sin(theta),
        y: exact.camber - exact.thickness * Math.cos(theta)
      }
    };
  }

  function naca4ThicknessPeak(code) {
    const x = NACA4_OPEN_TE_THICKNESS_PEAK_X;
    return { x, value: naca4ClosedFormAt(code, x).thickness };
  }

  function naca4ExactCamberCoefficients(code, order = 2) {
    const { m, p } = parseNaca4Digits(code);
    const degree = Math.max(0, Math.floor(Number(order) || 0));
    const coefficients = new Array(degree + 1).fill(0);
    if (!(m > 0 && p > 0 && p < 1)) return coefficients;
    const thetaP = Math.acos(1 - 2 * p);
    const sinThetaP = Math.sin(thetaP);
    const p2 = p * p;
    const q2 = (1 - p) * (1 - p);
    const ap = p - 0.5;
    coefficients[0] = m / Math.PI * (
      (2 * p - 1) * (thetaP / p2 + (Math.PI - thetaP) / q2)
      + sinThetaP * (1 / p2 - 1 / q2)
    );
    if (degree >= 1) {
      const f1 = ap * sinThetaP + thetaP / 4 + sinThetaP * Math.cos(thetaP) / 4;
      coefficients[1] = 2 * m / Math.PI * (f1 / p2 + (Math.PI / 4 - f1) / q2);
    }
    for (let n = 2; n <= degree; n++) {
      const fn = ap * Math.sin(n * thetaP) / n
        + 0.25 * (Math.sin((n - 1) * thetaP) / (n - 1) + Math.sin((n + 1) * thetaP) / (n + 1));
      coefficients[n] = 2 * m / Math.PI * (1 / p2 - 1 / q2) * fn;
    }
    return coefficients;
  }

  function naca4ExactThicknessCoefficients(code, order = 4) {
    const { t } = parseNaca4Digits(code);
    const degree = Math.max(0, Math.floor(Number(order) || 0));
    const base = [
      5 * t * 0.2969,
      5 * t * -0.1260,
      5 * t * -0.3516,
      5 * t * 0.2843,
      5 * t * -0.1015
    ];
    return Array.from({ length: degree + 1 }, (_, index) => base[index] || 0);
  }

  function naca4ExactTrailingEdgeAngle(code) {
    const exact = naca4ClosedFormAt(code, 1);
    const theta = Math.atan(exact.camberSlope);
    const thetaDerivative = exact.camberSecondDerivative / (1 + exact.camberSlope * exact.camberSlope);
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);
    const upperDx = 1 - exact.thicknessSlope * sinTheta - exact.thickness * cosTheta * thetaDerivative;
    const upperDy = exact.camberSlope + exact.thicknessSlope * cosTheta - exact.thickness * sinTheta * thetaDerivative;
    const lowerDx = 1 + exact.thicknessSlope * sinTheta + exact.thickness * cosTheta * thetaDerivative;
    const lowerDy = exact.camberSlope - exact.thicknessSlope * cosTheta + exact.thickness * sinTheta * thetaDerivative;
    const upperAngle = Math.atan2(upperDy, upperDx);
    const lowerAngle = Math.atan2(lowerDy, lowerDx);
    return Math.abs(normalizeAngleRadians(upperAngle - lowerAngle)) * 180 / Math.PI;
  }

  function naca4ExactAnalysis(code, xValues, options = {}) {
    const parsed = parseNaca4Digits(code);
    const etaOrder = Math.max(0, Math.min(Number(options.etaOrder) || 8, 20));
    const betaOrder = Math.max(0, Math.min(Number(options.betaOrder) || 4, 12));
    const rows = xValues.map(x => naca4ClosedFormAt(parsed.code, x));
    const thicknessPeak = naca4ThicknessPeak(parsed.code);
    const camberPeak = parsed.m > 0 && parsed.p > 0
      ? { x: parsed.p, value: parsed.m }
      : { x: 0, value: 0 };
    const etaFull = naca4ExactCamberCoefficients(parsed.code, Math.max(2, etaOrder));
    const beta = naca4ExactThicknessCoefficients(parsed.code, betaOrder);
    return {
      code: parsed.code,
      rows,
      coefficients: {
        eta: etaFull.slice(0, etaOrder + 1),
        beta
      },
      summary: {
        geometric: {
          maxCamber: camberPeak.value,
          xmaxCamber: camberPeak.x,
          maxThickness: 2 * thicknessPeak.value,
          xmaxThickness: thicknessPeak.x,
          leadingEdgeRadius: 1.1019 * parsed.t * parsed.t
        },
        aerodynamic: computeAerodynamicQuantities(etaFull),
        edge: {
          leadingEdgeInclinationDegrees: angleDegreesFromSlope(naca4ClosedFormAt(parsed.code, 0).camberSlope),
          trailingEdgeAngleDegrees: naca4ExactTrailingEdgeAngle(parsed.code),
          trailingEdgeInclinationDegrees: angleDegreesFromSlope(naca4ClosedFormAt(parsed.code, 1).camberSlope)
        }
      }
    };
  }

  function angleDegreesFromSlope(slope) {
    return Math.atan(Number.isFinite(slope) ? slope : 0) * 180 / Math.PI;
  }

  function normalizeAngleRadians(angle) {
    let value = angle;
    while (value <= -Math.PI) value += 2 * Math.PI;
    while (value > Math.PI) value -= 2 * Math.PI;
    return value;
  }

  function tangentAngleDegrees(previous, current) {
    return Math.atan2(current.y - previous.y, current.x - previous.x) * 180 / Math.PI;
  }

  function trailingEdgeAngleDegrees(rows, upperAccessor, lowerAccessor) {
    const last = rows.length - 1;
    const upperPrevious = upperAccessor(rows[last - 1]);
    const upperCurrent = upperAccessor(rows[last]);
    const lowerPrevious = lowerAccessor(rows[last - 1]);
    const lowerCurrent = lowerAccessor(rows[last]);
    const upperAngle = Math.atan2(upperCurrent.y - upperPrevious.y, upperCurrent.x - upperPrevious.x);
    const lowerAngle = Math.atan2(lowerCurrent.y - lowerPrevious.y, lowerCurrent.x - lowerPrevious.x);
    return Math.abs(normalizeAngleRadians(upperAngle - lowerAngle)) * 180 / Math.PI;
  }

  function computeEdgeQuantities(rows) {
    const last = rows.length - 1;
    return {
      linear: {
        leadingEdgeInclinationDegrees: angleDegreesFromSlope(rows[0].linearCamberSlope),
        trailingEdgeAngleDegrees: trailingEdgeAngleDegrees(
          rows,
          row => ({ x: row.x, y: row.linearCamber + row.linearThickness }),
          row => ({ x: row.x, y: row.linearCamber - row.linearThickness })
        ),
        trailingEdgeInclinationDegrees: angleDegreesFromSlope(rows[last].linearCamberSlope)
      },
      nonlinear: {
        leadingEdgeInclinationDegrees: angleDegreesFromSlope(rows[0].slope),
        trailingEdgeAngleDegrees: trailingEdgeAngleDegrees(
          rows,
          row => row.reconstructedUpper,
          row => row.reconstructedLower
        ),
        trailingEdgeInclinationDegrees: angleDegreesFromSlope(rows[last].slope)
      }
    };
  }

  function curveSamples(curve, start, end, count) {
    return Array.from({ length: count }, (_, i) => curve.evaluate(start + (end - start) * i / (count - 1)).point);
  }

  function createDenseReconstruction(curve, sLE, rows, requestedCount = 401, options = {}) {
    const count = Math.max(101, Math.min(Math.round(Number(requestedCount) || 401), 1201));
    const zeroTeThickness = optionEnabled(options.zeroTeThickness);
    const camberSpline = new NaturalCubicSpline(rows.map(row => row.x), rows.map(row => row.ycamber));
    const denseRows = [];
    let maxError = 0;
    let fallbackCount = 0;
    for (let i = 0; i < count; i++) {
      const theta = Math.PI * i / (count - 1);
      const x = 0.5 * (1 - Math.cos(theta));
      const camber = camberSpline.evaluate(x);
      let camberValue = camber.value;
      let upper;
      let lower;
      let usedFallback = false;
      if (i === 0) {
        upper = lower = { s: sLE, ...curve.evaluate(sLE) };
      } else if (i === count - 1) {
        upper = { s: 0, ...curve.evaluate(0) };
        lower = { s: 1, ...curve.evaluate(1) };
      } else {
        let upperGuess = 1 - x;
        let lowerGuess = sLE + x * (1 - sLE);
        try {
          // The spline supplies a smooth dense-grid guess. This local correction then
          // enforces that each pair of normal intersections has (x, z_c) as midpoint.
          for (let iteration = 0; iteration < 14; iteration++) {
            upper = intersectNormal(curve, [0, sLE], x, camberValue, camber.derivative, upperGuess);
            lower = intersectNormal(curve, [sLE, 1], x, camberValue, camber.derivative, lowerGuess);
            upperGuess = upper.s;
            lowerGuess = lower.s;
            const residual = upper.point.y + lower.point.y - 2 * camberValue;
            if (Math.abs(residual) < 2e-13) break;
            const upperDenominator = upper.derivative.x + camber.derivative * upper.derivative.y;
            const lowerDenominator = lower.derivative.x + camber.derivative * lower.derivative.y;
            const jacobian = camber.derivative * upper.derivative.y / upperDenominator
              + camber.derivative * lower.derivative.y / lowerDenominator - 2;
            let update = Math.abs(jacobian) > 1e-10 ? -residual / jacobian : 0.5 * residual;
            update = Math.max(-0.006, Math.min(0.006, update));
            camberValue += update;
          }
        } catch (error) {
          // Very close to a blunt or measured LE/TE, the interpolated normal can lie
          // outside one surface branch. Preserve the dense surface there with the
          // well-defined vertical pair instead of aborting every plot on the page.
          try {
            upper = intersectNormal(curve, [0, sLE], x, 0, 0, upperGuess);
            lower = intersectNormal(curve, [sLE, 1], x, 0, 0, lowerGuess);
            camberValue = 0.5 * (upper.point.y + lower.point.y);
          } catch (fallbackError) {
            camberValue = interpolateRows(rows, x, row => row.ycamber);
            const fallbackSlope = interpolateRows(rows, x, row => row.slope);
            const fallbackThickness = Math.max(0, interpolateRows(rows, x, row => row.thickness));
            const inverseNorm = 1 / Math.sqrt(1 + fallbackSlope * fallbackSlope);
            const normal = { x: -fallbackSlope * inverseNorm, y: inverseNorm };
            upper = { point: { x: x + fallbackThickness * normal.x, y: camberValue + fallbackThickness * normal.y } };
            lower = { point: { x: x - fallbackThickness * normal.x, y: camberValue - fallbackThickness * normal.y } };
          }
          usedFallback = true;
          fallbackCount++;
        }
      }
      let thickness = 0.5 * Math.hypot(upper.point.x - lower.point.x, upper.point.y - lower.point.y);
      const inverseNorm = 1 / Math.sqrt(1 + camber.derivative * camber.derivative);
      const normal = { x: -camber.derivative * inverseNorm, y: inverseNorm };
      const reconstructedUpper = { x: x + thickness * normal.x, y: camberValue + thickness * normal.y };
      const reconstructedLower = { x: x - thickness * normal.x, y: camberValue - thickness * normal.y };
      if (zeroTeThickness && i === count - 1) {
        const trailingEdge = {
          x: 0.5 * (upper.point.x + lower.point.x),
          y: 0.5 * (upper.point.y + lower.point.y)
        };
        thickness = 0;
        Object.assign(reconstructedUpper, trailingEdge);
        Object.assign(reconstructedLower, trailingEdge);
      } else if (i === 0 || i === count - 1 || usedFallback) {
        Object.assign(reconstructedUpper, upper.point);
        Object.assign(reconstructedLower, lower.point);
      }
      maxError = Math.max(
        maxError,
        Math.hypot(reconstructedUpper.x - upper.point.x, reconstructedUpper.y - upper.point.y),
        Math.hypot(reconstructedLower.x - lower.point.x, reconstructedLower.y - lower.point.y)
      );
      denseRows.push({
        x,
        ycamber: camberValue,
        slope: camber.derivative,
        thickness,
        reconstructedUpper,
        reconstructedLower,
        surfaceUpper: upper.point,
        surfaceLower: lower.point
      });
    }
    return { rows: denseRows, count, maxError, fallbackCount };
  }

  function peakFromRows(rows, accessor, absolute = false) {
    let index = 0;
    for (let i = 1; i < rows.length; i++) {
      const current = absolute ? Math.abs(accessor(rows[i])) : accessor(rows[i]);
      const best = absolute ? Math.abs(accessor(rows[index])) : accessor(rows[index]);
      if (current > best) index = i;
    }
    let x = rows[index].x;
    let value = accessor(rows[index]);
    if (index > 0 && index < rows.length - 1) {
      const ym = absolute ? Math.abs(accessor(rows[index - 1])) : accessor(rows[index - 1]);
      const y0 = absolute ? Math.abs(accessor(rows[index])) : accessor(rows[index]);
      const yp = absolute ? Math.abs(accessor(rows[index + 1])) : accessor(rows[index + 1]);
      const xm = rows[index - 1].x;
      const x0 = rows[index].x;
      const xp = rows[index + 1].x;
      const denominator = (xm - x0) * (xm - xp) * (x0 - xp);
      if (Math.abs(denominator) > 1e-18) {
        const a = (xp * (y0 - ym) + x0 * (ym - yp) + xm * (yp - y0)) / denominator;
        const b = (xp * xp * (ym - y0) + x0 * x0 * (yp - ym) + xm * xm * (y0 - yp)) / denominator;
        const candidateX = Math.abs(a) > 1e-18 ? -b / (2 * a) : x0;
        if (Number.isFinite(candidateX) && candidateX >= xm && candidateX <= xp) {
          x = candidateX;
          const c = y0 - a * x0 * x0 - b * x0;
          const magnitude = a * x * x + b * x + c;
          value = absolute ? Math.sign(value || 1) * magnitude : magnitude;
        }
      }
    }
    return { x, value };
  }

  function computeSummary(prepared, nonlinear, beta, eta, etaOrder, betaOrder, reconstruction) {
    const linearCamberPeak = peakFromRows(nonlinear.rows, row => row.linearCamber, true);
    const nonlinearCamberPeak = peakFromRows(nonlinear.rows, row => row.ycamber, true);
    const linearThicknessPeak = peakFromRows(nonlinear.rows, row => row.linearThickness);
    const nonlinearThicknessPeak = peakFromRows(nonlinear.rows, row => row.thickness);
    const camberDifference = nonlinear.rows.map(row => row.ycamber - row.linearCamber);
    const thicknessDifference = nonlinear.rows.map(row => row.thickness - row.linearThickness);
    const rms = values => Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / values.length);
    const geometric = {
      linear: {
        maxCamber: linearCamberPeak.value,
        xmaxCamber: linearCamberPeak.x,
        maxThickness: 2 * linearThicknessPeak.value,
        xmaxThickness: linearThicknessPeak.x,
        leadingEdgeRadius: 0.5 * beta.linear[0] * beta.linear[0]
      },
      nonlinear: {
        maxCamber: nonlinearCamberPeak.value,
        xmaxCamber: nonlinearCamberPeak.x,
        maxThickness: 2 * nonlinearThicknessPeak.value,
        xmaxThickness: nonlinearThicknessPeak.x,
        leadingEdgeRadius: 0.5 * beta.nonlinear[0] * beta.nonlinear[0]
      }
    };
    return {
      maxCamber: geometric.nonlinear.maxCamber,
      xmaxCamber: geometric.nonlinear.xmaxCamber,
      maxThickness: geometric.nonlinear.maxThickness,
      xmaxThickness: geometric.nonlinear.xmaxThickness,
      leadingEdgeRadius: geometric.nonlinear.leadingEdgeRadius,
      geometric,
      aerodynamic: {
        linear: computeAerodynamicQuantities(eta.linear),
        nonlinear: computeAerodynamicQuantities(eta.nonlinear)
      },
      edge: computeEdgeQuantities(nonlinear.rows),
      beta: beta.nonlinear,
      etaOrder,
      betaOrder,
      reconstructionNodes: reconstruction.count,
      denseReconstructionError: reconstruction.maxError,
      inputPoints: prepared.points.length,
      splineSegments: prepared.points.length - 1,
      stations: nonlinear.rows.length,
      camberDifferenceRms: rms(camberDifference),
      thicknessDifferenceRms: rms(thicknessDifference),
      nonlinearResidual: nonlinear.residual,
      reconstructionError: nonlinear.maxReconstructionError,
      iterations: nonlinear.iterations,
      converged: nonlinear.converged
    };
  }

  function runExtraction(rawText, options = {}) {
    const prepared = normalizeAndOrderContour(parseCoordinateText(rawText));
    let curve = buildParametricSpline(prepared.points);
    let sLE = curve.parameters[prepared.leIndex];
    if (!prepared.chordCoordinateInput) {
      sLE = findLeadingEdge(curve, sLE, 0.08);
      // Re-evaluate the spline LE after each chord transformation. A few fixed-point
      // passes remove the tiny LE offset that otherwise remains on generic sections.
      for (let pass = 0; pass < 3; pass++) {
        const normalized = normalizeSplineChord(prepared, curve, sLE);
        curve = normalized.curve;
        sLE = normalized.sLE;
      }
    }
    const linear = extractLinear(curve, sLE, options.stations);
    const zeroTeThickness = optionEnabled(options.zeroTeThickness);
    const nonlinear = extractNonlinear(curve, sLE, linear, options.tolerance || 1e-10, { zeroTeThickness });
    const etaOrder = Math.max(1, Math.min(Number(options.etaOrder) || 8, 20));
    const betaOrder = Math.max(1, Math.min(Number(options.betaOrder) || 4, 12));
    const aerodynamicEtaOrder = Math.max(2, etaOrder);
    const etaLinearFull = computeCamberCoefficients(nonlinear.rows, aerodynamicEtaOrder, row => row.linearCamberSlope);
    const etaNonlinearFull = computeCamberCoefficients(nonlinear.rows, aerodynamicEtaOrder, row => row.slope);
    const etaLinear = etaLinearFull.slice(0, etaOrder + 1);
    const etaNonlinear = etaNonlinearFull.slice(0, etaOrder + 1);
    const betaLinear = fitThicknessCoefficients(nonlinear.rows, betaOrder, row => row.linearThickness);
    const betaNonlinear = fitThicknessCoefficients(nonlinear.rows, betaOrder, row => row.thickness, { zeroTeThickness });
    let reconstruction;
    try {
      reconstruction = createDenseReconstruction(curve, sLE, nonlinear.rows, options.reconstructionNodes, { zeroTeThickness });
    } catch (error) {
      // Dense reconstruction is a visualization refinement. Never let an unusual
      // edge geometry suppress the already-converged distributions and plots.
      reconstruction = {
        rows: nonlinear.rows.map(row => ({
          x: row.x,
          ycamber: row.ycamber,
          slope: row.slope,
          thickness: row.thickness,
          reconstructedUpper: row.reconstructedUpper,
          reconstructedLower: row.reconstructedLower,
          surfaceUpper: { x: row.xu, y: row.yu },
          surfaceLower: { x: row.xl, y: row.yl }
        })),
        count: nonlinear.rows.length,
        maxError: nonlinear.maxReconstructionError,
        fallbackCount: nonlinear.rows.length,
        warning: error.message
      };
    }
    const summary = computeSummary(prepared, nonlinear, { linear: betaLinear, nonlinear: betaNonlinear }, { linear: etaLinearFull, nonlinear: etaNonlinearFull }, etaOrder, betaOrder, reconstruction);
    summary.initialCubicCoefficients = nonlinear.initialCubicCoefficients;
    summary.zeroTeThickness = zeroTeThickness;
    return {
      prepared,
      curve,
      sLE,
      linearRows: linear.rows,
      initialCamber: nonlinear.initialCamber,
      rows: nonlinear.rows,
      reconstruction,
      coefficients: {
        eta: { linear: etaLinear, nonlinear: etaNonlinear },
        beta: { linear: betaLinear, nonlinear: betaNonlinear }
      },
      summary,
      surfaceUpper: curveSamples(curve, 0, sLE, 300),
      surfaceLower: curveSamples(curve, sLE, 1, 300)
    };
  }

  function smartTick(value, range) {
    const magnitude = Math.abs(range);
    const digits = magnitude >= 0.5 ? 2 : magnitude >= 0.05 ? 3 : magnitude >= 0.005 ? 4 : 5;
    const clean = Math.abs(value) < Math.pow(10, -digits) / 2 ? 0 : value;
    return clean.toFixed(digits);
  }

  function niceTickStep(span, target = 5) {
    if (!(span > 0) || !Number.isFinite(span)) return 1;
    const rough = span / Math.max(1, target);
    const exponent = Math.floor(Math.log10(rough));
    const scale = 10 ** exponent;
    const fraction = rough / scale;
    const niceFraction = fraction <= 1 ? 1
      : fraction <= 2 ? 2
        : fraction <= 2.5 ? 2.5
          : fraction <= 5 ? 5
            : 10;
    return niceFraction * scale;
  }

  function ticksForRange(min, max, target = 5, includeZero = false) {
    if (!Number.isFinite(min + max) || min === max) return [];
    const step = niceTickStep(max - min, target);
    const tolerance = Math.max(EPS, step * 1e-9);
    const start = Math.ceil((min - tolerance) / step) * step;
    const end = Math.floor((max + tolerance) / step) * step;
    const ticks = [];
    for (let value = start; value <= end + tolerance; value += step) {
      const clean = Math.abs(value) < tolerance ? 0 : value;
      if (clean >= min - tolerance && clean <= max + tolerance) ticks.push(clean);
    }
    if (includeZero && min <= 0 && max >= 0 && !ticks.some(value => Math.abs(value) < tolerance)) ticks.push(0);
    return ticks
      .sort((a, b) => a - b)
      .filter((value, index, values) => index === 0 || Math.abs(value - values[index - 1]) > tolerance);
  }

  function drawAxesAndSeries(svg, series, options = {}) {
    if (!svg) return;
    const measuredWidth = Math.round(svg.getBoundingClientRect?.().width || svg.parentElement?.getBoundingClientRect?.().width || 720);
    const width = Math.max(280, measuredWidth);
    let height = options.height || 340;
    let left = width < 430 ? 58 : 76;
    let right = width < 430 ? 16 : 24;
    let top = 22;
    let bottom = 50;
    if (options.squarePlotFitWidth) height = Math.max(height, Math.ceil(width - left - right + top + bottom));
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.style.height = `${height}px`;
    svg.innerHTML = '';
    if (options.squarePlot) {
      const plotWidth = width - left - right;
      const plotHeight = height - top - bottom;
      const size = Math.max(120, Math.min(plotWidth, plotHeight));
      const extraX = Math.max(0, plotWidth - size);
      const extraY = Math.max(0, plotHeight - size);
      left += extraX / 2;
      right += extraX / 2;
      top += extraY / 2;
      bottom += extraY / 2;
    }
    const visibleData = series.flatMap(item => item.data.filter(point =>
      (!Number.isFinite(options.xMin) || point.x >= options.xMin)
      && (!Number.isFinite(options.xMax) || point.x <= options.xMax)
    ));
    const allX = visibleData.map(point => point.x).filter(Number.isFinite);
    const allY = visibleData.map(point => point.y).filter(Number.isFinite);
    let xMin = Number.isFinite(options.xMin) ? options.xMin : Math.min(...allX);
    let xMax = Number.isFinite(options.xMax) ? options.xMax : Math.max(...allX);
    let yMin = Math.min(...allY);
    let yMax = Math.max(...allY);
    if (!Number.isFinite(xMin + xMax + yMin + yMax)) return;
    if (xMin === xMax) { xMin -= 1; xMax += 1; }
    if (yMin === yMax) { yMin -= 1e-4; yMax += 1e-4; }
    const pad = Math.max(0.06 * (yMax - yMin), 2e-4);
    yMin = Number.isFinite(options.yMin) ? options.yMin : yMin - pad;
    yMax = Number.isFinite(options.yMax) ? options.yMax : yMax + pad;
    if (options.includeZeroY) {
      yMin = Math.min(yMin, 0);
      yMax = Math.max(yMax, 0);
      const zeroPad = Math.max(0.02 * (yMax - yMin || 1), 2e-4);
      if (Math.abs(yMin) < EPS) yMin = -zeroPad;
      if (Math.abs(yMax) < EPS) yMax = zeroPad;
    }
    if (options.equalScale) {
      const requiredHalf = Math.max(Math.abs(yMin - (options.yCenter || 0)), Math.abs(yMax - (options.yCenter || 0)));
      const geometricHalf = 0.5 * (xMax - xMin) * (height - top - bottom) / (width - left - right);
      const half = Math.max(requiredHalf, geometricHalf);
      yMin = (options.yCenter || 0) - half;
      yMax = (options.yCenter || 0) + half;
    }
    const px = x => left + (x - xMin) / (xMax - xMin) * (width - left - right);
    const py = y => height - bottom - (y - yMin) / (yMax - yMin) * (height - top - bottom);
    const NS = 'http://www.w3.org/2000/svg';
    const make = (name, attrs = {}) => {
      const element = document.createElementNS(NS, name);
      for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
      return element;
    };
    const clipId = `${svg.id || 'plot'}-clip`;
    const defs = make('defs');
    const clip = make('clipPath', { id: clipId });
    clip.appendChild(make('rect', { x: left, y: top, width: width - left - right, height: height - top - bottom }));
    defs.appendChild(clip);
    svg.appendChild(defs);
    svg.appendChild(make('rect', { x: 0, y: 0, width, height, fill: '#ffffff' }));
    svg.appendChild(make('rect', { x: left, y: top, width: width - left - right, height: height - top - bottom, fill: '#ffffff', stroke: '#dbe4ee' }));
    const tickTarget = width < 430 ? 4 : 5;
    const xTicks = ticksForRange(xMin, xMax, tickTarget);
    const yTicks = ticksForRange(yMin, yMax, tickTarget, true);
    const reference = make('g');
    if (options.showZeroReference !== false && yMin < 0 && yMax > 0) {
      reference.appendChild(make('line', {
        x1: left,
        y1: py(0),
        x2: width - right,
        y2: py(0),
        stroke: '#94a3b8',
        'stroke-width': 1.15,
        'stroke-dasharray': '5 5',
        'stroke-linecap': 'round'
      }));
    }
    svg.appendChild(reference);
    const tickMarks = make('g', { stroke: '#94a3b8', 'stroke-width': 1 });
    xTicks.forEach(value => {
      const x = px(value);
      tickMarks.appendChild(make('line', { x1: x, y1: height - bottom, x2: x, y2: height - bottom + 5 }));
    });
    yTicks.forEach(value => {
      const y = py(value);
      tickMarks.appendChild(make('line', { x1: left - 5, y1: y, x2: left, y2: y }));
    });
    svg.appendChild(tickMarks);
    const labels = make('g', { fill: '#475569', 'font-size': width < 430 ? 11 : 12, 'font-family': 'Segoe UI, sans-serif' });
    xTicks.forEach(value => {
      const tx = make('text', { x: px(value), y: height - bottom + 20, 'text-anchor': 'middle' });
      tx.textContent = smartTick(value, xMax - xMin);
      labels.appendChild(tx);
    });
    yTicks.forEach(value => {
      const ty = make('text', { x: left - 8, y: py(value) + 4, 'text-anchor': 'end' });
      ty.textContent = smartTick(value, yMax - yMin);
      labels.appendChild(ty);
    });
    const xLabel = make('text', { x: (left + width - right) / 2, y: height - 10, 'text-anchor': 'middle', fill: '#0f172a', 'font-weight': 700 });
    xLabel.textContent = options.xlabel || 'x';
    labels.appendChild(xLabel);
    const yLabel = make('text', { x: 16, y: (top + height - bottom) / 2, transform: `rotate(-90 16 ${(top + height - bottom) / 2})`, 'text-anchor': 'middle', fill: '#0f172a', 'font-weight': 700 });
    yLabel.textContent = options.ylabel || 'y';
    labels.appendChild(yLabel);
    if (options.plotLabel) {
      const plotLabel = make('text', {
        x: left + 12,
        y: top + 22,
        fill: '#0f172a',
        'font-size': width < 430 ? 12 : 13,
        'font-weight': 850,
        'font-family': 'Segoe UI, sans-serif'
      });
      plotLabel.textContent = options.plotLabel;
      labels.appendChild(plotLabel);
    }
    svg.appendChild(labels);
    const dataGroup = make('g', { 'clip-path': `url(#${clipId})` });
    const orderedSeries = [
      ...series.filter(item => item.type !== 'points'),
      ...series.filter(item => item.type === 'points')
    ];
    for (const item of orderedSeries) {
      if (item.type === 'points') {
        const group = make('g', {
          fill: item.color,
          opacity: item.opacity ?? 0.85,
          stroke: item.stroke ?? '#ffffff',
          'stroke-width': item.strokeWidth ?? 0.75
        });
        for (const point of item.data) group.appendChild(make('circle', { cx: px(point.x), cy: py(point.y), r: item.radius || 2.4 }));
        dataGroup.appendChild(group);
      } else {
        const path = item.data.map((point, i) => `${i ? 'L' : 'M'} ${px(point.x).toFixed(2)} ${py(point.y).toFixed(2)}`).join(' ');
        dataGroup.appendChild(make('path', { d: path, fill: 'none', stroke: item.color, 'stroke-width': item.width || 2, 'stroke-dasharray': item.dash || '', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
      }
    }
    svg.appendChild(dataGroup);
  }

  function toCsv(result) {
    const s = result.summary;
    const csvNumber = value => Number.isFinite(value) ? Number(value).toPrecision(12) : '';
    const metadata = [
      '# surface_fit=parametric_natural_cubic_spline',
      '# nonlinear_method=normal_midpoint_iteration',
      '# aerodynamic_model_equations=51-54',
      '# aerodynamic_lift_definition=C_l=C_n*cos(alpha)',
      '# aerodynamic_polar_alpha_range_deg=-10,50',
      `# initial_camber_model=z_c=x(1-x)(a+b*x)`,
      `# initial_camber_coefficients=${s.initialCubicCoefficients.map(value => value.toExponential(8)).join(',')}`,
      `# leading_edge_radius=${s.leadingEdgeRadius.toExponential(8)}`,
      `# alpha_zero_lift_linear_rad=${s.aerodynamic.linear.zeroLiftAngle.toExponential(8)}`,
      `# alpha_zero_lift_nonlinear_rad=${s.aerodynamic.nonlinear.zeroLiftAngle.toExponential(8)}`,
      `# cm_quarter_chord_linear=${s.aerodynamic.linear.quarterChordMoment.toExponential(8)}`,
      `# cm_quarter_chord_nonlinear=${s.aerodynamic.nonlinear.quarterChordMoment.toExponential(8)}`,
      `# cl_max_inviscid_linear=${s.aerodynamic.linear.maximumLift.toExponential(8)}`,
      `# alpha_cl_max_linear_deg=${s.aerodynamic.linear.maximumLiftAlphaDegrees.toExponential(8)}`,
      `# cl_max_inviscid_nonlinear=${s.aerodynamic.nonlinear.maximumLift.toExponential(8)}`,
      `# alpha_cl_max_nonlinear_deg=${s.aerodynamic.nonlinear.maximumLiftAlphaDegrees.toExponential(8)}`,
      `# leading_edge_inclination_linear_deg=${s.edge.linear.leadingEdgeInclinationDegrees.toExponential(8)}`,
      `# leading_edge_inclination_nonlinear_deg=${s.edge.nonlinear.leadingEdgeInclinationDegrees.toExponential(8)}`,
      `# trailing_edge_angle_linear_deg=${s.edge.linear.trailingEdgeAngleDegrees.toExponential(8)}`,
      `# trailing_edge_angle_nonlinear_deg=${s.edge.nonlinear.trailingEdgeAngleDegrees.toExponential(8)}`,
      `# trailing_edge_inclination_linear_deg=${s.edge.linear.trailingEdgeInclinationDegrees.toExponential(8)}`,
      `# trailing_edge_inclination_nonlinear_deg=${s.edge.nonlinear.trailingEdgeInclinationDegrees.toExponential(8)}`,
      `# zero_te_thickness=${s.zeroTeThickness ? 'true' : 'false'}`,
      `# eta_order=${s.etaOrder}`,
      `# beta_order=${s.betaOrder}`,
      `# reconstruction_nodes=${s.reconstructionNodes}`,
      `# eta_linear=${result.coefficients.eta.linear.map(value => value.toExponential(8)).join(',')}`,
      `# eta_nonlinear=${result.coefficients.eta.nonlinear.map(value => value.toExponential(8)).join(',')}`,
      `# beta_linear=${result.coefficients.beta.linear.map(value => value.toExponential(8)).join(',')}`,
      `# beta_nonlinear=${result.coefficients.beta.nonlinear.map(value => value.toExponential(8)).join(',')}`
    ];
    if (Array.isArray(result.coefficients.eta.exact)) {
      metadata.push(`# eta_exact=${result.coefficients.eta.exact.map(value => value.toExponential(8)).join(',')}`);
    }
    if (Array.isArray(result.coefficients.beta.exact)) {
      metadata.push(`# beta_exact=${result.coefficients.beta.exact.map(value => value.toExponential(8)).join(',')}`);
    }
    if (s.exact?.aerodynamic) {
      metadata.push(
        `# alpha_zero_lift_exact_rad=${s.exact.aerodynamic.zeroLiftAngle.toExponential(8)}`,
        `# cm_quarter_chord_exact=${s.exact.aerodynamic.quarterChordMoment.toExponential(8)}`,
        `# cl_max_inviscid_exact=${s.exact.aerodynamic.maximumLift.toExponential(8)}`,
        `# alpha_cl_max_exact_deg=${s.exact.aerodynamic.maximumLiftAlphaDegrees.toExponential(8)}`
      );
    }
    const header = 'x_c;z_c_linear;dz_c_linear_dx;z_t_linear_vertical;dz_t_linear_dx;z_c_initial_cubic;z_c_nonlinear;dz_c_nonlinear_dx;z_t_nonlinear_normal;dz_t_nonlinear_dx;x_upper;z_upper;x_lower;z_lower';
    const body = result.rows.map(row => [row.x, row.linearCamber, row.linearCamberSlope, row.linearThickness, row.linearThicknessSlope, row.initialCamber, row.ycamber, row.slope, row.thickness, row.thicknessSlope, row.xu, row.yu, row.xl, row.yl].map(csvNumber).join(';'));
    const reconstructionHeader = 'reconstruction_x_c;reconstruction_z_c;reconstruction_dz_c_dx;reconstruction_z_t;reconstructed_x_upper;reconstructed_z_upper;reconstructed_x_lower;reconstructed_z_lower;surface_x_upper;surface_z_upper;surface_x_lower;surface_z_lower';
    const reconstructionBody = result.reconstruction.rows.map(row => [
      row.x,
      row.ycamber,
      row.slope,
      row.thickness,
      row.reconstructedUpper.x,
      row.reconstructedUpper.y,
      row.reconstructedLower.x,
      row.reconstructedLower.y,
      row.surfaceUpper.x,
      row.surfaceUpper.y,
      row.surfaceLower.x,
      row.surfaceLower.y
    ].map(csvNumber).join(';'));
    const polarHeader = 'alpha_deg;alpha_rad;c_l_linear;c_m_c4_linear;c_l_nonlinear;c_m_c4_nonlinear;c_l_exact;c_m_c4_exact';
    const polarBody = aerodynamicAlphaGrid().map(sample => {
      const linear = aerodynamicCoefficientsAtAlpha(s.aerodynamic.linear, sample.radians, 0.25);
      const nonlinear = aerodynamicCoefficientsAtAlpha(s.aerodynamic.nonlinear, sample.radians, 0.25);
      const exact = s.exact?.aerodynamic ? aerodynamicCoefficientsAtAlpha(s.exact.aerodynamic, sample.radians, 0.25) : null;
      return [
        sample.degrees,
        sample.radians,
        linear.lift,
        linear.quarterChordMoment,
        nonlinear.lift,
        nonlinear.quarterChordMoment,
        exact?.lift,
        exact?.quarterChordMoment
      ].map(csvNumber).join(';');
    });
    return '\ufeffsep=;\n' + metadata.concat(header, body, '', reconstructionHeader, reconstructionBody, '', polarHeader, polarBody).join('\n');
  }

  function downloadText(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function summaryMarkup(summary, lang) {
    const values = lang === 'en' ? [
      ['Input geometry', `${summary.inputPoints} surface nodes`],
      ['Analysis resolution', `${summary.stations} camber stations`]
    ] : [
      ['Geometria de entrada', `${summary.inputPoints} nós da superfície`],
      ['Resolução da análise', `${summary.stations} estações de cambagem`]
    ];
    return values.map(([label, value]) => `<div class="result-item"><div class="result-label">${label}</div><div class="result-value">${value}</div></div>`).join('');
  }

  function quantityTableMarkup(rows, lang) {
    const hasExact = rows.some(row => row.length > 3 && row[3] != null);
    const body = rows.map(([quantity, linear, nonlinear, exact]) => `<tr><th scope="row">${quantity}</th><td>${linear}</td><td>${nonlinear}</td>${hasExact ? `<td>${exact ?? '—'}</td>` : ''}</tr>`).join('');
    return `<div class="coefficient-table-wrap"><table class="coefficient-table"><thead><tr><th>${lang === 'en' ? 'Quantity' : 'Grandeza'}</th><th>Linear</th><th>${lang === 'en' ? 'Nonlinear' : 'Não linear'}</th>${hasExact ? `<th>${lang === 'en' ? 'Exact' : 'Exato'}</th>` : ''}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function geometricQuantityTableMarkup(summary, lang) {
    const linearGeometry = summary.geometric.linear;
    const nonlinearGeometry = summary.geometric.nonlinear;
    const linearEdge = summary.edge.linear;
    const nonlinearEdge = summary.edge.nonlinear;
    const exactGeometry = summary.exact?.geometric;
    const exactEdge = summary.exact?.edge;
    const percentAt = (value, x) => `${(Math.abs(value) * 100).toFixed(3)}% @ x/c = ${x.toFixed(3)}`;
    const degrees = value => `${value.toFixed(3)}°`;
    const exactPercentAt = quantity => exactGeometry ? percentAt(exactGeometry[quantity.value], exactGeometry[quantity.x]) : null;
    const exactRadius = exactGeometry ? `${(exactGeometry.leadingEdgeRadius * 100).toFixed(3)}%` : null;
    const exactAngle = key => exactEdge ? degrees(exactEdge[key]) : null;
    const rows = lang === 'en' ? [
      ['Maximum camber', percentAt(linearGeometry.maxCamber, linearGeometry.xmaxCamber), percentAt(nonlinearGeometry.maxCamber, nonlinearGeometry.xmaxCamber), exactPercentAt({ value: 'maxCamber', x: 'xmaxCamber' })],
      ['Maximum thickness', percentAt(linearGeometry.maxThickness, linearGeometry.xmaxThickness), percentAt(nonlinearGeometry.maxThickness, nonlinearGeometry.xmaxThickness), exactPercentAt({ value: 'maxThickness', x: 'xmaxThickness' })],
      ['Leading-edge radius, r<sub>LE</sub>/c', `${(linearGeometry.leadingEdgeRadius * 100).toFixed(3)}%`, `${(nonlinearGeometry.leadingEdgeRadius * 100).toFixed(3)}%`, exactRadius],
      ['Leading-edge inclination', degrees(linearEdge.leadingEdgeInclinationDegrees), degrees(nonlinearEdge.leadingEdgeInclinationDegrees), exactAngle('leadingEdgeInclinationDegrees')],
      ['Trailing-edge angle', degrees(linearEdge.trailingEdgeAngleDegrees), degrees(nonlinearEdge.trailingEdgeAngleDegrees), exactAngle('trailingEdgeAngleDegrees')],
      ['Trailing-edge inclination', degrees(linearEdge.trailingEdgeInclinationDegrees), degrees(nonlinearEdge.trailingEdgeInclinationDegrees), exactAngle('trailingEdgeInclinationDegrees')]
    ] : [
      ['Cambagem máxima', percentAt(linearGeometry.maxCamber, linearGeometry.xmaxCamber), percentAt(nonlinearGeometry.maxCamber, nonlinearGeometry.xmaxCamber), exactPercentAt({ value: 'maxCamber', x: 'xmaxCamber' })],
      ['Espessura máxima', percentAt(linearGeometry.maxThickness, linearGeometry.xmaxThickness), percentAt(nonlinearGeometry.maxThickness, nonlinearGeometry.xmaxThickness), exactPercentAt({ value: 'maxThickness', x: 'xmaxThickness' })],
      ['Raio do bordo de ataque, r<sub>BA</sub>/c', `${(linearGeometry.leadingEdgeRadius * 100).toFixed(3)}%`, `${(nonlinearGeometry.leadingEdgeRadius * 100).toFixed(3)}%`, exactRadius],
      ['Inclinação do bordo de ataque', degrees(linearEdge.leadingEdgeInclinationDegrees), degrees(nonlinearEdge.leadingEdgeInclinationDegrees), exactAngle('leadingEdgeInclinationDegrees')],
      ['Ângulo do bordo de fuga', degrees(linearEdge.trailingEdgeAngleDegrees), degrees(nonlinearEdge.trailingEdgeAngleDegrees), exactAngle('trailingEdgeAngleDegrees')],
      ['Inclinação do bordo de fuga', degrees(linearEdge.trailingEdgeInclinationDegrees), degrees(nonlinearEdge.trailingEdgeInclinationDegrees), exactAngle('trailingEdgeInclinationDegrees')]
    ];
    return quantityTableMarkup(rows, lang);
  }

  function aerodynamicQuantityTableMarkup(summary, lang) {
    const linearAerodynamics = summary.aerodynamic.linear;
    const nonlinearAerodynamics = summary.aerodynamic.nonlinear;
    const exactAerodynamics = summary.exact?.aerodynamic;
    const exactAngle = exactAerodynamics ? `${exactAerodynamics.zeroLiftAngleDegrees.toFixed(3)}°` : null;
    const exactMoment = exactAerodynamics ? exactAerodynamics.quarterChordMoment.toFixed(5) : null;
    const maxLiftAt = aerodynamics => `${aerodynamics.maximumLift.toFixed(4)} @ α = ${aerodynamics.maximumLiftAlphaDegrees.toFixed(2)}°`;
    const exactMaxLift = exactAerodynamics ? maxLiftAt(exactAerodynamics) : null;
    const rows = lang === 'en' ? [
      ['Zero-lift angle, α<sub>L=0</sub>', `${linearAerodynamics.zeroLiftAngleDegrees.toFixed(3)}°`, `${nonlinearAerodynamics.zeroLiftAngleDegrees.toFixed(3)}°`, exactAngle],
      ['Quarter-chord moment, C<sub>m,c/4</sub>', linearAerodynamics.quarterChordMoment.toFixed(5), nonlinearAerodynamics.quarterChordMoment.toFixed(5), exactMoment],
      ['Maximum inviscid lift, C<sub>l,max</sub>', maxLiftAt(linearAerodynamics), maxLiftAt(nonlinearAerodynamics), exactMaxLift]
    ] : [
      ['Ângulo de sustentação nula, α<sub>L=0</sub>', `${linearAerodynamics.zeroLiftAngleDegrees.toFixed(3)}°`, `${nonlinearAerodynamics.zeroLiftAngleDegrees.toFixed(3)}°`, exactAngle],
      ['Momento no quarto de corda, C<sub>m,c/4</sub>', linearAerodynamics.quarterChordMoment.toFixed(5), nonlinearAerodynamics.quarterChordMoment.toFixed(5), exactMoment],
      ['Sustentação invíscida máxima, C<sub>l,max</sub>', maxLiftAt(linearAerodynamics), maxLiftAt(nonlinearAerodynamics), exactMaxLift]
    ];
    return quantityTableMarkup(rows, lang);
  }

  function coefficientTableMarkup(symbol, coefficients, lang) {
    const hasExact = Array.isArray(coefficients.exact);
    const rows = coefficients.linear.map((linear, n) => {
      const nonlinear = coefficients.nonlinear[n];
      const exact = coefficients.exact?.[n];
      return `<tr><th scope="row">${symbol}<sub>${n}</sub></th><td>${linear.toExponential(5)}</td><td>${nonlinear.toExponential(5)}</td>${hasExact ? `<td>${Number.isFinite(exact) ? exact.toExponential(5) : '—'}</td>` : ''}</tr>`;
    }).join('');
    return `<div class="coefficient-table-wrap"><table class="coefficient-table"><thead><tr><th>${lang === 'en' ? 'Mode' : 'Modo'}</th><th>${lang === 'en' ? 'Linear' : 'Linear'}</th><th>${lang === 'en' ? 'Nonlinear' : 'Não linear'}</th>${hasExact ? `<th>${lang === 'en' ? 'Exact' : 'Exato'}</th>` : ''}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function naca4ParametersFromInputs(maxCamberInput, camberLocationInput, thicknessInput, surfaceNodesInput) {
    const maximumCamberPercent = Number(maxCamberInput?.value);
    const camberLocationPercent = Number(camberLocationInput?.value);
    const thicknessPercent = Number(thicknessInput?.value);
    const surfaceNodes = Number(surfaceNodesInput?.value);
    if (![maximumCamberPercent, camberLocationPercent, thicknessPercent].every(Number.isInteger)) {
      throw new Error('NACA 4-digit parameters must be integers.');
    }
    if (!Number.isInteger(surfaceNodes)) {
      throw new Error('NACA surface nodes must be an integer.');
    }
    if (maximumCamberPercent < 0 || maximumCamberPercent > 9) {
      throw new Error('Maximum camber must be between 0 and 9% of chord.');
    }
    const hasSymmetricLocation = maximumCamberPercent === 0 && camberLocationPercent === 0;
    const hasStandardCamberLocation = camberLocationPercent >= 10
      && camberLocationPercent <= 90
      && camberLocationPercent % 10 === 0;
    if (!hasSymmetricLocation && !hasStandardCamberLocation) {
      throw new Error('Camber location must be 0 for a symmetric airfoil, or 10, 20, ..., or 90% of chord.');
    }
    if (thicknessPercent < 1 || thicknessPercent > 40) {
      throw new Error('Maximum thickness must be between 1 and 40% of chord.');
    }
    if (surfaceNodes < 8 || surfaceNodes > 401) {
      throw new Error('NACA surface nodes must be between 8 and 401.');
    }
    const camberDigit = maximumCamberPercent;
    const locationDigit = maximumCamberPercent === 0 ? 0 : camberLocationPercent / 10;
    const thicknessDigits = String(thicknessPercent).padStart(2, '0');
    return {
      maximumCamberPercent,
      camberLocationPercent,
      thicknessPercent,
      code: `${camberDigit}${locationDigit}${thicknessDigits}`,
      surfaceNodes
    };
  }

  function wireTool(ids, lang) {
    const get = key => document.getElementById(ids[key]);
    const textarea = get('textarea');
    const presetSelect = get('preset');
    const nacaFields = get('nacaFields');
    const nacaInputs = {
      maxCamber: get('nacaMaxCamber'),
      camberLocation: get('nacaCamberLocation'),
      thickness: get('nacaThickness'),
      surfaceNodes: get('nacaSurfaceNodes')
    };
    const samplesInput = get('samples');
    const etaOrderInput = get('etaOrder');
    const betaOrderInput = get('betaOrder');
    const summary = get('summaryCards');
    const runBtn = get('runBtn');
    const progress = get('progress');
    const progressFill = get('progressFill');
    const geometryToggles = { points: get('togglePoints'), surface: get('toggleSurface'), chord: get('toggleChord') };
    const reconstructionToggles = { points: get('toggleReconstructionPoints'), camber: get('toggleReconstructionCamber'), surface: get('toggleReconstructionSurface'), chord: get('toggleReconstructionChord') };
    const analysisToggles = {
      camber: { exact: get('toggleCamberExact'), linear: get('toggleCamberLinear'), nonlinear: get('toggleCamberNonlinear') },
      thickness: { exact: get('toggleThicknessExact'), linear: get('toggleThicknessLinear'), nonlinear: get('toggleThicknessNonlinear') },
      aerodynamic: { exact: get('toggleAeroExact'), linear: get('toggleAeroLinear'), nonlinear: get('toggleAeroNonlinear') }
    };
    const zeroTeThicknessInput = get('zeroTeThickness');
    const chordData = [{ x: 0, y: 0 }, { x: 1, y: 0 }];
    const chordSeries = () => ({ type: 'line', data: chordData, color: CHORD_COLOR, width: 1.25, dash: '6 5' });
    const linearSeries = data => ({ type: 'line', data, color: LINEAR_COLOR, width: 1.25, dash: '7 5' });
    const nonlinearSeries = data => ({ type: 'line', data, color: NONLINEAR_COLOR, width: 2.45, dash: '9 4 1.5 4' });
    const exactSeries = data => ({ type: 'line', data, color: EXACT_COLOR, width: 1.25 });
    const exactLegendItems = Array.from(textarea?.closest('.lang-content')?.querySelectorAll('.exact-key') || []);
    let latest = null;
    let rendering = false;
    let resizeTimer = null;

    function setNacaValidity(message = '') {
      Object.values(nacaInputs).forEach(input => input?.setCustomValidity?.(message));
    }

    function updateNacaFieldVisibility() {
      if (nacaFields) nacaFields.hidden = presetSelect?.value !== 'NACA4';
    }

    function naca4CoordinateText() {
      const parameters = naca4ParametersFromInputs(nacaInputs.maxCamber, nacaInputs.camberLocation, nacaInputs.thickness, nacaInputs.surfaceNodes);
      return `# NACA ${parameters.code} generated preset\n# surface_nodes=${parameters.surfaceNodes}\nNACA ${parameters.code}\n${generateNaca4SurfaceNodes(parameters.code, parameters.surfaceNodes)}`;
    }

    function updateExactLegend(show) {
      exactLegendItems.forEach(item => { item.hidden = !show; });
    }

    function denseExactXValues(count = 1001) {
      return Array.from({ length: count }, (_, index) => index / (count - 1));
    }

    function toggleChecked(element) {
      return element?.checked !== false;
    }

    function comparisonSeries(toggles, exactData, linearData, nonlinearData) {
      const series = [];
      if (exactData && toggleChecked(toggles.exact)) series.push(exactSeries(exactData));
      if (toggleChecked(toggles.linear)) series.push(linearSeries(linearData));
      if (toggleChecked(toggles.nonlinear)) series.push(nonlinearSeries(nonlinearData));
      return series;
    }

    function activeNacaExact() {
      if (presetSelect?.value !== 'NACA4') return null;
      const parameters = naca4ParametersFromInputs(nacaInputs.maxCamber, nacaInputs.camberLocation, nacaInputs.thickness, nacaInputs.surfaceNodes);
      return naca4ExactAnalysis(parameters.code, denseExactXValues(), {
        etaOrder: etaOrderInput?.value,
        betaOrder: betaOrderInput?.value
      });
    }

    function airfoilPlotLabel() {
      const nacaMatch = String(textarea?.value || '').match(/^\s*NACA\s+([0-9]{4})\b/im);
      if (nacaMatch) return `NACA ${nacaMatch[1]}`;
      if (presetSelect?.value === 'NACA4') {
        const parameters = naca4ParametersFromInputs(nacaInputs.maxCamber, nacaInputs.camberLocation, nacaInputs.thickness, nacaInputs.surfaceNodes);
        return `NACA ${parameters.code}`;
      }
      return presetSelect?.selectedOptions?.[0]?.textContent?.trim() || (lang === 'en' ? 'Airfoil' : 'Aerofólio');
    }

    function updateCoordinatesFromPreset() {
      updateNacaFieldVisibility();
      updateExactLegend(presetSelect?.value === 'NACA4');
      if (!textarea || !presetSelect) return;
      if (presetSelect.value === 'NACA4') {
        try {
          textarea.value = naca4CoordinateText();
          setNacaValidity('');
        } catch (error) {
          setNacaValidity(error.message);
          textarea.value = `# ${error.message}\n`;
        }
        return;
      }
      setNacaValidity('');
      const preset = global.AIRFOIL_PRESET_DATA?.[presetSelect.value];
      if (preset?.data) textarea.value = preset.data;
    }

    function drawReconstructionPlot() {
      if (!latest) {
        render();
        return;
      }
      const zeroTeThickness = Boolean(zeroTeThicknessInput?.checked);
      if (Boolean(latest.summary.zeroTeThickness) !== zeroTeThickness) {
        render();
        return;
      }
      const reconstructedUpper = latest.reconstruction.rows.map(row => row.reconstructedUpper);
      const reconstructedLower = latest.reconstruction.rows.map(row => row.reconstructedLower);
      const reconstructedContour = reconstructedUpper.concat(reconstructedLower.slice().reverse());
      const displayedNonlinearCamber = latest.rows.map(row => ({ x: row.x, y: row.ycamber }));
      const reconstructionSeries = [];
      if (reconstructionToggles.chord?.checked) reconstructionSeries.push(chordSeries());
      if (reconstructionToggles.camber?.checked) reconstructionSeries.push(nonlinearSeries(displayedNonlinearCamber));
      if (reconstructionToggles.surface?.checked) reconstructionSeries.push({ type: 'line', data: reconstructedContour, color: '#000000', width: 2.2 });
      if (reconstructionToggles.points?.checked) reconstructionSeries.push({ type: 'points', data: latest.prepared.points, color: RED2_COLOR, radius: 2.45, opacity: 1, stroke: '#ffffff', strokeWidth: 0.8 });
      const visibleReconstructionSeries = reconstructionSeries.length ? reconstructionSeries : [
        { type: 'line', data: reconstructedContour, color: '#000000', width: 2.2 }
      ];
      const reconstructionOptions = { xlabel: 'x/c', ylabel: 'z/c', equalScale: true, yCenter: 0, showZeroReference: false };
      const detailOptions = { xlabel: 'x/c', ylabel: 'z/c', yMin: -0.06, yMax: 0.06, height: 265, squarePlot: true, squarePlotFitWidth: true, showZeroReference: false };
      drawAxesAndSeries(get('svgReconstruction'), visibleReconstructionSeries, { ...reconstructionOptions, xMin: 0, xMax: 1, height: 350, plotLabel: airfoilPlotLabel() });
      drawAxesAndSeries(get('svgReconstructionLE'), visibleReconstructionSeries, { ...detailOptions, xMin: 0, xMax: 0.1 });
      drawAxesAndSeries(get('svgReconstructionTE'), visibleReconstructionSeries, { ...detailOptions, xMin: 0.9, xMax: 1 });
      if (summary) summary.innerHTML = summaryMarkup(latest.summary, lang);
    }

    function render() {
      if (!textarea || rendering || !textarea.closest('.lang-content')?.classList.contains('active')) return;
      updateNacaFieldVisibility();
      rendering = true;
      try {
        latest = runExtraction(textarea.value, { stations: samplesInput?.value, etaOrder: etaOrderInput?.value, betaOrder: betaOrderInput?.value, zeroTeThickness: zeroTeThicknessInput?.checked });
        const nacaExact = activeNacaExact();
        if (nacaExact) {
          latest.summary.exact = nacaExact.summary;
          latest.coefficients.eta.exact = nacaExact.coefficients.eta;
          latest.coefficients.beta.exact = nacaExact.coefficients.beta;
        } else {
          delete latest.summary.exact;
          delete latest.coefficients.eta.exact;
          delete latest.coefficients.beta.exact;
        }
        updateExactLegend(Boolean(nacaExact));
        const splineContour = latest.surfaceUpper.concat(latest.surfaceLower);
        const linearCamber = latest.rows.map(row => ({ x: row.x, y: row.linearCamber }));
        const nonlinearCamber = latest.rows.map(row => ({ x: row.x, y: row.ycamber }));
        const linearThickness = latest.rows.map(row => ({ x: row.x, y: row.linearThickness }));
        const nonlinearThickness = latest.rows.map(row => ({ x: row.x, y: row.thickness }));
        const linearThicknessSlope = latest.rows.map(row => ({ x: row.x, y: row.linearThicknessSlope }));
        const nonlinearThicknessSlope = latest.rows.map(row => ({ x: row.x, y: row.thicknessSlope }));
        const linearCamberSlope = latest.rows.map(row => ({ x: row.x, y: row.linearCamberSlope }));
        const nonlinearCamberSlope = latest.rows.map(row => ({ x: row.x, y: row.slope }));
        const exactCamber = nacaExact?.rows.map(row => ({ x: row.x, y: row.camber })) || null;
        const exactCamberSlope = nacaExact?.rows.map(row => ({ x: row.x, y: row.camberSlope })) || null;
        const exactThickness = nacaExact?.rows.map(row => ({ x: row.x, y: row.thickness })) || null;
        const exactThicknessSlope = nacaExact?.rows
          .filter(row => row.x > 1e-8 && Number.isFinite(row.thicknessSlope))
          .map(row => ({ x: row.x, y: row.thicknessSlope })) || null;
        const geometry = [];
        if (geometryToggles.chord?.checked) geometry.push(chordSeries());
        if (geometryToggles.surface?.checked) geometry.push({ type: 'line', data: splineContour, color: '#000000', width: 2.1 });
        if (geometryToggles.points?.checked) geometry.push({ type: 'points', data: latest.prepared.points, color: RED2_COLOR, radius: 2.45, opacity: 1, stroke: '#ffffff', strokeWidth: 0.8 });
        const geometrySeries = geometry.length ? geometry : [{ type: 'line', data: splineContour, color: '#000000' }];
        drawAxesAndSeries(get('svgGeom'), geometrySeries, { xMin: 0, xMax: 1, xlabel: 'x/c', ylabel: 'z/c', equalScale: true, yCenter: 0, height: 350, showZeroReference: false, plotLabel: airfoilPlotLabel() });
        const surfaceDetailOptions = { xlabel: 'x/c', ylabel: 'z/c', yMin: -0.06, yMax: 0.06, height: 265, squarePlot: true, squarePlotFitWidth: true, showZeroReference: false };
        drawAxesAndSeries(get('svgGeomLE'), geometrySeries, { ...surfaceDetailOptions, xMin: 0, xMax: 0.1 });
        drawAxesAndSeries(get('svgGeomTE'), geometrySeries, { ...surfaceDetailOptions, xMin: 0.9, xMax: 1 });
        const detailOptions = (xMin, xMax, ylabel, extra = {}) => ({ xMin, xMax, xlabel: 'x/c', ylabel, height: 245, ...extra });
        const leDetail = (ylabel, extra) => detailOptions(0, 0.1, ylabel, extra);
        const teDetail = (ylabel, extra) => detailOptions(0.9, 1, ylabel, extra);

        const thicknessSeries = comparisonSeries(analysisToggles.thickness, exactThickness, linearThickness, nonlinearThickness);
        drawAxesAndSeries(get('svgThickness'), thicknessSeries, { xMin: 0, xMax: 1, yMin: 0, xlabel: 'x/c', ylabel: 'z_t/c', height: 320 });
        drawAxesAndSeries(get('svgThicknessLE'), thicknessSeries, leDetail('z_t/c', { yMin: 0 }));
        drawAxesAndSeries(get('svgThicknessTE'), thicknessSeries, teDetail('z_t/c', { yMin: 0 }));
        const thicknessSlopeSeries = comparisonSeries(analysisToggles.thickness, exactThicknessSlope, linearThicknessSlope, nonlinearThicknessSlope);
        drawAxesAndSeries(get('svgThicknessDerivative'), thicknessSlopeSeries, { xMin: 0, xMax: 1, xlabel: 'x/c', ylabel: "z'_t", height: 320 });
        drawAxesAndSeries(get('svgThicknessDerivativeLE'), thicknessSlopeSeries, leDetail("z'_t"));
        drawAxesAndSeries(get('svgThicknessDerivativeTE'), thicknessSlopeSeries, teDetail("z'_t"));

        const camberSeries = comparisonSeries(analysisToggles.camber, exactCamber, linearCamber, nonlinearCamber);
        drawAxesAndSeries(get('svgCamber'), camberSeries, { xMin: 0, xMax: 1, xlabel: 'x/c', ylabel: 'z_c/c', height: 320 });
        drawAxesAndSeries(get('svgCamberLE'), camberSeries, leDetail('z_c/c'));
        drawAxesAndSeries(get('svgCamberTE'), camberSeries, teDetail('z_c/c'));
        const camberSlopeSeries = comparisonSeries(analysisToggles.camber, exactCamberSlope, linearCamberSlope, nonlinearCamberSlope);
        drawAxesAndSeries(get('svgCamberDerivative'), camberSlopeSeries, { xMin: 0, xMax: 1, xlabel: 'x/c', ylabel: "z'_c", height: 320 });
        drawAxesAndSeries(get('svgCamberDerivativeLE'), camberSlopeSeries, leDetail("z'_c"));
        drawAxesAndSeries(get('svgCamberDerivativeTE'), camberSlopeSeries, teDetail("z'_c"));
        const etaContainer = get('etaCoefficients');
        const betaContainer = get('betaCoefficients');
        const geometryContainer = get('geometricQuantities');
        const aeroContainer = get('aeroQuantities');
        if (etaContainer) etaContainer.innerHTML = coefficientTableMarkup('η', latest.coefficients.eta, lang);
        if (betaContainer) betaContainer.innerHTML = coefficientTableMarkup('β', latest.coefficients.beta, lang);
        if (geometryContainer) geometryContainer.innerHTML = geometricQuantityTableMarkup(latest.summary, lang);
        if (aeroContainer) aeroContainer.innerHTML = aerodynamicQuantityTableMarkup(latest.summary, lang);
        const aerodynamicSeriesFor = quantity => {
          const exactData = nacaExact ? aerodynamicCurveData(nacaExact.summary.aerodynamic, quantity) : null;
          return comparisonSeries(
            analysisToggles.aerodynamic,
            exactData,
            aerodynamicCurveData(latest.summary.aerodynamic.linear, quantity),
            aerodynamicCurveData(latest.summary.aerodynamic.nonlinear, quantity)
          );
        };
        drawAxesAndSeries(get('svgAeroLift'), aerodynamicSeriesFor('lift'), { xMin: -10, xMax: 50, xlabel: 'α (deg)', ylabel: 'C_l', height: 260, includeZeroY: true });
        drawAxesAndSeries(get('svgAeroMoment'), aerodynamicSeriesFor('moment'), { xMin: -10, xMax: 50, xlabel: 'α (deg)', ylabel: 'C_m,c/4', height: 260, includeZeroY: true });
        drawReconstructionPlot();
      } catch (error) {
        latest = null;
        updateExactLegend(false);
        if (summary) summary.innerHTML = `<div class="result-item warning"><div class="result-label">${lang === 'en' ? 'Error' : 'Erro'}</div><div class="result-value muted">${error.message}</div></div>`;
        console.error(error);
      } finally {
        rendering = false;
      }
    }

    async function runWithProgress() {
      if (rendering || !runBtn) return;
      const idleLabel = lang === 'en' ? 'Run' : 'Executar';
      runBtn.disabled = true;
      runBtn.textContent = lang === 'en' ? 'Running…' : 'Executando…';
      if (progress && progressFill) {
        progress.hidden = false;
        progress.setAttribute('aria-hidden', 'false');
        progress.setAttribute('aria-valuenow', '8');
        progressFill.style.width = '8%';
      }
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (progress && progressFill) {
        progress.setAttribute('aria-valuenow', '68');
        progressFill.style.width = '68%';
      }
      await new Promise(resolve => setTimeout(resolve, 30));
      render();
      if (progress && progressFill) {
        progress.setAttribute('aria-valuenow', '100');
        progressFill.style.width = '100%';
        await new Promise(resolve => setTimeout(resolve, 180));
        progress.hidden = true;
        progress.setAttribute('aria-hidden', 'true');
      }
      runBtn.disabled = false;
      runBtn.textContent = idleLabel;
    }

    runBtn?.addEventListener('click', runWithProgress);
    samplesInput?.addEventListener('change', render);
    etaOrderInput?.addEventListener('change', render);
    betaOrderInput?.addEventListener('change', render);
    zeroTeThicknessInput?.addEventListener('change', render);
    Object.values(geometryToggles).forEach(element => element?.addEventListener('change', render));
    Object.values(reconstructionToggles).forEach(element => element?.addEventListener('change', () => drawReconstructionPlot()));
    Object.values(analysisToggles).flatMap(group => Object.values(group)).forEach(element => element?.addEventListener('change', render));
    presetSelect?.addEventListener('change', updateCoordinatesFromPreset);
    Object.values(nacaInputs).forEach(input => input?.addEventListener('input', () => {
      if (presetSelect?.value === 'NACA4') updateCoordinatesFromPreset();
    }));
    get('downloadBtn')?.addEventListener('click', () => { if (!latest) render(); if (latest) downloadText(toCsv(latest), 'unsaero_cubic_spline_geometric_decomposition.csv'); });
    window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(render, 120); });
    global.__unsaeroToolRenders = global.__unsaeroToolRenders || {};
    global.__unsaeroToolRenders[lang] = render;
    render();
  }

  function initialize() {
    const defaultAirfoil = `# NACA 2412 generated preset\n# surface_nodes=40\nNACA 2412\n${generateNaca4SurfaceNodes('2412', 40)}`;
    for (const id of ['points-input', 'points-input-pt']) {
      const textarea = document.getElementById(id);
      if (textarea && !textarea.value.trim()) textarea.value = defaultAirfoil;
    }
    for (const id of ['airfoil-preset-input', 'airfoil-preset-input-pt']) {
      const select = document.getElementById(id);
      if (select && !select.value) select.value = 'NACA4';
    }
    wireTool({
      textarea: 'points-input',
      preset: 'airfoil-preset-input',
      nacaFields: 'naca4-fields',
      nacaMaxCamber: 'naca-max-camber-input',
      nacaCamberLocation: 'naca-camber-location-input',
      nacaThickness: 'naca-thickness-input',
      nacaSurfaceNodes: 'naca-surface-nodes-input',
      samples: 'samples-input',
      etaOrder: 'eta-order-input',
      betaOrder: 'beta-order-input',
      zeroTeThickness: 'zero-te-thickness-input',
      runBtn: 'run-btn',
      progress: 'run-progress',
      progressFill: 'run-progress-fill',
      svgGeom: 'plot-geom',
      svgGeomLE: 'plot-geom-le',
      svgGeomTE: 'plot-geom-te',
      svgThickness: 'plot-thickness',
      svgThicknessLE: 'plot-thickness-le',
      svgThicknessTE: 'plot-thickness-te',
      svgThicknessDerivative: 'plot-thickness-derivative',
      svgThicknessDerivativeLE: 'plot-thickness-derivative-le',
      svgThicknessDerivativeTE: 'plot-thickness-derivative-te',
      svgCamber: 'plot-camber',
      svgCamberLE: 'plot-camber-le',
      svgCamberTE: 'plot-camber-te',
      svgCamberDerivative: 'plot-camber-derivative',
      svgCamberDerivativeLE: 'plot-camber-derivative-le',
      svgCamberDerivativeTE: 'plot-camber-derivative-te',
      svgReconstruction: 'plot-reconstruction',
      svgReconstructionLE: 'plot-reconstruction-le',
      svgReconstructionTE: 'plot-reconstruction-te',
      etaCoefficients: 'eta-coefficients',
      betaCoefficients: 'beta-coefficients',
      geometricQuantities: 'geometric-quantities',
      aeroQuantities: 'aero-quantities',
      svgAeroLift: 'plot-aero-cl',
      svgAeroMoment: 'plot-aero-cm',
      summaryCards: 'summary-cards',
      togglePoints: 'toggle-points',
      toggleSurface: 'toggle-surface',
      toggleChord: 'toggle-chord',
      toggleReconstructionPoints: 'toggle-reconstruction-points',
      toggleReconstructionCamber: 'toggle-reconstruction-camber',
      toggleReconstructionSurface: 'toggle-reconstruction-surface',
      toggleReconstructionChord: 'toggle-reconstruction-chord',
      toggleCamberExact: 'toggle-camber-exact',
      toggleCamberLinear: 'toggle-camber-linear',
      toggleCamberNonlinear: 'toggle-camber-nonlinear',
      toggleThicknessExact: 'toggle-thickness-exact',
      toggleThicknessLinear: 'toggle-thickness-linear',
      toggleThicknessNonlinear: 'toggle-thickness-nonlinear',
      toggleAeroExact: 'toggle-aero-exact',
      toggleAeroLinear: 'toggle-aero-linear',
      toggleAeroNonlinear: 'toggle-aero-nonlinear',
      downloadBtn: 'download-data-btn'
    }, 'en');
    wireTool({
      textarea: 'points-input-pt',
      preset: 'airfoil-preset-input-pt',
      nacaFields: 'naca4-fields-pt',
      nacaMaxCamber: 'naca-max-camber-input-pt',
      nacaCamberLocation: 'naca-camber-location-input-pt',
      nacaThickness: 'naca-thickness-input-pt',
      nacaSurfaceNodes: 'naca-surface-nodes-input-pt',
      samples: 'samples-input-pt',
      etaOrder: 'eta-order-input-pt',
      betaOrder: 'beta-order-input-pt',
      zeroTeThickness: 'zero-te-thickness-input-pt',
      runBtn: 'run-btn-pt',
      progress: 'run-progress-pt',
      progressFill: 'run-progress-fill-pt',
      svgGeom: 'plot-geom-pt',
      svgGeomLE: 'plot-geom-le-pt',
      svgGeomTE: 'plot-geom-te-pt',
      svgThickness: 'plot-thickness-pt',
      svgThicknessLE: 'plot-thickness-le-pt',
      svgThicknessTE: 'plot-thickness-te-pt',
      svgThicknessDerivative: 'plot-thickness-derivative-pt',
      svgThicknessDerivativeLE: 'plot-thickness-derivative-le-pt',
      svgThicknessDerivativeTE: 'plot-thickness-derivative-te-pt',
      svgCamber: 'plot-camber-pt',
      svgCamberLE: 'plot-camber-le-pt',
      svgCamberTE: 'plot-camber-te-pt',
      svgCamberDerivative: 'plot-camber-derivative-pt',
      svgCamberDerivativeLE: 'plot-camber-derivative-le-pt',
      svgCamberDerivativeTE: 'plot-camber-derivative-te-pt',
      svgReconstruction: 'plot-reconstruction-pt',
      svgReconstructionLE: 'plot-reconstruction-le-pt',
      svgReconstructionTE: 'plot-reconstruction-te-pt',
      etaCoefficients: 'eta-coefficients-pt',
      betaCoefficients: 'beta-coefficients-pt',
      geometricQuantities: 'geometric-quantities-pt',
      aeroQuantities: 'aero-quantities-pt',
      svgAeroLift: 'plot-aero-cl-pt',
      svgAeroMoment: 'plot-aero-cm-pt',
      summaryCards: 'summary-cards-pt',
      togglePoints: 'toggle-points-pt',
      toggleSurface: 'toggle-surface-pt',
      toggleChord: 'toggle-chord-pt',
      toggleReconstructionPoints: 'toggle-reconstruction-points-pt',
      toggleReconstructionCamber: 'toggle-reconstruction-camber-pt',
      toggleReconstructionSurface: 'toggle-reconstruction-surface-pt',
      toggleReconstructionChord: 'toggle-reconstruction-chord-pt',
      toggleCamberExact: 'toggle-camber-exact-pt',
      toggleCamberLinear: 'toggle-camber-linear-pt',
      toggleCamberNonlinear: 'toggle-camber-nonlinear-pt',
      toggleThicknessExact: 'toggle-thickness-exact-pt',
      toggleThicknessLinear: 'toggle-thickness-linear-pt',
      toggleThicknessNonlinear: 'toggle-thickness-nonlinear-pt',
      toggleAeroExact: 'toggle-aero-exact-pt',
      toggleAeroLinear: 'toggle-aero-linear-pt',
      toggleAeroNonlinear: 'toggle-aero-nonlinear-pt',
      downloadBtn: 'download-data-btn-pt'
    }, 'pt');
    installCollapsiblePanels();
  }

  function installCollapsiblePanels() {
    document.querySelectorAll('.tool-panel').forEach((panel, index) => {
      if (panel.querySelector(':scope > .panel-collapse-btn')) return;
      const heading = panel.querySelector(':scope > .visual-header') || panel.querySelector(':scope > h2');
      if (!heading) return;
      const content = document.createElement('div');
      content.className = 'collapsible-content';
      const children = Array.from(panel.children).filter(child => child !== heading);
      children.forEach(child => content.appendChild(child));
      const button = document.createElement('button');
      const portuguese = Boolean(panel.closest('#content-pt'));
      button.type = 'button';
      button.className = 'panel-collapse-btn';
      button.setAttribute('aria-expanded', 'true');
      button.setAttribute('aria-controls', 'geometric-panel-content-' + index);
      content.id = 'geometric-panel-content-' + index;
      button.innerHTML = `<span>${portuguese ? 'Recolher' : 'Collapse'}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg>`;
      button.addEventListener('click', () => {
        const expanded = button.getAttribute('aria-expanded') === 'true';
        button.setAttribute('aria-expanded', String(!expanded));
        content.hidden = expanded;
        panel.classList.toggle('is-collapsed', expanded);
        button.querySelector('span').textContent = expanded ? (portuguese ? 'Expandir' : 'Expand') : (portuguese ? 'Recolher' : 'Collapse');
        if (!expanded) {
          const lang = portuguese ? 'pt' : 'en';
          global.__unsaeroToolRenders?.[lang]?.();
        }
      });
      panel.appendChild(content);
      panel.appendChild(button);
    });
  }

  global.syncGeometricToolState = function (fromLang, toLang) {
    const suffix = lang => lang === 'pt' ? '-pt' : '';
    const from = suffix(fromLang);
    const to = suffix(toLang);
    for (const base of ['points-input', 'airfoil-preset-input', 'naca-max-camber-input', 'naca-camber-location-input', 'naca-thickness-input', 'naca-surface-nodes-input', 'samples-input', 'eta-order-input', 'beta-order-input']) {
      const source = document.getElementById(`${base}${from}`);
      const target = document.getElementById(`${base}${to}`);
      if (source && target) target.value = source.value;
    }
    for (const base of ['toggle-points', 'toggle-surface', 'toggle-chord', 'toggle-reconstruction-points', 'toggle-reconstruction-camber', 'toggle-reconstruction-surface', 'toggle-reconstruction-chord', 'toggle-camber-exact', 'toggle-camber-linear', 'toggle-camber-nonlinear', 'toggle-thickness-exact', 'toggle-thickness-linear', 'toggle-thickness-nonlinear', 'toggle-aero-exact', 'toggle-aero-linear', 'toggle-aero-nonlinear', 'zero-te-thickness-input']) {
      const source = document.getElementById(`${base}${from}`);
      const target = document.getElementById(`${base}${to}`);
      if (source && target) target.checked = source.checked;
    }
    global.__unsaeroToolRenders?.[toLang]?.();
  };

  function naca4SurfacePoint(digits, x) {
    const m = Number(digits[0]) / 100;
    const p = Number(digits[1]) / 10;
    const t = Number(digits.slice(2)) / 100;
    const yt = 5 * t * (0.2969 * Math.sqrt(x) - 0.1260 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1015 * x ** 4);
    let yc = 0, dy = 0;
    if (m > 0 && p > 0) {
      if (x < p) { yc = m / (p * p) * (2 * p * x - x * x); dy = 2 * m / (p * p) * (p - x); }
      else { yc = m / ((1 - p) ** 2) * ((1 - 2 * p) + 2 * p * x - x * x); dy = 2 * m / ((1 - p) ** 2) * (p - x); }
    }
    const theta = Math.atan(dy);
    return {
      upper: { x: x - yt * Math.sin(theta), y: yc + yt * Math.cos(theta) },
      lower: { x: x + yt * Math.sin(theta), y: yc - yt * Math.cos(theta) }
    };
  }

  function cosineSurfacePoints(count, digits, side) {
    return Array.from({ length: count }, (_, i) => {
      const beta = Math.PI * i / (count - 1);
      const x = 0.5 * (1 - Math.cos(beta));
      return side(naca4SurfacePoint(digits, x));
    });
  }

  function generateNaca4Contour(code, upperCount, lowerCount) {
    const digits = String(code).padStart(4, '0');
    const upper = cosineSurfacePoints(upperCount, digits, result => result.upper);
    const lower = cosineSurfacePoints(lowerCount, digits, result => result.lower);
    const contour = upper.slice().reverse().concat(lower.slice(1));
    return contour.map(point => `${point.x.toFixed(9)} ${point.y.toFixed(9)}`).join('\n');
  }

  function generateNaca4(code, pointsPerSurface = 121) {
    const sideNodes = Math.max(2, Math.floor(Number(pointsPerSurface) || 121));
    return generateNaca4Contour(code, sideNodes, sideNodes);
  }

  function generateNaca4SurfaceNodes(code, surfaceNodes = 60) {
    const totalNodes = Math.max(8, Math.min(401, Math.floor(Number(surfaceNodes) || 60)));
    const upperCount = Math.ceil((totalNodes + 1) / 2);
    const lowerCount = totalNodes - upperCount + 1;
    return generateNaca4Contour(code, upperCount, lowerCount);
  }

  global.UNSAEROFdmb = { runExtraction, generateNaca4, generateNaca4SurfaceNodes, naca4ExactAnalysis, normalizeAndOrderContour, buildParametricSpline, extractLinear, extractNonlinear, toCsv };
  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', initialize);
})(typeof window !== 'undefined' ? window : globalThis);
