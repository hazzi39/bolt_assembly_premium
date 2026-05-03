import { CalculationResult, InputState } from '../App';

interface BoltPatternProps {
  inputs: InputState;
  result: CalculationResult | null;
  isValid: boolean;
}

const VIEW_WIDTH = 560;
const VIEW_HEIGHT = 380;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function BoltPattern({ inputs, result, isValid }: BoltPatternProps) {
  if (!isValid || !result) {
    return (
      <div className="diagram-empty">
        <p>Enter valid geometry and loading values to generate the live bolt-group visualisation.</p>
      </div>
    );
  }

  const demands = result.boltDemands;
  const maxAbsX = Math.max(...demands.map((demand) => Math.abs(demand.x)), 1);
  const maxAbsY = Math.max(...demands.map((demand) => Math.abs(demand.y)), 1);
  const extentsX = maxAbsX + 110;
  const extentsY = maxAbsY + 110;
  const scale = Math.min((VIEW_WIDTH - 140) / (2 * extentsX), (VIEW_HEIGHT - 120) / (2 * extentsY));
  const centerX = VIEW_WIDTH / 2;
  const centerY = VIEW_HEIGHT / 2;
  const boltRadius = clamp((Number(inputs.boltSize.slice(1)) / 2) * scale, 7, 16);
  const maxShear = Math.max(...demands.map((demand) => demand.shear), 1);
  const maxTension = Math.max(...demands.map((demand) => demand.tension), 1);

  const toSvg = (x: number, y: number) => ({
    x: centerX + x * scale,
    y: centerY - y * scale,
  });

  const rectangularSpanX =
    inputs.arrangement === 'rectangular'
      ? (Number(inputs.numCols) - 1) * Number(inputs.colSpacing)
      : 0;
  const rectangularSpanY =
    inputs.arrangement === 'rectangular'
      ? (Number(inputs.numRows) - 1) * Number(inputs.rowSpacing)
      : 0;
  const circularRadius = inputs.arrangement === 'circular' ? Number(inputs.diameter) / 2 : 0;

  return (
    <div className="diagram-shell">
      <svg viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} className="diagram-canvas" role="img">
        <defs>
          <pattern id="gridPattern" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="rgba(58, 110, 130, 0.08)" strokeWidth="1" />
          </pattern>
          <marker id="loadArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#0f766e" />
          </marker>
          <marker id="dimensionArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#4b6470" />
          </marker>
        </defs>

        <rect x="0" y="0" width={VIEW_WIDTH} height={VIEW_HEIGHT} rx="22" fill="url(#gridPattern)" />

        <line
          x1="48"
          y1={centerY}
          x2={VIEW_WIDTH - 48}
          y2={centerY}
          stroke="#b9c9cf"
          strokeWidth="1.2"
          strokeDasharray="4 5"
        />
        <line
          x1={centerX}
          y1="34"
          x2={centerX}
          y2={VIEW_HEIGHT - 34}
          stroke="#b9c9cf"
          strokeWidth="1.2"
          strokeDasharray="4 5"
        />
        <text x={centerX + 8} y="48" className="diagram-axis-label">
          y
        </text>
        <text x={VIEW_WIDTH - 56} y={centerY - 8} className="diagram-axis-label">
          x
        </text>

        {inputs.arrangement === 'rectangular' ? (
          <rect
            x={centerX - (rectangularSpanX / 2) * scale - 28}
            y={centerY - (rectangularSpanY / 2) * scale - 28}
            width={rectangularSpanX * scale + 56}
            height={rectangularSpanY * scale + 56}
            rx="18"
            fill="rgba(255,255,255,0.7)"
            stroke="#cad7dc"
            strokeWidth="1.2"
          />
        ) : (
          <circle
            cx={centerX}
            cy={centerY}
            r={circularRadius * scale + 28}
            fill="rgba(255,255,255,0.7)"
            stroke="#cad7dc"
            strokeWidth="1.2"
          />
        )}

        {demands.map((demand, index) => {
          const position = toSvg(demand.x, demand.y);
          const vectorScale = 34 / maxShear;
          const endX = position.x + demand.shearX * vectorScale;
          const endY = position.y - demand.shearY * vectorScale;
          const halo = clamp((demand.tension / maxTension) * 10, 0, 10);

          return (
            <g key={`bolt-${index}`}>
              <circle
                cx={position.x}
                cy={position.y}
                r={boltRadius + halo}
                fill="rgba(14, 165, 233, 0.10)"
                stroke="rgba(14, 165, 233, 0.18)"
              />
              <circle
                cx={position.x}
                cy={position.y}
                r={boltRadius}
                fill="#fdfefe"
                stroke="#1696c7"
                strokeWidth="2"
              />
              <circle cx={position.x} cy={position.y} r="2.5" fill="#0f4c5c" />
              <line
                x1={position.x}
                y1={position.y}
                x2={endX}
                y2={endY}
                stroke="#0f766e"
                strokeWidth="1.8"
                markerEnd="url(#loadArrow)"
              />
              <text x={position.x + 10} y={position.y - 10} className="diagram-bolt-label">
                B{index + 1}
              </text>
            </g>
          );
        })}

        <circle cx={centerX} cy={centerY} r="5" fill="#1d4ed8" />
        <text x={centerX + 10} y={centerY + 16} className="diagram-centroid-label">
          C.G.
        </text>

        {inputs.arrangement === 'rectangular' ? (
          <>
            <line
              x1={centerX - (rectangularSpanX / 2) * scale}
              y1={VIEW_HEIGHT - 34}
              x2={centerX + (rectangularSpanX / 2) * scale}
              y2={VIEW_HEIGHT - 34}
              stroke="#4b6470"
              strokeWidth="1.4"
              markerStart="url(#dimensionArrow)"
              markerEnd="url(#dimensionArrow)"
            />
            <text x={centerX} y={VIEW_HEIGHT - 12} textAnchor="middle" className="diagram-dimension-label">
              {(rectangularSpanX || 0).toFixed(0)} mm
            </text>
            <line
              x1={VIEW_WIDTH - 34}
              y1={centerY - (rectangularSpanY / 2) * scale}
              x2={VIEW_WIDTH - 34}
              y2={centerY + (rectangularSpanY / 2) * scale}
              stroke="#4b6470"
              strokeWidth="1.4"
              markerStart="url(#dimensionArrow)"
              markerEnd="url(#dimensionArrow)"
            />
            <text
              x={VIEW_WIDTH - 16}
              y={centerY}
              textAnchor="middle"
              className="diagram-dimension-label"
              transform={`rotate(90 ${VIEW_WIDTH - 16} ${centerY})`}
            >
              {(rectangularSpanY || 0).toFixed(0)} mm
            </text>
          </>
        ) : (
          <>
            <line
              x1={centerX - circularRadius * scale}
              y1={VIEW_HEIGHT - 34}
              x2={centerX + circularRadius * scale}
              y2={VIEW_HEIGHT - 34}
              stroke="#4b6470"
              strokeWidth="1.4"
              markerStart="url(#dimensionArrow)"
              markerEnd="url(#dimensionArrow)"
            />
            <text x={centerX} y={VIEW_HEIGHT - 12} textAnchor="middle" className="diagram-dimension-label">
              {Number(inputs.diameter).toFixed(0)} mm
            </text>
          </>
        )}

        <g className="diagram-load-set">
          <line x1="72" y1="72" x2="122" y2="72" stroke="#0f766e" strokeWidth="1.8" markerEnd="url(#loadArrow)" />
          <text x="64" y="62" className="diagram-load-label">
            Vx {Number(inputs.vx).toFixed(1)} kN
          </text>
          <line x1="72" y1="72" x2="72" y2="124" stroke="#0f766e" strokeWidth="1.8" markerEnd="url(#loadArrow)" />
          <text x="84" y="112" className="diagram-load-label">
            Vy {Number(inputs.vy).toFixed(1)} kN
          </text>
          <path
            d="M 112 128 A 24 24 0 1 1 74 110"
            fill="none"
            stroke="#1d4ed8"
            strokeWidth="1.8"
            markerEnd="url(#loadArrow)"
          />
          <text x="118" y="118" className="diagram-load-label">
            Tb {Number(inputs.tb).toFixed(1)} kNm
          </text>
          <text x="72" y="154" className="diagram-load-label">
            Nt {Number(inputs.nt).toFixed(1)} kN
          </text>
        </g>
      </svg>

      <div className="diagram-legend">
        <div className="legend-item">
          <span className="legend-swatch bolt" />
          <span>Bolt position and nominal hole marker</span>
        </div>
        <div className="legend-item">
          <span className="legend-swatch vector" />
          <span>Per-bolt shear vector</span>
        </div>
        <div className="legend-item">
          <span className="legend-swatch halo" />
          <span>Tension intensity halo</span>
        </div>
      </div>
    </div>
  );
}

export default BoltPattern;
