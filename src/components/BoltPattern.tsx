import React from 'react';

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
  const boltDiameter = parseInt(boltSize.substring(1));
  const scale = 0.8;
  const padding = 60;
  
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

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Bolt Pattern Layout</h3>
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
            
            return (
              <g key={`bolt-${index}`}>
                {/* Bolt hole */}
                <circle
                  cx={scaledX}
                  cy={scaledY}
                  r={boltDiameter * scale / 2}
                  fill="#93c5fd"
                  stroke="#1e40af"
                />
                <circle
                  cx={scaledX}
                  cy={scaledY}
                  r={2}
                  fill="#1e40af"
                />
                
                {/* Force values */}
                <text
                  x={scaledX}
                  y={scaledY - boltDiameter * scale / 2 - 5}
                  textAnchor="middle"
                  fill="#1e40af"
                  className="text-[11px] font-normal"
                >
                  V: {bolt.shear.toFixed(1)} kN
                </text>
                <text
                  x={scaledX}
                  y={scaledY + boltDiameter * scale / 2 + 15}
                  textAnchor="middle"
                  fill="#1e40af"
                  className="text-[11px] font-normal"
                >
                  N: {bolt.tension.toFixed(1)} kN
                </text>
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
                  fill="#1e40af"
                  className="text-xs font-normal"
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
                  fill="#1e40af"
                  className="text-xs font-normal"
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
                  fill="#1e40af"
                  className="text-xs font-normal"
                >
                  {diameter.toFixed(0)} mm
                </text>
              </g>
            </>
          )}

          {/* Arrow markers definition */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#1e40af" />
            </marker>
          </defs>
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-4 space-y-2">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded-full bg-blue-200 border-2 border-blue-800"></div>
          <span className="text-sm font-normal text-gray-600">Bolt hole (M{boltDiameter})</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-0 border-t-2 border-dashed border-gray-300"></div>
          <span className="text-sm font-normal text-gray-600">
            {arrangement === 'rectangular' ? 'Center line' : 'Bolt circle'}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-0 border-t-2 border-blue-800"></div>
          <span className="text-sm font-normal text-gray-600">Dimension line</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm font-normal text-gray-600">V: Shear Force (kN)</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm font-normal text-gray-600">N: Tensile Force (kN)</span>
        </div>
      </div>
    </div>
  );
};

export default BoltPattern;