export const CALLOUT_RE = /^\[!([a-zA-Z]+)\]([+-]?)\s*(.*)$/

export const CALLOUT_LABELS: Record<string, string> = {
  note: '笔记',
  abstract: '摘要',
  info: '信息',
  todo: '待办',
  tip: '提示',
  hint: '提示',
  success: '成功',
  question: '问题',
  warning: '注意',
  caution: '注意',
  failure: '失败',
  danger: '危险',
  bug: '缺陷',
  example: '示例',
  quote: '引用'
}
