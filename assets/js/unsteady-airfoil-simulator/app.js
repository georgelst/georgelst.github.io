import { createZip, encodeMatFile, payloadToCsvEntries } from './export.js?v=uas-export-columns-20260704e';

const TRANSLATIONS = {
  en: {
    document_title: 'Unsteady Airfoil Simulator | UNSAERO',
    breadcrumb_tools: 'Tools', page_title: 'Unsteady Airfoil Simulator',
    hero_subtitle: 'Explore pitching and heaving thin-airfoil cases through wake-vortex animation and time-resolved aerodynamic loads.',
    run_case: 'Run case', simulator: 'Unsteady Airfoil Simulator (UAS)', inputs: 'Inputs',
    kinematics: 'Kinematics', kinematic_inputs: 'Kinematic inputs', airfoil: 'Airfoil', airfoil_sections: 'Airfoil sections',
    naca_4_digit: 'NACA 4-Digit', naca_max_camber: 'Maximum camber [%c]',
    naca_camber_location: 'Camber location [%c]', naca_thickness: 'Maximum thickness [%c]',
    camber_line: 'Camber', leading_edge_circle: 'LE radius',
    freestream: 'Freestream', chord: 'Chord',
    pitch_source: 'Pitch source',
    plunge_source: 'Plunge source',
    source_constant: 'Constant',
    source_sinusoidal: 'Sinusoidal',
    source_smooth_ramp: 'Smooth ramp',
    source_cosine_cycle: 'Asymmetric cosine',
    pitch_constant_value: 'Value [deg]',
    plunge_constant_value: 'H/c',
    frequency: 'f [Hz]',
    pitch_amplitude: 'Aα [deg]',
    plunge_amplitude: 'H/c',
    phase: 'φ [deg]',
    start_time: 't1 [s]',
    end_time: 't2 [s]',
    sharpness: 'as [1/s]',
    zeta: 'ζ',
    pitch_angle: 'pitch α',
    plunge: 'plunge h',
    pivot: 'Pivot', moment_reference: 'Moment ref.', fourier_terms: 'Fourier terms',
    time_step: 'Time step Δτ = 2UΔt/c', steps: 'Steps',
    run: 'Run', stop: 'Stop',
    flowfield: 'Flowfield', airfoil_lower: 'airfoil', wake_vortices: 'wake vortices',
    animation: 'Animation', play: 'Play', pause: 'Pause', auto_repeat: 'Auto repeat',
    frame: 'Frame', vortex_colors: 'Vortex colors',
    uniform: 'Uniform', edge: 'Edge', by_circulation: 'By circulation',
    trailing_edge: 'Trailing edge', leading_edge: 'Leading edge',
    circulation: 'Circulation', circulation_scale: 'Circulation scale',
    collapse: 'Collapse', expand: 'Expand',
    loads: 'Loads', circulation_history: 'Dimensionless Bound Circulation', stagnation_point_location: 'Stagnation-point location',
    fourier_coefficients: 'Fourier coefficients', coefficient_pair: 'Coefficient group',
    pitch_angle_history: 'Pitch angle', pitch_rate_history: 'Pitch rate',
    pitch_acceleration_history: 'Pitch acceleration', plunge_history: 'Plunge displacement',
    plunge_rate_history: 'Plunge rate', plunge_acceleration_history: 'Plunge acceleration',
    distributions: 'Distributions',
    export_data: 'Export Data',
    export_scope: 'Data scope', export_scope_all: 'All simulation data',
    export_scope_histories: 'Kinematics and loads', export_scope_flowfield: 'Flowfield and wake',
    export_scope_frame: 'Distributions', export_format: 'File format',
    export_format_mat: 'MATLAB structure (.mat) — recommended',
    export_format_csv: 'CSV bundle (.zip)', export_format_json: 'Structured JSON (.json)',
    export_action: 'Export data', export_frontend_note: 'Run a case to enable export.',
    export_working: 'Preparing export…',
    export_done: 'Export created.', export_error: 'Export failed: {message}',
    versus: 'vs',
    lift_coefficient: 'Lift Coefficient',
    drag_coefficient: 'Pressure Drag Coefficient',
    moment_coefficient: 'Moment Coefficient',
    suction_coefficient: 'Leading-Edge Suction Coefficient',
    pressure_distribution: 'Pressure Distribution',
    surface_velocity_distribution: 'Tangential Surface Velocity',
    upper_surface: 'Upper surface', lower_surface: 'Lower surface',
    distribution_unavailable: 'Distribution data unavailable. Run the case again.',
    status_ready: 'Ready.', status_running: 'Running...',
    status_running_progress: 'Running... {progress}%', status_stopped: 'Stopped.',
    status_done: 'Done.', status_error: 'Error: {message}',
    status_data_error: 'Failed to load data.',
    nav_home: 'Home', nav_teaching: 'Teaching', nav_research: 'Research',
    nav_tools: 'Tools', nav_contact: 'Contact',
    footer_rights: '© 2025–2026 UNSAERO. All rights reserved.'
  },
  pt: {
    document_title: 'Simulador de Aerofólio Não Estacionário | UNSAERO',
    breadcrumb_tools: 'Ferramentas', page_title: 'Simulador de Aerofólio Não Estacionário',
    hero_subtitle: 'Explore casos de aerofólios finos em arfagem e mergulho por meio da animação da esteira de vórtices e de cargas aerodinâmicas resolvidas no tempo.',
    run_case: 'Executar caso', simulator: 'Simulador de Aerofólio Não Estacionário (UAS)', inputs: 'Entradas',
    kinematics: 'Cinemática', kinematic_inputs: 'Entradas cinemáticas', airfoil: 'Aerofólio', airfoil_sections: 'Seções do aerofólio',
    naca_4_digit: 'NACA de 4 dígitos', naca_max_camber: 'Cambra máxima [%c]',
    naca_camber_location: 'Posição da cambra [%c]', naca_thickness: 'Espessura máxima [%c]',
    camber_line: 'Cambra', leading_edge_circle: 'Raio do BA',
    freestream: 'Escoamento livre', chord: 'Corda',
    pitch_source: 'Fonte da arfagem',
    plunge_source: 'Fonte do mergulho',
    source_constant: 'Constante',
    source_sinusoidal: 'Senoidal',
    source_smooth_ramp: 'Rampa suave',
    source_cosine_cycle: 'Cosseno assimétrico',
    pitch_constant_value: 'Valor [graus]',
    plunge_constant_value: 'H/c',
    frequency: 'f [Hz]',
    pitch_amplitude: 'Aα [graus]',
    plunge_amplitude: 'H/c',
    phase: 'φ [graus]',
    start_time: 't1 [s]',
    end_time: 't2 [s]',
    sharpness: 'as [1/s]',
    zeta: 'ζ',
    pitch_angle: 'arfagem α',
    plunge: 'mergulho h',
    pivot: 'Pivô', moment_reference: 'Ref. do momento', fourier_terms: 'Termos de Fourier',
    time_step: 'Passo de tempo Δτ = 2UΔt/c', steps: 'Passos',
    run: 'Executar', stop: 'Parar',
    flowfield: 'Campo de escoamento', airfoil_lower: 'aerofólio', wake_vortices: 'vórtices da esteira',
    animation: 'Animação', play: 'Reproduzir', pause: 'Pausar', auto_repeat: 'Repetir automaticamente',
    frame: 'Quadro', vortex_colors: 'Cores dos vórtices',
    uniform: 'Uniforme', edge: 'Bordo', by_circulation: 'Por circulação',
    trailing_edge: 'Bordo de fuga', leading_edge: 'Bordo de ataque',
    circulation: 'Circulação', circulation_scale: 'Escala de circulação',
    collapse: 'Recolher', expand: 'Expandir',
    loads: 'Cargas', circulation_history: 'Circulação Ligada Adimensional', stagnation_point_location: 'Posição do ponto de estagnação',
    fourier_coefficients: 'Coeficientes de Fourier', coefficient_pair: 'Grupo de coeficientes',
    pitch_angle_history: 'Ângulo de arfagem', pitch_rate_history: 'Velocidade de arfagem',
    pitch_acceleration_history: 'Aceleração de arfagem', plunge_history: 'Deslocamento de mergulho',
    plunge_rate_history: 'Velocidade de mergulho', plunge_acceleration_history: 'Aceleração de mergulho',
    distributions: 'Distribuições',
    export_data: 'Exportar Dados',
    export_scope: 'Escopo dos dados', export_scope_all: 'Todos os dados da simulação',
    export_scope_histories: 'Cinemática e cargas', export_scope_flowfield: 'Campo de escoamento e esteira',
    export_scope_frame: 'Distribuições', export_format: 'Formato do arquivo',
    export_format_mat: 'Estrutura MATLAB (.mat) — recomendado',
    export_format_csv: 'Pacote CSV (.zip)', export_format_json: 'JSON estruturado (.json)',
    export_action: 'Exportar dados', export_frontend_note: 'Execute um caso para habilitar a exportação.',
    export_working: 'Preparando exportação…',
    export_done: 'Exportação criada.', export_error: 'Falha na exportação: {message}',
    versus: 'versus',
    lift_coefficient: 'Coeficiente de Sustentação',
    drag_coefficient: 'Coeficiente de Arrasto de Pressão',
    moment_coefficient: 'Coeficiente de Momento',
    suction_coefficient: 'Coeficiente de Sucção do Bordo de Ataque',
    pressure_distribution: 'Distribuição de Pressão',
    surface_velocity_distribution: 'Velocidade Tangencial na Superfície',
    upper_surface: 'Superfície superior', lower_surface: 'Superfície inferior',
    distribution_unavailable: 'Dados de distribuição indisponíveis. Execute o caso novamente.',
    status_ready: 'Pronto.', status_running: 'Executando...',
    status_running_progress: 'Executando... {progress}%', status_stopped: 'Interrompido.',
    status_done: 'Concluído.', status_error: 'Erro: {message}',
    status_data_error: 'Falha ao carregar os dados.',
    nav_home: 'Início', nav_teaching: 'Ensino', nav_research: 'Pesquisa',
    nav_tools: 'Ferramentas', nav_contact: 'Contato',
    footer_rights: '© 2025–2026 UNSAERO. Todos os direitos reservados.'
  }
};

const TWO_PI = 2 * Math.PI;
const FLOWFIELD_EQUALITY_LIMIT_MULTIPLIER = 5;

let currentLanguage = 'en';
let currentStatus = { key: 'status_ready', values: {} };

function normalizedLanguage(lang){ return ['pt', 'en'].includes(lang) ? lang : 'en'; }
function translated(key){ return TRANSLATIONS[currentLanguage]?.[key] || TRANSLATIONS.en[key] || key; }
function interpolate(text, values = {}){
  return Object.entries(values).reduce((result, [key, value]) => result.replace(`{${key}}`, value), text);
}
function renderStatus(){
  if (statusEl) statusEl.textContent = interpolate(translated(currentStatus.key), currentStatus.values);
  renderProgress();
}

function renderProgress(){
  if (!runProgress || !runProgressFill) return;
  const active = currentStatus.key === 'status_running' || currentStatus.key === 'status_running_progress';
  runProgress.hidden = !active;
  runProgress.setAttribute('aria-hidden', active ? 'false' : 'true');
  if (!active){
    runProgressFill.style.width = '0%';
    runProgress.setAttribute('aria-valuenow', '0');
    return;
  }

  const raw = Number(currentStatus.values.progress ?? 0);
  const progress = Math.max(0, Math.min(100, Number.isFinite(raw) ? raw : 0));
  runProgressFill.style.width = `${progress}%`;
  runProgress.setAttribute('aria-valuenow', progress.toFixed(1));
}

function applyLanguage(lang){
  currentLanguage = normalizedLanguage(lang || localStorage.getItem('unsaero-lang') || 'en');
  localStorage.setItem('unsaero-lang', currentLanguage);
  document.documentElement.lang = currentLanguage === 'pt' ? 'pt-BR' : 'en-US';
  document.title = translated('document_title');
  document.querySelectorAll('[data-i18n]').forEach((element) => {
    const value = translated(element.dataset.i18n);
    if (value) element.textContent = value;
  });
  document.querySelectorAll('.unsaero-global-lang-option').forEach((button) => {
    button.classList.toggle('active', button.id === `btn-${currentLanguage}`);
  });
  renderStatus();
  updateRunStopButton();
  updatePlayPauseButton();
  updateRepeatButton();
  updateFrameCounter();
  updateCollapseButtons();
  if (DATA) drawKinematicsPreview();
  if (DATA) drawAirfoilPreview();
  if (out){
    drawFrame(Number(frameSlider.value || 0));
    plotKinematicHistories(Number(frameSlider.value || 0));
    plotLoads();
    plotFourierCoefficients(Number(frameSlider.value || 0));
  }
  syncExportControls();
}

window.setLang = applyLanguage;
window.applyChromeI18n = applyLanguage;

const statusEl = document.getElementById('status');
const vortexColorMode = document.getElementById('vortexColorMode');
const circulationScaleInput = document.getElementById('circulationScale');
const circulationScaleValue = document.getElementById('circulationScaleValue');
const collapseButtons = Array.from(document.querySelectorAll('[data-collapse-target]'));
const exportScope = document.getElementById('exportScope');
const exportFormat = document.getElementById('exportFormat');
const exportButton = document.getElementById('exportButton');
const exportNote = document.getElementById('exportNote');

const pitchKinSelect = document.getElementById('pitchKinSelect');
const plungeKinSelect = document.getElementById('plungeKinSelect');
const pitchConstantFields = document.getElementById('pitchConstantFields');
const pitchSinusoidalFields = document.getElementById('pitchSinusoidalFields');
const plungeConstantFields = document.getElementById('plungeConstantFields');
const plungeSinusoidalFields = document.getElementById('plungeSinusoidalFields');
const airSelect = document.getElementById('airSelect');
const airfoilSectionsInput = document.getElementById('airfoilSections');
const airfoilCanvas = document.getElementById('airfoilCanvas');
const naca4Fields = document.getElementById('naca4Fields');

const runStopBtn = document.getElementById('runStopBtn');

const playPauseBtn = document.getElementById('playPauseBtn');
const repeatBtn = document.getElementById('repeatBtn');
const frameSlider = document.getElementById('frameSlider');
const frameCounter = document.getElementById('frameCounter');
const frameStepButtons = Array.from(document.querySelectorAll('[data-frame-step]'));
const frameMiniLabels = Array.from(document.querySelectorAll('[data-frame-mini-label]'));
const showWake = { checked: true }; // wake is always shown

const flowCanvas = document.getElementById('flowCanvas');

const plotPitchKinematics = document.getElementById('plotPitchKinematics');
const plotPlungeKinematics = document.getElementById('plotPlungeKinematics');
const plotGamma = document.getElementById('plotGamma');
const plotStagnationPoint = document.getElementById('plotStagnationPoint');
const plotCL = document.getElementById('plotCL');
const plotCD = document.getElementById('plotCD');
const plotCM = document.getElementById('plotCM');
const plotCs = document.getElementById('plotCs');
const plotAlpha = document.getElementById('plotAlpha');
const plotDAlpha = document.getElementById('plotDAlpha');
const plotD2Alpha = document.getElementById('plotD2Alpha');
const plotH = document.getElementById('plotH');
const plotDH = document.getElementById('plotDH');
const plotD2H = document.getElementById('plotD2H');
const plotFourierFirst = document.getElementById('plotFourierFirst');
const plotFourierSecond = document.getElementById('plotFourierSecond');
const plotFourierThird = document.getElementById('plotFourierThird');
const plotFourierFourth = document.getElementById('plotFourierFourth');
const fourierPairSelect = document.getElementById('fourierPairSelect');
const plotPressureDist = document.getElementById('plotPressureDist');
const plotSurfaceVelocity = document.getElementById('plotSurfaceVelocity');
const distributionFrameLabel = document.getElementById('distributionFrameLabel');
const tooltip = document.getElementById('tooltip');
const runProgress = document.getElementById('runProgress');
const runProgressFill = document.getElementById('runProgressFill');

function updateCollapseButton(button){
  if (!button) return;
  const expanded = button.getAttribute('aria-expanded') !== 'false';
  const action = translated(expanded ? 'collapse' : 'expand');
  const label = button.querySelector('[data-collapse-label]');
  if (label) label.textContent = action;
  button.setAttribute('aria-label', action);
  button.title = action;
}

function updateCollapseButtons(){
  collapseButtons.forEach(updateCollapseButton);
}

function setCardExpanded(button, expanded){
  const targetId = button?.dataset.collapseTarget;
  const content = targetId ? document.getElementById(targetId) : null;
  if (!content) return;
  button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  content.hidden = !expanded;
  button.closest('.collapsible-card')?.classList.toggle('is-collapsed', !expanded);
  updateCollapseButton(button);

  if (!expanded) return;
  requestAnimationFrame(() => {
    if (targetId === 'kinematicsContent' && DATA) drawKinematicsPreview();
    if (targetId === 'airfoilContent' && DATA) drawAirfoilPreview();
    if (targetId === 'kinematicsHistoryContent' && out) plotKinematicHistories(Number(frameSlider.value || 0));
    if (targetId === 'loadsContent' && out) plotLoads(Number(frameSlider.value || 0));
    if (targetId === 'fourierContent' && out) plotFourierCoefficients(Number(frameSlider.value || 0));
    if (targetId === 'distributionsContent' && out) plotDistributions(Number(frameSlider.value || 0));
  });
}

function initializeCollapsibles(){
  collapseButtons.forEach((button) => {
    setCardExpanded(button, button.getAttribute('aria-expanded') !== 'false');
    button.addEventListener('click', () => {
      setCardExpanded(button, button.getAttribute('aria-expanded') === 'false');
    });
  });
}

let DATA = null;
let out = null;
let SIM = null; // current simulation context
let anim = { playing:false, frame:0, raf:null, repeat:true };
let vortexMode = 'gamma';

