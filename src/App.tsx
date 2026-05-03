import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { BlockMath, InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Gauge,
  Ruler,
  Save,
  Sigma,
} from 'lucide-react';
import BoltPattern from './components/BoltPattern';
import { getBoltGrades, getBoltProperties, getBoltSizes } from './boltData';

type BoltArrangement = 'rectangular' | 'circular';

type NumericField =
  | 'numRows'
  | 'numCols'
  | 'rowSpacing'
  | 'colSpacing'
  | 'diameter'
  | 'numBolts'
  | 'vx'
  | 'vy'
  | 'tb'
  | 'mb'
  | 'mm'
  | 'nt'
  | 'vxFatigue'
  | 'vyFatigue'
  | 'tbFatigue'
  | 'mbFatigue'
  | 'mmFatigue'
  | 'ntFatigue'
  | 'pryingAllowance';

interface InputState {
  arrangement: BoltArrangement;
  fatigueEnabled: boolean;
  numRows: string;
  numCols: string;
  rowSpacing: string;
  colSpacing: string;
  diameter: string;
  numBolts: string;
  vx: string;
  vy: string;
  tb: string;
  mb: string;
  mm: string;
  nt: string;
  vxFatigue: string;
  vyFatigue: string;
  tbFatigue: string;
  mbFatigue: string;
  mmFatigue: string;
  ntFatigue: string;
  boltGrade: string;
  boltSize: string;
  pryingAllowance: string;
}

interface LoadSet {
  vx: number;
  vy: number;
  tb: number;
  mb: number;
  mm: number;
  nt: number;
}

interface BoltPosition {
  x: number;
  y: number;
}

interface BoltDemand extends BoltPosition {
  shearX: number;
  shearY: number;
  shear: number;
  tension: number;
}

interface CalculationResult {
  boltDemands: BoltDemand[];
  totalBolts: number;
  ibp: number;
  xm: number;
  ym: number;
  maxShear: number;
  maxTension: number;
  shearCapacity: number;
  tensionCapacity: number;
  shearUtilisation: number;
  tensionUtilisation: number;
  combinedRatio: number;
  tensileArea: number;
  shearStress: number;
  tensionStress: number;
  highestBoltStress: number;
  fatigueStressRange: number | null;
}

interface SavedCalculation {
  timestamp: string;
  arrangement: string;
  boltSize: string;
  boltGrade: string;
  totalBolts: number;
  maxShear: number;
  maxTension: number;
  combinedRatio: number;
}

interface FieldConfig {
  name: NumericField;
  label: ReactNode;
  unit: string;
  step?: string;
  helper: string;
}

const DEFAULT_INPUTS: InputState = {
  arrangement: 'rectangular',
  fatigueEnabled: false,
  numRows: '4',
  numCols: '4',
  rowSpacing: '150',
  colSpacing: '160',
  diameter: '400',
  numBolts: '8',
  vx: '20',
  vy: '5',
  tb: '10',
  mb: '50',
  mm: '10',
  nt: '10',
  vxFatigue: '12',
  vyFatigue: '3',
  tbFatigue: '4',
  mbFatigue: '18',
  mmFatigue: '4',
  ntFatigue: '4',
  boltGrade: 'Grade 8.8',
  boltSize: 'M24',
  pryingAllowance: '1.10',
};

const geometryFields: FieldConfig[] = [
  {
    name: 'numRows',
    label: 'Rows',
    unit: 'count',
    step: '1',
    helper: 'Vertical bolt rows',
  },
  {
    name: 'numCols',
    label: 'Columns',
    unit: 'count',
    step: '1',
    helper: 'Horizontal bolt columns',
  },
  {
    name: 'rowSpacing',
    label: 'Row spacing',
    unit: 'mm',
    helper: 'Centre-to-centre vertical spacing',
  },
  {
    name: 'colSpacing',
    label: 'Column spacing',
    unit: 'mm',
    helper: 'Centre-to-centre horizontal spacing',
  },
  {
    name: 'diameter',
    label: 'Bolt circle diameter',
    unit: 'mm',
    helper: 'Pitch circle diameter',
  },
  {
    name: 'numBolts',
    label: 'Bolts on circle',
    unit: 'count',
    step: '1',
    helper: 'Total bolts in the circular pattern',
  },
];

