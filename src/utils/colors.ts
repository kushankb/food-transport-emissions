export const CHART_COLORS = ['#4A9EFF','#EE6677','#228833','#CCBB44','#66CCEE','#AA3377','#BBBBBB']

export const MODE_COLORS: Record<string, string> = {
  maritime: '#4477AA', air: '#EE6677', land: '#228833',
  road: '#228833', rail: '#CCBB44', domestic: '#66CCEE',
}

export const ROUTE_COLORS = { bilateral: '#4A9EFF', domestic: '#EE6677' }

export const SEQUENTIAL_BLUE = [
  '#0a1628','#0f2847','#143a66','#1a4d85',
  '#2060a5','#2874c5','#3a8ee5','#4A9EFF',
]

export function getSequentialColor(value: number, min: number, max: number): string {
  if (max === min) return SEQUENTIAL_BLUE[4]
  const ratio = Math.min(1, Math.max(0, (value - min) / (max - min)))
  const index = Math.floor(ratio * (SEQUENTIAL_BLUE.length - 1))
  return SEQUENTIAL_BLUE[index]
}
