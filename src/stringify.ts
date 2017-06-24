import * as intl from 'intl'

export default function stringify(locale: string) {
  const numIntl = intl.NumberFormat(locale)
  const dateIntl = intl.DateTimeFormat(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric'
  })
  return (format: string, ...params: any[]) => {
    const pieces = format.split('#')
    let result = pieces[0]
    for (let i = 1, p = 0; i !== pieces.length; ++i) {
      switch (pieces[i].charAt(0)) {
        case '#':
          result += pieces[i]
          break
        case 'n':
          result += numIntl.format(params[p++]) + pieces[i].slice(1)
          break
        case 's':
          result += params[p++] + pieces[i].slice(1)
          break
        case 'd':
          result += dateIntl.format(params[p++]) + pieces[i].slice(1)
          break
      }
    }
    return result
  }
}
