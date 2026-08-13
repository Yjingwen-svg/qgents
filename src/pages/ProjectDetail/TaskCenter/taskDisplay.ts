export function valueOrNone(value: string | null | undefined): string {
  return value?.trim() || '暂无'
}
