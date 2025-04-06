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
    <div className="absolute z-10 invisible group-hover:visible bg-gray-900 text-white p-2 rounded text-sm w-64 -mt-24">
      {text}
    </div>
  );

  const getUtilisationColor = (value: number) => 
    value <= 1.0 ? 'text-green-600' : 'text-red-600';

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Bolt Group Analysis Calculator
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Bolt Pattern Visualisation */}
          <div className="bg-white rounded-xl shadow-lg ring-1 ring-black ring-opacity-5 overflow-hidden">
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
          <div className="bg-white rounded-xl shadow-lg ring-1 ring-black ring-opacity-5 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Governing Equations</h2>
            <div className="space-y-6">
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-blue-900 mb-2">Total Axial Force per Bolt:</p>
                <BlockMath math="N_t = \alpha \left(\frac{N}{n} + \frac{M_b y}{2y_m^2} + \frac{M_m x}{2x_m^2}\right)" />
              </div>
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-blue-900 mb-2">Resultant Shear Force per Bolt:</p>
                <BlockMath math="V_r = \sqrt{\left(\frac{V_x}{n} + \frac{T_b y}{I_{bp}}\right)^2 + \left(\frac{V_y}{n} + \frac{T_b x}{I_{bp}}\right)^2}" />
              </div>
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-blue-900 mb-2">Combined Shear and Tension Check:</p>
                <BlockMath math="\left(\frac{V_r}{\phi V_f}\right)^2 + \left(\frac{N_t}{\phi N_{tf}}\right)^2 \leq 1.0" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg ring-1 ring-black ring-opacity-5 p-6 mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Bolt Layout Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Bolt Layout</h3>

              <div className="relative group">
                <label className="flex items-center text-sm font-medium text-gray-700">
                  Arrangement Type
                  <HelpCircle className="w-4 h-4 ml-2 text-gray-400" />
                  {renderTooltip("Choose between rectangular grid or circular arrangement")}
                </label>
                <select
                  name="arrangement"
                  value={inputs.arrangement}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="rectangular">Rectangular Grid</option>
                  <option value="circular">Circular Pattern</option>
                </select>
              </div>

              {inputs.arrangement === 'rectangular' ? (
                <>
                  <div className="relative group">
                    <label className="flex items-center text-sm font-medium text-gray-700">
                      Number of Rows
                      <HelpCircle className="w-4 h-4 ml-2 text-gray-400" />
                      {renderTooltip("Number of bolt rows in the vertical direction")}
                    </label>
                    <input
                      type="number"
                      name="numRows"
                      min="1"
                      value={inputs.numRows}
                      onChange={handleInputChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  <div className="relative group">
                    <label className="flex items-center text-sm font-medium text-gray-700">
                      Number of Columns
                      <HelpCircle className="w-4 h-4 ml-2 text-gray-400" />
                      {renderTooltip("Number of bolt columns in the horizontal direction")}
                    </label>
                    <input
                      type="number"
                      name="numCols"
                      min="1"
                      value={inputs.numCols}
                      onChange={handleInputChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  <div className="relative group">
                    <label className="flex items-center text-sm font-medium text-gray-700">
                      Row Spacing (mm)
                      <HelpCircle className="w-4 h-4 ml-2 text-gray-400" />
                      {renderTooltip("Vertical spacing between bolt rows")}
                    </label>
                    <input
                      type="number"
                      name="rowSpacing"
                      min="0"
                      value={inputs.rowSpacing}
                      onChange={handleInputChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  <div className="relative group">
                    <label className="flex items-center text-sm font-medium text-gray-700">
                      Column Spacing (mm)
                      <HelpCircle className="w-4 h-4 ml-2 text-gray-400" />
                      {renderTooltip("Horizontal spacing between bolt columns")}
                    </label>
                    <input
                      type="number"
                      name="colSpacing"
                      min="0"
                      value={inputs.colSpacing}
                      onChange={handleInputChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="relative group">
                    <label className="flex items-center text-sm font-medium text-gray-700">
                      Circle Diameter (mm)
                      <HelpCircle className="w-4 h-4 ml-2 text-gray-400" />
                      {renderTooltip("Diameter of the bolt circle")}
                    </label>
                    <input
                      type="number"
                      name="diameter"
                      min="0"
                      value={inputs.diameter}
                      onChange={handleInputChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  <div className="relative group">
                    <label className="flex items-center text-sm font-medium text-gray-700">
                      Number of Bolts
                      <HelpCircle className="w-4 h-4 ml-2 text-gray-400" />
                      {renderTooltip("Total number of bolts in the circular pattern")}
                    </label>
                    <input
                      type="number"
                      name="numBolts"
                      min="2"
                      value={inputs.numBolts}
                      onChange={handleInputChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Applied Loads Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Applied Loads</h3>
              
              <div className="relative group">
                <label className="flex items-center text-sm font-medium text-gray-700">
                  Horizontal Shear (V<sub>x</sub>) [kN]
                  <HelpCircle className="w-4 h-4 ml-2 text-gray-400" />
                  {renderTooltip("Applied horizontal shear force")}
                </label>
                <input
                  type="number"
                  name="vx"
                  value={inputs.vx}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="relative group">
                <label className="flex items-center text-sm font-medium text-gray-700">
                  Vertical Shear (V<sub>y</sub>) [kN]
                  <HelpCircle className="w-4 h-4 ml-2 text-gray-400" />
                  {renderTooltip("Applied vertical shear force")}
                </label>
                <input
                  type="number"
                  name="vy"
                  value={inputs.vy}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="relative group">
                <label className="flex items-center text-sm font-medium text-gray-700">
                  Torsion (T<sub>b</sub>) [kNm]
                  <HelpCircle className="w-4 h-4 ml-2 text-gray-400" />
                  {renderTooltip("Applied torsional moment")}
                </label>
                <input
                  type="number"
                  name="tb"
                  value={inputs.tb}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="relative group">
                <label className="flex items-center text-sm font-medium text-gray-700">
                  Major Axis Moment (M<sub>b</sub>) [kNm]
                  <HelpCircle className="w-4 h-4 ml-2 text-gray-400" />
                  {renderTooltip("Bending moment about major axis")}
                </label>
                <input
                  type="number"
                  name="mb"
                  value={inputs.mb}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="relative group">
                <label className="flex items-center text-sm font-medium text-gray-700">
                  Minor Axis Moment (M<sub>m</sub>) [kNm]
                  <HelpCircle className="w-4 h-4 ml-2 text-gray-400" />
                  {renderTooltip("Bending moment about minor axis")}
                </label>
                <input
                  type="number"
                  name="mm"
                  value={inputs.mm}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="relative group">
                <label className="flex items-center text-sm font-medium text-gray-700">
                  Axial Force (N<sub>t</sub>) [kN] (tension positive)
                  <HelpCircle className="w-4 h-4 ml-2 text-gray-400" />
                  {renderTooltip("Applied axial force (positive for tension)")}
                </label>
                <input
                  type="number"
                  name="nt"
                  value={inputs.nt}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Bolt Properties and Analysis Factors */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Bolt Properties & Factors</h3>
              
              <div className="relative group">
                <label className="flex items-center text-sm font-medium text-gray-700">
                  Bolt Grade
                  <HelpCircle className="w-4 h-4 ml-2 text-gray-400" />
                  {renderTooltip("Strength grade of the bolt")}
                </label>
                <select
                  name="boltGrade"
                  value={inputs.boltGrade}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  {getBoltGrades().map(grade => (
                    <option key={grade} value={grade}>{grade}</option>
                  ))}
                </select>
              </div>

              <div className="relative group">
                <label className="flex items-center text-sm font-medium text-gray-700">
                  Bolt Size
                  <HelpCircle className="w-4 h-4 ml-2 text-gray-400" />
                  {renderTooltip("Nominal diameter of the bolt")}
                </label>
                <select
                  name="boltSize"
                  value={inputs.boltSize}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  {availableSizes.map(size => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>

              <div className="relative group">
                <label className="flex items-center text-sm font-medium text-gray-700">
                  Prying Allowance
                  <HelpCircle className="w-4 h-4 ml-2 text-gray-400" />
                  {renderTooltip("Factor to account for prying action")}
                </label>
                <input
                  type="number"
                  name="pryingAllowance"
                  min="1"
                  step="0.1"
                  value={inputs.pryingAllowance}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="bg-blue-50 p-4 rounded-lg mt-6">
                <h3 className="font-semibold text-blue-900 mb-2">Results</h3>
                <div className="space-y-2">
                  <p>Maximum Shear Force: {results.shearForce.toFixed(2)} kN</p>
                  <p>Maximum Tensile Force: {results.axialForce.toFixed(2)} kN</p>
                  <p>Bolt Shear Capacity (<InlineMath math="\phi V_f" />): {results.maxShear.toFixed(2)} kN</p>
                  <p>Bolt Tensile Capacity (<InlineMath math="\phi N_{tf}" />): {results.maxTension.toFixed(2)} kN</p>
                  <p>Bolt Tensile Area: {results.tensileArea.toFixed(1)} mm²</p>
                  <p>Maximum Shear Stress: {results.shearStress.toFixed(1)} MPa</p>
                  <p>Maximum Tensile Stress: {results.tensileStress.toFixed(1)} MPa</p>
                  <p>Polar Moment of Inertia: {results.ibp.toFixed(0)} mm⁴</p>
                  
                  <div className="mt-4 space-y-2">
                    <p className={getUtilisationColor(results.shearForce / results.maxShear)}>
                      Shear Utilisation: {(results.shearForce / results.maxShear).toFixed(3)}
                    </p>
                    <p className={getUtilisationColor(results.axialForce / results.maxTension)}>
                      Tension Utilisation: {(results.axialForce / results.maxTension).toFixed(3)}
                    </p>
                    <p className={getUtilisationColor(results.combinedRatio)}>
                      Combined Ratio: {results.combinedRatio.toFixed(3)}
                    </p>
                  </div>

                  {results.combinedRatio <= 1 ? (
                    <p className="text-green-600 font-semibold flex items-center">
                      <span className="mr-2">✓</span> Design is acceptable
                    </p>
                  ) : (
                    <p className="text-red-600 font-semibold flex items-center">
                      <AlertCircle className="w-4 h-4 mr-2" /> Design exceeds limits
                    </p>
                  )}
                </div>
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={saveCalculation}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Results
                </button>
                <button
                  onClick={() => generateWordDocument({ inputs, results })}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Export Word
                </button>
              </div>
            </div>
          </div>
        </div>

        {savedCalculations.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg ring-1 ring-black ring-opacity-5 p-6 overflow-hidden">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Save
d Calculations</h2>
              <button
                onClick={exportToCSV}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Bolt Size
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Bolt Grade
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Shear Force (kN)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tensile Force (kN)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Shear Utilisation
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tension Utilisation
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Combined Ratio
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {savedCalculations.map((calc, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {calc.timestamp}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {calc.boltSize}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {calc.boltGrade}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {calc.shearForce.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {calc.axialForce.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {calc.shearUtilisation.toFixed(3)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {calc.tensionUtilisation.toFixed(3)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
          <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-xl flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            <span className="text-sm">{error}</span>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col items-center justify-center">
            <p className="text-sm text-gray-500">
              © {new Date().getFullYear()} DummyMember.com. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;