import React, { useState, useEffect } from 'react';
import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import { HelpCircle, Save, AlertCircle, FileText, Download } from 'lucide-react';
import { getBoltGrades, getBoltSizes, getBoltProperties } from './boltData';
import BoltPattern from './components/BoltPattern';
import { generateWordDocument } from './wordExport';

interface BoltCalculation {
  shearForce: number;
  axialForce: number;
  shearUtilisation: number;
  tensionUtilisation: number;
  combinedRatio: number;
  boltSize: string;
  boltGrade: string;
  timestamp: string;
}

interface BoltPosition {
  x: number;
  y: number;
}

type BoltArrangement = 'rectangular' | 'circular';

function App() {
  const [inputs, setInputs] = useState({
    // Bolt arrangement
    arrangement: 'rectangular' as BoltArrangement,
    
    // Rectangular layout
    numRows: 4,
    numCols: 4,
    rowSpacing: 150, // mm
    colSpacing: 160, // mm
    
    // Circular layout
    diameter: 400, // mm
    numBolts: 8,
    
    // Applied loads
    vx: 20, // kN
    vy: 5, // kN
    tb: 10, // kNm (torsion)
    mb: 50, // kNm (major axis moment)
    mm: 10, // kNm (minor axis moment)
    nt: 10, // kN (axial force)
    
    // Bolt properties
    boltGrade: 'Grade 8.8',
    boltSize: 'M24',
    
    // Analysis factors
    pryingAllowance: 1.1
  });

  const [results, setResults] = useState({
    shearForce: 0,
    axialForce: 0,
    combinedRatio: 0,
    boltPositions: [] as BoltPosition[],
    maxShear: 0,
    maxTension: 0,
    ibp: 0,
    tensileArea: 0,
    shearStress: 0,
    tensileStress: 0
  });

  const [savedCalculations, setSavedCalculations] = useState<BoltCalculation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [availableSizes, setAvailableSizes] = useState<string[]>([]);

  useEffect(() => {
    const sizes = getBoltSizes(inputs.boltGrade);
    setAvailableSizes(sizes);
    if (!sizes.includes(inputs.boltSize)) {
      setInputs(prev => ({ ...prev, boltSize: sizes[0] }));
    }
  }, [inputs.boltGrade]);

  // Calculate bolt positions and polar moment of inertia
  const calculateBoltLayout = () => {
    const positions: BoltPosition[] = [];
    let ibp = 0;
    
    if (inputs.arrangement === 'rectangular') {
      const startX = -((inputs.numCols - 1) * inputs.colSpacing) / 2;
      const startY = -((inputs.numRows - 1) * inputs.rowSpacing) / 2;
      
      for (let row = 0; row < inputs.numRows; row++) {
        for (let col = 0; col < inputs.numCols; col++) {
          const x = startX + (col * inputs.colSpacing);
          const y = startY + (row * inputs.rowSpacing);
          positions.push({ x, y });
          ibp += x * x + y * y;
        }
      }
    } else {
      // Circular arrangement
      const radius = inputs.diameter / 2;
      const angleIncrement = (2 * Math.PI) / inputs.numBolts;
      
      for (let i = 0; i < inputs.numBolts; i++) {
        const angle = i * angleIncrement;
        const x = radius * Math.cos(angle);
        const y = radius * Math.sin(angle);
        positions.push({ x, y });
      }
      
      // For circular arrangement, Ibp = n * R²
      ibp = inputs.numBolts * (radius * radius);
    }
    
    return { positions, ibp };
  };

  useEffect(() => {
    try {
      const numBolts = inputs.arrangement === 'rectangular' 
        ? inputs.numRows * inputs.numCols 
        : inputs.numBolts;

      if (numBolts < 2) {
        throw new Error('Minimum 2 bolts required for analysis');
      }

      // Get bolt properties
      const boltProps = getBoltProperties(inputs.boltGrade, inputs.boltSize);
      if (!boltProps) {
        throw new Error('Invalid bolt grade and size combination');
      }

      // Calculate bolt layout
      const { positions, ibp } = calculateBoltLayout();

      let maxShear = 0;
      let maxTension = 0;

      // Calculate forces for each bolt
      positions.forEach(pos => {
        // Shear components
        const verticalShear = (-inputs.vy * 1000 / numBolts) + 
          ((-inputs.tb * 1e6) * pos.x / ibp);
        const horizontalShear = (-inputs.vx * 1000 / numBolts) + 
          ((-inputs.tb * 1e6) * pos.y / ibp);
        const totalShear = Math.sqrt(verticalShear ** 2 + horizontalShear ** 2) / 1000;
        maxShear = Math.max(maxShear, totalShear);

        // Axial components
        const ym = inputs.arrangement === 'rectangular'
          ? (inputs.numRows * inputs.rowSpacing) / 2
          : inputs.diameter / 2;
        const xm = inputs.arrangement === 'rectangular'
          ? (inputs.numCols * inputs.colSpacing) / 2
          : inputs.diameter / 2;
        
        const majorAxisForce = (inputs.mb * 1e6 * pos.y) / (2 * ym * ym);
        const minorAxisForce = (inputs.mm * 1e6 * pos.x) / (2 * xm * xm);
        const pureAxialForce = inputs.nt * 1000 / numBolts;
        const totalAxial = inputs.pryingAllowance * (pureAxialForce + majorAxisForce + minorAxisForce) / 1000;
        maxTension = Math.max(maxTension, totalAxial);
      });

      // Calculate combined ratio using phiVf and phiNtf
      const combinedRatio = Math.pow(maxShear / boltProps.phiVf, 2) + 
        Math.pow(maxTension / boltProps.phiNtf, 2);

      // Calculate stresses in MPa
      const shearStress = (maxShear * 1000) / boltProps.tensileArea;  // Convert kN to N
      const tensileStress = (maxTension * 1000) / boltProps.tensileArea;  // Convert kN to N

      setResults({
        shearForce: maxShear,
        axialForce: maxTension,
        combinedRatio,
        boltPositions: positions,
        maxShear: boltProps.phiVf,
        maxTension: boltProps.phiNtf,
        ibp,
        tensileArea: boltProps.tensileArea,
        shearStress,
        tensileStress
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid input values');
    }
  }, [inputs]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const numValue = parseFloat(value);
    
    setInputs(prev => ({
      ...prev,
      [name]: isNaN(numValue) ? value : numValue
    }));
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-AU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const saveCalculation = () => {
    const calculation: BoltCalculation = {
      shearForce: results.shearForce,
      axialForce: results.axialForce,
      shearUtilisation: results.shearForce / results.maxShear,
      tensionUtilisation: results.axialForce / results.maxTension,
      combinedRatio: results.combinedRatio,
      boltSize: inputs.boltSize,
      boltGrade: inputs.boltGrade,
      timestamp: formatDate(new Date())
    };
    setSavedCalculations(prev => [...prev, calculation]);
  };

  const exportToCSV = () => {
    const headers = [
      'Timestamp',
      'Bolt Size',
      'Bolt Grade',
      'Shear Force (kN)',
      'Tensile Force (kN)',
      'Shear Utilisation',
      'Tension Utilisation',
      'Combined Ratio'
    ];

    const csvContent = [
      headers.join(','),
      ...savedCalculations.map(calc => [
        `"${calc.timestamp}"`,
        calc.boltSize,
        calc.boltGrade,
        calc.shearForce.toFixed(2),
        calc.axialForce.toFixed(2),
        calc.shearUtilisation.toFixed(3),
        calc.tensionUtilisation.toFixed(3),
        calc.combinedRatio.toFixed(3)
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `bolt-calculations-${formatDate(new Date())}.csv`;
    link.click();
  };

  const renderTooltip = (text: string) => (
    <div className="absolute z-10 invisible group-hover:visible bg-slate-900 text-white p-3 rounded-lg text-xs w-64 -mt-24 shadow-xl border border-slate-700">
      {text}
    </div>
  );

  const getUtilisationColor = (value: number) => 
    value <= 1.0 ? 'text-green-600' : 'text-red-600';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-extrabold bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-600 bg-clip-text text-transparent tracking-tight">
                Bolt Group Analysis Calculator
              </h1>
              <p className="text-xs text-slate-600 font-medium">Advanced structural engineering analysis tool</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Bolt Pattern Visualisation */}
          <div className="bg-white rounded-2xl shadow-xl ring-1 ring-slate-200 overflow-hidden transform transition-all duration-300 hover:shadow-2xl hover:-translate-y-1">
            <BoltPattern
              arrangement={inputs.arrangement}
              numRows={inputs.numRows}
              numCols={inputs.numCols}
              rowSpacing={inputs.rowSpacing}
              colSpacing={inputs.colSpacing}
              diameter={inputs.diameter}
              numBolts={inputs.numBolts}
              boltSize={inputs.boltSize}
              vx={inputs.vx}
              vy={inputs.vy}
              tb={inputs.tb}
              mb={inputs.mb}
              mm={inputs.mm}
              nt={inputs.nt}
              pryingAllowance={inputs.pryingAllowance}
            />
          </div>

          {/* Governing Equations */}
          <div className="bg-gradient-to-br from-white to-blue-50/30 rounded-2xl shadow-xl ring-1 ring-slate-200 p-5 transform transition-all duration-300 hover:shadow-2xl hover:-translate-y-1">
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <div className="w-1 h-6 bg-gradient-to-b from-blue-600 to-cyan-600 rounded-full"></div>
              Governing Equations
            </h2>
            <div className="space-y-4">
              <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50/50 rounded-xl border border-blue-100 shadow-sm transition-all duration-300 hover:shadow-md hover:border-blue-200">
                <p className="text-xs font-semibold text-blue-900 mb-2 tracking-wide">Total Axial Force per Bolt:</p>
                <BlockMath math="N_t = \alpha \left(\frac{N}{n} + \frac{M_b y}{2y_m^2} + \frac{M_m x}{2x_m^2}\right)" />
              </div>
              <div className="p-4 bg-gradient-to-br from-teal-50 to-emerald-50/50 rounded-xl border border-teal-100 shadow-sm transition-all duration-300 hover:shadow-md hover:border-teal-200">
                <p className="text-xs font-semibold text-teal-900 mb-2 tracking-wide">Resultant Shear Force per Bolt:</p>
                <BlockMath math="V_r = \sqrt{\left(\frac{V_x}{n} + \frac{T_b y}{I_{bp}}\right)^2 + \left(\frac{V_y}{n} + \frac{T_b x}{I_{bp}}\right)^2}" />
              </div>
              <div className="p-4 bg-gradient-to-br from-cyan-50 to-blue-50/50 rounded-xl border border-cyan-100 shadow-sm transition-all duration-300 hover:shadow-md hover:border-cyan-200">
                <p className="text-xs font-semibold text-cyan-900 mb-2 tracking-wide">Combined Shear and Tension Check:</p>
                <BlockMath math="\left(\frac{V_r}{\phi V_f}\right)^2 + \left(\frac{N_t}{\phi N_{tf}}\right)^2 \leq 1.0" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl ring-1 ring-slate-200 p-5 mb-6 transform transition-all duration-300 hover:shadow-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Bolt Layout Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 pb-2 border-b-2 border-blue-600">
                <div className="w-1 h-5 bg-gradient-to-b from-blue-600 to-cyan-600 rounded-full"></div>
                Bolt Layout
              </h3>

              <div className="relative group">
                <label className="flex items-center text-sm font-semibold text-slate-700 mb-2">
                  Arrangement Type
                  <HelpCircle className="w-4 h-4 ml-2 text-slate-400 transition-colors group-hover:text-blue-500" />
                  {renderTooltip("Choose between rectangular grid or circular arrangement")}
                </label>
                <select
                  name="arrangement"
                  value={inputs.arrangement}
                  onChange={handleInputChange}
                  className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all duration-200 bg-white hover:border-blue-400"
                >
                  <option value="rectangular">Rectangular Grid</option>
                  <option value="circular">Circular Pattern</option>
                </select>
              </div>

              {inputs.arrangement === 'rectangular' ? (
                <>
                  <div className="relative group">
                    <label className="flex items-center text-sm font-semibold text-slate-700 mb-2">
                      Number of Rows
                      <HelpCircle className="w-4 h-4 ml-2 text-slate-400 transition-colors group-hover:text-blue-500" />
                      {renderTooltip("Number of bolt rows in the vertical direction")}
                    </label>
                    <input
                      type="number"
                      name="numRows"
                      min="1"
                      value={inputs.numRows}
                      onChange={handleInputChange}
                      className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all duration-200 hover:border-blue-400"
                    />
                  </div>

                  <div className="relative group">
                    <label className="flex items-center text-sm font-semibold text-slate-700 mb-2">
                      Number of Columns
                      <HelpCircle className="w-4 h-4 ml-2 text-slate-400 transition-colors group-hover:text-blue-500" />
                      {renderTooltip("Number of bolt columns in the horizontal direction")}
                    </label>
                    <input
                      type="number"
                      name="numCols"
                      min="1"
                      value={inputs.numCols}
                      onChange={handleInputChange}
                      className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all duration-200 hover:border-blue-400"
                    />
                  </div>

                  <div className="relative group">
                    <label className="flex items-center text-sm font-semibold text-slate-700 mb-2">
                      Row Spacing (mm)
                      <HelpCircle className="w-4 h-4 ml-2 text-slate-400 transition-colors group-hover:text-blue-500" />
                      {renderTooltip("Vertical spacing between bolt rows")}
                    </label>
                    <input
                      type="number"
                      name="rowSpacing"
                      min="0"
                      value={inputs.rowSpacing}
                      onChange={handleInputChange}
                      className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all duration-200 hover:border-blue-400"
                    />
                  </div>

                  <div className="relative group">
                    <label className="flex items-center text-sm font-semibold text-slate-700 mb-2">
                      Column Spacing (mm)
                      <HelpCircle className="w-4 h-4 ml-2 text-slate-400 transition-colors group-hover:text-blue-500" />
                      {renderTooltip("Horizontal spacing between bolt columns")}
                    </label>
                    <input
                      type="number"
                      name="colSpacing"
                      min="0"
                      value={inputs.colSpacing}
                      onChange={handleInputChange}
                      className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all duration-200 hover:border-blue-400"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="relative group">
                    <label className="flex items-center text-sm font-semibold text-slate-700 mb-2">
                      Circle Diameter (mm)
                      <HelpCircle className="w-4 h-4 ml-2 text-slate-400 transition-colors group-hover:text-blue-500" />
                      {renderTooltip("Diameter of the bolt circle")}
                    </label>
                    <input
                      type="number"
                      name="diameter"
                      min="0"
                      value={inputs.diameter}
                      onChange={handleInputChange}
                      className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all duration-200 hover:border-blue-400"
                    />
                  </div>

                  <div className="relative group">
                    <label className="flex items-center text-sm font-semibold text-slate-700 mb-2">
                      Number of Bolts
                      <HelpCircle className="w-4 h-4 ml-2 text-slate-400 transition-colors group-hover:text-blue-500" />
                      {renderTooltip("Total number of bolts in the circular pattern")}
                    </label>
                    <input
                      type="number"
                      name="numBolts"
                      min="2"
                      value={inputs.numBolts}
                      onChange={handleInputChange}
                      className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all duration-200 hover:border-blue-400"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Applied Loads Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 pb-2 border-b-2 border-teal-600">
                <div className="w-1 h-5 bg-gradient-to-b from-teal-600 to-emerald-600 rounded-full"></div>
                Applied Loads
              </h3>
              
              <div className="relative group">
                <label className="flex items-center text-sm font-semibold text-slate-700 mb-2">
                  Horizontal Shear (V<sub>x</sub>) [kN]
                  <HelpCircle className="w-4 h-4 ml-2 text-slate-400 transition-colors group-hover:text-blue-500" />
                  {renderTooltip("Applied horizontal shear force")}
                </label>
                <input
                  type="number"
                  name="vx"
                  value={inputs.vx}
                  onChange={handleInputChange}
                  className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all duration-200 hover:border-blue-400"
                />
              </div>

              <div className="relative group">
                <label className="flex items-center text-sm font-semibold text-slate-700 mb-2">
                  Vertical Shear (V<sub>y</sub>) [kN]
                  <HelpCircle className="w-4 h-4 ml-2 text-slate-400 transition-colors group-hover:text-blue-500" />
                  {renderTooltip("Applied vertical shear force")}
                </label>
                <input
                  type="number"
                  name="vy"
                  value={inputs.vy}
                  onChange={handleInputChange}
                  className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all duration-200 hover:border-blue-400"
                />
              </div>

              <div className="relative group">
                <label className="flex items-center text-sm font-semibold text-slate-700 mb-2">
                  Torsion (T<sub>b</sub>) [kNm]
                  <HelpCircle className="w-4 h-4 ml-2 text-slate-400 transition-colors group-hover:text-blue-500" />
                  {renderTooltip("Applied torsional moment")}
                </label>
                <input
                  type="number"
                  name="tb"
                  value={inputs.tb}
                  onChange={handleInputChange}
                  className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all duration-200 hover:border-blue-400"
                />
              </div>

              <div className="relative group">
                <label className="flex items-center text-sm font-semibold text-slate-700 mb-2">
                  Major Axis Moment (M<sub>b</sub>) [kNm]
                  <HelpCircle className="w-4 h-4 ml-2 text-slate-400 transition-colors group-hover:text-blue-500" />
                  {renderTooltip("Bending moment about major axis")}
                </label>
                <input
                  type="number"
                  name="mb"
                  value={inputs.mb}
                  onChange={handleInputChange}
                  className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all duration-200 hover:border-blue-400"
                />
              </div>

              <div className="relative group">
                <label className="flex items-center text-sm font-semibold text-slate-700 mb-2">
                  Minor Axis Moment (M<sub>m</sub>) [kNm]
                  <HelpCircle className="w-4 h-4 ml-2 text-slate-400 transition-colors group-hover:text-blue-500" />
                  {renderTooltip("Bending moment about minor axis")}
                </label>
                <input
                  type="number"
                  name="mm"
                  value={inputs.mm}
                  onChange={handleInputChange}
                  className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all duration-200 hover:border-blue-400"
                />
              </div>

              <div className="relative group">
                <label className="flex items-center text-sm font-semibold text-slate-700 mb-2">
                  Axial Force (N<sub>t</sub>) [kN] (tension positive)
                  <HelpCircle className="w-4 h-4 ml-2 text-slate-400 transition-colors group-hover:text-blue-500" />
                  {renderTooltip("Applied axial force (positive for tension)")}
                </label>
                <input
                  type="number"
                  name="nt"
                  value={inputs.nt}
                  onChange={handleInputChange}
                  className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all duration-200 hover:border-blue-400"
                />
              </div>
            </div>

            {/* Bolt Properties and Analysis Factors */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 pb-2 border-b-2 border-cyan-600">
                <div className="w-1 h-5 bg-gradient-to-b from-cyan-600 to-blue-600 rounded-full"></div>
                Bolt Properties & Factors
              </h3>

              <div className="relative group">
                <label className="flex items-center text-sm font-semibold text-slate-700 mb-2">
                  Bolt Grade
                  <HelpCircle className="w-4 h-4 ml-2 text-slate-400 transition-colors group-hover:text-blue-500" />
                  {renderTooltip("Strength grade of the bolt")}
                </label>
                <select
                  name="boltGrade"
                  value={inputs.boltGrade}
                  onChange={handleInputChange}
                  className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all duration-200 bg-white hover:border-blue-400"
                >
                  {getBoltGrades().map(grade => (
                    <option key={grade} value={grade}>{grade}</option>
                  ))}
                </select>
              </div>

              <div className="relative group">
                <label className="flex items-center text-sm font-semibold text-slate-700 mb-2">
                  Bolt Size
                  <HelpCircle className="w-4 h-4 ml-2 text-slate-400 transition-colors group-hover:text-blue-500" />
                  {renderTooltip("Nominal diameter of the bolt")}
                </label>
                <select
                  name="boltSize"
                  value={inputs.boltSize}
                  onChange={handleInputChange}
                  className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all duration-200 bg-white hover:border-blue-400"
                >
                  {availableSizes.map(size => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>

              <div className="relative group">
                <label className="flex items-center text-sm font-semibold text-slate-700 mb-2">
                  Prying Allowance
                  <HelpCircle className="w-4 h-4 ml-2 text-slate-400 transition-colors group-hover:text-blue-500" />
                  {renderTooltip("Factor to account for prying action")}
                </label>
                <input
                  type="number"
                  name="pryingAllowance"
                  min="1"
                  step="0.1"
                  value={inputs.pryingAllowance}
                  onChange={handleInputChange}
                  className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all duration-200 hover:border-blue-400"
                />
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-4 rounded-xl border border-blue-100 shadow-sm mt-4">
                <h3 className="font-bold text-blue-900 mb-3 text-base flex items-center gap-2">
                  <div className="w-1 h-4 bg-gradient-to-b from-blue-600 to-cyan-600 rounded-full"></div>
                  Results
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-blue-100">
                    <span className="text-slate-700 font-medium">Max Shear Force:</span>
                    <span className="font-bold text-blue-900">{results.shearForce.toFixed(2)} kN</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-blue-100">
                    <span className="text-slate-700 font-medium">Max Tensile Force:</span>
                    <span className="font-bold text-blue-900">{results.axialForce.toFixed(2)} kN</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-blue-100">
                    <span className="text-slate-700 font-medium">Shear Capacity (<InlineMath math="\phi V_f" />):</span>
                    <span className="font-bold text-blue-900">{results.maxShear.toFixed(2)} kN</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-blue-100">
                    <span className="text-slate-700 font-medium">Tensile Capacity (<InlineMath math="\phi N_{tf}" />):</span>
                    <span className="font-bold text-blue-900">{results.maxTension.toFixed(2)} kN</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-blue-100">
                    <span className="text-slate-700 font-medium">Tensile Area:</span>
                    <span className="font-bold text-blue-900">{results.tensileArea.toFixed(1)} mm²</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-blue-100">
                    <span className="text-slate-700 font-medium">Max Shear Stress:</span>
                    <span className="font-bold text-blue-900">{results.shearStress.toFixed(1)} MPa</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-blue-100">
                    <span className="text-slate-700 font-medium">Max Tensile Stress:</span>
                    <span className="font-bold text-blue-900">{results.tensileStress.toFixed(1)} MPa</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-blue-100">
                    <span className="text-slate-700 font-medium">Polar Moment:</span>
                    <span className="font-bold text-blue-900">{results.ibp.toFixed(0)} mm⁴</span>
                  </div>

                  <div className="mt-4 space-y-2 pt-3 border-t-2 border-blue-200">
                    <div className="flex justify-between items-center p-1.5 rounded-lg bg-white/60">
                      <span className="text-slate-700 font-semibold">Shear Utilisation:</span>
                      <span className={`font-bold ${getUtilisationColor(results.shearForce / results.maxShear)}`}>
                        {(results.shearForce / results.maxShear).toFixed(3)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-1.5 rounded-lg bg-white/60">
                      <span className="text-slate-700 font-semibold">Tension Utilisation:</span>
                      <span className={`font-bold ${getUtilisationColor(results.axialForce / results.maxTension)}`}>
                        {(results.axialForce / results.maxTension).toFixed(3)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-1.5 rounded-lg bg-white/60">
                      <span className="text-slate-700 font-semibold">Combined Ratio:</span>
                      <span className={`font-bold ${getUtilisationColor(results.combinedRatio)}`}>
                        {results.combinedRatio.toFixed(3)}
                      </span>
                    </div>
                  </div>

                  {results.combinedRatio <= 1 ? (
                    <div className="mt-3 p-3 bg-gradient-to-r from-emerald-50 to-green-50 border-l-4 border-emerald-500 rounded-lg">
                      <p className="text-emerald-700 font-bold flex items-center text-sm">
                        <span className="mr-2 text-lg">✓</span> Design is acceptable
                      </p>
                    </div>
                  ) : (
                    <div className="mt-3 p-3 bg-gradient-to-r from-red-50 to-orange-50 border-l-4 border-red-500 rounded-lg">
                      <p className="text-red-700 font-bold flex items-center text-sm">
                        <AlertCircle className="w-4 h-4 mr-2" /> Design exceeds limits
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 mt-4">
                <button
                  onClick={saveCalculation}
                  className="flex items-center justify-center px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg text-sm font-semibold shadow-lg hover:shadow-xl hover:from-blue-700 hover:to-cyan-700 transition-all duration-300 transform hover:-translate-y-0.5"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Results
                </button>
                <button
                  onClick={() => generateWordDocument({ inputs, results })}
                  className="flex items-center justify-center px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg text-sm font-semibold shadow-lg hover:shadow-xl hover:from-emerald-700 hover:to-teal-700 transition-all duration-300 transform hover:-translate-y-0.5"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Export Word
                </button>
              </div>
            </div>
          </div>
        </div>

        {savedCalculations.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl ring-1 ring-slate-200 p-5 overflow-hidden transform transition-all duration-300 hover:shadow-2xl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <div className="w-1 h-6 bg-gradient-to-b from-blue-600 to-cyan-600 rounded-full"></div>
                Saved Calculations
              </h2>
              <button
                onClick={exportToCSV}
                className="flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg text-sm font-semibold shadow-lg hover:shadow-xl hover:from-blue-700 hover:to-cyan-700 transition-all duration-300 transform hover:-translate-y-0.5"
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-gradient-to-r from-slate-50 to-blue-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Size
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Grade
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Shear (kN)
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Tension (kN)
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Shear Util.
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Tension Util.
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Combined
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {savedCalculations.map((calc, index) => (
                    <tr key={index} className="hover:bg-blue-50/50 transition-colors duration-150">
                      <td className="px-4 py-3 whitespace-nowrap text-xs font-medium text-slate-700">
                        {calc.timestamp}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs font-semibold text-blue-700">
                        {calc.boltSize}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-600">
                        {calc.boltGrade}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs font-medium text-slate-700">
                        {calc.shearForce.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs font-medium text-slate-700">
                        {calc.axialForce.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs font-semibold text-slate-700">
                        {calc.shearUtilisation.toFixed(3)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs font-semibold text-slate-700">
                        {calc.tensionUtilisation.toFixed(3)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs font-bold text-slate-700">
                        {calc.combinedRatio.toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 bg-gradient-to-r from-red-50 to-orange-50 border-l-4 border-red-500 rounded-xl shadow-lg flex items-start">
            <AlertCircle className="w-5 h-5 mr-2 text-red-600 flex-shrink-0 mt-0.5" />
            <span className="text-xs font-medium text-red-700">{error}</span>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-slate-50 to-blue-50 border-t border-slate-200 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col items-center justify-center">
            <p className="text-xs font-medium text-slate-600">
              © {new Date().getFullYear()} DummyMember.com. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;