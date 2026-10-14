import { HALF, splitHalves, stickGroups } from "@/lib/scoring"

const STICKS = [
  { x1: 18, y1: 66, x2: 18, y2: 18 },
  { x1: 18, y1: 18, x2: 66, y2: 18 },
  { x1: 66, y1: 18, x2: 66, y2: 66 },
  { x1: 66, y1: 66, x2: 18, y2: 66 },
  { x1: 24, y1: 60, x2: 60, y2: 24 },
] as const

function Square({ count }: { count: number }) {
  return (
    <svg
      viewBox="10 10 64 64"
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full"
      aria-hidden="true"
    >
      <rect
        x="14"
        y="14"
        width="56"
        height="56"
        rx="2"
        fill="none"
        stroke="rgba(246, 240, 224, 0.16)"
        strokeWidth="2"
      />
      {STICKS.slice(0, count).map((stick) => (
        <g key={`${stick.x1}-${stick.y1}-${stick.x2}-${stick.y2}`}>
          <line
            x1={stick.x1}
            y1={stick.y1}
            x2={stick.x2}
            y2={stick.y2}
            stroke="#f0d7a2"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <circle cx={stick.x2} cy={stick.y2} r="4.2" fill="#e24b3b" />
        </g>
      ))}
    </svg>
  )
}

export function Fosforos({ score }: { score: number }) {
  const { malas, buenas } = splitHalves(score)
  const points = score <= HALF ? malas : buenas

  return (
    <div className="grid h-full min-h-0 w-full grid-rows-3 gap-2">
      {stickGroups(points).map((count, index) => (
        <Square key={index} count={count} />
      ))}
    </div>
  )
}