const loadFields: FieldConfig[] = [
  {
    name: 'vx',
    label: <>Horizontal shear V<sub>x</sub></>,
    unit: 'kN',
    helper: 'Positive to the global x-axis',
  },
  {
    name: 'vy',
    label: <>Vertical shear V<sub>y</sub></>,
    unit: 'kN',
    helper: 'Positive to the global y-axis',
  },
  {
    name: 'tb',
    label: <>Torsion T<sub>b</sub></>,
    unit: 'kNm',
    helper: 'Applied in-plane torsion',
  },
  {
    name: 'mb',
    label: <>Major-axis moment M<sub>b</sub></>,
    unit: 'kNm',
    helper: 'Bending about the y-axis lever arm',
  },
  {
    name: 'mm',
    label: <>Minor-axis moment M<sub>m</sub></>,
    unit: 'kNm',
    helper: 'Bending about the x-axis lever arm',
  },
  {
    name: 'nt',
    label: <>Axial force N<sub>t</sub></>,
    unit: 'kN',
    helper: 'Tension positive, compression negative',
  },
];

const fatigueLoadFields: FieldConfig[] = [
  {
    name: 'vxFatigue',
    label: <>Horizontal shear ΔV<sub>x</sub></>,
    unit: 'kN',
    helper: 'Fatigue load range on the x-axis',
  },
  {
    name: 'vyFatigue',
    label: <>Vertical shear ΔV<sub>y</sub></>,
    unit: 'kN',
    helper: 'Fatigue load range on the y-axis',
  },
  {
    name: 'tbFatigue',
    label: <>Torsion ΔT<sub>b</sub></>,
    unit: 'kNm',
    helper: 'Fatigue torsional range',
  },
  {
    name: 'mbFatigue',
    label: <>Major-axis moment ΔM<sub>b</sub></>,
    unit: 'kNm',
    helper: 'Fatigue major-axis range',
  },
  {
    name: 'mmFatigue',
    label: <>Minor-axis moment ΔM<sub>m</sub></>,
    unit: 'kNm',
    helper: 'Fatigue minor-axis range',
  },
  {
    name: 'ntFatigue',
    label: <>Axial force ΔN<sub>t</sub></>,
    unit: 'kN',
    helper: 'Tension positive, compression negative',
  },
];

const factorFields: FieldConfig[] = [
  {
    name: 'pryingAllowance',
    label: 'Prying allowance',
    unit: 'factor',
    step: '0.01',
    helper: 'Amplification factor on bolt tension',
  },
];

const parseNumber = (value: string): number | null => {
  if (value.trim() === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const roundValue = (value: number, digits = 2): string => value.toFixed(digits);

const formatTimestamp = (date: Date) =>
  date.toLocaleString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const getStatusTone = (ratio: number) => {
  if (ratio <= 0.8) return 'good';
  if (ratio <= 1.0) return 'warn';
  return 'bad';
};

function AnimatedNumber({
  value,
  digits = 2,
  suffix = '',
}: {
  value: number;
  digits?: number;
  suffix?: string;
}) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    let frame = 0;
    const from = displayValue;
    const to = value;
    const start = performance.now();
    const duration = 220;

    const animate = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(from + (to - from) * eased);

      if (progress < 1) {
        frame = requestAnimationFrame(animate);
      }
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return (
    <span>
      {displayValue.toFixed(digits)}
      {suffix}
    </span>
  );
}

function InputField({
  field,
  value,
  error,
  onChange,
}: {
  field: FieldConfig;
  value: string;
  error?: string;
  onChange: (name: NumericField, value: string) => void;
}) {
  return (
    <label className="input-field">
      <span className="field-label-row">
        <span className="field-label">{field.label}</span>
        <span className="field-helper">{field.helper}</span>
      </span>
      <span className={`input-shell ${error ? 'has-error' : ''}`}>
        <input
          className="input-control"
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(field.name, event.target.value)}
          aria-invalid={Boolean(error)}
        />
        <span className="input-unit">{field.unit}</span>
      </span>
      <span className="field-error">{error ?? ' '}</span>
    </label>
  );
}

