import * as fs from 'fs'
import * as yml from 'js-yaml'
import { join as pJoin } from 'path'

interface GlobalConfig {
  defaultLocale: string
  locales: {
    [locale: string]: string
  }
  pages: string[]
  dataDir: string
  tempDir: string
  mongo: {
    url: string
  }
}

interface LocaleConfig {
  locale: string
  name: string
  dictionary: {
    [id: string]: string
  }
}

export interface IConfig {
  global: GlobalConfig
  locales: { [locale: string]: LocaleConfig }
}

export default function (dataDir: string) {

  const global: GlobalConfig = yml.safeLoad(
    fs.readFileSync(pJoin(dataDir, 'config.yml'), 'utf8'))

  let locales: { [locale: string]: LocaleConfig } = {}

  const configs = fs.readdirSync(pJoin(dataDir, 'configs'))

  for (let conf of configs) {
    let locale: LocaleConfig = yml.safeLoad(fs.readFileSync(conf, 'utf8'))
    locales[locale.locale] = locale
  }

  return {
    global: global,
    locales: locales
  }
}