let worker = null;
let workerRunning = false;
let runActive = false;
let activeWorkerAbort = null;
let directSolverModule = null;

let COLORS = {};
function refreshColors(){
  const st = getComputedStyle(document.documentElement);
  const get = (v, fallback) => (st.getPropertyValue(v).trim() || fallback);
  COLORS = {
    canvasBg:  get('--canvas-bg', '#ffffff'),
    canvasGrid:get('--canvas-grid', '#d6dde8'),
    canvasAxis:get('--canvas-axis', '#94a3b8'),
    canvasText:get('--canvas-text', '#334155'),
    border:    get('--border', '#d6dde8'),
    muted:     get('--muted', '#475569'),
    text:      get('--text', '#0b1220'),
    accent:    get('--accent', '#2563eb'),
    accent2:   get('--accent2', '#059669')
  };
}

function setStatus(key, values = {}){
  currentStatus = { key, values };
  renderStatus();
}

function flowPlotBox(){
  const w = flowCanvas?.width || 900;
  const h = flowCanvas?.height || 300;
  return { x:50, y:25, w:w-70, h:h-60 };
}

async function loadData(){
  const air = await fetch(new URL('../../data/unsteady-airfoil-simulator/airfoils.json?v=uas-airfoil-legend-20260703f', import.meta.url)).then(r=>r.json());
  DATA = { air };
  Object.keys(air).forEach(k=>{
    const opt=document.createElement('option');
    opt.value=k; opt.textContent=k;
    airSelect.appendChild(opt);
  });
  const nacaOption = document.createElement('option');
  nacaOption.value = 'naca4';
  nacaOption.dataset.i18n = 'naca_4_digit';
  nacaOption.textContent = translated('naca_4_digit');
  airSelect.appendChild(nacaOption);
  pitchKinSelect.value = 'constant';
  plungeKinSelect.value = 'sinusoidal';
  syncKinematicPanels();
  syncAirfoilControls();
  setStatus('status_ready');
  drawKinematicsPreview();
  drawAirfoilPreview();
}

function getNum(id){ return Number(document.getElementById(id).value); }
function getPercent(id){ return getNum(id) / 100; }
function degreesToRadians(value){ return value * Math.PI / 180; }