const extractLoadSet = (inputs: InputState, fatigue = false): LoadSet => ({
  vx: parseNumber(fatigue ? inputs.vxFatigue : inputs.vx) ?? 0,
  vy: parseNumber(fatigue ? inputs.vyFatigue : inputs.vy) ?? 0,
  tb: parseNumber(fatigue ? inputs.tbFatigue : inputs.tb) ?? 0,
  mb: parseNumber(fatigue ? inputs.mbFatigue : inputs.mb) ?? 0,
  mm: parseNumber(fatigue ? inputs.mmFatigue : inputs.mm) ?? 0,
  nt: parseNumber(fatigue ? inputs.ntFatigue : inputs.nt) ?? 0,
});

const calculateBoltLayout = (
  arrangement: BoltArrangement,
  numRows: number,
  numCols: number,
  rowSpacing: number,
  colSpacing: number,
  diameter: number,
  numBolts: number,
) => {
  const positions: BoltPosition[] = [];

  if (arrangement === 'rectangular') {
    const startX = -((numCols - 1) * colSpacing) / 2;
    const startY = -((numRows - 1) * rowSpacing) / 2;

    for (let row = 0; row < numRows; row += 1) {
      for (let col = 0; col < numCols; col += 1) {
        positions.push({
          x: startX + col * colSpacing,
          y: startY + row * rowSpacing,
        });
      }
    }
  } else {
    const radius = diameter / 2;
    const angleIncrement = (2 * Math.PI) / numBolts;

    for (let index = 0; index < numBolts; index += 1) {
      const angle = index * angleIncrement - Math.PI / 2;
      positions.push({
        x: radius * Math.cos(angle),
        y: radius * Math.sin(angle),
      });
    }
  }

  const ibp = positions.reduce((sum, position) => sum + position.x ** 2 + position.y ** 2, 0);
  const xm = Math.max(...positions.map((position) => Math.abs(position.x)));
  const ym = Math.max(...positions.map((position) => Math.abs(position.y)));

  return { positions, ibp, xm, ym };
};

const validateInputs = (
  inputs: InputState,
  boltSizeOptions: string[],
): Record<string, string> => {
  const errors: Record<string, string> = {};

  const requireNumber = (key: NumericField, message: string) => {
    const parsed = parseNumber(inputs[key]);
    if (parsed === null) {
      errors[key] = message;
      return null;
    }
    return parsed;
  };

  const checkRange = (
    key: NumericField,
    min: number,
    max: number,
    message: string,
    allowZero = false,
  ) => {
    const value = requireNumber(key, 'Enter a numeric value.');
    if (value === null) return;

    if (!allowZero && value === 0) {
      errors[key] = 'Zero is not permitted here.';
      return;
    }

    if (value < min || value > max) {
      errors[key] = message;
    }
  };

  if (!boltSizeOptions.includes(inputs.boltSize)) {
    errors.boltSize = 'Select a bolt size available for the chosen grade.';
  }

  checkRange('pryingAllowance', 1, 3, 'Use a factor between 1.00 and 3.00.');

  if (inputs.arrangement === 'rectangular') {
    checkRange('numRows', 1, 12, 'Use between 1 and 12 rows.');
    checkRange('numCols', 1, 12, 'Use between 1 and 12 columns.');
    checkRange('rowSpacing', 30, 1200, 'Use spacing between 30 mm and 1200 mm.');
    checkRange('colSpacing', 30, 1200, 'Use spacing between 30 mm and 1200 mm.');

    const rows = parseNumber(inputs.numRows);
    const cols = parseNumber(inputs.numCols);
    if (rows !== null && cols !== null && rows * cols < 2) {
      errors.numCols = 'At least two bolts are required for group action.';
    }
  }

  if (inputs.arrangement === 'circular') {
    checkRange('diameter', 80, 3000, 'Use a diameter between 80 mm and 3000 mm.');
    checkRange('numBolts', 2, 40, 'Use between 2 and 40 bolts.');
  }

  const finiteLoad = (key: NumericField) => {
    const value = requireNumber(key, 'Enter a numeric value.');
    if (value === null) return;
    if (Math.abs(value) > 10000) {
      errors[key] = 'Magnitude is outside the supported engineering range.';
    }
  };

  finiteLoad('vx');
  finiteLoad('vy');
  finiteLoad('tb');
  finiteLoad('mb');
  finiteLoad('mm');
  finiteLoad('nt');

  if (inputs.fatigueEnabled) {
    finiteLoad('vxFatigue');
    finiteLoad('vyFatigue');
    finiteLoad('tbFatigue');
    finiteLoad('mbFatigue');
    finiteLoad('mmFatigue');
    finiteLoad('ntFatigue');
  }

  return errors;
};

