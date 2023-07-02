const basePath = import.meta.env.BASE_URL.replace(/\/$/, '')

export function linkTo(path: string): string {
  return `${basePath}/${path.replace(/^\//, '')}`
}