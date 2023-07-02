const basePath = import.meta.env.BASE_URL.replace(/\/$/, '')

export function pathTo(path: string): string {
  return `${basePath}/${path.replace(/^\//, '')}`
}