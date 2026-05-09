export function Fireworks() {
  return (
    <div aria-hidden="true" style={containerStyle}>
      <style>
        {`
          @media (prefers-reduced-motion: no-preference) {
            .spx-fireworks-burst {
              position: absolute;
              width: 10px;
              height: 10px;
              border-radius: 50%;
              animation: spx-fireworks-burst 3s ease-out forwards;
              opacity: 0;
            }
            @keyframes spx-fireworks-burst {
              0% { transform: translate(0, 0) scale(0.4); opacity: 0; }
              15% { opacity: 1; }
              100% { transform: translate(var(--x), var(--y)) scale(1); opacity: 0; }
            }
          }
        `}
      </style>
      {BURSTS.map((burst, index) => (
        <span
          key={index}
          className="spx-fireworks-burst"
          style={{
            left: '50%',
            top: '50%',
            background: burst.color,
            ...toCssVars(burst.x, burst.y),
            animationDelay: burst.delay,
          }}
        />
      ))}
    </div>
  )
}

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  overflow: 'hidden',
}

const BURSTS = [
  { x: '-160px', y: '-120px', color: '#C9A84C', delay: '0s' },
  { x: '170px', y: '-130px', color: '#4fc3f7', delay: '0.1s' },
  { x: '-130px', y: '140px', color: '#ff6b6b', delay: '0.2s' },
  { x: '140px', y: '150px', color: '#8bc34a', delay: '0.3s' },
  { x: '-210px', y: '10px', color: '#ffd54f', delay: '0.35s' },
  { x: '220px', y: '-5px', color: '#ba68c8', delay: '0.45s' },
  { x: '0px', y: '-210px', color: '#26c6da', delay: '0.5s' },
  { x: '0px', y: '220px', color: '#ef5350', delay: '0.65s' },
] as const

type FireworkCssVars = React.CSSProperties & Record<'--x' | '--y', string>

function toCssVars(x: string, y: string): FireworkCssVars {
  return {
    '--x': x,
    '--y': y,
  }
}