const calculateBoltDemands = (
  positions: BoltPosition[],
  ibp: number,
  xm: number,
  ym: number,
  loads: LoadSet,
  pryingAllowance: number,
): BoltDemand[] => {
  const totalBolts = positions.length;

  return positions.map((position) => {
    const shearX = (-loads.vx * 1000) / totalBolts + ((-loads.tb * 1e6) * position.y) / ibp;
    const shearY = (-loads.vy * 1000) / totalBolts + ((loads.tb * 1e6) * position.x) / ibp;
    const shear = Math.sqrt(shearX ** 2 + shearY ** 2) / 1000;

    const directTension = (loads.nt * 1000) / totalBolts;
    const majorAxisForce = ym === 0 ? 0 : ((loads.mb * 1e6) * position.y) / (2 * ym ** 2);
    const minorAxisForce = xm === 0 ? 0 : ((loads.mm * 1e6) * position.x) / (2 * xm ** 2);
    const rawTension = (pryingAllowance * (directTension + majorAxisForce + minorAxisForce)) / 1000;
    const tension = Math.max(0, rawTension);

    return {
      ...position,
      shearX: shearX / 1000,
      shearY: shearY / 1000,
      shear,
      tension,
    };
  });
};

const calculateResults = (
  inputs: InputState,
  tensileArea: number,
  shearCapacity: number,
  tensionCapacity: number,
): CalculationResult => {
  const numRows = parseNumber(inputs.numRows) ?? 0;
  const numCols = parseNumber(inputs.numCols) ?? 0;
  const rowSpacing = parseNumber(inputs.rowSpacing) ?? 0;
  const colSpacing = parseNumber(inputs.colSpacing) ?? 0;
  const diameter = parseNumber(inputs.diameter) ?? 0;
  const numBolts = parseNumber(inputs.numBolts) ?? 0;
  const pryingAllowance = parseNumber(inputs.pryingAllowance) ?? 1;

  const layout = calculateBoltLayout(
    inputs.arrangement,
    numRows,
    numCols,
    rowSpacing,
    colSpacing,
    diameter,
    numBolts,
  );

  const totalBolts = layout.positions.length;
  const demands = calculateBoltDemands(
    layout.positions,
    layout.ibp,
    layout.xm,
    layout.ym,
    extractLoadSet(inputs),
    pryingAllowance,
  );

  const maxShear = Math.max(...demands.map((demand) => demand.shear));
  const maxTension = Math.max(...demands.map((demand) => demand.tension));
  const shearUtilisation = maxShear / shearCapacity;
  const tensionUtilisation = maxTension / tensionCapacity;
  const combinedRatio = shearUtilisation ** 2 + tensionUtilisation ** 2;

  const highestBoltStress = Math.max(
    ...demands.map((demand) => {
      const boltShearStress = (demand.shear * 1000) / tensileArea;
      const boltTensionStress = (demand.tension * 1000) / tensileArea;
      return Math.sqrt(boltTensionStress ** 2 + 3 * boltShearStress ** 2);
    }),
  );

  const fatigueStressRange = inputs.fatigueEnabled
    ? Math.max(
        ...calculateBoltDemands(
          layout.positions,
          layout.ibp,
          layout.xm,
          layout.ym,
          extractLoadSet(inputs, true),
          pryingAllowance,
        ).map((demand) => {
          const boltShearStress = (demand.shear * 1000) / tensileArea;
          const boltTensionStress = (demand.tension * 1000) / tensileArea;
          return Math.sqrt(boltTensionStress ** 2 + 3 * boltShearStress ** 2);
        }),
      )
    : null;

  return {
    boltDemands: demands,
    totalBolts,
    ibp: layout.ibp,
    xm: layout.xm,
    ym: layout.ym,
    maxShear,
    maxTension,
    shearCapacity,
    tensionCapacity,
    shearUtilisation,
    tensionUtilisation,
    combinedRatio,
    tensileArea,
    shearStress: (maxShear * 1000) / tensileArea,
    tensionStress: (maxTension * 1000) / tensileArea,
    highestBoltStress,
    fatigueStressRange,
  };
};

