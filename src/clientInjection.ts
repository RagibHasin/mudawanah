function setCookie(cname: string, cvalue: string, exdays: number) {
  const d = new Date()
  d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000))
  const expires = 'expires=' + d.toUTCString()
  document.cookie = cname + '=' + cvalue + ';' + expires + ';path=/'
}

function getCookie(cname: string) {
  const name = cname + '='
  const ca = document.cookie.split(';')
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i]
    while (c.charAt(0) === ' ') {
      c = c.substring(1)
    }
    if (c.indexOf(name) === 0) {
      return c.substring(name.length, c.length)
    }
  }
  return ''
}

const mudawanah = {
  uid: '#{uid}',
  setLocale: (locale: string) =>
    setCookie(`mudawanah.${mudawanah.uid}.locale`, locale, 365)
}

$('body').on('load', e => {
  $('#mudawanahTranslate').each((idx, elem) => {
    $(elem).click(e1 => mudawanah.setLocale($(elem).attr('data-locale-name')))
  })
})
