import type {ReactNode} from 'react'

const paths = {
  sound: <path d='m11 4-6 5H2v6h3l6 5zM15 8c3 2 3 6 0 8M18 4c6 4 6 12 0 16' />,
  mute: <path d='m11 4-6 5H2v6h3l6 5zM16 9l6 6m0-6-6 6' />,
  settings:
    <>
      <path d='M4 7h16M4 17h16' />
      <circle cx='8' cy='7' r='3' />
      <circle cx='16' cy='17' r='3' />
    </>,
  arrow: <path d='M4 12h16m-6-6 6 6-6 6' />,
  close: <path d='m6 6 12 12M6 18 18 6' />,
  check: <path d='m5 12.5 4.5 4.5L19 7' />,
  cross: <path d='m7 7 10 10M7 17 17 7' />,
  question:
    <>
      <circle cx='12' cy='12' r='9' />
      <path d='M9.5 9.5a2.5 2.5 0 1 1 3.4 2.33c-.55.22-.9.74-.9 1.32v.6M12 16.75v.01' />
    </>,
  download: <path d='M12 4v11m-4.5-4.5L12 15l4.5-4.5M5 19h14' />,
  copy:
    <>
      <rect height='13' rx='2' width='13' x='8' y='8' />
      <path d='M5 16H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v1' />
    </>,

} satisfies Record<string, ReactNode>

export default function Icon({name, size = 20}: {
  name: keyof typeof paths
  size?: number
}) {
  return (
    <svg
      aria-hidden='true'
      fill='none'
      height={size}
      stroke='currentColor'
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth='1.4'
      viewBox='0 0 24 24'
      width={size}
    >
      {paths[name]}
    </svg>
  )
}