function finiteNumber(value, fallback = 0){
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function positiveNumber(value, fallback = 1){
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function getInputNumber(id, fallback = 0){
  return finiteNumber(document.getElementById(id)?.value, fallback);
}

function getStrictInputNumber(id, label){
  const value = Number(document.getElementById(id)?.value);
  if (!Number.isFinite(value)) throw new Error(`${label} must be a finite number.`);
  return value;
}

function getStrictPositiveInputNumber(id, label){
  const value = getStrictInputNumber(id, label);
  if (value <= 0) throw new Error(`${label} must be greater than zero.`);
  return value;
}

function getStrictStepCount(id, label){
  const value = getStrictPositiveInputNumber(id, label);
  const rounded = Math.floor(value);
  if (rounded !== value) throw new Error(`${label} must be an integer.`);
  if (rounded < 3) throw new Error(`${label} must be at least 3.`);
  return rounded;
}

function getTimeStep(){
  const element = document.getElementById('dt');
  if (!element) return 0.01;
  return getStrictPositiveInputNumber('dt', 'Dimensionless time step Δτ');
}

function getStepCount(){
  const element = document.getElementById('nSteps');
  if (!element) return 500;
  return getStrictStepCount('nSteps', 'Steps');
}

function getAirfoilSectionCount(){
  const element = airfoilSectionsInput || document.getElementById('airfoilSections');
  if (!element) return 99;
  const value = getStrictPositiveInputNumber('airfoilSections', 'Airfoil sections');
  if (!Number.isInteger(value)) throw new Error('Airfoil sections must be an integer.');
  if (value < 2) throw new Error('Airfoil sections must be at least 2.');
  return value;
}

function interpolatePolylineY(points, x){
  if (!points?.length) return 0;
  if (x <= points[0][0]) return Number(points[0][1]) || 0;
  const last = points[points.length - 1];
  if (x >= last[0]) return Number(last[1]) || 0;

  for (let i=0; i<points.length - 1; i++){
    const x0 = Number(points[i][0]);
    const x1 = Number(points[i + 1][0]);
    if (x >= x0 && x <= x1){
      const y0 = Number(points[i][1]) || 0;
      const y1 = Number(points[i + 1][1]) || 0;
      const denom = x1 - x0;
      const s = Math.abs(denom) < 1e-12 ? 0 : (x - x0) / denom;
      return y0 + s * (y1 - y0);
    }
  }
  return Number(last[1]) || 0;
}

function camberSlopeAtTheta(coefficients, theta){
  let slope = Number(coefficients[0]) || 0;
  for (let n=1; n<coefficients.length; n++){
    slope += 2*(Number(coefficients[n]) || 0)*Math.cos(n*theta);
  }
  return slope;
}

function camberIntegralTerm(n, theta){
  if (n === 1) return 0.5*Math.sin(theta)**2;
  return 0.5*(
    (1 - Math.cos((n + 1)*theta))/(n + 1)
    + (1 - Math.cos((1 - n)*theta))/(1 - n)
  );
}

function camberAtTheta(coefficients, theta){
  let camber = 0.5*(Number(coefficients[0]) || 0)*(1 - Math.cos(theta));
  for (let n=1; n<coefficients.length; n++){
    camber += (Number(coefficients[n]) || 0)*camberIntegralTerm(n, theta);
  }
  return camber;
}

function closedThicknessCoefficients(values){
  const coefficients = Array.from(values || [], Number);
  if (coefficients.length < 2 || coefficients.some((value)=>!Number.isFinite(value))){
    throw new Error('Airfoil thickness coefficients are invalid.');
  }
  // The printed thesis coefficients are rounded. Enforce Eq. (2.60), z_t(1)=0,
  // by absorbing the small rounding residual into the highest-order term.
  const trailingThickness = coefficients.reduce((total, value)=>total + value, 0);
  coefficients[coefficients.length - 1] -= trailingThickness;
  return coefficients;
}

function thicknessAtX(coefficients, x){
  if (x <= 0) return 0;
  let polynomial = coefficients[coefficients.length - 1];
  for (let k=coefficients.length - 2; k>=1; k--){
    polynomial = coefficients[k] + x*polynomial;
  }
  return Math.max(0, coefficients[0]*Math.sqrt(x) + x*polynomial);
}

function airfoilWithSections(definition, sections){
  const nSections = Math.max(2, Math.floor(sections));
  const camberCoefficients = Array.from(definition?.camberCoefficients || [], Number);
  if (!camberCoefficients.length || camberCoefficients.some((value)=>!Number.isFinite(value))){
    throw new Error('Airfoil camber coefficients are invalid.');
  }
  const thicknessCoefficients = closedThicknessCoefficients(definition?.thicknessCoefficients);
  const camber = new Array(nSections + 1);
  const upper = new Array(nSections + 1);
  const lower = new Array(nSections + 1);

  for (let i=0; i<=nSections; i++){
    const theta = Math.PI*i/nSections;
    const x = 0.5*(1 - Math.cos(theta));
    const zc = camberAtTheta(camberCoefficients, theta);
    const slope = camberSlopeAtTheta(camberCoefficients, theta);
    const angle = Math.atan(slope);
    const zt = thicknessAtX(thicknessCoefficients, x);
    camber[i] = [x, zc];
    upper[i] = [x - zt*Math.sin(angle), zc + zt*Math.cos(angle)];
    lower[i] = [x + zt*Math.sin(angle), zc - zt*Math.cos(angle)];
  }

  return {
    chord: camber.map(([x])=>[x, 0]),
    camber,
    upper,
    lower,
    outline: [...upper, ...lower.slice().reverse()],
    leadingEdgeSlope: camberSlopeAtTheta(camberCoefficients, 0),
    camberCoefficients,
    thicknessCoefficients
  };
}

function naca4Parameters(){
  const maximumCamberPercent = getStrictInputNumber('nacaMaxCamber', 'Maximum camber');
  const camberLocationPercent = getStrictInputNumber('nacaCamberLocation', 'Camber location');
  const thicknessPercent = getStrictPositiveInputNumber('nacaThickness', 'Maximum thickness');
  if (![maximumCamberPercent, camberLocationPercent, thicknessPercent].every(Number.isInteger)){
    throw new Error('NACA 4-digit parameters must be integers.');
  }
  if (maximumCamberPercent < 0 || maximumCamberPercent > 9){
    throw new Error('Maximum camber must be between 0 and 9% of chord.');
  }
  const hasSymmetricLocation = maximumCamberPercent === 0 && camberLocationPercent === 0;
  const hasStandardCamberLocation = camberLocationPercent >= 10
    && camberLocationPercent <= 90
    && camberLocationPercent % 10 === 0;
  if (!hasSymmetricLocation && !hasStandardCamberLocation){
    throw new Error('Camber location must be 0 for a symmetric airfoil, or 10, 20, ..., or 90% of chord.');
  }
  if (thicknessPercent > 40){
    throw new Error('Maximum thickness must not exceed 40% of chord.');
  }
  const camberDigit = maximumCamberPercent;
  const locationDigit = maximumCamberPercent === 0 ? 0 : camberLocationPercent/10;
  const thicknessDigits = String(thicknessPercent).padStart(2, '0');
  return {
    maximumCamberPercent,
    camberLocationPercent,
    thicknessPercent,
    m: maximumCamberPercent/100,
    p: maximumCamberPercent === 0 ? 0 : camberLocationPercent/100,
    t: thicknessPercent/100,
    code: `${camberDigit}${locationDigit}${thicknessDigits}`
  };
}

function nacaCamberAtX(x, m, p){
  if (m === 0) return { z:0, slope:0 };
  if (x < p){
    const factor = m/(p*p);
    return {
      z: factor*(2*p*x - x*x),
      slope: 2*factor*(p - x)
    };
  }
  const factor = m/((1-p)*(1-p));
  return {
    z: factor*((1 - 2*p) + 2*p*x - x*x),
    slope: 2*factor*(p - x)
  };
}

let nacaCamberCoefficientCache = null;
function nacaCamberCoefficients(m, p, modes = 300){
  const key = `${m.toFixed(12)}:${p.toFixed(12)}:${modes}`;
  if (nacaCamberCoefficientCache?.key === key){
    return nacaCamberCoefficientCache.values.slice();
  }
  const samples = 4096;
  const sums = new Float64Array(modes);
  for (let i=0; i<samples; i++){
    const theta = Math.PI*(i + 0.5)/samples;
    const x = 0.5*(1 - Math.cos(theta));
    const slope = nacaCamberAtX(x, m, p).slope;
    sums[0] += slope;
    const cosine = Math.cos(theta);
    let previous = 1;
    let current = cosine;
    for (let mode=1; mode<modes; mode++){
      sums[mode] += slope*current;
      const next = 2*cosine*current - previous;
      previous = current;
      current = next;
    }
  }
  const coefficients = Array.from(sums, (sum)=>sum/samples);
  nacaCamberCoefficientCache = { key, values:coefficients.slice() };
  return coefficients;
}

function naca4Geometry(parameters, sections){
  const nSections = Math.max(2, Math.floor(sections));
  const { m, p, t } = parameters;
  const camber = new Array(nSections + 1);
  const upper = new Array(nSections + 1);
  const lower = new Array(nSections + 1);

  for (let i=0; i<=nSections; i++){
    const theta = Math.PI*i/nSections;
    const x = 0.5*(1 - Math.cos(theta));
    const { z:zc, slope } = nacaCamberAtX(x, m, p);
    const zt = 5*t*(
      0.2969*Math.sqrt(x) - 0.1260*x - 0.3516*x*x
      + 0.2843*x*x*x - 0.1036*x*x*x*x
    );
    const angle = Math.atan(slope);
    camber[i] = [x, zc];
    upper[i] = [x - zt*Math.sin(angle), zc + zt*Math.cos(angle)];
    lower[i] = [x + zt*Math.sin(angle), zc - zt*Math.cos(angle)];
  }

  const thicknessCoefficients = [0.2969, -0.1260, -0.3516, 0.2843, -0.1036]
    .map((coefficient)=>5*t*coefficient);
  return {
    name: `NACA ${parameters.code}`,
    nacaCode: parameters.code,
    chord: camber.map(([x])=>[x, 0]),
    camber,
    upper,
    lower,
    outline: [...upper, ...lower.slice().reverse()],
    leadingEdgeSlope: nacaCamberAtX(0, m, p).slope,
    camberCoefficients: nacaCamberCoefficients(m, p),
    thicknessCoefficients
  };
}

function selectedAirfoilGeometry(sections = getAirfoilSectionCount()){
  if (airSelect?.value === 'naca4') return naca4Geometry(naca4Parameters(), sections);
  const definition = DATA?.air?.[airSelect?.value];
  if (!definition) throw new Error('Select a valid airfoil.');
  return { name:airSelect.value, ...airfoilWithSections(definition, sections) };
}

function drawAirfoilPreview(){
  if (!airfoilCanvas) return;
  const ctx = airfoilCanvas.getContext('2d');
  const w = airfoilCanvas.width;
  const h = airfoilCanvas.height;
  clear(ctx, w, h);
  if (!DATA?.air || !airSelect?.value) return;

  let geometry;
  try{
    geometry = selectedAirfoilGeometry();
  } catch(error){
    ctx.fillStyle = COLORS.muted;
    ctx.font = '13px system-ui';
    ctx.fillText(error.message, 18, 32);
    return;
  }

  const points = [...geometry.upper, ...geometry.lower];
  let xmin = Infinity, xmax = -Infinity, maxAbsZ = 0;
  for (const [x, z] of points){
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    xmin = Math.min(xmin, x);
    xmax = Math.max(xmax, x);
    maxAbsZ = Math.max(maxAbsZ, Math.abs(z));
  }
  const box = { x:62, y:34, w:w-90, h:h-76 };
  const xSpan = Math.max(xmax - xmin, 1);
  const xPad = 0.035*xSpan;
  const equalScaleZLimit = 0.5*(xSpan + 2*xPad)*(box.h/box.w);
  const zLimit = Math.max(1.28*maxAbsZ, equalScaleZLimit);
  const bounds = { xmin:xmin-xPad, xmax:xmax+xPad, zmin:-zLimit, zmax:zLimit };
  drawPlotAxes(ctx, box, bounds.xmin, bounds.xmax, bounds.zmin, bounds.zmax, 'x/c', 'z/c');

  const drawPolyline = (coordinates, color, width, dash = [])=>{
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.beginPath();
    coordinates.forEach(([x, z], index)=>{
      const q = worldToCanvas(x, z, box, bounds);
      if (index === 0) ctx.moveTo(q.X, q.Y);
      else ctx.lineTo(q.X, q.Y);
    });
    ctx.stroke();
    ctx.restore();
  };
  drawPolyline([[0, 0], [1, 0]], COLORS.canvasAxis, 1.35, [7, 5]);
  drawPolyline(geometry.camber, COLORS.accent, 1.35, [5, 4]);
  drawPolyline(geometry.outline, COLORS.text, 2.1);

  const beta0 = Number(geometry.thicknessCoefficients?.[0]) || 0;
  const leadingEdgeRadius = 0.5*beta0*beta0;
  const darkTheme = document.documentElement.getAttribute('data-theme') === 'dark';
  const leadingEdgeRadiusColor = darkTheme ? '#f0abfc' : '#a21caf';
  const momentReferenceColor = darkTheme ? '#60a5fa' : '#1d4ed8';
  if (leadingEdgeRadius > 0){
    const leadingEdgeZ = Number(geometry.camber?.[0]?.[1]) || 0;
    const leadingEdgeAngle = Math.atan(Number(geometry.leadingEdgeSlope) || 0);
    const centerX = leadingEdgeRadius*Math.cos(leadingEdgeAngle);
    const centerZ = leadingEdgeZ + leadingEdgeRadius*Math.sin(leadingEdgeAngle);
    const center = worldToCanvas(centerX, centerZ, box, bounds);
    const leadingEdge = worldToCanvas(0, leadingEdgeZ, box, bounds);
    const radiusPixels = Math.hypot(center.X - leadingEdge.X, center.Y - leadingEdge.Y);
    ctx.save();
    ctx.strokeStyle = leadingEdgeRadiusColor;
    ctx.fillStyle = leadingEdgeRadiusColor;
    ctx.lineWidth = 1.35;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.arc(center.X, center.Y, radiusPixels, 0, Math.PI*2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(center.X, center.Y);
    ctx.lineTo(leadingEdge.X, leadingEdge.Y);
    ctx.stroke();
    ctx.restore();
  }

  const xp = getInputNumber('xp', 25)/100;
  const pivotZ = interpolatePolylineY(geometry.camber, xp);
  const pivot = worldToCanvas(xp, pivotZ, box, bounds);
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(pivot.X, pivot.Y, 3.6, 0, Math.PI*2);
  ctx.fill();

  const xref = getInputNumber('xref', 33)/100;
  const momentReferenceZ = interpolatePolylineY(geometry.camber, xref);
  const momentReference = worldToCanvas(xref, momentReferenceZ, box, bounds);
  ctx.save();
  ctx.strokeStyle = momentReferenceColor;
  ctx.lineWidth = 2.1;
  ctx.beginPath();
  ctx.moveTo(momentReference.X - 4.5, momentReference.Y - 4.5);
  ctx.lineTo(momentReference.X + 4.5, momentReference.Y + 4.5);
  ctx.moveTo(momentReference.X + 4.5, momentReference.Y - 4.5);
  ctx.lineTo(momentReference.X - 4.5, momentReference.Y + 4.5);
  ctx.stroke();
  ctx.restore();

  if (geometry.nacaCode){
    ctx.fillStyle = COLORS.canvasText;
    ctx.font = '12px system-ui';
    ctx.fillText(`NACA ${geometry.nacaCode}`, 12, 17);
  }

  const legend = [
    { label:translated('chord'), color:COLORS.canvasAxis, type:'line', dash:[6, 4] },
    { label:translated('camber_line'), color:COLORS.accent, type:'line', dash:[5, 4] },
    { label:translated('pivot'), color:'#ef4444', type:'point' },
    { label:translated('moment_reference'), color:momentReferenceColor, type:'cross' },
    { label:translated('leading_edge_circle'), color:leadingEdgeRadiusColor, type:'circle' }
  ];
  ctx.save();
  ctx.font = '11px system-ui';
  ctx.textBaseline = 'middle';
  let legendX = w - 12;
  for (let i=legend.length - 1; i>=0; i--){
    const item = legend[i];
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.canvasText;
    ctx.fillText(item.label, legendX, 16);
    const textWidth = ctx.measureText(item.label).width;
    const sampleX = legendX - textWidth - 18;
    ctx.strokeStyle = item.color;
    ctx.fillStyle = item.color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash(item.dash || []);
    if (item.type === 'point'){
      ctx.beginPath(); ctx.arc(sampleX - 5, 16, 3, 0, Math.PI*2); ctx.fill();
    } else if (item.type === 'cross'){
      ctx.beginPath();
      ctx.moveTo(sampleX - 9, 12); ctx.lineTo(sampleX - 1, 20);
      ctx.moveTo(sampleX - 1, 12); ctx.lineTo(sampleX - 9, 20);
      ctx.stroke();
    } else if (item.type === 'circle'){
      ctx.beginPath(); ctx.arc(sampleX - 5, 16, 4, 0, Math.PI*2); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(sampleX - 12, 16); ctx.lineTo(sampleX + 2, 16); ctx.stroke();
    }
    legendX = sampleX - 25;
  }
  ctx.restore();
}

function kinematicAmplitudeToPhysical(kind, value, chord){
  return kind === 'pitch' ? degreesToRadians(value) : value * chord;
}

function normalizedKinematicSource(value){
  return ['constant', 'sinusoidal', 'smooth_ramp', 'cosine_cycle'].includes(value) ? value : 'constant';
}

function getKinematicConfig(kind, options = {}){
  const strict = options.strict === true;
  const chord = positiveNumber(options.chord, 1);
  const isPitch = kind === 'pitch';
  const select = kind === 'pitch' ? pitchKinSelect : plungeKinSelect;
  const source = normalizedKinematicSource(select?.value);
  if (source === 'constant'){
    const rawValue = strict
      ? getStrictInputNumber(`${kind}ConstantValue`, isPitch ? 'Pitch value [deg]' : 'Plunge H/c')
      : getInputNumber(`${kind}ConstantValue`, 0);
    return {
      kind,
      source,
      valueInput: rawValue,
      value: kinematicAmplitudeToPhysical(kind, rawValue, chord)
    };
  }

  if (source === 'smooth_ramp'){
    const amplitudeInput = strict
      ? getStrictInputNumber(`${kind}SmoothAmplitude`, isPitch ? 'Pitch smooth-ramp amplitude [deg]' : 'Plunge smooth-ramp H/c')
      : getInputNumber(`${kind}SmoothAmplitude`, isPitch ? 5 : 0.03);
    const sharpness = strict
      ? getStrictPositiveInputNumber(`${kind}SmoothSharpness`, `${isPitch ? 'Pitch' : 'Plunge'} smooth-ramp sharpness as [1/s]`)
      : positiveNumber(document.getElementById(`${kind}SmoothSharpness`)?.value, 8);
    const t1 = strict
      ? getStrictInputNumber(`${kind}SmoothT1`, `${isPitch ? 'Pitch' : 'Plunge'} smooth-ramp t1 [s]`)
      : getInputNumber(`${kind}SmoothT1`, 1);
    const t2 = strict
      ? getStrictInputNumber(`${kind}SmoothT2`, `${isPitch ? 'Pitch' : 'Plunge'} smooth-ramp t2 [s]`)
      : getInputNumber(`${kind}SmoothT2`, 3);
    if (strict && t2 <= t1) throw new Error(`${isPitch ? 'Pitch' : 'Plunge'} smooth-ramp t2 must be greater than t1.`);
    const amplitude = kinematicAmplitudeToPhysical(kind, amplitudeInput, chord);
    const duration = Math.max(t2 - t1, 1e-9);
    return {
      kind,
      source,
      amplitudeInput,
      amplitude,
      sharpness,
      t1,
      t2,
      K: amplitude / (2 * duration)
    };
  }

  if (source === 'cosine_cycle'){
    const frequency = strict
      ? getStrictPositiveInputNumber(`${kind}CosineFrequency`, `${isPitch ? 'Pitch' : 'Plunge'} asymmetric-cosine frequency [Hz]`)
      : positiveNumber(document.getElementById(`${kind}CosineFrequency`)?.value, 1);
    const amplitudeInput = strict
      ? getStrictInputNumber(`${kind}CosineAmplitude`, isPitch ? 'Pitch asymmetric-cosine amplitude [deg]' : 'Plunge asymmetric-cosine H/c')
      : getInputNumber(`${kind}CosineAmplitude`, isPitch ? 3 : 0.03);
    const zeta = strict
      ? getStrictInputNumber(`${kind}CosineZeta`, `${isPitch ? 'Pitch' : 'Plunge'} asymmetric-cosine ζ`)
      : getInputNumber(`${kind}CosineZeta`, 0.5);
    if (strict && !(zeta > 0 && zeta < 1)) throw new Error(`${isPitch ? 'Pitch' : 'Plunge'} asymmetric-cosine ζ must be between 0 and 1.`);
    const phaseInput = strict
      ? getStrictInputNumber(`${kind}CosinePhase`, `${isPitch ? 'Pitch' : 'Plunge'} asymmetric-cosine phase [deg]`)
      : getInputNumber(`${kind}CosinePhase`, 0);
    return {
      kind,
      source,
      frequency,
      amplitudeInput,
      amplitude: kinematicAmplitudeToPhysical(kind, amplitudeInput, chord),
      zeta,
      phaseInput,
      phase: degreesToRadians(phaseInput)
    };
  }

  const frequency = strict
    ? getStrictPositiveInputNumber(`${kind}Frequency`, `${isPitch ? 'Pitch' : 'Plunge'} frequency [Hz]`)
    : positiveNumber(document.getElementById(`${kind}Frequency`)?.value, 1);
  const amplitudeInput = strict
    ? getStrictInputNumber(`${kind}Amplitude`, isPitch ? 'Pitch amplitude [deg]' : 'Plunge H/c')
    : getInputNumber(`${kind}Amplitude`, isPitch ? 3 : 0.03);
  const phaseInput = strict
    ? getStrictInputNumber(`${kind}Phase`, `${isPitch ? 'Pitch' : 'Plunge'} phase [deg]`)
    : getInputNumber(`${kind}Phase`, 0);

  return {
    kind,
    source,
    frequency,
    amplitudeInput,
    phaseInput,
    amplitude: isPitch ? degreesToRadians(amplitudeInput) : amplitudeInput * chord,
    phase: degreesToRadians(phaseInput)
  };
}

function logCosh(x){
  const ax = Math.abs(x);
  return ax + Math.log1p(Math.exp(-2 * ax)) - Math.log(2);
}

function sechSquared(x){
  const c = Math.cosh(x);
  if (!Number.isFinite(c) || c === 0){
    const e = Math.exp(-Math.abs(x));
    return 4 * e * e;
  }
  return 1 / (c * c);
}

function evaluateKinematic(config, time){
  if (config.source === 'constant'){
    return {
      y: config.value,
      dy: 0,
      d2y: 0
    };
  }

  if (config.source === 'smooth_ramp'){
    const a1 = config.sharpness * (time - config.t1);
    const a2 = config.sharpness * (time - config.t2);
    return {
      y: (config.K / config.sharpness) * (logCosh(a1) - logCosh(a2)) + 0.5 * config.amplitude,
      dy: config.K * (Math.tanh(a1) - Math.tanh(a2)),
      d2y: config.sharpness * config.K * (sechSquared(a1) - sechSquared(a2))
    };
  }

  if (config.source === 'cosine_cycle'){
    const T = 1 / config.frequency;
    const tCycle = ((time % T) + T) % T;
    const split = config.zeta * T;
    if (tCycle < split){
      const omega = Math.PI / split;
      const angle = omega * tCycle + config.phase;
      return {
        y: config.amplitude - config.amplitude * Math.cos(angle),
        dy: omega * config.amplitude * Math.sin(angle),
        d2y: omega * omega * config.amplitude * Math.cos(angle)
      };
    }
    const omega = Math.PI / (T * (1 - config.zeta));
    const angle = omega * (T - tCycle) + config.phase;
    return {
      y: config.amplitude - config.amplitude * Math.cos(angle),
      dy: -omega * config.amplitude * Math.sin(angle),
      d2y: omega * omega * config.amplitude * Math.cos(angle)
    };
  }

  const omega = TWO_PI * config.frequency;
  const angle = omega * time + config.phase;
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  return {
    y: config.amplitude * sin,
    dy: config.amplitude * omega * cos,
    d2y: -config.amplitude * omega * omega * sin
  };
}

function checkSeries(name, values, n){
  if (!values || values.length !== n) throw new Error(`${name} has invalid length.`);
  for (let i=0; i<n; i++){
    if (!Number.isFinite(Number(values[i]))) throw new Error(`${name} contains a non-finite value.`);
  }
}

function selectedKinematics(
  chord = getStrictPositiveInputNumber('c', 'Chord c'),
  Uref = getStrictPositiveInputNumber('Uref', 'Freestream U')
){
  const pitchConfig = getKinematicConfig('pitch', { strict: true, chord });
  const plungeConfig = getKinematicConfig('plunge', { strict: true, chord });
  const dtau = getTimeStep();
  const dt = dtau*chord/(2*Uref);
  const n = getStepCount();
  const duration = dt * (n - 1);

  const t = new Array(n);
  const tau = new Array(n);
  const alpha = new Array(n);
  const h = new Array(n);
  const dalpha = new Array(n);
  const d2alpha = new Array(n);
  const dh = new Array(n);
  const d2h = new Array(n);
  const rows = new Array(n);

  for (let i=0; i<n; i++){
    const time = i * dt;
    const pitch = evaluateKinematic(pitchConfig, time);
    const plunge = evaluateKinematic(plungeConfig, time);
    t[i] = time;
    tau[i] = i * dtau;
    alpha[i] = pitch.y;
    dalpha[i] = pitch.dy;
    d2alpha[i] = pitch.d2y;
    h[i] = plunge.y;
    dh[i] = plunge.dy;
    d2h[i] = plunge.d2y;
    rows[i] = [time, alpha[i], h[i]];
  }

  checkSeries('t', t, n);
  checkSeries('alpha', alpha, n);
  checkSeries('h', h, n);
  checkSeries('dalpha', dalpha, n);
  checkSeries('d2alpha', d2alpha, n);
  checkSeries('dh', dh, n);
  checkSeries('d2h', d2h, n);

  return {
    pitchName: pitchConfig.source,
    plungeName: plungeConfig.source,
    pitchConfig,
    plungeConfig,
    rows,
    t,
    tau,
    alpha,
    h,
    dalpha,
    d2alpha,
    dh,
    d2h,
    dt,
    dtau,
    duration
  };
}

let stopRequested = false;
function solverAbortError(){
  const error = new Error('Simulation stopped.');
  error.name = 'AbortError';
  return error;
}

function updateRunStopButton(){
  if (!runStopBtn) return;
  const label = translated(runActive ? 'stop' : 'run');
  const icon = runActive
    ? '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><rect x="3.2" y="3.2" width="9.6" height="9.6" rx="1.4"></rect></svg>'
    : '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4 2.7v10.6c0 .78.85 1.26 1.52.86l8.24-5.3a1 1 0 0 0 0-1.72L5.52 1.84A1 1 0 0 0 4 2.7z"></path></svg>';
  runStopBtn.innerHTML = `<span class="play-pause-icon">${icon}</span><span>${label}</span>`;
  runStopBtn.classList.toggle('is-running', runActive);
  runStopBtn.setAttribute('aria-label', label);
}

function requestSolverStop(){
  stopRequested = true;
  runStopBtn.disabled = true;
  if (activeWorkerAbort) activeWorkerAbort();
}

async function loadDirectSolver(){
  if (directSolverModule) return directSolverModule;
  try{
    directSolverModule = await import(new URL('./solver.js?v=uas-composite-pressure-20260706a', import.meta.url).href);
  } catch(error){
    console.warn('Versioned solver import failed; falling back to plain solver import.', error);
    directSolverModule = await import('./solver.js');
  }
  return directSolverModule;
}

async function runSolverDirect(params, hooks){
  await new Promise(r => setTimeout(r, 0));
  if (stopRequested) throw solverAbortError();
  const { aeroSolver } = await loadDirectSolver();
  const result = aeroSolver(params, {
    onProgress: hooks?.onProgress,
    shouldStop: () => stopRequested
  });
  if (result.stopped) throw solverAbortError();
  return result;
}

async function runSolverInWorker(params, hooks){
  if (!window.Worker) return runSolverDirect(params, hooks);

  if (!worker){
    try{
      worker = new Worker(new URL('./worker.js?v=uas-composite-pressure-20260706a', import.meta.url), { type: 'module' });
    } catch(error){
      console.warn('Worker construction failed; falling back to direct solver.', error);
      return runSolverDirect(params, hooks);
    }
  }
  workerRunning = true;
  const runWorker = worker;

  return new Promise((resolve, reject)=>{
    let settled = false;
    const cleanup = ()=>{
      runWorker.removeEventListener('message', onMsg);
      runWorker.removeEventListener('error', onErr);
    };
    const onMsg = (ev)=>{
      const msg = ev.data || {};
      if (msg.type === 'progress'){
        hooks.onProgress(msg.k, msg.it);
      } else if (msg.type === 'done'){
        if (settled) return;
        settled = true;
        cleanup();
        workerRunning = false;
        activeWorkerAbort = null;
        resolve(msg.out);
      } else if (msg.type === 'error'){
        if (settled) return;
        settled = true;
        cleanup();
        workerRunning = false;
        activeWorkerAbort = null;
        reject(new Error(msg.message || 'Worker error'));
      }
    };
    const onErr = (e)=>{
      if (settled) return;
      settled = true;
      cleanup();
      workerRunning = false;
      activeWorkerAbort = null;
      reject(new Error(e.message || 'Worker error'));
    };

    activeWorkerAbort = ()=>{
      if (settled) return;
      settled = true;
      cleanup();
      workerRunning = false;
      activeWorkerAbort = null;
      runWorker.terminate();
      if (worker === runWorker) worker = null;
      reject(solverAbortError());
    };

    runWorker.addEventListener('message', onMsg);
    runWorker.addEventListener('error', onErr);
    runWorker.postMessage({ type: 'run', params });
  }).catch(async (error)=>{
    if (error?.name === 'AbortError') throw error;
    console.warn('Worker failed; falling back to direct solver.', error);
    workerRunning = false;
    activeWorkerAbort = null;
    worker = null;
    return runSolverDirect(params, hooks);
  });
}

runStopBtn.addEventListener('click', async ()=>{
  if (runActive){
    requestSolverStop();
    return;
  }
  if (!DATA) return;
  runActive = true;
  stopRequested = false;
  workerRunning = false;
  runStopBtn.disabled = false;
  updateRunStopButton();
  playPauseBtn.disabled = true;
  repeatBtn.disabled = true;
  frameSlider.disabled = true;
  if (exportButton) exportButton.disabled = true;
  if (exportNote) exportNote.textContent = translated('export_working');

  // Reset plots and lock animation controls
  anim.playing = false;
  if (anim.raf) cancelAnimationFrame(anim.raf);
  anim.raf = null;
  playPauseBtn.disabled = true;
  updatePlayPauseButton();
  repeatBtn.disabled = true;
  updateRepeatButton();
  frameSlider.disabled = true;
  updateFrameCounter();
  clearCanvas(plotCL);
  clearCanvas(plotCD);
  clearCanvas(plotCM);
  clearCanvas(plotCs);
  clearCanvas(plotGamma);
  clearCanvas(plotStagnationPoint);
  clearCanvas(plotAlpha);
  clearCanvas(plotDAlpha);
  clearCanvas(plotD2Alpha);
  clearCanvas(plotH);
  clearCanvas(plotDH);
  clearCanvas(plotD2H);
  clearCanvas(plotFourierFirst);
  clearCanvas(plotFourierSecond);
  clearCanvas(plotFourierThird);
  clearCanvas(plotFourierFourth);
  clearCanvas(plotPressureDist);
  clearCanvas(plotSurfaceVelocity);
  if (fourierPairSelect){
    fourierPairSelect.replaceChildren();
    fourierPairSelect.disabled = true;
  }
  if (distributionFrameLabel) distributionFrameLabel.textContent = '0/0';
  setStatus('status_running');

  try{
    const Uref = getStrictPositiveInputNumber('Uref', 'Freestream U');
    const chord = getStrictPositiveInputNumber('c', 'Chord c');
    const motion = selectedKinematics(chord, Uref);
    const { pitchName, plungeName, rows: kin, t, tau, alpha, h, dalpha, d2alpha, dh, d2h } = motion;
    const geometry = selectedAirfoilGeometry(getAirfoilSectionCount());
    const airName = geometry.name || airSelect.value;

    const hooks = {
      onProgress: (k, it)=>{
        if (k % 20 === 0) setStatus('status_running_progress', { progress: (100*k/it).toFixed(1) });
      }
    };

    SIM = {
      pitchName,
      plungeName,
      kin,
      airName,
      t, tau, alpha, h, dalpha, d2alpha, dh, d2h,
      Uref,
      c: chord,
      xp: getPercent('xp'),
      xref: getPercent('xref'),
      airfoil: geometry.chord,
      camberLine: geometry.camber,
      airfoilOutline: geometry.outline,
      airfoilUpper: geometry.upper,
      airfoilLower: geometry.lower,
      camberCoefficients: geometry.camberCoefficients,
      thicknessCoefficients: geometry.thicknessCoefficients
    };

    const params = {
      Uref,
      c: chord,
      xp: getPercent('xp'),
      xref: getPercent('xref'),
      nAterm: Math.floor(getNum('nAterm')),
      t, alpha, h, dalpha, d2alpha, dh, d2h,
      airfoil: geometry.chord,
      camberCoefficients: geometry.camberCoefficients,
      thicknessCoefficients: geometry.thicknessCoefficients,
      nascentBeta: 0.5,
      maxWake: 0,
      wakeSaveStride: 1,
      wakeWakeNeighbors: -1
    };

    out = await runSolverInWorker(params, hooks);
    populateFourierPairSelector();
    GLOBAL_GSCALE = null;
    GLOBAL_FLOW_BOUNDS = null;
    FIXED_DISTRIBUTION_BOUNDS = null;
    getGlobalFlowBounds();

    setStatus(out.stopped ? 'status_stopped' : 'status_done');
    syncExportControls();
    runActive = false;
    runStopBtn.disabled = false;
    updateRunStopButton();

    // Enable animation and begin automatically at human-readable frame 1.
    const nFrames = getFrameCount();
    frameSlider.max = String(nFrames - 1);
    frameSlider.value = '0';
    anim.frame = -1;
    frameSlider.disabled = false;
    playPauseBtn.disabled = false;
    repeatBtn.disabled = false;
    updateRepeatButton();
    updateFrameCounter();

    plotKinematicHistories(0);
    plotLoads(0);
    plotFourierCoefficients(0);
    if (!out.stopped && nFrames > 0){
      anim.playing = true;
      updatePlayPauseButton();
      tick();
    } else {
      anim.frame = 0;
      anim.playing = false;
      updatePlayPauseButton();
      drawFrame(0);
    }

  } catch(e){
    const stopped = e?.name === 'AbortError' || stopRequested;
    setStatus(stopped ? 'status_stopped' : 'status_error', stopped ? {} : { message: e.message });
    runActive = false;
    runStopBtn.disabled = false;
    updateRunStopButton();
    playPauseBtn.disabled = true;
    repeatBtn.disabled = true;
    updatePlayPauseButton();
    updateRepeatButton();
    updateFrameCounter();
    syncExportControls();
  }
});

frameSlider.addEventListener('input', ()=>{
  setFrame(Number(frameSlider.value));
});

function syncKinematicPanels(){
  const pitchSource = normalizedKinematicSource(pitchKinSelect.value);
  const plungeSource = normalizedKinematicSource(plungeKinSelect.value);
  [
    ['pitchConstantFields', pitchSource === 'constant'],
    ['pitchSinusoidalFields', pitchSource === 'sinusoidal'],
    ['pitchSmoothRampFields', pitchSource === 'smooth_ramp'],
    ['pitchCosineCycleFields', pitchSource === 'cosine_cycle'],
    ['plungeConstantFields', plungeSource === 'constant'],
    ['plungeSinusoidalFields', plungeSource === 'sinusoidal'],
    ['plungeSmoothRampFields', plungeSource === 'smooth_ramp'],
    ['plungeCosineCycleFields', plungeSource === 'cosine_cycle']
  ].forEach(([id, visible])=>{
    const element = document.getElementById(id);
    if (element) element.hidden = !visible;
  });
  drawKinematicsPreview();
}

function bindKinematicControls(){
  [
    pitchKinSelect,
    plungeKinSelect,
    document.getElementById('Uref'),
    document.getElementById('c'),
    document.getElementById('dt'),
    document.getElementById('nSteps'),
    document.getElementById('pitchConstantValue'),
    document.getElementById('pitchFrequency'),
    document.getElementById('pitchAmplitude'),
    document.getElementById('pitchPhase'),
    document.getElementById('pitchSmoothAmplitude'),
    document.getElementById('pitchSmoothSharpness'),
    document.getElementById('pitchSmoothT1'),
    document.getElementById('pitchSmoothT2'),
    document.getElementById('pitchCosineFrequency'),
    document.getElementById('pitchCosineAmplitude'),
    document.getElementById('pitchCosineZeta'),
    document.getElementById('pitchCosinePhase'),
    document.getElementById('plungeConstantValue'),
    document.getElementById('plungeFrequency'),
    document.getElementById('plungeAmplitude'),
    document.getElementById('plungePhase'),
    document.getElementById('plungeSmoothAmplitude'),
    document.getElementById('plungeSmoothSharpness'),
    document.getElementById('plungeSmoothT1'),
    document.getElementById('plungeSmoothT2'),
    document.getElementById('plungeCosineFrequency'),
    document.getElementById('plungeCosineAmplitude'),
    document.getElementById('plungeCosineZeta'),
    document.getElementById('plungeCosinePhase')
  ].forEach((element)=>{
    element?.addEventListener('input', syncKinematicPanels);
    element?.addEventListener('change', syncKinematicPanels);
  });
}

bindKinematicControls();

function bindAirfoilControls(){
  [airSelect, airfoilSectionsInput, document.getElementById('xp'), document.getElementById('xref')].forEach((element)=>{
    element?.addEventListener('input', syncAirfoilControls);
    element?.addEventListener('change', syncAirfoilControls);
  });

  const nacaInputs = [
    document.getElementById('nacaMaxCamber'),
    document.getElementById('nacaCamberLocation'),
    document.getElementById('nacaThickness')
  ];
  nacaInputs.forEach((element)=>{
    element?.addEventListener('keydown', (event)=>{
      if (['.', ',', 'e', 'E', '+', '-'].includes(event.key)) event.preventDefault();
    });
    element?.addEventListener('input', ()=>{
      const value = Number(element.value);
      if (element.value !== '' && Number.isFinite(value) && !Number.isInteger(value)){
        element.value = String(Math.trunc(value));
      }
      syncAirfoilControls();
    });
    element?.addEventListener('change', syncAirfoilControls);
  });
}

function syncAirfoilControls(){
  if (naca4Fields) naca4Fields.hidden = airSelect?.value !== 'naca4';
  drawAirfoilPreview();
}

bindAirfoilControls();

function getCirculationScaleFactor(){
  const raw = Number(circulationScaleInput?.value);
  if (!Number.isFinite(raw)) return 1;
  return Math.max(1e-10, Math.min(1, raw));
}

function updateCirculationScaleOutput(){
  if (!circulationScaleValue) return;
  const raw = Number(circulationScaleInput?.value);
  circulationScaleValue.value = raw <= 0 ? '1e-10' : getCirculationScaleFactor().toFixed(2);
}

// segmented control for vortex colors
function syncVortexColorControls(){
  const scaleActive = vortexMode === 'gamma' || vortexMode === 'edge';
  if (circulationScaleInput) circulationScaleInput.disabled = !scaleActive;
  circulationScaleInput?.closest('.circulation-scale-row')?.classList.toggle('is-disabled', !scaleActive);
}

vortexColorMode?.addEventListener('click', (ev)=>{
  const btn = ev.target.closest('button');
  if (!btn) return;
  const mode = btn.dataset.mode;
  vortexMode = mode;
  [...vortexColorMode.querySelectorAll('.segbtn')].forEach(b=>b.classList.toggle('active', b===btn));
  syncVortexColorControls();
  drawFrame(Number(frameSlider.value||0));
});

circulationScaleInput?.addEventListener('input', ()=>{
  updateCirculationScaleOutput();
  drawFrame(Number(frameSlider.value || 0));
});
circulationScaleInput?.addEventListener('change', updateCirculationScaleOutput);
updateCirculationScaleOutput();
syncVortexColorControls();


function updatePlayPauseButton(){
  if (!playPauseBtn) return;
  const label = translated(anim.playing ? 'pause' : 'play');
  const icon = anim.playing
    ? '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><rect x="3" y="2.5" width="3.5" height="11" rx="1"></rect><rect x="9.5" y="2.5" width="3.5" height="11" rx="1"></rect></svg>'
    : '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4 2.7v10.6c0 .78.85 1.26 1.52.86l8.24-5.3a1 1 0 0 0 0-1.72L5.52 1.84A1 1 0 0 0 4 2.7z"></path></svg>';
  playPauseBtn.innerHTML = `<span class="play-pause-icon">${icon}</span><span>${label}</span>`;
  playPauseBtn.setAttribute('aria-label', label);
}

function updateRepeatButton(){
  if (!repeatBtn) return;
  repeatBtn.checked = !!anim.repeat;
  repeatBtn.setAttribute('aria-checked', anim.repeat ? 'true' : 'false');
}

function updateFrameCounter(){
  const total = getFrameCount();
  if (!total){
    if (frameCounter) frameCounter.textContent = '0/0';
    frameMiniLabels.forEach((label)=>{ label.textContent = '0/0'; });
    frameStepButtons.forEach((button)=>{ button.disabled = true; });
    return;
  }
  const current = Math.max(0, Math.min(total - 1, Number(frameSlider.value || anim.frame || 0)));
  const label = `${current + 1}/${total}`;
  if (frameCounter) frameCounter.textContent = label;
  frameMiniLabels.forEach((element)=>{ element.textContent = label; });
  frameStepButtons.forEach((button)=>{
    button.disabled = !out;
  });
}

function setFrame(frame){
  if (!out) return;
  const total = getFrameCount();
  if (!total) return;
  const next = Math.max(0, Math.min(total - 1, Math.round(Number(frame) || 0)));
  anim.frame = next;
  frameSlider.value = String(next);
  drawFrame(next);
  updateFrameCounter();
}

function stepFrame(delta){
  if (anim.playing){
    anim.playing = false;
    if (anim.raf) cancelAnimationFrame(anim.raf);
    anim.raf = null;
    updatePlayPauseButton();
  }
  const current = Number(frameSlider.value || anim.frame || 0);
  const total = getFrameCount();
  const next = ((Math.round(current + delta) % total) + total) % total;
  setFrame(next);
}

let frameHoldDelay = null;
let frameHoldTimer = null;

function clearFrameStepHold(){
  if (frameHoldDelay){
    clearTimeout(frameHoldDelay);
    frameHoldDelay = null;
  }
  if (frameHoldTimer){
    clearInterval(frameHoldTimer);
    frameHoldTimer = null;
  }
}

frameStepButtons.forEach((button)=>{
  const stepFromButton = () => Number(button.dataset.frameStep || 0);
  button.addEventListener('pointerdown', (event)=>{
    if (button.disabled) return;
    event.preventDefault();
    clearFrameStepHold();
    const step = stepFromButton();
    stepFrame(step);
    frameHoldDelay = setTimeout(()=>{
      frameHoldTimer = setInterval(()=>{
        if (button.disabled){
          clearFrameStepHold();
          return;
        }
        stepFrame(step);
      }, 55);
    }, 230);
  });
  button.addEventListener('click', (event)=>{
    // Keyboard-initiated clicks have detail = 0; pointer clicks are handled
    // by pointerdown so press-and-hold does not double-step on release.
    if (event.detail === 0) stepFrame(stepFromButton());
  });
  button.addEventListener('pointerup', clearFrameStepHold);
  button.addEventListener('pointercancel', clearFrameStepHold);
  button.addEventListener('pointerleave', clearFrameStepHold);
  button.addEventListener('blur', clearFrameStepHold);
});
window.addEventListener('pointerup', clearFrameStepHold);
window.addEventListener('pointercancel', clearFrameStepHold);

playPauseBtn.addEventListener('click', ()=>{
  if (!out) return;
  const nFrames = getFrameCount();
  if (!nFrames) return;

  if (anim.playing){
    anim.playing = false;
    if (anim.raf){
      cancelAnimationFrame(anim.raf);
      anim.raf = null;
    }
  } else {
    const sliderFrame = Number(frameSlider.value || anim.frame || 0);
    anim.frame = Math.max(0, Math.min(nFrames - 1, Number.isFinite(sliderFrame) ? sliderFrame : 0));
    if (anim.frame >= nFrames - 1){
      anim.frame = -1;
    }
    anim.playing = true;
    tick();
  }
  updatePlayPauseButton();
});

repeatBtn?.addEventListener('change', ()=>{
  anim.repeat = !!repeatBtn.checked;
  updateRepeatButton();
});

function tick(){
  if (!anim.playing || !out) return;
  const nFrames = getFrameCount();
  if (!nFrames){
    anim.playing = false;
    anim.raf = null;
    updatePlayPauseButton();
    updateFrameCounter();
    return;
  }
  anim.frame = anim.repeat ? ((anim.frame + 1) % nFrames) : Math.min(anim.frame + 1, nFrames - 1);
  frameSlider.value = String(anim.frame);
  drawFrame(anim.frame);
  updateFrameCounter();
  if (anim.frame >= nFrames - 1 && !anim.repeat){
    anim.playing = false;
    anim.raf = null;
    updatePlayPauseButton();
    return;
  }
  anim.raf = requestAnimationFrame(tick);
}

// --- drawing helpers ---
function clear(ctx,w,h){
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle = COLORS.canvasBg;
  ctx.fillRect(0,0,w,h);
}

function clearCanvas(canvas){
  if (!canvas) return;
  clear(canvas.getContext('2d'), canvas.width, canvas.height);
}

function drawAxes(ctx, w, h, box){
  ctx.strokeStyle = COLORS.canvasGrid;
  ctx.lineWidth = 1;
  ctx.strokeRect(box.x, box.y, box.w, box.h);
}

function niceStep(range, targetTicks=5){
  // returns a "nice" step size (1,2,5 * 10^k)
  const raw = range / Math.max(1, targetTicks);
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const frac = raw / pow;
  let niceFrac = 1;
  if (frac <= 1) niceFrac = 1;
  else if (frac <= 2) niceFrac = 2;
  else if (frac <= 5) niceFrac = 5;
  else niceFrac = 10;
  return niceFrac * pow;
}

function formatTickValue(value){
  if (!Number.isFinite(value)) return '—';
  const magnitude = Math.abs(value);
  if (magnitude < 1e-12) return '0';
  if (magnitude >= 1e5 || magnitude < 1e-4) return value.toExponential(1);
  const decimalPlaces = Math.max(0, Math.min(6, 1 - Math.floor(Math.log10(magnitude))));
  return value.toFixed(decimalPlaces);
}

function drawPlotAxes(ctx, box, xmin, xmax, ymin, ymax, xlabel, ylabel, options = {}){
  // axes: left + bottom, with ticks and labels
  const showYTicks = options.showYTicks !== false;
  const showYTickLabels = options.showYTickLabels !== false;
  const invertY = options.invertY === true;
  const ylabelOffset = Number.isFinite(options.ylabelOffset) ? options.ylabelOffset : 52;
  ctx.save();
  ctx.fillStyle = COLORS.canvasText;
  ctx.lineWidth = 1;

  // y-axis: readable, but secondary to the data.
  ctx.strokeStyle = COLORS.canvasAxis;
  ctx.beginPath();
  ctx.moveTo(box.x, box.y);
  ctx.lineTo(box.x, box.y + box.h);
  ctx.stroke();

  const xRange = xmax - xmin;
  const yRange = ymax - ymin;
  const xStep = niceStep(xRange, 5);
  const yStep = niceStep(yRange, 5);

  // x-axis/baseline: dashed and located at the physical y = 0 level.
  if (ymin <= 0 && ymax >= 0 && yRange > 0){
    const zeroFraction = (0 - ymin) / yRange;
    const zeroY = box.y + (invertY ? zeroFraction : 1 - zeroFraction) * box.h;
    ctx.save();
    ctx.strokeStyle = COLORS.canvasAxis;
    ctx.globalAlpha = 0.86;
    ctx.lineWidth = 1.05;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(box.x, zeroY);
    ctx.lineTo(box.x + box.w, zeroY);
    ctx.stroke();
    ctx.restore();
  }

  // ticks
  ctx.font = "11px system-ui";

  // x ticks
  ctx.strokeStyle = COLORS.canvasGrid;
  const xStart = Math.ceil(xmin / xStep) * xStep;
  for (let xv = xStart; xv <= xmax + 1e-12; xv += xStep){
    const u = (xv - xmin) / (xmax - xmin);
    const X = box.x + u * box.w;
    const Y = box.y + box.h;
    ctx.beginPath();
    ctx.moveTo(X, Y);
    ctx.lineTo(X, Y + 5);
    ctx.stroke();
    const s = formatTickValue(xv);
    ctx.fillText(s, X - 10, Y + 18);
  }

  if (showYTicks){
    ctx.strokeStyle = COLORS.canvasAxis;
    // y ticks
    const yStart = Math.ceil(ymin / yStep) * yStep;
    for (let yv = yStart; yv <= ymax + 1e-12; yv += yStep){
      const v = (yv - ymin) / (ymax - ymin);
      const X = box.x;
      const Y = box.y + (invertY ? v : 1 - v) * box.h;
      ctx.beginPath();
      ctx.moveTo(X - 5, Y);
      ctx.lineTo(X, Y);
      ctx.stroke();
      if (showYTickLabels){
        const s = formatTickValue(yv);
        ctx.fillText(s, X - 42, Y + 4);
      }
    }
  }

  // labels
  ctx.font = "12px system-ui";
  if (xlabel){
    ctx.fillText(xlabel, box.x + box.w/2 - 10, box.y + box.h + 34);
  }
  if (ylabel){
    ctx.save();
    ctx.translate(box.x - ylabelOffset, box.y + box.h/2);
    ctx.rotate(-Math.PI/2);
    if (ylabel?.kind === 'gammaHatB'){
      ctx.fillStyle = COLORS.canvasText;
      ctx.font = 'italic 14px Georgia, "Times New Roman", serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      const gamma = 'Γ';
      const gammaWidth = ctx.measureText(gamma).width;
      const subscriptWidth = 6;
      const startX = -0.5*(gammaWidth + subscriptWidth);
      ctx.fillText(gamma, startX, 4);
      ctx.strokeStyle = COLORS.canvasText;
      ctx.lineWidth = 1.15;
      ctx.beginPath();
      ctx.moveTo(startX + 1, -8);
      ctx.lineTo(startX + 0.5*gammaWidth, -11);
      ctx.lineTo(startX + gammaWidth - 1, -8);
      ctx.stroke();
      ctx.font = 'italic 9px Georgia, "Times New Roman", serif';
      ctx.fillText('b', startX + gammaWidth + 1, 8);
    } else {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(ylabel), 0, 0);
    }
    ctx.restore();
  }
  ctx.restore();
}

function paddedRange(values, fallbackSpan = 1){
  let min = Infinity;
  let max = -Infinity;
  for (const value of values){
    if (!Number.isFinite(value)) continue;
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)){
    min = -fallbackSpan;
    max = fallbackSpan;
  }
  if (min === max){
    const span = Math.max(Math.abs(min) * 0.2, fallbackSpan);
    min -= span;
    max += span;
  }
  const pad = 0.1 * (max - min);
  return { min: min - pad, max: max + pad };
}

function drawKinematicsCurve(ctx, box, t, y, ylabel, color, xlabel = '', yRange = null, axisOptions = {}){
  const xmin = t[0] ?? 0;
  const xmax = t[t.length - 1] ?? 1;
  const yr = yRange || paddedRange(y, 0.05);
  drawPlotAxes(ctx, box, xmin, xmax, yr.min, yr.max, xlabel, ylabel, axisOptions);

  const bounds = { xmin, xmax, zmin: yr.min, zmax: yr.max };
  if (Array.isArray(axisOptions.verticalGuides)){
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();
    ctx.strokeStyle = COLORS.canvasAxis;
    ctx.fillStyle = COLORS.canvasText;
    ctx.globalAlpha = 0.78;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.font = '11px system-ui';
    ctx.textAlign = 'center';
    for (const guide of axisOptions.verticalGuides){
      const gx = Number(guide?.x);
      if (!Number.isFinite(gx) || gx < xmin || gx > xmax) continue;
      const gy = Number.isFinite(guide?.y) ? Number(guide.y) : 0;
      const q0 = worldToCanvas(gx, 0, box, bounds);
      const q1 = worldToCanvas(gx, gy, box, bounds);
      ctx.beginPath();
      ctx.moveTo(q0.X, q0.Y);
      ctx.lineTo(q1.X, q1.Y);
      ctx.stroke();
      if (guide.label){
        ctx.setLineDash([]);
        ctx.textBaseline = gy >= 0 ? 'top' : 'bottom';
        ctx.fillText(guide.label, q0.X, q0.Y + (gy >= 0 ? 5 : -5));
        ctx.setLineDash([5, 5]);
      }
    }
    ctx.restore();
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.w, box.h);
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.9;
  ctx.beginPath();
  for (let i=0; i<t.length; i++){
    const q = worldToCanvas(t[i], y[i], box, bounds);
    if (i === 0) ctx.moveTo(q.X, q.Y);
    else ctx.lineTo(q.X, q.Y);
  }
  ctx.stroke();
  ctx.restore();
}

function buildPreviewSeries(config){
  const n = 241;
  const x = new Array(n);
  const y = new Array(n);
  const Uref = positiveNumber(document.getElementById('Uref')?.value, 1);
  const chord = positiveNumber(document.getElementById('c')?.value, 1);
  const tauPerSecond = 2*Uref/chord;
  if (config.source === 'sinusoidal'){
    const period = 1/positiveNumber(config.frequency, 1);
    for (let i=0; i<n; i++){
      const phase = i / (n - 1);
      x[i] = tauPerSecond*period*phase;
      y[i] = 0.92 * Math.sin(TWO_PI * phase);
    }
    return { x, y, xlabel: 'τ' };
  }

  if (config.source === 'smooth_ramp'){
    const sharpness = positiveNumber(config.sharpness, 8);
    const t1 = Math.max(0, Number.isFinite(config.t1) ? config.t1 : 1);
    const rawT2 = Number.isFinite(config.t2) ? config.t2 : 3;
    const t2 = rawT2 > t1 ? rawT2 : t1 + Math.max(0.2, 1 / sharpness);
    const duration = Math.max(t2 - t1, 1e-9);
    const xmin = 0;
    const xmax = Math.max(t1 + t2, t2 + 1e-6, 1e-6);
    const K = 1 / (2 * duration);
    const rampPreviewY = (time)=>{
      const a1 = sharpness * (time - t1);
      const a2 = sharpness * (time - t2);
      const yRaw = (K / sharpness) * (logCosh(a1) - logCosh(a2)) + 0.5;
      return 0.92 * (2 * yRaw - 1);
    };
    for (let i=0; i<n; i++){
      const time = xmin + (i / (n - 1)) * (xmax - xmin);
      x[i] = tauPerSecond*time;
      y[i] = rampPreviewY(time);
    }
    return {
      x,
      y,
      xlabel: 'τ',
      guides: [
        { x: tauPerSecond*t1, y: rampPreviewY(t1), label: 'τ₁' },
        { x: tauPerSecond*t2, y: rampPreviewY(t2), label: 'τ₂' }
      ]
    };
  }

  if (config.source === 'cosine_cycle'){
    const zeta = Math.max(0.001, Math.min(0.999, Number.isFinite(config.zeta) ? config.zeta : 0.5));
    const period = 1/positiveNumber(config.frequency, 1);
    for (let i=0; i<n; i++){
      const phase = i / (n - 1);
      const yRaw = phase < zeta
        ? 1 - Math.cos(Math.PI * phase / zeta)
        : 1 - Math.cos(Math.PI * (1 - phase) / (1 - zeta));
      x[i] = tauPerSecond*period*phase;
      y[i] = 0.46 * yRaw;
    }
    return {
      x,
      y,
      xlabel: 'τ',
      guides: [{ x: tauPerSecond*period*zeta, y: 0.92, label: 'ζ' }]
    };
  }

  const dtau = positiveNumber(document.getElementById('dt')?.value, 0.01);
  const steps = Math.max(3, Math.floor(positiveNumber(document.getElementById('nSteps')?.value, 500)));
  const tauEnd = dtau*(steps - 1);
  for (let i=0; i<n; i++){
    x[i] = tauEnd*i/(n - 1);
    y[i] = 0;
  }
  return { x, y, xlabel: 'τ' };
}

function drawSingleKinematicPreview(canvas, config, ylabel, color){
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  clear(ctx, w, h);

  const { x, y, xlabel, guides } = buildPreviewSeries(config);
  const box = { x: 62, y: 18, w: w - 88, h: h - 62 };
  drawKinematicsCurve(ctx, box, x, y, ylabel, color, xlabel, { min: -1, max: 1 }, {
    showYTicks: false,
    ylabelOffset: 30,
    verticalGuides: guides
  });
}

function drawKinematicsPreview(){
  const pitchConfig = getKinematicConfig('pitch');
  const plungeConfig = getKinematicConfig('plunge');
  drawSingleKinematicPreview(
    plotPitchKinematics,
    pitchConfig,
    'α',
    COLORS.accent2
  );
  drawSingleKinematicPreview(
    plotPlungeKinematics,
    plungeConfig,
    'h',
    COLORS.accent2
  );
}

function worldToCanvas(x, z, box, bounds){
  const {xmin,xmax,zmin,zmax} = bounds;
  const u = (x - xmin)/(xmax - xmin);
  const v = (z - zmin)/(zmax - zmin);
  return {
    X: box.x + u*box.w,
    Y: box.y + (1-v)*box.h
  };
}

function lerp(a,b,t){ return a + (b-a)*t; }
function rgb(r,g,b){ return `rgb(${r|0},${g|0},${b|0})`; }
function getMidRGB(){
  const theme = document.documentElement.getAttribute('data-theme') || 'light';
  // Requirement: zero circulation must map to white (light mode) or black (dark mode)
  return (theme === 'light') ? [255,255,255] : [0,0,0];
}
function vortexColor(G, Gmax){
  if (!Number.isFinite(G) || !Number.isFinite(Gmax) || Gmax <= 0) return COLORS.accent2;

  const mid = getMidRGB();
  const red = [255, 40, 40];
  const blue = [40, 120, 255];
  if (!Number.isFinite(Gmax) || Gmax <= 0) return COLORS.accent2;
  const ratio = G/Gmax;
  if (!Number.isFinite(ratio)) return COLORS.accent2;
  const x = Math.max(-1, Math.min(1, ratio));
  if (x >= 0){
    const t = x;
    return rgb(lerp(mid[0], red[0], t), lerp(mid[1], red[1], t), lerp(mid[2], red[2], t));
  } else {
    const t = -x;
    return rgb(lerp(mid[0], blue[0], t), lerp(mid[1], blue[1], t), lerp(mid[2], blue[2], t));
  }
}

function displayedVortexColor(G, Gmax, edge){
  if (vortexMode === 'uniform') return COLORS.accent2;
  if (vortexMode === 'edge'){
    const circulation = Number(G);
    const strength = (!Number.isFinite(Gmax) || Gmax <= 0)
      ? 1
      : Math.max(0.08, Math.min(1, Number.isFinite(circulation) ? Math.abs(circulation)/Gmax : 0.08));
    return edgeVortexColor(edge, strength);
  }
  return vortexColor(G, Gmax);
}

function edgeVortexColor(edge, alpha = 1){
  const darkTheme = document.documentElement.getAttribute('data-theme') === 'dark';
  const rgb = edge === 'TE'
    ? (darkTheme ? [251,113,133] : [220,38,38])
    : (darkTheme ? [96,165,250] : [37,99,235]);
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${Math.max(0, Math.min(1, alpha))})`;
}

function getWakeSnapshot(frame, edge = 'TE'){
  const snapshots = out?.flowfield?.[edge];
  if (!snapshots) return null;
  if (snapshots[frame]) return snapshots[frame];
  const stride = Math.max(1, out.flowfield.wakeSaveStride || 1);
  // jump directly to the last saved stride-aligned snapshot
  let k = frame - (frame % stride);
  for (; k >= 0; k -= stride){
    if (snapshots[k]) return snapshots[k];
  }
  return snapshots[0] || null;
}

function getFrameCount(){
  return Math.max(
    out?.flowfield?.TE?.length || 0,
    out?.flowfield?.LE?.length || 0,
    SIM?.t?.length || 0
  );
}

function wakeLength(w){
  if (!w) return 0;
  if (Array.isArray(w)) return w.length;
  if (w.re && typeof w.re.length === 'number') return w.re.length;
  return 0;
}

let GLOBAL_FLOW_BOUNDS = null;
function getGlobalFlowBounds(){
  if (GLOBAL_FLOW_BOUNDS) return GLOBAL_FLOW_BOUNDS;
  if (!out || !SIM || !DATA) return null;

  const kin = SIM.kin || [];
  const airfoil = SIM.airfoilOutline || SIM.airfoil || [];
  const chord = Math.max(Math.abs(SIM.c), 1e-9);
  const pivot = SIM.xp * SIM.c;
  const U = SIM.Uref;
  let xmin = Infinity;
  let xmax = -Infinity;
  let maxAbsVortexZ = 0;
  let maxAbsAirfoilZ = 0;

  for (let frame=0; frame<kin.length; frame++){
    const row = kin[frame];
    if (!row) continue;
    const t = Number(row[0]) || 0;
    const alpha = Number(row[1]) || 0;
    const plunge = Number(row[2]) || 0;
    for (const edge of ['TE', 'LE']){
      const wake = getWakeSnapshot(frame, edge);
      if (Array.isArray(wake)){
        for (const vortex of wake){
          const x = Number(vortex.re);
          const z = Number(vortex.im);
          if (Number.isFinite(x)){
            xmin = Math.min(xmin, x);
            xmax = Math.max(xmax, x);
          }
          if (Number.isFinite(z)) maxAbsVortexZ = Math.max(maxAbsVortexZ, Math.abs(z));
        }
      } else if (wake?.im){
        for (let i=0; i<wake.im.length; i++){
          const x = Number(wake.re[i]);
          const z = Number(wake.im[i]);
          if (Number.isFinite(x)){
            xmin = Math.min(xmin, x);
            xmax = Math.max(xmax, x);
          }
          if (Number.isFinite(z)) maxAbsVortexZ = Math.max(maxAbsVortexZ, Math.abs(z));
        }
      }
    }

    const ca = Math.cos(alpha);
    const sa = Math.sin(alpha);
    for (const point of airfoil){
      const xr = point[0] * SIM.c - pivot;
      const yi = point[1] * SIM.c;
      const x = xr * ca + yi * sa - U * t;
      const z = -xr * sa + yi * ca;
      const zFixed = z + plunge;
      if (Number.isFinite(x)){
        xmin = Math.min(xmin, x);
        xmax = Math.max(xmax, x);
      }
      if (Number.isFinite(zFixed)) maxAbsAirfoilZ = Math.max(maxAbsAirfoilZ, Math.abs(zFixed));
    }
  }

  const measuredExtent = Math.max(maxAbsVortexZ, maxAbsAirfoilZ);
  const zLimit = Math.max(0.05 * chord, 1.15 * measuredExtent);
  if (!Number.isFinite(xmin) || !Number.isFinite(xmax)){
    xmin = -chord;
    xmax = 0;
  }

  // Use a constant fixed-frame origin at the rightmost point in the full
  // trajectory. This keeps the view fixed while presenting the domain as
  // roughly -L < x/c < 0, instead of following the airfoil body.
  const xOrigin = Math.max(xmax, 0);
  const xPad = Math.max(0.03 * Math.max(xmax - xmin, chord), 0.03 * chord);
  const shiftedMin = xmin - xOrigin - xPad;
  // Keep the fixed-frame view anchored near -L < x/c, but leave a real
  // right-side margin so early wake/airfoil markers are not clipped at x = 0.
  const shiftedMax = Math.max(xmax - xOrigin + xPad, xPad);
  const xRange = Math.max(shiftedMax - shiftedMin, 1e-9);
  const box = flowPlotBox();
  const equalScaleZLimit = 0.5 * xRange * (box.h / Math.max(box.w, 1));
  const visualZLimit = zLimit;
  const balancedZLimit = Math.max(
    visualZLimit,
    Math.min(equalScaleZLimit, visualZLimit * FLOWFIELD_EQUALITY_LIMIT_MULTIPLIER)
  );

  GLOBAL_FLOW_BOUNDS = {
    xmin: shiftedMin,
    xmax: shiftedMax,
    zmin: -balancedZLimit,
    zmax: balancedZLimit,
    xOrigin,
    maxAbsVortexZ,
    maxAbsAirfoilZ,
    visualZLimit,
    equalScaleZLimit
  };
  return GLOBAL_FLOW_BOUNDS;
}


let GLOBAL_GSCALE = null;
function getGlobalGScale(){
  if (!out) return 1e-12;
  const ff = out.flowfield || {};
  if (Number.isFinite(ff.maxAbsG) && ff.maxAbsG > 0) return ff.maxAbsG;
  if (Number.isFinite(GLOBAL_GSCALE) && GLOBAL_GSCALE > 0) return GLOBAL_GSCALE;

  let gmax = 0;
  for (const edge of ['TE', 'LE']){
    const snapshots = ff[edge];
    if (!Array.isArray(snapshots)) continue;
    for (const snapshot of snapshots){
      if (Array.isArray(snapshot)){
        for (const vortex of snapshot){
          const g = Number(vortex?.G);
          if (Number.isFinite(g)) gmax = Math.max(gmax, Math.abs(g));
        }
      } else if (snapshot?.G && typeof snapshot.G.length === 'number'){
        for (let i=0; i<snapshot.G.length; i++){
          const g = Number(snapshot.G[i]);
          if (Number.isFinite(g)) gmax = Math.max(gmax, Math.abs(g));
        }
      }
    }
  }
  GLOBAL_GSCALE = Math.max(gmax, 1e-12);
  return GLOBAL_GSCALE;
}

function getActiveGScale(){
  return Math.max(getGlobalGScale()*getCirculationScaleFactor(), 1e-10);
}

function drawCirculationColorbox(ctx, box, gLimit){
  if (vortexMode !== 'gamma' || !Number.isFinite(gLimit) || gLimit <= 0) return;
  const width = 154;
  const height = 11;
  const x = box.x + 14;
  const y = box.y + 12;
  const gradient = ctx.createLinearGradient(x, 0, x + width, 0);
  gradient.addColorStop(0, vortexColor(-gLimit, gLimit));
  gradient.addColorStop(0.5, vortexColor(0, gLimit));
  gradient.addColorStop(1, vortexColor(gLimit, gLimit));

  ctx.save();
  ctx.fillStyle = COLORS.canvasBg;
  ctx.globalAlpha = 0.88;
  ctx.fillRect(x - 8, y - 10, width + 16, height + 34);
  ctx.globalAlpha = 1;
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, height);
  ctx.fillStyle = COLORS.canvasText;
  ctx.font = '10.5px system-ui';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText(`−${formatPlotValue(gLimit)}`, x, y + height + 4);
  ctx.textAlign = 'center';
  ctx.fillText('0', x + width/2, y + height + 4);
  ctx.textAlign = 'right';
  ctx.fillText(formatPlotValue(gLimit), x + width, y + height + 4);
  ctx.textAlign = 'center';
  ctx.fillText(translated('circulation'), x + width/2, y - 10);
  ctx.restore();
}

function drawEdgeLegend(ctx, box){
  if (vortexMode !== 'edge') return;
  const entries = [
    { edge:'TE', label:translated('trailing_edge') },
    { edge:'LE', label:translated('leading_edge') }
  ];
  const x = box.x + 14;
  const y = box.y + 14;
  ctx.save();
  ctx.font = '11px system-ui';
  ctx.textBaseline = 'middle';
  const widest = Math.max(...entries.map(({ label })=>ctx.measureText(label).width));
  ctx.fillStyle = COLORS.canvasBg;
  ctx.globalAlpha = 0.88;
  ctx.fillRect(x - 8, y - 9, widest + 38, entries.length*22 + 8);
  ctx.globalAlpha = 1;
  entries.forEach(({ edge, label }, index)=>{
    const rowY = y + index*22;
    ctx.fillStyle = edgeVortexColor(edge);
    ctx.fillRect(x, rowY - 5, 10, 10);
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, rowY - 5, 10, 10);
    ctx.fillStyle = COLORS.canvasText;
    ctx.fillText(label, x + 17, rowY);
  });
  ctx.restore();
}

function drawFrame(frame){
  if (!out || !DATA) return;
  const ctx = flowCanvas.getContext('2d');
  const w = flowCanvas.width, h = flowCanvas.height;
  clear(ctx,w,h);

  const box = flowPlotBox();
  drawAxes(ctx,w,h,box);

  const kin = SIM.kin;
  const air = SIM.airfoilOutline || SIM.airfoil || [];

  const U = getNum('Uref');
  const c = getNum('c');
  const xp = getPercent('xp');

  const tK = kin[frame][0];
  const aK = kin[frame][1];
  const hK = kin[frame][2];
  const globalFlow = getGlobalFlowBounds();
  const xOrigin = globalFlow?.xOrigin || 0;

  // Bounds/data are plotted in the fixed frame. The only x transform is a
  // constant origin shift so the right edge reads near x/c = 0 for every frame.
  let xmin = Infinity, xmax = -Infinity;
  let zmin = Infinity, zmax = -Infinity;

  const wake = getWakeSnapshot(frame, 'TE');
  const leWake = getWakeSnapshot(frame, 'LE');
  for (const edgeWake of [wake, leWake]){
    if (edgeWake){
      if (Array.isArray(edgeWake)){
        for (const p of edgeWake){
          const Xp = p.re - xOrigin;
          const Zp = p.im;
          xmin = Math.min(xmin, Xp); xmax = Math.max(xmax, Xp);
          zmin = Math.min(zmin, Zp); zmax = Math.max(zmax, Zp);
        }
      } else {
        for (let i=0;i<edgeWake.re.length;i++){
          const Xp = edgeWake.re[i] - xOrigin;
          const Zp = edgeWake.im[i];
          xmin = Math.min(xmin, Xp); xmax = Math.max(xmax, Xp);
          zmin = Math.min(zmin, Zp); zmax = Math.max(zmax, Zp);
        }
      }
    }
  }

  const ca = Math.cos(aK), sa = Math.sin(aK);
  const xpAbs = xp*c;

  for (const p of air){
    const xr = p[0]*c - xpAbs;
    const yi = p[1]*c;
    const Xp = xr*ca + yi*sa - U*tK - xOrigin;
    const Zp = -xr*sa + yi*ca + hK;
    xmin = Math.min(xmin, Xp); xmax = Math.max(xmax, Xp);
    zmin = Math.min(zmin, Zp); zmax = Math.max(zmax, Zp);
  }

  const xMinData = xmin, xMaxData = xmax;
  const zMinData = zmin, zMaxData = zmax;

  if (globalFlow){
    xmin = globalFlow.xmin;
    xmax = globalFlow.xmax;
    zmin = globalFlow.zmin;
    zmax = globalFlow.zmax;
  } else {
    const fallbackXMin = Number.isFinite(xMinData) ? xMinData : -c;
    const fallbackXMax = Number.isFinite(xMaxData) ? xMaxData : 0;
    const xr = Math.max(fallbackXMax - fallbackXMin, 0.25*c);
    const px = 0.08 * xr;
    xmin = fallbackXMin - px;
    xmax = fallbackXMax + px;

    const fallbackMin = Number.isFinite(zMinData) ? zMinData : -0.05*c;
    const fallbackMax = Number.isFinite(zMaxData) ? zMaxData : 0.05*c;
    const zc = 0.5*(fallbackMax + fallbackMin);
    const zr = Math.max(fallbackMax - fallbackMin, 0.1*c);
    zmin = zc - 0.575*zr;
    zmax = zc + 0.575*zr;
  }


  const bounds = {xmin,xmax,zmin,zmax};
  flowCanvas.dataset.xMin = String(xmin);
  flowCanvas.dataset.xMax = String(xmax);
  flowCanvas.dataset.xOrigin = String(xOrigin);
  flowCanvas.dataset.zMin = String(zmin);
  flowCanvas.dataset.zMax = String(zmax);
  flowCanvas.dataset.maxVortexHeight = String(globalFlow?.maxAbsVortexZ || 0);
  flowCanvas.dataset.axisEqual = "false";

  // fixed-frame axes
  const O = worldToCanvas(0,0,box,bounds);
  ctx.strokeStyle = COLORS.canvasAxis;

  // Keep the horizontal x/c axis readable but secondary to the wake and airfoil.
  ctx.save();
  ctx.strokeStyle = COLORS.canvasAxis;
  ctx.globalAlpha = 0.86;
  ctx.lineWidth = 1.05;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(box.x, O.Y); ctx.lineTo(box.x + box.w, O.Y);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.68;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(O.X, box.y); ctx.lineTo(O.X, box.y + box.h);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = COLORS.canvasText;
  ctx.font = "12px system-ui";
  ctx.fillText("x/c", box.x + box.w - 24, O.Y - 6);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.translate(O.X + 14, box.y + 32);
  ctx.rotate(-Math.PI/2);
  ctx.fillText("z/c", 0, 0);
  ctx.restore();

  // Three explicit z/c ticks make the automatically fitted scale readable.
  ctx.save();
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (const zTick of [zmax, 0, zmin]){
    const q = worldToCanvas(0, zTick, box, bounds);
    const normalized = Math.abs(zTick/c) < 5e-7 ? 0 : zTick/c;
    ctx.beginPath();
    ctx.moveTo(O.X - 4, q.Y);
    ctx.lineTo(O.X + 4, q.Y);
    ctx.stroke();
    ctx.fillText(normalized.toFixed(2), O.X - 7, q.Y);
  }
  ctx.restore();

  // airfoil in the fixed frame
  ctx.strokeStyle = COLORS.text;
  ctx.lineWidth = 2.1;
  ctx.beginPath();
  for (let i=0;i<air.length;i++){
    const p = air[i];
    const xr = p[0]*c - xpAbs;
    const yi = p[1]*c;
    const Xp = xr*ca + yi*sa - U*tK - xOrigin;
    const Zp = -xr*sa + yi*ca + hK;
    const q = worldToCanvas(Xp, Zp, box, bounds);
    if (i===0) ctx.moveTo(q.X,q.Y);
    else ctx.lineTo(q.X,q.Y);
  }
  ctx.stroke();

  // wake vortices
  let activeGScale = null;
  if (showWake.checked){
    activeGScale = getActiveGScale();

    const drawWakeSnapshot = (edgeWake, edge)=>{
      if (!edgeWake) return;
      if (Array.isArray(edgeWake)){
        for (let i=0;i<edgeWake.length;i++){
          const p = edgeWake[i];
          const g = (p.G ?? 0);
          const q = worldToCanvas(p.re - xOrigin, p.im, box, bounds);
          ctx.fillStyle = displayedVortexColor(g, activeGScale, edge);
          ctx.beginPath();
          ctx.arc(q.X,q.Y,3.0,0,Math.PI*2);
          ctx.fill();
        }
      } else {
        const wr = edgeWake.re, wi = edgeWake.im, wG = edgeWake.G;
        for (let i=0;i<wr.length;i++){
          const g = wG[i];
          const q = worldToCanvas(wr[i] - xOrigin, wi[i], box, bounds);
          ctx.fillStyle = displayedVortexColor(g, activeGScale, edge);
          ctx.beginPath();
          ctx.arc(q.X,q.Y,3.0,0,Math.PI*2);
          ctx.fill();
        }
      }
    };
    drawWakeSnapshot(wake, 'TE');
    drawWakeSnapshot(leWake, 'LE');
  }
  drawCirculationColorbox(ctx, box, activeGScale || getActiveGScale());
  drawEdgeLegend(ctx, box);

  // Place the pivot marker on the reconstructed camber line at x_p/c.
  const pivotZ = interpolatePolylineY(SIM.camberLine || SIM.airfoil || [], xp)*c;
  const pivotPoint = worldToCanvas(
    pivotZ*sa - U*tK - xOrigin,
    pivotZ*ca + hK,
    box,
    bounds
  );
  ctx.save();
  const darkTheme = document.documentElement.getAttribute('data-theme') === 'dark';
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = darkTheme ? '#f8fafc' : '#ffffff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(pivotPoint.X, pivotPoint.Y, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

// footer text
  ctx.fillStyle = COLORS.canvasText;
  ctx.font = "12px system-ui";
  const nFrames = getFrameCount();
  ctx.fillText(`frame ${frame + 1}/${nFrames}`, 50, h-18);
  updateFrameCounter();
  plotDistributions(frame);
  updateKinematicHistoryMarkers(frame);
  updateLoadMarkers(frame);
  updateFourierMarkers(frame);
}

// simple line plot on canvas
function plotLine(canvas, x, y, title, ylabel){
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  clear(ctx,w,h);
  const box = {x:60,y:18,w:w-85,h:h-58};

  const xmin = x[0], xmax = x[x.length-1];
  let ymin = Infinity, ymax = -Infinity;
  for (const v of y){ ymin = Math.min(ymin,v); ymax = Math.max(ymax,v); }
  if (!isFinite(ymin) || ymin===ymax){ ymin -= 1; ymax += 1; }

  // small padding
  const py = 0.08*(ymax - ymin + 1e-9);
  ymin -= py; ymax += py;

  drawPlotAxes(ctx, box, xmin, xmax, ymin, ymax, "t", ylabel || "");

  // plot
  const bounds = {xmin,xmax,zmin:ymin,zmax:ymax};
  ctx.strokeStyle = COLORS.accent;
  ctx.lineWidth = 1.75;
  ctx.beginPath();
  for (let i=0;i<x.length;i++){
    const q = worldToCanvas(x[i], y[i], box, bounds);
    if (i===0) ctx.moveTo(q.X,q.Y);
    else ctx.lineTo(q.X,q.Y);
  }
  ctx.stroke();

  // title
  ctx.fillStyle = COLORS.canvasText;
  ctx.font = "12px system-ui";
  ctx.fillText(title, 10, 14);
}


function binarySearchNearest(x, value){
  let lo = 0, hi = x.length - 1;
  while (hi - lo > 1){
    const mid = (lo + hi) >> 1;
    if (x[mid] < value) lo = mid;
    else hi = mid;
  }
  return (Math.abs(x[lo]-value) <= Math.abs(x[hi]-value)) ? lo : hi;
}

function nearestFiniteIndex(x, y, value){
  if (!x?.length) return 0;
  const guess = binarySearchNearest(x, value);
  if (Number.isFinite(x[guess]) && Number.isFinite(y?.[guess])) return guess;

  let best = -1;
  let bestDistance = Infinity;
  for (let i=0; i<x.length; i++){
    if (!Number.isFinite(x[i]) || !Number.isFinite(y?.[i])) continue;
    const distance = Math.abs(x[i] - value);
    if (distance < bestDistance){
      bestDistance = distance;
      best = i;
    }
  }
  return best >= 0 ? best : Math.max(0, Math.min(x.length - 1, guess));
}

function formatPlotValue(value){
  if (!Number.isFinite(value)) return '—';
  const mag = Math.abs(value);
  if (mag > 0 && (mag < 1e-4 || mag >= 1e4)) return value.toExponential(4);
  return value.toFixed(6);
}

function drawPlot(canvas, state, hoverIdx = null){
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  clear(ctx,w,h);
  const box = {x:62,y:38,w:w-90,h:h-78};

  const x = state.x, y = state.y;
  const xmin = x[0], xmax = x[x.length-1];
  let ymin = Infinity, ymax = -Infinity;
  for (const v of y){
    if (!Number.isFinite(v)) continue;
    ymin = Math.min(ymin,v); ymax = Math.max(ymax,v);
  }
  if (!Number.isFinite(ymin) || !Number.isFinite(ymax)){ ymin = -1; ymax = 1; }
  else if (ymin===ymax){ ymin -= 1; ymax += 1; }
  const py = 0.10*(ymax - ymin + 1e-9);
  ymin -= py; ymax += py;

  state.bounds = {xmin,xmax,ymin,ymax, box};
  const xlabel = state.xlabel || 't';
  drawPlotAxes(ctx, box, xmin, xmax, ymin, ymax, xlabel, state.axisLabel || state.ylabel);

  const bounds = {xmin,xmax,zmin:ymin,zmax:ymax};
  ctx.strokeStyle = COLORS.accent;
  ctx.lineWidth = 1.75;
  ctx.beginPath();
  let drawing = false;
  for (let i=0;i<x.length;i++){
    if (!Number.isFinite(x[i]) || !Number.isFinite(y[i])){
      drawing = false;
      continue;
    }
    const q = worldToCanvas(x[i], y[i], box, bounds);
    if (!drawing){ ctx.moveTo(q.X,q.Y); drawing = true; }
    else ctx.lineTo(q.X,q.Y);
  }
  ctx.stroke();

  ctx.fillStyle = COLORS.canvasText;
  ctx.font = '12px system-ui';
  ctx.fillText(state.title, 10, 16);

  const markerIdxRaw = hoverIdx !== null ? hoverIdx : state.activeIdx;
  if (Number.isFinite(markerIdxRaw)){
    const markerIdx = Math.max(0, Math.min(x.length - 1, Math.round(markerIdxRaw)));
    if (!Number.isFinite(x[markerIdx]) || !Number.isFinite(y[markerIdx])) return;
    const q = worldToCanvas(x[markerIdx], y[markerIdx], box, bounds);
    const markerColor = hoverIdx !== null ? COLORS.accent2 : '#ef4444';
    ctx.save();
    ctx.strokeStyle = markerColor;
    ctx.fillStyle = markerColor;
    ctx.lineWidth = hoverIdx !== null ? 1 : 1.25;
    ctx.setLineDash(hoverIdx !== null ? [4,4] : [3,5]);
    ctx.beginPath();
    ctx.moveTo(q.X, box.y); ctx.lineTo(q.X, box.y + box.h);
    if (hoverIdx !== null){
      ctx.moveTo(box.x, q.Y); ctx.lineTo(box.x + box.w, q.Y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(q.X, q.Y, hoverIdx !== null ? 3.5 : 4.2, 0, Math.PI*2); ctx.fill();
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = COLORS.canvasBg;
    ctx.stroke();
    ctx.restore();
  }
}

function attachPlotHover(canvas){
  canvas.addEventListener('mousemove', (ev)=>{
    const st = canvas.__plotState;
    if (!st || !st.bounds) return;

    const rect = canvas.getBoundingClientRect();
    const mx = (ev.clientX - rect.left) * (canvas.width / rect.width);
    const my = (ev.clientY - rect.top)  * (canvas.height / rect.height);

    const {xmin,xmax, box} = st.bounds;
    if (mx < box.x || mx > box.x+box.w || my < box.y || my > box.y+box.h){
      tooltip.hidden = true;
      drawPlot(canvas, st, null);
      return;
    }

    const tVal = xmin + ((mx - box.x)/box.w)*(xmax - xmin);
    const idx = binarySearchNearest(st.x, tVal);
    drawPlot(canvas, st, idx);

    const xVal = st.x[idx];
    const yVal = st.y[idx];

    tooltip.innerHTML =
      '<div><b>'+st.ylabel+'</b> <span class="muted">'+translated('versus')+'</span> <b>'+(st.xlabel || 't')+'</b></div>' +
      '<div class="muted">'+(st.xlabel || 't')+' = '+xVal.toFixed(4)+'</div>' +
      '<div class="muted">'+st.ylabel+' = '+yVal.toFixed(6)+'</div>';
    tooltip.hidden = false;
    tooltip.style.left = (ev.clientX + 14) + 'px';
    tooltip.style.top  = (ev.clientY + 14) + 'px';
  });

  canvas.addEventListener('mouseleave', ()=>{
    const st = canvas.__plotState;
    if (st) drawPlot(canvas, st, null);
    tooltip.hidden = true;
  });
}

function activeFrameIndex(frame = Number(frameSlider.value || 0)){
  const total = getFrameCount();
  if (!total) return 0;
  const value = Number(frame);
  return Math.max(0, Math.min(total - 1, Number.isFinite(value) ? Math.round(value) : 0));
}

function plotKinematicHistories(frame = Number(frameSlider.value || 0)){
  if (!SIM?.tau?.length) return;
  const x = SIM.tau;
  const activeIdx = activeFrameIndex(frame);
  const timeScale = SIM.c/(2*SIM.Uref);
  const radiansToDegrees = 180/Math.PI;
  const alpha = SIM.alpha.map((value)=>value*radiansToDegrees);
  const dalpha = SIM.dalpha.map((value)=>value*timeScale*radiansToDegrees);
  const d2alpha = SIM.d2alpha.map((value)=>value*timeScale*timeScale*radiansToDegrees);
  const plunge = SIM.h.map((value)=>value/SIM.c);
  const dplunge = SIM.dh.map((value)=>value*timeScale/SIM.c);
  const d2plunge = SIM.d2h.map((value)=>value*timeScale*timeScale/SIM.c);
  const plots = [
    [plotAlpha, alpha, translated('pitch_angle_history'), 'α [deg]'],
    [plotDAlpha, dalpha, translated('pitch_rate_history'), 'α′ [deg]'],
    [plotD2Alpha, d2alpha, translated('pitch_acceleration_history'), 'α″ [deg]'],
    [plotH, plunge, translated('plunge_history'), 'h/c'],
    [plotDH, dplunge, translated('plunge_rate_history'), 'h′/c'],
    [plotD2H, d2plunge, translated('plunge_acceleration_history'), 'h″/c']
  ];

  for (const [canvas, y, title, ylabel] of plots){
    if (!canvas) continue;
    canvas.__plotState = { x, y, title, ylabel, xlabel:'τ', activeIdx };
    drawPlot(canvas, canvas.__plotState);
    if (!canvas.__hoverAttached){ attachPlotHover(canvas); canvas.__hoverAttached = true; }
  }
}

function updateKinematicHistoryMarkers(frame = Number(frameSlider.value || 0)){
  const activeIdx = activeFrameIndex(frame);
  for (const canvas of [plotAlpha, plotDAlpha, plotD2Alpha, plotH, plotDH, plotD2H]){
    const state = canvas?.__plotState;
    if (!state) continue;
    state.activeIdx = activeIdx;
    drawPlot(canvas, state);
  }
}

function plotLoads(frame = Number(frameSlider.value || 0)){
  const x = SIM.tau || SIM.t;
  const circulationScale = Math.PI*SIM.c*SIM.Uref;
  const GammaHat = out.GammaHat?.length
    ? Array.from(out.GammaHat, Number)
    : Array.from(out.Gamma || [], (value)=>Number(value)/circulationScale);
  const stagnationPoint = Array.from(out.stagnationPoint || [], (value)=>100*Number(value));
  const CL = out.loads.map(r=>r[2]);
  const CD = out.loads.map(r=>r[3]);
  const CM = out.loads.map(r=>r[4]);
  const Cs = out.loads.map((row)=>Number(row?.[1]));
  const activeIdx = activeFrameIndex(frame);

  plotGamma.__plotState = {
    x, y: GammaHat,
    title: translated('circulation_history'),
    ylabel: 'Gamma-hat b',
    axisLabel: { kind:'gammaHatB' },
    xlabel: 'τ', activeIdx
  };
  plotStagnationPoint.__plotState = { x, y: stagnationPoint, title: translated('stagnation_point_location'), ylabel: 'x_s/c [%]', xlabel: 'τ', activeIdx };
  plotCL.__plotState = { x, y: CL, title: translated('lift_coefficient'), ylabel: 'C_L', xlabel: 'τ', activeIdx };
  plotCD.__plotState = { x, y: CD, title: translated('drag_coefficient'), ylabel: 'C_D', xlabel: 'τ', activeIdx };
  plotCM.__plotState = { x, y: CM, title: translated('moment_coefficient'), ylabel: 'C_M', xlabel: 'τ', activeIdx };
  plotCs.__plotState = { x, y: Cs, title: translated('suction_coefficient'), ylabel: 'C_S', xlabel: 'τ', activeIdx };

  drawPlot(plotGamma, plotGamma.__plotState);
  drawPlot(plotStagnationPoint, plotStagnationPoint.__plotState);
  drawPlot(plotCL, plotCL.__plotState);
  drawPlot(plotCD, plotCD.__plotState);
  drawPlot(plotCM, plotCM.__plotState);
  drawPlot(plotCs, plotCs.__plotState);

  if (!plotGamma.__hoverAttached){ attachPlotHover(plotGamma); plotGamma.__hoverAttached = true; }
  if (!plotStagnationPoint.__hoverAttached){ attachPlotHover(plotStagnationPoint); plotStagnationPoint.__hoverAttached = true; }
  if (!plotCL.__hoverAttached){ attachPlotHover(plotCL); plotCL.__hoverAttached = true; }
  if (!plotCD.__hoverAttached){ attachPlotHover(plotCD); plotCD.__hoverAttached = true; }
  if (!plotCM.__hoverAttached){ attachPlotHover(plotCM); plotCM.__hoverAttached = true; }
  if (!plotCs.__hoverAttached){ attachPlotHover(plotCs); plotCs.__hoverAttached = true; }
}

function updateLoadMarkers(frame = Number(frameSlider.value || 0)){
  const activeIdx = activeFrameIndex(frame);
  for (const canvas of [plotGamma, plotStagnationPoint, plotCL, plotCD, plotCM, plotCs]){
    const state = canvas?.__plotState;
    if (!state) continue;
    state.activeIdx = activeIdx;
    drawPlot(canvas, state);
  }
}

function populateFourierPairSelector(){
  if (!fourierPairSelect) return;
  const previous = Number(fourierPairSelect.value || 0);
  fourierPairSelect.replaceChildren();
  const coefficientCount = Number(out?.fourier?.[0]?.length || 0);
  for (let first=0; first<coefficientCount; first+=4){
    const last = Math.min(first + 3, coefficientCount - 1);
    const option = document.createElement('option');
    option.value = String(first);
    const coefficientLabel = first === last ? `A${first}` : `A${first}–A${last}`;
    option.textContent = first === 0 ? `${coefficientLabel} (A0 = LESP)` : coefficientLabel;
    fourierPairSelect.appendChild(option);
  }
  const available = Array.from(fourierPairSelect.options).map((option)=>Number(option.value));
  fourierPairSelect.value = String(available.includes(previous) ? previous : (available[0] || 0));
  fourierPairSelect.disabled = available.length === 0;
}

function plotFourierCoefficients(frame = Number(frameSlider.value || 0)){
  if (!out?.fourier?.length || !SIM) return;
  const x = SIM.tau || SIM.t;
  const first = Math.max(0, Math.floor(Number(fourierPairSelect?.value || 0)));
  const coefficientCount = Number(out.fourier[0]?.length || 0);
  const activeIdx = activeFrameIndex(frame);
  const configure = (canvas, mode)=>{
    if (!canvas) return;
    if (mode >= coefficientCount){
      canvas.__plotState = null;
      clearCanvas(canvas);
      return;
    }
    const y = out.fourier.map((coefficients)=>Number(coefficients?.[mode]));
    canvas.__plotState = {
      x, y,
      title: mode === 0 ? 'A0(τ) = LESP(τ)' : `A${mode}(τ)`,
      ylabel: mode === 0 ? 'A_0 = LESP' : `A_${mode}`,
      xlabel: 'τ',
      activeIdx
    };
    drawPlot(canvas, canvas.__plotState);
    if (!canvas.__hoverAttached){ attachPlotHover(canvas); canvas.__hoverAttached = true; }
  };
  configure(plotFourierFirst, first);
  configure(plotFourierSecond, first + 1);
  configure(plotFourierThird, first + 2);
  configure(plotFourierFourth, first + 3);
}

function updateFourierMarkers(frame = Number(frameSlider.value || 0)){
  const activeIdx = activeFrameIndex(frame);
  for (const canvas of [plotFourierFirst, plotFourierSecond, plotFourierThird, plotFourierFourth]){
    const state = canvas?.__plotState;
    if (!state) continue;
    state.activeIdx = activeIdx;
    drawPlot(canvas, state);
  }
}

fourierPairSelect?.addEventListener('change', ()=>{
  plotFourierCoefficients(Number(frameSlider.value || 0));
});

function panelCenterX(){
  const air = SIM?.airfoil || [];
  const x = [];
  for (let i=0; i<air.length - 1; i++){
    x.push(0.5 * (Number(air[i][0]) + Number(air[i + 1][0])));
  }
  return x;
}

function fittedDistributionBounds(seriesInput, kind){
  let ymin = Infinity;
  let ymax = -Infinity;
  for (const entry of seriesInput || []){
    for (const rawValue of entry?.y || []){
      const value = Number(rawValue);
      if (!Number.isFinite(value)) continue;
      ymin = Math.min(ymin, value);
      ymax = Math.max(ymax, value);
    }
  }

  if (!Number.isFinite(ymin) || !Number.isFinite(ymax)){
    return kind === 'velocity' ? { ymin:-1, ymax:1 } : { ymin:-2, ymax:2 };
  }
  if (Math.abs(ymax - ymin) < 1e-12){
    const center = 0.5*(ymin + ymax);
    const halfSpan = Math.max(
      kind === 'velocity' ? 0.02 : 0.05,
      0.05*Math.abs(center),
      1e-4
    );
    ymin = center - halfSpan;
    ymax = center + halfSpan;
  }

  const span = ymax - ymin;
  const pad = 0.06*span;
  const step = niceStep(span + 2*pad, 7);
  return {
    ymin:Math.floor((ymin - pad)/step)*step,
    ymax:Math.ceil((ymax + pad)/step)*step
  };
}

function sortedQuantile(sortedValues, fraction){
  if (!sortedValues.length) return NaN;
  const position = Math.max(0, Math.min(1, fraction))*(sortedValues.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sortedValues[lower];
  const weight = position - lower;
  return sortedValues[lower]*(1 - weight) + sortedValues[upper]*weight;
}

let FIXED_DISTRIBUTION_BOUNDS = null;
function fixedDistributionBounds(kind){
  if (FIXED_DISTRIBUTION_BOUNDS?.[kind]) return FIXED_DISTRIBUTION_BOUNDS[kind];

  const frames = kind === 'velocity' ? out?.surfaceVelocity : out?.pressure;
  const values = [];
  for (let frameIndex=0; frameIndex<(frames?.length || 0); frameIndex++){
    const frame = frames[frameIndex];
    for (const series of [frame?.upper, frame?.lower]){
      for (const rawValue of series || []){
        const value = Number(rawValue);
        if (Number.isFinite(value)) values.push(value);
      }
    }
    const leadingEdge = out?.leadingEdge?.[frameIndex];
    const endpointValues = kind === 'velocity'
      ? [leadingEdge?.velocity?.upper, leadingEdge?.velocity?.lower]
      : [leadingEdge?.pressure?.upper, leadingEdge?.pressure?.lower];
    for (const rawValue of endpointValues){
      const value = Number(rawValue);
      if (Number.isFinite(value)) values.push(value);
    }
  }
  values.sort((a,b)=>a-b);
  const cropFraction = values.length >= 200 ? 0.01 : 0;
  const croppedExtent = [
    sortedQuantile(values, cropFraction),
    sortedQuantile(values, 1 - cropFraction)
  ];

  FIXED_DISTRIBUTION_BOUNDS ||= {};
  FIXED_DISTRIBUTION_BOUNDS[kind] = fittedDistributionBounds([{ y:croppedExtent }], kind);
  return FIXED_DISTRIBUTION_BOUNDS[kind];
}

function drawDistributionPlot(canvas, x, y, title, ylabel, hoverIdx = null, kind = 'pressure'){
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  clear(ctx,w,h);
  if (!x?.length || !y?.length){
    canvas.__distributionState = null;
    ctx.fillStyle = COLORS.muted;
    ctx.font = '13px system-ui';
    ctx.fillText(translated('distribution_unavailable'), 18, 34);
    return;
  }

  const n = Math.min(x.length, y.length);
  const xPlot = x.slice(0, n);
  const yPlot = Array.from(y).slice(0, n).map(Number);
  const box = {x:62,y:38,w:w-90,h:h-78};
  const xmin = 0;
  const xmax = 1;
  const { ymin, ymax } = fixedDistributionBounds(kind);
  const invertY = kind === 'pressure';
  const bounds = {
    xmin, xmax,
    zmin:invertY ? ymax : ymin,
    zmax:invertY ? ymin : ymax
  };

  drawPlotAxes(ctx, box, xmin, xmax, ymin, ymax, 'x/c', ylabel, { invertY });

  canvas.__distributionState = {
    x: xPlot,
    y: yPlot,
    title,
    ylabel,
    kind,
    bounds: { xmin, xmax, ymin, ymax, box }
  };

  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.w, box.h);
  ctx.clip();
  ctx.strokeStyle = COLORS.accent;
  ctx.lineWidth = 1.75;
  let drawing = false;
  ctx.beginPath();
  for (let i=0; i<n; i++){
    if (!Number.isFinite(xPlot[i]) || !Number.isFinite(yPlot[i])){
      drawing = false;
      continue;
    }
    const q = worldToCanvas(xPlot[i], yPlot[i], box, bounds);
    if (!drawing){
      ctx.moveTo(q.X,q.Y);
      drawing = true;
    }
    else ctx.lineTo(q.X,q.Y);
  }
  ctx.stroke();

  ctx.restore();

  if (Number.isFinite(hoverIdx)){
    const markerIdx = Math.max(0, Math.min(n - 1, Math.round(hoverIdx)));
    if (Number.isFinite(xPlot[markerIdx]) && Number.isFinite(yPlot[markerIdx])){
      const q = worldToCanvas(xPlot[markerIdx], yPlot[markerIdx], box, bounds);
      ctx.save();
      ctx.beginPath();
      ctx.rect(box.x, box.y, box.w, box.h);
      ctx.clip();
      ctx.strokeStyle = COLORS.accent2;
      ctx.fillStyle = COLORS.accent2;
      ctx.lineWidth = 1;
      ctx.setLineDash([4,4]);
      ctx.beginPath();
      ctx.moveTo(q.X, box.y); ctx.lineTo(q.X, box.y + box.h);
      ctx.moveTo(box.x, q.Y); ctx.lineTo(box.x + box.w, q.Y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(q.X, q.Y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = COLORS.canvasBg;
      ctx.stroke();
      ctx.restore();
    }
  }

  ctx.fillStyle = COLORS.canvasText;
  ctx.font = '12px system-ui';
  ctx.fillText(title, 10, 16);
}

function drawDistributionMultiPlot(canvas, x, seriesInput, title, ylabel, hoverIdx = null, kind = 'pressure'){
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  clear(ctx,w,h);
  const series = (seriesInput || [])
    .map((entry)=>({
      label: entry.label,
      color: entry.color,
      y: Array.from(entry.y || [], Number)
    }))
    .filter((entry)=>entry.y.length);
  if (!x?.length || !series.length){
    canvas.__distributionState = null;
    ctx.fillStyle = COLORS.muted;
    ctx.font = '13px system-ui';
    ctx.fillText(translated('distribution_unavailable'), 18, 34);
    return;
  }

  const n = Math.min(x.length, ...series.map((entry)=>entry.y.length));
  const xPlot = x.slice(0, n);
  series.forEach((entry)=>{ entry.y = entry.y.slice(0, n); });
  const box = {x:62,y:38,w:w-90,h:h-78};
  const xmin = 0, xmax = 1;
  const { ymin, ymax } = fixedDistributionBounds(kind);
  const invertY = kind === 'pressure';
  const bounds = {
    xmin, xmax,
    zmin:invertY ? ymax : ymin,
    zmax:invertY ? ymin : ymax
  };
  drawPlotAxes(ctx, box, xmin, xmax, ymin, ymax, 'x/c', ylabel, { invertY });

  canvas.__distributionState = {
    x: xPlot, series, title, ylabel, kind,
    bounds: { xmin, xmax, ymin, ymax, box }
  };

  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.w, box.h);
  ctx.clip();
  for (const entry of series){
    ctx.strokeStyle = entry.color;
    ctx.lineWidth = 1.75;
    ctx.beginPath();
    let drawing = false;
    for (let i=0; i<n; i++){
      const yValue = entry.y[i];
      if (!Number.isFinite(xPlot[i]) || !Number.isFinite(yValue)){
        drawing = false;
        continue;
      }
      const q = worldToCanvas(xPlot[i], yValue, box, bounds);
      if (!drawing){ ctx.moveTo(q.X,q.Y); drawing = true; }
      else ctx.lineTo(q.X,q.Y);
    }
    ctx.stroke();
  }
  ctx.restore();

  if (Number.isFinite(hoverIdx)){
    const markerIdx = Math.max(0, Math.min(n - 1, Math.round(hoverIdx)));
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();
    for (const entry of series){
      if (!Number.isFinite(xPlot[markerIdx]) || !Number.isFinite(entry.y[markerIdx])) continue;
      const q = worldToCanvas(xPlot[markerIdx], entry.y[markerIdx], box, bounds);
      ctx.fillStyle = entry.color;
      ctx.beginPath(); ctx.arc(q.X, q.Y, 3.5, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = COLORS.canvasBg; ctx.lineWidth = 1.2; ctx.stroke();
    }
    ctx.restore();
  }

  ctx.fillStyle = COLORS.canvasText;
  ctx.font = '12px system-ui';
  ctx.textAlign = 'left';
  ctx.fillText(title, 10, 16);
  let legendX = w - 12;
  ctx.textAlign = 'right';
  for (let i=series.length - 1; i>=0; i--){
    const entry = series[i];
    ctx.fillStyle = COLORS.canvasText;
    ctx.fillText(entry.label, legendX, 16);
    const width = ctx.measureText(entry.label).width;
    ctx.fillStyle = entry.color;
    ctx.fillRect(legendX - width - 17, 11, 11, 3);
    legendX -= width + 34;
  }
  ctx.textAlign = 'left';
}

function redrawDistributionState(canvas, hoverIdx = null){
  const state = canvas.__distributionState;
  if (!state) return;
  if (state.series){
    drawDistributionMultiPlot(
      canvas, state.x, state.series, state.title, state.ylabel, hoverIdx, state.kind
    );
  } else {
    drawDistributionPlot(
      canvas, state.x, state.y, state.title, state.ylabel, hoverIdx, state.kind
    );
  }
}

function attachDistributionHover(canvas){
  canvas.addEventListener('mousemove', (ev)=>{
    const st = canvas.__distributionState;
    if (!st || !st.bounds) return;

    const rect = canvas.getBoundingClientRect();
    const mx = (ev.clientX - rect.left) * (canvas.width / rect.width);
    const my = (ev.clientY - rect.top)  * (canvas.height / rect.height);

    const { xmin, xmax, box } = st.bounds;
    if (mx < box.x || mx > box.x + box.w || my < box.y || my > box.y + box.h){
      tooltip.hidden = true;
      redrawDistributionState(canvas);
      return;
    }

    const xValue = xmin + ((mx - box.x) / box.w) * (xmax - xmin);
    const referenceY = st.series?.[0]?.y || st.y;
    const idx = nearestFiniteIndex(st.x, referenceY, xValue);
    redrawDistributionState(canvas, idx);

    const xVal = st.x[idx];
    const values = st.series
      ? st.series.map((entry)=>'<div class="muted">'+entry.label+' = '+formatPlotValue(entry.y[idx])+'</div>').join('')
      : '<div class="muted">'+st.ylabel+' = '+formatPlotValue(st.y[idx])+'</div>';
    tooltip.innerHTML = '<div><b>'+st.ylabel+'</b> <span class="muted">'+translated('versus')+'</span> <b>x/c</b></div>'
      + '<div class="muted">x/c = '+formatPlotValue(xVal)+'</div>' + values;
    tooltip.hidden = false;
    tooltip.style.left = (ev.clientX + 14) + 'px';
    tooltip.style.top  = (ev.clientY + 14) + 'px';
  });

  canvas.addEventListener('mouseleave', ()=>{
    redrawDistributionState(canvas);
    tooltip.hidden = true;
  });
}

function plotDistributions(frame = Number(frameSlider.value || 0)){
  if (!out || !SIM) return;
  const nFrames = getFrameCount();
  if (!nFrames) return;
  const k = Math.max(0, Math.min(nFrames - 1, Number(frame) || 0));
  const x = Array.from(out.surfaceX || panelCenterX(), Number);
  const pressure = out.pressure?.[k];
  const surfaceVelocity = out.surfaceVelocity?.[k];
  const leadingEdge = out.leadingEdge?.[k];
  const hasLeadingEdge = Number(leadingEdge?.x) === 0
    && Number.isFinite(Number(leadingEdge?.pressure?.upper))
    && Number.isFinite(Number(leadingEdge?.pressure?.lower));
  const distributionX = hasLeadingEdge ? [0, ...x] : x;
  const pressureUpper = hasLeadingEdge
    ? [Number(leadingEdge.pressure.upper), ...Array.from(pressure?.upper || [], Number)]
    : pressure?.upper;
  const pressureLower = hasLeadingEdge
    ? [Number(leadingEdge.pressure.lower), ...Array.from(pressure?.lower || [], Number)]
    : pressure?.lower;
  const velocityUpper = hasLeadingEdge
    ? [Number(leadingEdge.velocity.upper), ...Array.from(surfaceVelocity?.upper || [], Number)]
    : surfaceVelocity?.upper;
  const velocityLower = hasLeadingEdge
    ? [Number(leadingEdge.velocity.lower), ...Array.from(surfaceVelocity?.lower || [], Number)]
    : surfaceVelocity?.lower;

  drawDistributionMultiPlot(
    plotPressureDist,
    distributionX,
    [
      { label: translated('upper_surface'), y: pressureUpper, color: '#dc2626' },
      { label: translated('lower_surface'), y: pressureLower, color: '#2563eb' }
    ],
    translated('pressure_distribution'),
    'C_p',
    null,
    'pressure'
  );
  drawDistributionMultiPlot(
    plotSurfaceVelocity,
    distributionX,
    [
      { label: translated('upper_surface'), y: velocityUpper, color: '#dc2626' },
      { label: translated('lower_surface'), y: velocityLower, color: '#2563eb' }
    ],
    translated('surface_velocity_distribution'),
    'V_t/U_ref',
    null,
    'velocity'
  );
  if (!plotPressureDist.__hoverAttached){ attachDistributionHover(plotPressureDist); plotPressureDist.__hoverAttached = true; }
  if (!plotSurfaceVelocity.__hoverAttached){ attachDistributionHover(plotSurfaceVelocity); plotSurfaceVelocity.__hoverAttached = true; }
  if (distributionFrameLabel) distributionFrameLabel.textContent = `${k + 1}/${nFrames}`;
}

function exportTable(columns, data){
  const names = Array.isArray(columns)
    ? columns
    : String(columns).split(',').map((name)=>name.trim()).filter(Boolean);
  const rows = Array.from(data || []);
  const table = {};
  names.forEach((name, column)=>{
    table[name] = rows.map((row)=>{
      const value = Number(row?.[column]);
      return Number.isFinite(value) ? value : NaN;
    });
  });
  return table;
}

function numericRows(rows){
  return Array.from(rows || [], (row)=>Array.from(row || [], (value)=>Number(value)));
}

function captureSimulationInputs(){
  const inputs = {};
  const selector = [
    '#inputsContent input[id]', '#inputsContent select[id]',
    '#airfoilContent input[id]', '#airfoilContent select[id]',
    '#kinematicsContent input[id]', '#kinematicsContent select[id]'
  ].join(',');
  document.querySelectorAll(selector).forEach((element)=>{
    if (element.type === 'checkbox') inputs[element.id] = element.checked;
    else if (element.type === 'number' || element.type === 'range'){
      const value = Number(element.value);
      inputs[element.id] = Number.isFinite(value) ? value : element.value;
    } else inputs[element.id] = element.value;
  });
  return inputs;
}

function geometryExportData(){
  const coefficientRows = (values)=>Array.from(values || [], (value, index)=>[index, Number(value)]);
  return {
    name:SIM.airName || '',
    chord:exportTable('x_over_c,z_over_c', numericRows(SIM.airfoil)),
    camber:exportTable('x_over_c,z_over_c', numericRows(SIM.camberLine)),
    outline:exportTable('x_over_c,z_over_c', numericRows(SIM.airfoilOutline)),
    upper:exportTable('x_over_c,z_over_c', numericRows(SIM.airfoilUpper)),
    lower:exportTable('x_over_c,z_over_c', numericRows(SIM.airfoilLower)),
    camber_coefficients:exportTable('mode,value', coefficientRows(SIM.camberCoefficients)),
    thickness_coefficients:exportTable('mode,value', coefficientRows(SIM.thicknessCoefficients))
  };
}

function historyExportData(){
  const count = SIM.t?.length || 0;
  const kinematics = [];
  const loads = [];
  const aerodynamics = [];
  const fourier = [];
  for (let frame=0; frame<count; frame++){
    const prefix = [frame, Number(SIM.t?.[frame]), Number(SIM.tau?.[frame])];
    kinematics.push([
      ...prefix,
      Number(SIM.alpha?.[frame]), Number(SIM.h?.[frame]),
      Number(SIM.dalpha?.[frame]), Number(SIM.d2alpha?.[frame]),
      Number(SIM.dh?.[frame]), Number(SIM.d2h?.[frame])
    ]);
    loads.push([...prefix, ...Array.from(out.loads?.[frame] || [], Number)]);
    const A0 = Number(out.fourier?.[frame]?.[0] ?? out.LESP?.[frame]);
    const LESP = Number(out.LESP?.[frame]);
    aerodynamics.push([
      ...prefix,
      Number(out.Gamma?.[frame]),
      Number(out.GammaHat?.[frame] ?? Number(out.Gamma?.[frame])/(Math.PI*SIM.c*SIM.Uref)),
      Number(out.stagnationPoint?.[frame]), 100*Number(out.stagnationPoint?.[frame]),
      A0, LESP, Number(out.kelvinResidual?.[frame]),
      Number(out.kelvinResidual?.[frame])/(Math.PI*SIM.c*SIM.Uref)
    ]);
    fourier.push([...prefix, ...Array.from(out.fourier?.[frame] || [], Number)]);
  }
  let fourierCount = 0;
  for (const row of out.fourier || []) fourierCount = Math.max(fourierCount, row?.length || 0);
  return {
    kinematics:exportTable(
      'frame,t_s,tau,alpha_rad,h_m,dalpha_rad_per_s,d2alpha_rad_per_s2,dh_m_per_s,d2h_m_per_s2',
      kinematics
    ),
    loads:exportTable('frame,t_s,tau,C_n,C_S,C_L,C_D,C_m', loads),
    aerodynamics:exportTable(
      'frame,t_s,tau,Gamma_b_m2_per_s,Gamma_b_hat,x_s_over_c,x_s_percent,A0,LESP,kelvin_residual_m2_per_s,kelvin_residual_hat',
      aerodynamics
    ),
    fourier:exportTable(
      ['frame', 't_s', 'tau', ...Array.from({length:fourierCount}, (_, index)=>`A${index}`)].join(','),
      fourier
    )
  };
}

function distributionExportData(){
  const x = Array.from(out.surfaceX || panelCenterX(), Number);
  const pressureRows = [];
  const velocityRows = [];
  const frameCount = Math.max(out.pressure?.length || 0, out.surfaceVelocity?.length || 0);
  for (let frame=0; frame<frameCount; frame++){
    const pressure = out.pressure?.[frame];
    const velocity = out.surfaceVelocity?.[frame];
    const leadingEdge = out.leadingEdge?.[frame];
    if (Number(leadingEdge?.x) === 0){
      const prefix = [frame, Number(SIM.t?.[frame]), Number(SIM.tau?.[frame]), -1, 0];
      pressureRows.push([
        ...prefix,
        Number(leadingEdge?.pressure?.delta), Number(leadingEdge?.pressure?.upper),
        Number(leadingEdge?.pressure?.lower), Number(leadingEdge?.pressure?.mean),
        NaN, NaN,
        Number(leadingEdge?.pressure?.steadyDelta), Number(leadingEdge?.pressure?.unsteadyDelta),
        NaN
      ]);
      velocityRows.push([
        ...prefix,
        Number(leadingEdge?.velocity?.upper), Number(leadingEdge?.velocity?.lower),
        Number(leadingEdge?.velocity?.mean)
      ]);
    }
    const count = Math.max(
      x.length,
      pressure?.upper?.length || 0, pressure?.lower?.length || 0, pressure?.delta?.length || 0,
      velocity?.upper?.length || 0, velocity?.lower?.length || 0
    );
    for (let index=0; index<count; index++){
      const prefix = [frame, Number(SIM.t?.[frame]), Number(SIM.tau?.[frame]), index, Number(x[index])];
      pressureRows.push([
        ...prefix,
        Number(pressure?.delta?.[index]), Number(pressure?.upper?.[index]), Number(pressure?.lower?.[index]),
        Number(pressure?.mean?.[index]), Number(pressure?.meanPotential?.[index]),
        Number(pressure?.meanPotentialDerivative?.[index]),
        Number(pressure?.steadyDelta?.[index]), Number(pressure?.unsteadyDelta?.[index]),
        Number(pressure?.localTangentialVelocity?.[index])
      ]);
      velocityRows.push([
        ...prefix,
        Number(velocity?.upper?.[index]), Number(velocity?.lower?.[index]), Number(velocity?.mean?.[index])
      ]);
    }
  }
  return {
    pressure:exportTable(
      'frame,t_s,tau,panel,x_over_c,delta_cp,upper_cp,lower_cp,mean_cp,mean_surface_potential,mean_surface_potential_dtau,steady_delta_cp,unsteady_delta_cp,local_tangential_velocity_over_Uref',
      pressureRows
    ),
    surface_velocity:exportTable('frame,t_s,tau,panel,x_over_c,upper_V_over_Uref,lower_V_over_Uref,mean_V_over_Uref', velocityRows)
  };
}

function wakeExportTable(edge){
  const rows = [];
  const snapshots = out.flowfield?.[edge] || [];
  for (let frame=0; frame<snapshots.length; frame++){
    const snapshot = snapshots[frame];
    if (!snapshot) continue;
    if (Array.isArray(snapshot)){
      snapshot.forEach((vortex, index)=>rows.push([
        frame, Number(SIM.t?.[frame]), Number(SIM.tau?.[frame]), index,
        Number(vortex?.re), Number(vortex?.im), Number(vortex?.G)
      ]));
    } else {
      const count = Math.max(snapshot.re?.length || 0, snapshot.im?.length || 0, snapshot.G?.length || 0);
      for (let index=0; index<count; index++) rows.push([
        frame, Number(SIM.t?.[frame]), Number(SIM.tau?.[frame]), index,
        Number(snapshot.re?.[index]), Number(snapshot.im?.[index]), Number(snapshot.G?.[index])
      ]);
    }
  }
  return exportTable('frame,t_s,tau,vortex,x_m,z_m,Gamma_m2_per_s', rows);
}

function buildExportPayload(scope){
  const payload = {
    metadata:{
      schema_version:'1.3', generator:'UNSAERO Unsteady Airfoil Simulator',
      exported_at:new Date().toISOString(), scope, language:currentLanguage,
      airfoil:SIM.airName || '', frame_count:getFrameCount()
    },
    inputs:captureSimulationInputs(),
    model_relations:{
      leading_edge_suction_parameter:'LESP = A0',
      leading_edge_suction_coefficient:'C_S = (pi/2) * A0^2',
      dimensionless_bound_circulation:'Gamma_b_hat = Gamma_b / (pi * c * Uref)',
      loads_order:'C_n, C_S, C_L, C_D, C_m',
      pressure_jump:'delta_Cp = Cp_lower - Cp_upper',
      pressure_distribution:'unsteady Bernoulli reconstruction from the uniformly valid finite-radius velocities of Ramesh (2020) Eq. (2.29)',
      leading_edge_limit:'delta_Cp(0) = 0 for finite leading-edge radius'
    },
    solver:{
      stopped:!!out.stopped,
      model_scope:'attached-leading-edge DVM with trailing-edge vortex shedding; LDVM/LEV shedding not enabled',
      consistency:out.consistency || {},
      wake_save_stride:Number(out.flowfield?.wakeSaveStride ?? 1),
      max_abs_wake_circulation_m2_per_s:Number(out.flowfield?.maxAbsG ?? NaN),
      pressure_reference_mode:String(out.pressureReference?.mode || ''),
      pressure_reference_Cp_infinity:Number(out.pressureReference?.Cp_infinity ?? NaN),
      pressure_coordinate:String(out.pressureReference?.coordinate || ''),
      pressure_equations:String(out.pressureReference?.equations || ''),
      pressure_potential_gauge:String(out.pressureReference?.potentialGauge || ''),
      pressure_time_derivative:String(out.pressureReference?.timeDerivative || '')
    }
  };
  const histories = historyExportData();
  const geometry = geometryExportData();
  const distributions = distributionExportData();
  const wake = { TE:wakeExportTable('TE'), LE:wakeExportTable('LE') };

  if (scope === 'histories') return { ...payload, ...histories };
  if (scope === 'flowfield') return { ...payload, geometry, wake };
  if (scope === 'distributions') return { ...payload, geometry, distributions };
  return { ...payload, geometry, ...histories, distributions, wake };
}

function exportFilename(scope, extension){
  const airfoil = String(SIM.airName || 'airfoil').replace(/[^A-Za-z0-9_-]+/g, '_');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `unsaero_${airfoil}_${scope}_${stamp}.${extension}`;
}

function downloadExport(bytes, type, filename){
  const blob = new Blob([bytes], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

function syncExportControls(messageKey = null){
  const ready = !!out;
  if (exportButton) exportButton.disabled = !ready;
  if (exportNote){
    exportNote.textContent = messageKey
      ? translated(messageKey)
      : (ready ? '' : translated('export_frontend_note'));
  }
}

exportButton?.addEventListener('click', async ()=>{
  if (!out || !SIM) return;
  const scope = exportScope?.value || 'all';
  const format = exportFormat?.value || 'mat';
  exportButton.disabled = true;
  if (exportNote) exportNote.textContent = translated('export_working');
  try{
    await new Promise((resolve)=>setTimeout(resolve, 0));
    const payload = buildExportPayload(scope);
    if (format === 'json'){
      const bytes = new TextEncoder().encode(JSON.stringify({ unsaero_case:payload }, null, 2));
      downloadExport(bytes, 'application/json', exportFilename(scope, 'json'));
    } else if (format === 'csv-zip'){
      const csvEntries = payloadToCsvEntries(payload);
      csvEntries.push({
        name:'unsaero_case/schema.json',
        data:new TextEncoder().encode(JSON.stringify(payload.metadata, null, 2))
      });
      downloadExport(createZip(csvEntries), 'application/zip', exportFilename(scope, 'zip'));
    } else {
      downloadExport(
        encodeMatFile('unsaero_case', payload),
        'application/x-matlab-data',
        exportFilename(scope, 'mat')
      );
    }
    if (exportNote) exportNote.textContent = translated('export_done');
  } catch(error){
    if (exportNote){
      exportNote.textContent = translated('export_error').replace('{message}', error?.message || String(error));
    }
  } finally {
    exportButton.disabled = false;
  }
});

function initializeScrollNavigation(){
  const nav = document.getElementById('uasScrollNav');
  const up = document.getElementById('uasBackToTopBtn');
  const down = document.getElementById('uasScrollToBottomBtn');
  if (!nav || !up || !down) return;

  const threshold = 140;
  const documentHeight = ()=>Math.max(
    document.documentElement.scrollHeight,
    document.body?.scrollHeight || 0,
    document.documentElement.offsetHeight,
    document.body?.offsetHeight || 0
  );
  const update = ()=>{
    const y = window.scrollY || document.documentElement.scrollTop || 0;
    const height = documentHeight();
    const viewport = window.innerHeight || document.documentElement.clientHeight || 0;
    if (height <= viewport + 2){
      up.classList.remove('show');
      down.classList.remove('show');
      return;
    }
    const atTop = y <= threshold;
    const atBottom = y >= height - viewport - threshold;
    nav.classList.toggle('at-bottom', atBottom);
    up.classList.toggle('show', !atTop);
    down.classList.toggle('show', !atBottom);
  };

  up.addEventListener('click', ()=>window.scrollTo({ top:0, behavior:'smooth' }));
  down.addEventListener('click', ()=>window.scrollTo({ top:documentHeight(), behavior:'smooth' }));
  window.addEventListener('scroll', update, { passive:true });
  window.addEventListener('resize', update);
  update();
  setTimeout(update, 250);
}



// init
initializeCollapsibles();
initializeScrollNavigation();
applyLanguage(localStorage.getItem('unsaero-lang') || 'en');
refreshColors();
loadData()
  .then(()=>runStopBtn.click())
  .catch(e=>{
    console.error(e);
    setStatus('status_data_error');
  });
