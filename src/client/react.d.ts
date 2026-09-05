declare module 'react' {
  export function createElement(type: any, props?: any, ...children: any[]): any
  export function useEffect(effect: () => void | (() => void), deps?: any[]): void
  export function useRef<T>(initial: T): { current: T }
  export function useState<T>(initial: T | (() => T)): [T, (value: T | ((prev: T) => T)) => void]
  export const Fragment: any
}
