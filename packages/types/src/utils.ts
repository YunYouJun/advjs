export type MakeRequired<T, K extends keyof T = keyof T> = Omit<T, K> & Required<Pick<T, K>>
