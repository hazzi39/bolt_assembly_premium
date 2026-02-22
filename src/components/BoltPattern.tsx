import React, { useState } from 'react';

interface BoltPatternProps {
  arrangement: 'rectangular' | 'circular';
  numRows: number;
  numCols: number;
  rowSpacing: number;
  colSpacing: number;
  diameter: number;
  numBolts: number;
  boltSize: string;
  vx: number;
  vy: number;
  tb: number;
  mb: number;
  mm: number;
  nt: number;
  pryingAllowance: number;
}

const BoltPattern: React.FC<BoltPatternProps> = ({
  arrangement,
  numRows,
  numCols,
  rowSpacing,
  colSpacing,
  diameter,
  numBolts,
  boltSize,
  vx,
  vy,
  tb,
  mb,
  mm,
  nt,
  pryingAllowance
}) => {
  const [hoveredBolt, setHoveredBolt] = useState<number | null>(null);
  const [showLabels, setShowLabels] = useState(true);

  const boltDiameter = parseInt(boltSize.substring(1));
  const scale = 0.8;
  const padding = 80;
  
  // Calculate dimensions based on arrangement
  const width = arrangement === 'rectangular'
    ? (colSpacing * (numCols - 1)) * scale + 2 * padding
    : diameter * scale + 2 * padding;
  const height = arrangement === 'rectangular'
    ? (rowSpacing * (numRows - 1)) * scale + 2 * padding
    : diameter * scale + 2 * padding;

  // Calculate bolt positions and forces
  const calculateBoltForces = () => {
    const positions: { x: number; y: number; shear: number; tension: number }[] = [];
    let ibp = 0;
    const totalBolts = arrangement === 'rectangular' ? numRows * numCols : numBolts;
    
    if (arrangement === 'rectangular') {
      const centerX = ((numCols - 1) * colSpacing) / 2;
      const centerY = ((numRows - 1) * rowSpacing) / 2;
      
      // Calculate Ibp first
      for (let row = 0; row < numRows; row++) {
        for (let col = 0; col < numCols; col++) {
          const x = col * colSpacing - centerX;
          const y = row * rowSpacing - centerY;
          ibp += x * x + y * y;
        }
      }
      
      // Calculate forces for each bolt
      for (let row = 0; row < numRows; row++) {
        for (let col = 0; col < numCols; col++) {
          const x = col * colSpacing - centerX;
          const y = row * rowSpacing - centerY;
          
          // Calculate forces
          const shearX = (-vx * 1000 / totalBolts) + ((-tb * 1e6) * y / ibp);
          const shearY = (-vy * 1000 / totalBolts) + ((-tb * 1e6) * x / ibp);
          const totalShear = Math.sqrt(shearX * shearX + shearY * shearY) / 1000;
          
          const ym = (numRows * rowSpacing) / 2;
          const xm = (numCols * colSpacing) / 2;
          const majorAxisForce = (mb * 1e6 * y) / (2 * ym * ym);
          const minorAxisForce = (mm * 1e6 * x) / (2 * xm * xm);
          const pureAxialForce = nt * 1000 / totalBolts;
          const totalTension = pryingAllowance * (pureAxialForce + majorAxisForce + minorAxisForce) / 1000;
          
          positions.push({
            x: col * colSpacing,
            y: row * rowSpacing,
            shear: totalShear,
            tension: totalTension
          });
        }
      }
    } else {
      // Circular arrangement
      const radius = diameter / 2;
      ibp = totalBolts * radius * radius;
      const angleIncrement = (2 * Math.PI) / totalBolts;
      
      for (let i = 0; i < totalBolts; i++) {
        const angle = i * angleIncrement;
        const x = radius * Math.cos(angle);
        const y = radius * Math.sin(angle);
        
        // Calculate forces
        const shearX = (-vx * 1000 / totalBolts) + ((-tb * 1e6) * y / ibp);
        const shearY = (-vy * 1000 / totalBolts) + ((-tb * 1e6) * x / ibp);
        const totalShear = Math.sqrt(shearX * shearX + shearY * shearY) / 1000;
        
        const majorAxisForce = (mb * 1e6 * y) / (2 * radius * radius);
        const minorAxisForce = (mm * 1e6 * x) / (2 * radius * radius);
        const pureAxialForce = nt * 1000 / totalBolts;
        const totalTension = pryingAllowance * (pureAxialForce + majorAxisForce + minorAxisForce) / 1000;
        
        positions.push({
          x: x + radius,
          y: y + radius,
          shear: totalShear,
          tension: totalTension
        });
      }
    }
    
    return positions;
  };

  const boltForces = calculateBoltForces();

  const scaledSpacing = arrangement === 'rectangular'
    ? Math.min(rowSpacing * scale, colSpacing * scale)
    : (diameter * scale) / numBolts;
  const showInlineLabels = scaledSpacing > 60;

  const maxShear = Math.max(...boltForces.map(b => Math.abs(b.shear)));
  const maxTension = Math.max(...boltForces.map(b => Math.abs(b.tension)));

  return (
    <div className="bg-gradient-to-br from-white to-slate-50 p-8">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <div className="w-1 h-8 bg-gradient-to-b from-blue-600 to-cyan-600 rounded-full"></div>
          Bolt Pattern Layout
        </h3>
        <button
          onClick={() => setShowLabels(!showLabels)}
          className="px-4 py-2 text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors duration-200 border border-blue-200"
        >
          {showLabels ? 'Hide Labels' : 'Show Labels'}
        </button>
      </div>
      <div className="relative" style={{ width: `${width}px`, height: `${height}px` }}>
        {/* Grid lines or circle */}
        <svg
          width={width}
          height={height}
          className="absolute top-0 left-0"
          style={{ strokeWidth: '1px', stroke: '#e5e7eb' }}
        >
          {arrangement === 'rectangular' ? (
            <>
              {/* Vertical grid lines */}
              {Array.from({ length: numCols }).map((_, col) => (
                <line
                  key={`v-${col}`}
                  x1={padding + col * colSpacing * scale}
                  y1={0}
                  x2={padding + col * colSpacing * scale}
                  y2={height}
                  strokeDasharray="4"
                />
              ))}
              {/* Horizontal grid lines */}
              {Array.from({ length: numRows }).map((_, row) => (
                <line
                  key={`h-${row}`}
                  x1={0}
                  y1={padding + row * rowSpacing * scale}
                  x2={width}
                  y2={padding + row * rowSpacing * scale}
                  strokeDasharray="4"
                />
              ))}
            </>
          ) : (
            <circle
              cx={width / 2}
              cy={height / 2}
              r={diameter * scale / 2}
              fill="none"
              strokeDasharray="4"
            />
          )}
        </svg>

        {/* Bolts and dimensions */}
        <svg
          width={width}
          height={height}
          className="absolute top-0 left-0"
          style={{ strokeWidth: '2px', stroke: '#1e40af' }}
        >
          {/* Bolt holes with force indicators */}
          {boltForces.map((bolt, index) => {
            const scaledX = padding + bolt.x * scale;
            const scaledY = padding + bolt.y * scale;
            const isHovered = hoveredBolt === index;

            const shearText = `V: ${bolt.shear.toFixed(1)} kN`;
            const tensionText = `N: ${bolt.tension.toFixed(1)} kN`;

            return (
              <g
                key={`bolt-${index}`}
                onMouseEnter={() => setHoveredBolt(index)}
                onMouseLeave={() => setHoveredBolt(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Bolt hole */}
                <circle
                  cx={scaledX}
                  cy={scaledY}
                  r={boltDiameter * scale / 2}
                  fill={isHovered ? "url(#boltGradientHover)" : "url(#boltGradient)"}
                  stroke={isHovered ? "#06b6d4" : "#0ea5e9"}
                  strokeWidth={isHovered ? "3" : "2.5"}
                  className="transition-all duration-200"
                />
                <circle
                  cx={scaledX}
                  cy={scaledY}
                  r={3}
                  fill="#0c4a6e"
                />

                {/* Force values with backgrounds */}
                {showLabels && showInlineLabels && (
                  <>
                    {/* Shear force label */}
                    <rect
                      x={scaledX - 30}
                      y={scaledY - boltDiameter * scale / 2 - 22}
                      width={60}
                      height={16}
                      rx={4}
                      fill="rgba(255, 255, 255, 0.95)"
                      stroke="#0ea5e9"
                      strokeWidth="1"
                      className="drop-shadow-sm"
                    />
                    <text
                      x={scaledX}
                      y={scaledY - boltDiameter * scale / 2 - 11}
                      textAnchor="middle"
                      fill="#0c4a6e"
                      className="text-[11px] font-bold"
                      style={{ fontFamily: 'monospace' }}
                    >
                      {shearText}
                    </text>

                    {/* Tension force label */}
                    <rect
                      x={scaledX - 30}
                      y={scaledY + boltDiameter * scale / 2 + 6}
                      width={60}
                      height={16}
                      rx={4}
                      fill="rgba(255, 255, 255, 0.95)"
                      stroke="#0ea5e9"
                      strokeWidth="1"
                      className="drop-shadow-sm"
                    />
                    <text
                      x={scaledX}
                      y={scaledY + boltDiameter * scale / 2 + 17}
                      textAnchor="middle"
                      fill="#0c4a6e"
                      className="text-[11px] font-bold"
                      style={{ fontFamily: 'monospace' }}
                    >
                      {tensionText}
                    </text>
                  </>
                )}

                {/* Tooltip on hover */}
                {isHovered && (
                  <>
                    <rect
                      x={scaledX + 15}
                      y={scaledY - 30}
                      width={100}
                      height={48}
                      rx={6}
                      fill="#1e293b"
                      stroke="#0ea5e9"
                      strokeWidth="2"
                      className="drop-shadow-lg"
                    />
                    <text
                      x={scaledX + 65}
                      y={scaledY - 15}
                      textAnchor="middle"
                      fill="#ffffff"
                      className="text-[11px] font-bold"
                    >
                      Bolt {index + 1}
                    </text>
                    <text
                      x={scaledX + 65}
                      y={scaledY - 2}
                      textAnchor="middle"
                      fill="#93c5fd"
                      className="text-[10px] font-semibold"
                    >
                      {shearText}
                    </text>
                    <text
                      x={scaledX + 65}
                      y={scaledY + 11}
                      textAnchor="middle"
                      fill="#93c5fd"
                      className="text-[10px] font-semibold"
                    >
                      {tensionText}
                    </text>
                  </>
                )}
              </g>
            );
          })}

          {/* Dimensions */}
          {arrangement === 'rectangular' ? (
            <>
              {/* Horizontal dimensions */}
              <g transform={`translate(0, ${height - 20})`}>
                <line
                  x1={padding}
                  y1={0}
                  x2={padding + (numCols - 1) * colSpacing * scale}
                  y2={0}
                  markerEnd="url(#arrowhead)"
                  markerStart="url(#arrowhead)"
                />
                <text
                  x={padding + ((numCols - 1) * colSpacing * scale) / 2}
                  y={20}
                  textAnchor="middle"
                  fill="#0c4a6e"
                  className="text-xs font-bold"
                >
                  {((numCols - 1) * colSpacing).toFixed(0)} mm
                </text>
              </g>

              {/* Vertical dimensions */}
              <g transform={`translate(${width - 20}, 0)`}>
                <line
                  x1={0}
                  y1={padding}
                  x2={0}
                  y2={padding + (numRows - 1) * rowSpacing * scale}
                  markerEnd="url(#arrowhead)"
                  markerStart="url(#arrowhead)"
                />
                <text
                  x={-20}
                  y={padding + ((numRows - 1) * rowSpacing * scale) / 2}
                  textAnchor="middle"
                  fill="#0c4a6e"
                  className="text-xs font-bold"
                  transform={`rotate(-90, -20, ${padding + ((numRows - 1) * rowSpacing * scale) / 2})`}
                >
                  {((numRows - 1) * rowSpacing).toFixed(0)} mm
                </text>
              </g>
            </>
          ) : (
            <>
              {/* Diameter dimension */}
              <g transform={`translate(0, ${height - 20})`}>
                <line
                  x1={padding}
                  y1={0}
                  x2={padding + diameter * scale}
                  y2={0}
                  markerEnd="url(#arrowhead)"
                  markerStart="url(#arrowhead)"
                />
                <text
                  x={padding + (diameter * scale) / 2}
                  y={20}
                  textAnchor="middle"
                  fill="#0c4a6e"
                  className="text-xs font-bold"
                >
                  {diameter.toFixed(0)} mm
                </text>
              </g>
            </>
          )}

          {/* Arrow markers and gradients definition */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#0c4a6e" />
            </marker>
            <linearGradient id="boltGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#bfdbfe" />
              <stop offset="100%" stopColor="#93c5fd" />
            </linearGradient>
            <linearGradient id="boltGradientHover" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#67e8f9" />
              <stop offset="100%" stopColor="#22d3ee" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Bolt Forces Data Table */}
      <div className="mt-8">
        <h4 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <div className="w-1 h-6 bg-gradient-to-b from-blue-600 to-cyan-600 rounded-full"></div>
          Bolt Forces Summary
        </h4>
        <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-gradient-to-r from-slate-50 to-blue-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Bolt #
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Position (mm)
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Shear Force (kN)
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Tensile Force (kN)
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {boltForces.map((bolt, index) => {
                const centerX = arrangement === 'rectangular' ? ((numCols - 1) * colSpacing) / 2 : diameter / 2;
                const centerY = arrangement === 'rectangular' ? ((numRows - 1) * rowSpacing) / 2 : diameter / 2;
                const relX = bolt.x - centerX;
                const relY = bolt.y - centerY;

                const isMaxShear = Math.abs(bolt.shear - maxShear) < 0.01;
                const isMaxTension = Math.abs(bolt.tension - maxTension) < 0.01;

                return (
                  <tr
                    key={index}
                    className={`transition-colors duration-150 ${
                      hoveredBolt === index ? 'bg-blue-100' : 'hover:bg-blue-50/50'
                    }`}
                    onMouseEnter={() => setHoveredBolt(index)}
                    onMouseLeave={() => setHoveredBolt(null)}
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-blue-700">
                      {index + 1}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 font-mono">
                      ({relX.toFixed(0)}, {relY.toFixed(0)})
                    </td>
                    <td className={`px-4 py-3 whitespace-nowrap text-sm font-semibold text-right ${
                      isMaxShear ? 'text-red-600 font-bold' : 'text-slate-700'
                    }`}>
                      {bolt.shear.toFixed(2)}
                      {isMaxShear && <span className="ml-1 text-xs">MAX</span>}
                    </td>
                    <td className={`px-4 py-3 whitespace-nowrap text-sm font-semibold text-right ${
                      isMaxTension ? 'text-red-600 font-bold' : 'text-slate-700'
                    }`}>
                      {bolt.tension.toFixed(2)}
                      {isMaxTension && <span className="ml-1 text-xs">MAX</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      {(isMaxShear || isMaxTension) ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Critical
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          OK
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg border border-blue-100 space-y-3">
        <h4 className="text-sm font-bold text-slate-800 mb-3">Legend</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-200 to-blue-300 border-2 border-cyan-500 shadow-sm"></div>
            <span className="text-xs font-medium text-slate-700">Bolt hole (M{boltDiameter})</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-6 h-0 border-t-2 border-dashed border-slate-400"></div>
            <span className="text-xs font-medium text-slate-700">
              {arrangement === 'rectangular' ? 'Center line' : 'Bolt circle'}
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-6 h-0 border-t-2 border-blue-900"></div>
            <span className="text-xs font-medium text-slate-700">Dimension line</span>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-xs font-semibold text-blue-700">V: Shear Force (kN)</span>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-xs font-semibold text-blue-700">N: Tensile Force (kN)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BoltPattern;