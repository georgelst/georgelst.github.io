(function (global) {
  'use strict';

  const EPS = 1e-12;
  const RED2_COLOR = '#ef4444';
  const LINEAR_COLOR = '#dc2626';
  const NONLINEAR_COLOR = '#2563eb';

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

  function normalizeAndOrderContour(rawPoints) {
    // Determine the chord independently of translation/rotation, then order TE-upper → LE → TE-lower.
    const points = removeConsecutiveDuplicates(rawPoints);
    if (points.length < 8) throw new Error('Insufficient unique contour points.');
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
    let normalized = points.map(p => ({
      x: ((p.x - le.x) * ex.x + (p.y - le.y) * ex.y) / chord,
      y: ((p.x - le.x) * ey.x + (p.y - le.y) * ey.y) / chord
    }));

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
    return { points: normalized, leIndex, chord, origin: le, axes: { ex, ey } };
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

  function finiteDifferenceSlopes(values, dx) {
    const n = values.length;
    const slopes = new Array(n);
    slopes[0] = (4 * values[1] - values[2] - 3 * values[0]) / (2 * dx);
    for (let i = 1; i < n - 1; i++) slopes[i] = (values[i + 1] - values[i - 1]) / (2 * dx);
    slopes[n - 1] = (3 * values[n - 1] - 4 * values[n - 2] + values[n - 3]) / (2 * dx);
    return slopes;
  }

  function extractLinear(curve, sLE, stationCount) {
    const count = Math.max(30, Math.min(Number(stationCount) || 60, 100));
    const rows = [];
    const upperS = new Array(count);
    const lowerS = new Array(count);
    for (let i = 0; i < count; i++) {
      const x = i / (count - 1);
      let upper;
      let lower;
      if (i === 0) {
        upper = lower = { s: sLE, ...curve.evaluate(sLE) };
      } else if (i === count - 1) {
        upper = { s: 0, ...curve.evaluate(0) };
        lower = { s: 1, ...curve.evaluate(1) };
      } else {
        upper = intersectNormal(curve, [0, sLE], x, 0, 0, 1 - x);
        lower = intersectNormal(curve, [sLE, 1], x, 0, 0, sLE + x * (1 - sLE));
      }
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

    const slopes = finiteDifferenceSlopes(y, dx);
    const rows = [];
    let finalNorm2 = 0;
    let maxReconstructionError = 0;
    for (let i = 0; i < count; i++) {
      const upper = i === 0 ? { s: sLE, ...curve.evaluate(sLE) }
        : i === count - 1 ? { s: 0, ...curve.evaluate(0) }
          : intersectNormal(curve, [0, sLE], x[i], y[i], slopes[i], upperS[i]);
      const lower = i === 0 ? { s: sLE, ...curve.evaluate(sLE) }
        : i === count - 1 ? { s: 1, ...curve.evaluate(1) }
          : intersectNormal(curve, [sLE, 1], x[i], y[i], slopes[i], lowerS[i]);
      const midpointResidual = upper.point.y + lower.point.y - 2 * y[i];
      if (i > 0 && i < count - 1) finalNorm2 += midpointResidual * midpointResidual;
      let thickness = 0.5 * Math.hypot(upper.point.x - lower.point.x, upper.point.y - lower.point.y);
      const inverseNorm = 1 / Math.sqrt(1 + slopes[i] * slopes[i]);
      const normal = { x: -slopes[i] * inverseNorm, y: inverseNorm };
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
        slope: slopes[i],
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
    const linearCamberSlopes = finiteDifferenceSlopes(rows.map(row => row.linearCamber), dx);
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
    const scaled = x * (rows.length - 1);
    const index = Math.min(rows.length - 2, Math.floor(scaled));
    const fraction = scaled - index;
    return accessor(rows[index]) * (1 - fraction) + accessor(rows[index + 1]) * fraction;
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
    const zeroLiftAngle = eta0 - eta1;
    return {
      zeroLiftAngle,
      zeroLiftAngleDegrees: zeroLiftAngle * 180 / Math.PI,
      quarterChordMoment: 0.5 * Math.PI * (eta2 - eta1)
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
      const denominator = ym - 2 * y0 + yp;
      if (Math.abs(denominator) > 1e-14) {
        const offset = Math.max(-1, Math.min(1, 0.5 * (ym - yp) / denominator));
        const dx = rows[1].x - rows[0].x;
        x += offset * dx;
        const magnitude = y0 - 0.25 * (ym - yp) * offset;
        value = absolute ? Math.sign(value || 1) * magnitude : magnitude;
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
    let sLE = findLeadingEdge(curve, curve.parameters[prepared.leIndex], 0.08);
    // Re-evaluate the spline LE after each chord transformation. A few fixed-point
    // passes remove the tiny LE offset that otherwise remains on cambered sections.
    for (let pass = 0; pass < 3; pass++) {
      const normalized = normalizeSplineChord(prepared, curve, sLE);
      curve = normalized.curve;
      sLE = normalized.sLE;
    }
    const linear = extractLinear(curve, sLE, options.stations);
    const zeroTeThickness = optionEnabled(options.zeroTeThickness);
    const nonlinear = extractNonlinear(curve, sLE, linear, options.tolerance || 1e-10, { zeroTeThickness });
    const etaOrder = Math.max(1, Math.min(Number(options.etaOrder) || 6, 20));
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
    const ticks = width < 430 ? 4 : 5;
    const grid = make('g', { stroke: '#e2e8f0', 'stroke-width': 1 });
    for (let i = 0; i <= ticks; i++) {
      const gx = left + i * (width - left - right) / ticks;
      const gy = top + i * (height - top - bottom) / ticks;
      grid.appendChild(make('line', { x1: gx, y1: top, x2: gx, y2: height - bottom }));
      grid.appendChild(make('line', { x1: left, y1: gy, x2: width - right, y2: gy }));
    }
    svg.appendChild(grid);
    const labels = make('g', { fill: '#475569', 'font-size': width < 430 ? 11 : 12, 'font-family': 'Segoe UI, sans-serif' });
    for (let i = 0; i <= ticks; i++) {
      const xv = xMin + i * (xMax - xMin) / ticks;
      const yv = yMax - i * (yMax - yMin) / ticks;
      const tx = make('text', { x: left + i * (width - left - right) / ticks, y: height - bottom + 20, 'text-anchor': 'middle' });
      tx.textContent = smartTick(xv, xMax - xMin);
      labels.appendChild(tx);
      const ty = make('text', { x: left - 8, y: top + i * (height - top - bottom) / ticks + 4, 'text-anchor': 'end' });
      ty.textContent = smartTick(yv, yMax - yMin);
      labels.appendChild(ty);
    }
    const xLabel = make('text', { x: (left + width - right) / 2, y: height - 10, 'text-anchor': 'middle', fill: '#0f172a', 'font-weight': 700 });
    xLabel.textContent = options.xlabel || 'x';
    labels.appendChild(xLabel);
    const yLabel = make('text', { x: 16, y: (top + height - bottom) / 2, transform: `rotate(-90 16 ${(top + height - bottom) / 2})`, 'text-anchor': 'middle', fill: '#0f172a', 'font-weight': 700 });
    yLabel.textContent = options.ylabel || 'y';
    labels.appendChild(yLabel);
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
    const metadata = [
      '# surface_fit=parametric_natural_cubic_spline',
      '# nonlinear_method=normal_midpoint_iteration',
      `# initial_camber_model=z_c=x(1-x)(a+b*x)`,
      `# initial_camber_coefficients=${s.initialCubicCoefficients.map(value => value.toExponential(8)).join(',')}`,
      `# leading_edge_radius=${s.leadingEdgeRadius.toExponential(8)}`,
      `# alpha_zero_lift_linear_rad=${s.aerodynamic.linear.zeroLiftAngle.toExponential(8)}`,
      `# alpha_zero_lift_nonlinear_rad=${s.aerodynamic.nonlinear.zeroLiftAngle.toExponential(8)}`,
      `# cm_quarter_chord_linear=${s.aerodynamic.linear.quarterChordMoment.toExponential(8)}`,
      `# cm_quarter_chord_nonlinear=${s.aerodynamic.nonlinear.quarterChordMoment.toExponential(8)}`,
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
    const header = 'x_c;z_c_linear;dz_c_linear_dx;z_t_linear_vertical;dz_t_linear_dx;z_c_initial_cubic;z_c_nonlinear;dz_c_nonlinear_dx;z_t_nonlinear_normal;dz_t_nonlinear_dx;x_upper;z_upper;x_lower;z_lower';
    const body = result.rows.map(row => [row.x, row.linearCamber, row.linearCamberSlope, row.linearThickness, row.linearThicknessSlope, row.initialCamber, row.ycamber, row.slope, row.thickness, row.thicknessSlope, row.xu, row.yu, row.xl, row.yl].map(value => Number(value).toPrecision(12)).join(';'));
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
    ].map(value => Number(value).toPrecision(12)).join(';'));
    return '\ufeffsep=;\n' + metadata.concat(header, body, '', reconstructionHeader, reconstructionBody).join('\n');
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
    const body = rows.map(([quantity, linear, nonlinear]) => `<tr><th scope="row">${quantity}</th><td>${linear}</td><td>${nonlinear}</td></tr>`).join('');
    return `<div class="coefficient-table-wrap"><table class="coefficient-table"><thead><tr><th>${lang === 'en' ? 'Quantity' : 'Grandeza'}</th><th>Linear</th><th>${lang === 'en' ? 'Nonlinear' : 'Não linear'}</th></tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function geometricQuantityTableMarkup(summary, lang) {
    const linearGeometry = summary.geometric.linear;
    const nonlinearGeometry = summary.geometric.nonlinear;
    const linearEdge = summary.edge.linear;
    const nonlinearEdge = summary.edge.nonlinear;
    const percentAt = (value, x) => `${(Math.abs(value) * 100).toFixed(3)}% @ x/c = ${x.toFixed(3)}`;
    const degrees = value => `${value.toFixed(3)}°`;
    const rows = lang === 'en' ? [
      ['Maximum camber', percentAt(linearGeometry.maxCamber, linearGeometry.xmaxCamber), percentAt(nonlinearGeometry.maxCamber, nonlinearGeometry.xmaxCamber)],
      ['Maximum thickness', percentAt(linearGeometry.maxThickness, linearGeometry.xmaxThickness), percentAt(nonlinearGeometry.maxThickness, nonlinearGeometry.xmaxThickness)],
      ['Leading-edge radius, r<sub>LE</sub>/c', `${(linearGeometry.leadingEdgeRadius * 100).toFixed(3)}%`, `${(nonlinearGeometry.leadingEdgeRadius * 100).toFixed(3)}%`],
      ['Leading-edge inclination', degrees(linearEdge.leadingEdgeInclinationDegrees), degrees(nonlinearEdge.leadingEdgeInclinationDegrees)],
      ['Trailing-edge angle', degrees(linearEdge.trailingEdgeAngleDegrees), degrees(nonlinearEdge.trailingEdgeAngleDegrees)],
      ['Trailing-edge inclination', degrees(linearEdge.trailingEdgeInclinationDegrees), degrees(nonlinearEdge.trailingEdgeInclinationDegrees)]
    ] : [
      ['Cambagem máxima', percentAt(linearGeometry.maxCamber, linearGeometry.xmaxCamber), percentAt(nonlinearGeometry.maxCamber, nonlinearGeometry.xmaxCamber)],
      ['Espessura máxima', percentAt(linearGeometry.maxThickness, linearGeometry.xmaxThickness), percentAt(nonlinearGeometry.maxThickness, nonlinearGeometry.xmaxThickness)],
      ['Raio do bordo de ataque, r<sub>BA</sub>/c', `${(linearGeometry.leadingEdgeRadius * 100).toFixed(3)}%`, `${(nonlinearGeometry.leadingEdgeRadius * 100).toFixed(3)}%`],
      ['Inclinação do bordo de ataque', degrees(linearEdge.leadingEdgeInclinationDegrees), degrees(nonlinearEdge.leadingEdgeInclinationDegrees)],
      ['Ângulo do bordo de fuga', degrees(linearEdge.trailingEdgeAngleDegrees), degrees(nonlinearEdge.trailingEdgeAngleDegrees)],
      ['Inclinação do bordo de fuga', degrees(linearEdge.trailingEdgeInclinationDegrees), degrees(nonlinearEdge.trailingEdgeInclinationDegrees)]
    ];
    return quantityTableMarkup(rows, lang);
  }

  function aerodynamicQuantityTableMarkup(summary, lang) {
    const linearAerodynamics = summary.aerodynamic.linear;
    const nonlinearAerodynamics = summary.aerodynamic.nonlinear;
    const rows = lang === 'en' ? [
      ['Zero-lift angle, α<sub>L=0</sub>', `${linearAerodynamics.zeroLiftAngleDegrees.toFixed(3)}°`, `${nonlinearAerodynamics.zeroLiftAngleDegrees.toFixed(3)}°`],
      ['Quarter-chord moment, C<sub>m,c/4</sub>', linearAerodynamics.quarterChordMoment.toFixed(5), nonlinearAerodynamics.quarterChordMoment.toFixed(5)]
    ] : [
      ['Ângulo de sustentação nula, α<sub>L=0</sub>', `${linearAerodynamics.zeroLiftAngleDegrees.toFixed(3)}°`, `${nonlinearAerodynamics.zeroLiftAngleDegrees.toFixed(3)}°`],
      ['Momento no quarto de corda, C<sub>m,c/4</sub>', linearAerodynamics.quarterChordMoment.toFixed(5), nonlinearAerodynamics.quarterChordMoment.toFixed(5)]
    ];
    return quantityTableMarkup(rows, lang);
  }

  function coefficientTableMarkup(symbol, coefficients, lang) {
    const rows = coefficients.linear.map((linear, n) => {
      const nonlinear = coefficients.nonlinear[n];
      return `<tr><th scope="row">${symbol}<sub>${n}</sub></th><td>${linear.toExponential(5)}</td><td>${nonlinear.toExponential(5)}</td></tr>`;
    }).join('');
    return `<div class="coefficient-table-wrap"><table class="coefficient-table"><thead><tr><th>${lang === 'en' ? 'Mode' : 'Modo'}</th><th>${lang === 'en' ? 'Linear' : 'Linear'}</th><th>${lang === 'en' ? 'Nonlinear' : 'Não linear'}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function wireTool(ids, lang) {
    const get = key => document.getElementById(ids[key]);
    const textarea = get('textarea');
    const presetSelect = get('preset');
    const samplesInput = get('samples');
    const etaOrderInput = get('etaOrder');
    const betaOrderInput = get('betaOrder');
    const summary = get('summaryCards');
    const runBtn = get('runBtn');
    const progress = get('progress');
    const progressFill = get('progressFill');
    const geometryToggles = { points: get('togglePoints'), surface: get('toggleSurface') };
    const reconstructionToggles = { points: get('toggleReconstructionPoints'), camber: get('toggleReconstructionCamber'), surface: get('toggleReconstructionSurface') };
    const zeroTeThicknessInput = get('zeroTeThickness');
    const linearSeries = data => ({ type: 'line', data, color: LINEAR_COLOR, width: 1.25 });
    const nonlinearSeries = data => ({ type: 'line', data, color: NONLINEAR_COLOR, width: 2.2, dash: '7 5' });
    let latest = null;
    let rendering = false;
    let resizeTimer = null;

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
      if (reconstructionToggles.camber?.checked) reconstructionSeries.push(nonlinearSeries(displayedNonlinearCamber));
      if (reconstructionToggles.surface?.checked) reconstructionSeries.push({ type: 'line', data: reconstructedContour, color: '#000000', width: 2.2 });
      if (reconstructionToggles.points?.checked) reconstructionSeries.push({ type: 'points', data: latest.prepared.points, color: RED2_COLOR, radius: 2.45, opacity: 1, stroke: '#ffffff', strokeWidth: 0.8 });
      const visibleReconstructionSeries = reconstructionSeries.length ? reconstructionSeries : [
        { type: 'line', data: reconstructedContour, color: '#000000', width: 2.2 }
      ];
      const reconstructionOptions = { xlabel: 'x/c', ylabel: 'z/c', equalScale: true, yCenter: 0 };
      const detailOptions = { xlabel: 'x/c', ylabel: 'z/c', yMin: -0.06, yMax: 0.06, height: 265, squarePlot: true, squarePlotFitWidth: true };
      drawAxesAndSeries(get('svgReconstruction'), visibleReconstructionSeries, { ...reconstructionOptions, xMin: 0, xMax: 1, height: 350 });
      drawAxesAndSeries(get('svgReconstructionLE'), visibleReconstructionSeries, { ...detailOptions, xMin: 0, xMax: 0.12 });
      drawAxesAndSeries(get('svgReconstructionTE'), visibleReconstructionSeries, { ...detailOptions, xMin: 0.88, xMax: 1 });
      if (summary) summary.innerHTML = summaryMarkup(latest.summary, lang);
    }

    function render() {
      if (!textarea || rendering || !textarea.closest('.lang-content')?.classList.contains('active')) return;
      rendering = true;
      try {
        latest = runExtraction(textarea.value, { stations: samplesInput?.value, etaOrder: etaOrderInput?.value, betaOrder: betaOrderInput?.value, zeroTeThickness: zeroTeThicknessInput?.checked });
        const splineContour = latest.surfaceUpper.concat(latest.surfaceLower);
        const linearCamber = latest.rows.map(row => ({ x: row.x, y: row.linearCamber }));
        const nonlinearCamber = latest.rows.map(row => ({ x: row.x, y: row.ycamber }));
        const linearThickness = latest.rows.map(row => ({ x: row.x, y: row.linearThickness }));
        const nonlinearThickness = latest.rows.map(row => ({ x: row.x, y: row.thickness }));
        const linearThicknessSlope = latest.rows.map(row => ({ x: row.x, y: row.linearThicknessSlope }));
        const nonlinearThicknessSlope = latest.rows.map(row => ({ x: row.x, y: row.thicknessSlope }));
        const linearCamberSlope = latest.rows.map(row => ({ x: row.x, y: row.linearCamberSlope }));
        const nonlinearCamberSlope = latest.rows.map(row => ({ x: row.x, y: row.slope }));
        const geometry = [];
        if (geometryToggles.surface?.checked) geometry.push({ type: 'line', data: splineContour, color: '#000000', width: 2.1 });
        if (geometryToggles.points?.checked) geometry.push({ type: 'points', data: latest.prepared.points, color: RED2_COLOR, radius: 2.45, opacity: 1, stroke: '#ffffff', strokeWidth: 0.8 });
        drawAxesAndSeries(get('svgGeom'), geometry.length ? geometry : [{ type: 'line', data: splineContour, color: '#000000' }], { xMin: 0, xMax: 1, xlabel: 'x/c', ylabel: 'z/c', equalScale: true, yCenter: 0, height: 350 });
        const detailOptions = (xMin, xMax, ylabel, extra = {}) => ({ xMin, xMax, xlabel: 'x/c', ylabel, height: 245, ...extra });
        const leDetail = (ylabel, extra) => detailOptions(0, 0.12, ylabel, extra);
        const teDetail = (ylabel, extra) => detailOptions(0.88, 1, ylabel, extra);

        drawAxesAndSeries(get('svgThickness'), [
          linearSeries(linearThickness),
          nonlinearSeries(nonlinearThickness)
        ], { xMin: 0, xMax: 1, yMin: 0, xlabel: 'x/c', ylabel: 'z_t/c', height: 320 });
        drawAxesAndSeries(get('svgThicknessLE'), [
          linearSeries(linearThickness),
          nonlinearSeries(nonlinearThickness)
        ], leDetail('z_t/c', { yMin: 0 }));
        drawAxesAndSeries(get('svgThicknessTE'), [
          linearSeries(linearThickness),
          nonlinearSeries(nonlinearThickness)
        ], teDetail('z_t/c', { yMin: 0 }));
        drawAxesAndSeries(get('svgThicknessDerivative'), [
          linearSeries(linearThicknessSlope),
          nonlinearSeries(nonlinearThicknessSlope)
        ], { xMin: 0, xMax: 1, xlabel: 'x/c', ylabel: "z'_t", height: 320 });
        drawAxesAndSeries(get('svgThicknessDerivativeLE'), [
          linearSeries(linearThicknessSlope),
          nonlinearSeries(nonlinearThicknessSlope)
        ], leDetail("z'_t"));
        drawAxesAndSeries(get('svgThicknessDerivativeTE'), [
          linearSeries(linearThicknessSlope),
          nonlinearSeries(nonlinearThicknessSlope)
        ], teDetail("z'_t"));

        drawAxesAndSeries(get('svgCamber'), [
          linearSeries(linearCamber),
          nonlinearSeries(nonlinearCamber)
        ], { xMin: 0, xMax: 1, xlabel: 'x/c', ylabel: 'z_c/c', height: 320 });
        drawAxesAndSeries(get('svgCamberLE'), [
          linearSeries(linearCamber),
          nonlinearSeries(nonlinearCamber)
        ], leDetail('z_c/c'));
        drawAxesAndSeries(get('svgCamberTE'), [
          linearSeries(linearCamber),
          nonlinearSeries(nonlinearCamber)
        ], teDetail('z_c/c'));
        drawAxesAndSeries(get('svgCamberDerivative'), [
          linearSeries(linearCamberSlope),
          nonlinearSeries(nonlinearCamberSlope)
        ], { xMin: 0, xMax: 1, xlabel: 'x/c', ylabel: "z'_c", height: 320 });
        drawAxesAndSeries(get('svgCamberDerivativeLE'), [
          linearSeries(linearCamberSlope),
          nonlinearSeries(nonlinearCamberSlope)
        ], leDetail("z'_c"));
        drawAxesAndSeries(get('svgCamberDerivativeTE'), [
          linearSeries(linearCamberSlope),
          nonlinearSeries(nonlinearCamberSlope)
        ], teDetail("z'_c"));
        const etaContainer = get('etaCoefficients');
        const betaContainer = get('betaCoefficients');
        const geometryContainer = get('geometricQuantities');
        const aeroContainer = get('aeroQuantities');
        if (etaContainer) etaContainer.innerHTML = coefficientTableMarkup('η', latest.coefficients.eta, lang);
        if (betaContainer) betaContainer.innerHTML = coefficientTableMarkup('β', latest.coefficients.beta, lang);
        if (geometryContainer) geometryContainer.innerHTML = geometricQuantityTableMarkup(latest.summary, lang);
        if (aeroContainer) aeroContainer.innerHTML = aerodynamicQuantityTableMarkup(latest.summary, lang);
        drawReconstructionPlot();
      } catch (error) {
        latest = null;
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
    presetSelect?.addEventListener('change', () => {
      const preset = global.AIRFOIL_PRESET_DATA?.[presetSelect.value];
      if (preset?.data && textarea) textarea.value = preset.data;
    });
    get('sampleBtn')?.addEventListener('click', () => {
      const key = presetSelect?.value || 'S1223';
      const preset = global.AIRFOIL_PRESET_DATA?.[key];
      if (textarea) textarea.value = preset?.data || global.AIRFOIL_PRESET_DATA?.S1223?.data || global.SD7003_SAMPLE_DATA || '';
      render();
    });
    get('downloadBtn')?.addEventListener('click', () => { if (!latest) render(); if (latest) downloadText(toCsv(latest), 'unsaero_cubic_spline_geometric_decomposition.csv'); });
    window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(render, 120); });
    global.__unsaeroToolRenders = global.__unsaeroToolRenders || {};
    global.__unsaeroToolRenders[lang] = render;
    render();
  }

  function initialize() {
    const defaultAirfoil = global.AIRFOIL_PRESET_DATA?.S1223?.data || global.S1223_SAMPLE_DATA || global.SD7003_SAMPLE_DATA || '';
    for (const id of ['points-input', 'points-input-pt']) {
      const textarea = document.getElementById(id);
      if (textarea && !textarea.value.trim()) textarea.value = defaultAirfoil;
    }
    for (const id of ['airfoil-preset-input', 'airfoil-preset-input-pt']) {
      const select = document.getElementById(id);
      if (select && !select.value) select.value = 'S1223';
    }
    wireTool({ textarea: 'points-input', preset: 'airfoil-preset-input', samples: 'samples-input', etaOrder: 'eta-order-input', betaOrder: 'beta-order-input', zeroTeThickness: 'zero-te-thickness-input', runBtn: 'run-btn', sampleBtn: 'sample-btn', progress: 'run-progress', progressFill: 'run-progress-fill', svgGeom: 'plot-geom', svgThickness: 'plot-thickness', svgThicknessLE: 'plot-thickness-le', svgThicknessTE: 'plot-thickness-te', svgThicknessDerivative: 'plot-thickness-derivative', svgThicknessDerivativeLE: 'plot-thickness-derivative-le', svgThicknessDerivativeTE: 'plot-thickness-derivative-te', svgCamber: 'plot-camber', svgCamberLE: 'plot-camber-le', svgCamberTE: 'plot-camber-te', svgCamberDerivative: 'plot-camber-derivative', svgCamberDerivativeLE: 'plot-camber-derivative-le', svgCamberDerivativeTE: 'plot-camber-derivative-te', svgReconstruction: 'plot-reconstruction', svgReconstructionLE: 'plot-reconstruction-le', svgReconstructionTE: 'plot-reconstruction-te', etaCoefficients: 'eta-coefficients', betaCoefficients: 'beta-coefficients', geometricQuantities: 'geometric-quantities', aeroQuantities: 'aero-quantities', summaryCards: 'summary-cards', togglePoints: 'toggle-points', toggleSurface: 'toggle-surface', toggleReconstructionPoints: 'toggle-reconstruction-points', toggleReconstructionCamber: 'toggle-reconstruction-camber', toggleReconstructionSurface: 'toggle-reconstruction-surface', downloadBtn: 'download-data-btn' }, 'en');
    wireTool({ textarea: 'points-input-pt', preset: 'airfoil-preset-input-pt', samples: 'samples-input-pt', etaOrder: 'eta-order-input-pt', betaOrder: 'beta-order-input-pt', zeroTeThickness: 'zero-te-thickness-input-pt', runBtn: 'run-btn-pt', sampleBtn: 'sample-btn-pt', progress: 'run-progress-pt', progressFill: 'run-progress-fill-pt', svgGeom: 'plot-geom-pt', svgThickness: 'plot-thickness-pt', svgThicknessLE: 'plot-thickness-le-pt', svgThicknessTE: 'plot-thickness-te-pt', svgThicknessDerivative: 'plot-thickness-derivative-pt', svgThicknessDerivativeLE: 'plot-thickness-derivative-le-pt', svgThicknessDerivativeTE: 'plot-thickness-derivative-te-pt', svgCamber: 'plot-camber-pt', svgCamberLE: 'plot-camber-le-pt', svgCamberTE: 'plot-camber-te-pt', svgCamberDerivative: 'plot-camber-derivative-pt', svgCamberDerivativeLE: 'plot-camber-derivative-le-pt', svgCamberDerivativeTE: 'plot-camber-derivative-te-pt', svgReconstruction: 'plot-reconstruction-pt', svgReconstructionLE: 'plot-reconstruction-le-pt', svgReconstructionTE: 'plot-reconstruction-te-pt', etaCoefficients: 'eta-coefficients-pt', betaCoefficients: 'beta-coefficients-pt', geometricQuantities: 'geometric-quantities-pt', aeroQuantities: 'aero-quantities-pt', summaryCards: 'summary-cards-pt', togglePoints: 'toggle-points-pt', toggleSurface: 'toggle-surface-pt', toggleReconstructionPoints: 'toggle-reconstruction-points-pt', toggleReconstructionCamber: 'toggle-reconstruction-camber-pt', toggleReconstructionSurface: 'toggle-reconstruction-surface-pt', downloadBtn: 'download-data-btn-pt' }, 'pt');
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
    for (const base of ['points-input', 'airfoil-preset-input', 'samples-input', 'eta-order-input', 'beta-order-input']) {
      const source = document.getElementById(`${base}${from}`);
      const target = document.getElementById(`${base}${to}`);
      if (source && target) target.value = source.value;
    }
    for (const base of ['toggle-points', 'toggle-surface', 'toggle-reconstruction-points', 'toggle-reconstruction-camber', 'toggle-reconstruction-surface', 'zero-te-thickness-input']) {
      const source = document.getElementById(`${base}${from}`);
      const target = document.getElementById(`${base}${to}`);
      if (source && target) target.checked = source.checked;
    }
    global.__unsaeroToolRenders?.[toLang]?.();
  };

  function generateNaca4(code, pointsPerSurface = 121) {
    const digits = String(code).padStart(4, '0');
    const m = Number(digits[0]) / 100;
    const p = Number(digits[1]) / 10;
    const t = Number(digits.slice(2)) / 100;
    const upper = [], lower = [];
    for (let i = 0; i < pointsPerSurface; i++) {
      const beta = Math.PI * i / (pointsPerSurface - 1);
      const x = 0.5 * (1 - Math.cos(beta));
      const yt = 5 * t * (0.2969 * Math.sqrt(x) - 0.1260 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1015 * x ** 4);
      let yc = 0, dy = 0;
      if (m > 0 && p > 0) {
        if (x < p) { yc = m / (p * p) * (2 * p * x - x * x); dy = 2 * m / (p * p) * (p - x); }
        else { yc = m / ((1 - p) ** 2) * ((1 - 2 * p) + 2 * p * x - x * x); dy = 2 * m / ((1 - p) ** 2) * (p - x); }
      }
      const theta = Math.atan(dy);
      upper.push({ x: x - yt * Math.sin(theta), y: yc + yt * Math.cos(theta) });
      lower.push({ x: x + yt * Math.sin(theta), y: yc - yt * Math.cos(theta) });
    }
    const contour = upper.slice().reverse().concat(lower.slice(1));
    return contour.map(point => `${point.x.toFixed(9)} ${point.y.toFixed(9)}`).join('\n');
  }

  global.UNSAEROFdmb = { runExtraction, generateNaca4, normalizeAndOrderContour, buildParametricSpline, extractLinear, extractNonlinear, toCsv };
  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', initialize);
})(typeof window !== 'undefined' ? window : globalThis);