function App() {
  const [inputs, setInputs] = useState<InputState>(DEFAULT_INPUTS);
  const [savedCalculations, setSavedCalculations] = useState<SavedCalculation[]>([]);

  const boltSizeOptions = useMemo(() => getBoltSizes(inputs.boltGrade), [inputs.boltGrade]);
  const boltProperties = useMemo(
    () => getBoltProperties(inputs.boltGrade, inputs.boltSize),
    [inputs.boltGrade, inputs.boltSize],
  );

  useEffect(() => {
    if (!boltSizeOptions.includes(inputs.boltSize) && boltSizeOptions.length > 0) {
      setInputs((current) => ({ ...current, boltSize: boltSizeOptions[0] }));
    }
  }, [boltSizeOptions, inputs.boltSize]);

  const validationErrors = useMemo(() => validateInputs(inputs, boltSizeOptions), [inputs, boltSizeOptions]);
  const isValid = Object.keys(validationErrors).length === 0 && Boolean(boltProperties);

  const result = useMemo(() => {
    if (!isValid || !boltProperties) return null;

    return calculateResults(
      inputs,
      boltProperties.tensileArea,
      boltProperties.phiVf,
      boltProperties.phiNtf,
    );
  }, [boltProperties, inputs, isValid]);

  const handleNumericChange = (name: NumericField, value: string) => {
    setInputs((current) => ({ ...current, [name]: value }));
  };

  const saveResult = () => {
    if (!result) return;

    setSavedCalculations((current) => [
      {
        timestamp: formatTimestamp(new Date()),
        arrangement: inputs.arrangement === 'rectangular' ? 'Rectangular' : 'Circular',
        boltSize: inputs.boltSize,
        boltGrade: inputs.boltGrade,
        totalBolts: result.totalBolts,
        maxShear: result.maxShear,
        maxTension: result.maxTension,
        combinedRatio: result.combinedRatio,
      },
      ...current,
    ]);
  };

  const statusTone = result ? getStatusTone(result.combinedRatio) : 'idle';

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Premium Engineering Calculator</p>
          <h1>Bolt Group Analysis</h1>
          <p className="header-copy">
            Real-time bolt demand, interaction check, and live arrangement visualisation for
            structural connection design.
          </p>
        </div>
      </header>

      <main className="main-grid">
        <section className="left-column">
          <article className="card visual-card">
            <div className="card-header">
              <div>
                <p className="card-kicker">Visualisation</p>
                <h2>Live bolt layout and demand field</h2>
              </div>
            </div>
            <BoltPattern inputs={inputs} result={result} isValid={isValid} />
          </article>

          <article className={`card result-card tone-${statusTone}`}>
            <div className="card-header">
              <div>
                <p className="card-kicker">Result</p>
                <h2>Combined utilisation check</h2>
              </div>
              <button className="primary-button" onClick={saveResult} disabled={!result}>
                <Save size={16} />
                <span>Save Result</span>
              </button>
            </div>

            {result ? (
              <>
                <div className="hero-result">
                  <div>
                    <p className="hero-label">Interaction ratio</p>
                    <div className="hero-value">
                      <AnimatedNumber value={result.combinedRatio} digits={3} />
                    </div>
                    <p className="hero-caption">
                      Requirement:{' '}
                      <span className="math-inline">
                        <InlineMath math="\left(\frac{V_r}{\phi V_f}\right)^2 + \left(\frac{N_t}{\phi N_{tf}}\right)^2 \leq 1.0" />
                      </span>
                    </p>
                  </div>
                  <div className={`status-pill tone-${statusTone}`}>
                    {result.combinedRatio <= 1 ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                    <span>{result.combinedRatio <= 1 ? 'Acceptable' : 'Exceeds limit'}</span>
                  </div>
                </div>

                <div className="metric-grid">
                  <div className="metric-tile">
                    <span className="metric-label">
                      Governing shear per bolt <InlineMath math="V_r" />
                    </span>
                    <strong>
                      <AnimatedNumber value={result.maxShear} digits={2} suffix=" kN" />
                    </strong>
                  </div>
                  <div className="metric-tile">
                    <span className="metric-label">
                      Governing tension per bolt <InlineMath math="N_t" />
                    </span>
                    <strong>
                      <AnimatedNumber value={result.maxTension} digits={2} suffix=" kN" />
                    </strong>
                  </div>
                  <div className="metric-tile">
                    <span className="metric-label">
                      Shear utilisation <InlineMath math="\frac{V_r}{\phi V_f}" />
                    </span>
                    <strong>
                      <AnimatedNumber value={result.shearUtilisation} digits={3} />
                    </strong>
                  </div>
                  <div className="metric-tile">
                    <span className="metric-label">
                      Tension utilisation <InlineMath math="\frac{N_t}{\phi N_{tf}}" />
                    </span>
                    <strong>
                      <AnimatedNumber value={result.tensionUtilisation} digits={3} />
                    </strong>
                  </div>
                  <div className="metric-tile">
                    <span className="metric-label">
                      Highest bolt stress <InlineMath math="\sigma_{eq,max}" />
                    </span>
                    <strong>
                      <AnimatedNumber value={result.highestBoltStress} digits={1} suffix=" MPa" />
                    </strong>
                  </div>
                  <div className="metric-tile">
                    <span className="metric-label">
                      Fatigue stress range <InlineMath math="\Delta \sigma_{eq,max}" />
                    </span>
                    <strong>
                      {result.fatigueStressRange !== null ? (
                        <AnimatedNumber value={result.fatigueStressRange} digits={1} suffix=" MPa" />
                      ) : (
                        'Disabled'
                      )}
                    </strong>
                  </div>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <AlertTriangle size={18} />
                <span>Results are disabled until all required inputs are valid.</span>
              </div>
            )}
          </article>
        </section>

        <section className="right-column">
          <article className="card">
            <div className="card-header">
              <div>
                <p className="card-kicker">Input Card</p>
                <h2>Geometry and arrangement</h2>
              </div>
            </div>

            <div className="segmented-control">
              <button
                className={inputs.arrangement === 'rectangular' ? 'active' : ''}
                onClick={() => setInputs((current) => ({ ...current, arrangement: 'rectangular' }))}
                type="button"
              >
                Rectangular
              </button>
              <button
                className={inputs.arrangement === 'circular' ? 'active' : ''}
                onClick={() => setInputs((current) => ({ ...current, arrangement: 'circular' }))}
                type="button"
              >
                Circular
              </button>
            </div>

            <div className="input-grid">
              {geometryFields
                .filter((field) =>
                  inputs.arrangement === 'rectangular'
                    ? ['numRows', 'numCols', 'rowSpacing', 'colSpacing'].includes(field.name)
                    : ['diameter', 'numBolts'].includes(field.name),
                )
                .map((field) => (
                  <InputField
                    key={field.name}
                    field={field}
                    value={inputs[field.name]}
                    error={validationErrors[field.name]}
                    onChange={handleNumericChange}
                  />
                ))}

              <label className="input-field">
                <span className="field-label-row">
                  <span className="field-label">Bolt grade</span>
                  <span className="field-helper">Available resistance family</span>
                </span>
                <span className="input-shell">
                  <select
                    className="input-control input-select"
                    value={inputs.boltGrade}
                    onChange={(event) =>
                      setInputs((current) => ({ ...current, boltGrade: event.target.value }))
                    }
                  >
                    {getBoltGrades().map((grade) => (
                      <option key={grade} value={grade}>
                        {grade}
                      </option>
                    ))}
                  </select>
                </span>
                <span className="field-error">{' '}</span>
              </label>

              <label className="input-field">
                <span className="field-label-row">
                  <span className="field-label">Bolt size</span>
                  <span className="field-helper">Linked to selected grade</span>
                </span>
                <span className={`input-shell ${validationErrors.boltSize ? 'has-error' : ''}`}>
                  <select
                    className="input-control input-select"
                    value={inputs.boltSize}
                    onChange={(event) =>
                      setInputs((current) => ({ ...current, boltSize: event.target.value }))
                    }
                  >
                    {boltSizeOptions.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </span>
                <span className="field-error">{validationErrors.boltSize ?? ' '}</span>
              </label>

              {factorFields.map((field) => (
                <InputField
                  key={field.name}
                  field={field}
                  value={inputs[field.name]}
                  error={validationErrors[field.name]}
                  onChange={handleNumericChange}
                />
              ))}
            </div>
          </article>

          <article className="card">
            <div className="card-header">
              <div>
                <p className="card-kicker">Input Card</p>
                <h2>Load cases</h2>
              </div>
            </div>

            <div className="load-case-group">
              <div className="load-case-head">
                <span className="load-case-tag">ULS</span>
                <h3>Ultimate Limit State</h3>
              </div>
              <div className="input-grid">
                {loadFields.map((field) => (
                  <InputField
                    key={field.name}
                    field={field}
                    value={inputs[field.name]}
                    error={validationErrors[field.name]}
                    onChange={handleNumericChange}
                  />
                ))}
              </div>
            </div>

            <div className="load-case-group fatigue">
              <div className="load-case-head fatigue-head">
                <div>
                  <span className="load-case-tag">FLS</span>
                  <h3>Fatigue Limit State</h3>
                </div>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={inputs.fatigueEnabled}
                    onChange={(event) =>
                      setInputs((current) => ({
                        ...current,
                        fatigueEnabled: event.target.checked,
                      }))
                    }
                  />
                  <span>Enable load case</span>
                </label>
              </div>
              {inputs.fatigueEnabled ? (
                <div className="input-grid">
                  {fatigueLoadFields.map((field) => (
                    <InputField
                      key={field.name}
                      field={field}
                      value={inputs[field.name]}
                      error={validationErrors[field.name]}
                      onChange={handleNumericChange}
                    />
                  ))}
                </div>
              ) : (
                <div className="empty-state secondary">
                  <span>Enable the FLS case to evaluate the maximum bolt stress range.</span>
                </div>
              )}
            </div>
          </article>

          <article className="card secondary-card">
            <details className="collapsible-panel">
              <summary className="collapsible-summary">
                <div>
                  <p className="card-kicker">Secondary Properties</p>
                  <h2>Resistance model and intermediate values</h2>
                </div>
              </summary>

              <div className="collapsible-body">
                <div className="equation-panel">
                  <div className="equation-block">
                    <p>Total bolt tension</p>
                    <BlockMath math="N_t = \alpha \left(\frac{N}{n} + \frac{M_b y}{2y_m^2} + \frac{M_m x}{2x_m^2}\right)" />
                  </div>
                  <div className="equation-block">
                    <p>Resultant bolt shear</p>
                    <BlockMath math="V_r = \sqrt{\left(\frac{V_x}{n} + \frac{T_b y}{I_{bp}}\right)^2 + \left(\frac{V_y}{n} - \frac{T_b x}{I_{bp}}\right)^2}" />
                  </div>
                </div>

                {result ? (
                  <div className="properties-grid">
                    <div className="property-row">
                      <span>
                        <Ruler size={15} /> Lever arm <InlineMath math="x_m" />
                      </span>
                      <strong>{roundValue(result.xm, 0)} mm</strong>
                    </div>
                    <div className="property-row">
                      <span>
                        <Ruler size={15} /> Lever arm <InlineMath math="y_m" />
                      </span>
                      <strong>{roundValue(result.ym, 0)} mm</strong>
                    </div>
                    <div className="property-row">
                      <span>
                        <Gauge size={15} /> <InlineMath math="I_{bp}" />
                      </span>
                      <strong>{roundValue(result.ibp, 0)} mm²</strong>
                    </div>
                    <div className="property-row">
                      <span>
                        <Database size={15} /> Tensile area <InlineMath math="A_t" />
                      </span>
                      <strong>{roundValue(result.tensileArea, 1)} mm²</strong>
                    </div>
                    <div className="property-row">
                      <span>
                        <Gauge size={15} /> Shear capacity <InlineMath math="\phi V_f" />
                      </span>
                      <strong>{roundValue(result.shearCapacity, 2)} kN</strong>
                    </div>
                    <div className="property-row">
                      <span>
                        <Gauge size={15} /> Tension capacity <InlineMath math="\phi N_{tf}" />
                      </span>
                      <strong>{roundValue(result.tensionCapacity, 2)} kN</strong>
                    </div>
                    <div className="property-row">
                      <span>
                        <Sigma size={15} /> Max shear stress <InlineMath math="\tau_{max}" />
                      </span>
                      <strong>{roundValue(result.shearStress, 1)} MPa</strong>
                    </div>
                    <div className="property-row">
                      <span>
                        <Sigma size={15} /> Max tension stress <InlineMath math="\sigma_{max}" />
                      </span>
                      <strong>{roundValue(result.tensionStress, 1)} MPa</strong>
                    </div>
                  </div>
                ) : (
                  <div className="empty-state secondary">
                    <span>Intermediate values will appear here as soon as the model validates.</span>
                  </div>
                )}
              </div>
            </details>
          </article>
        </section>
      </main>

      <section className="card table-card">
        <div className="card-header">
          <div>
            <p className="card-kicker">Saved Results</p>
            <h2>Stored design checks</h2>
          </div>
        </div>

        {savedCalculations.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Arrangement</th>
                  <th>Bolts</th>
                  <th>Grade</th>
                  <th>Size</th>
                  <th>Shear</th>
                  <th>Tension</th>
                  <th>Ratio</th>
                </tr>
              </thead>
              <tbody>
                {savedCalculations.map((item, index) => (
                  <tr key={`${item.timestamp}-${index}`}>
                    <td>{item.timestamp}</td>
                    <td>{item.arrangement}</td>
                    <td>{item.totalBolts}</td>
                    <td>{item.boltGrade}</td>
                    <td>{item.boltSize}</td>
                    <td>{roundValue(item.maxShear, 2)} kN</td>
                    <td>{roundValue(item.maxTension, 2)} kN</td>
                    <td>{roundValue(item.combinedRatio, 3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state table-empty">
            <Database size={18} />
            <span>Saved calculations will appear here after you capture a result.</span>
          </div>
        )}
      </section>
    </div>
  );
}

export type { BoltDemand, CalculationResult, InputState };
export default App;
