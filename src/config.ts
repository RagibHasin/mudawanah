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
  templatesDir: string
}

interface LocaleConfig {
  locale: string
  name: string
  blogTitle: string
  blogTagline: string
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

  global.dataDir = dataDir

  const locales: { [locale: string]: LocaleConfig } = {}

  for (const localeId in global.locales) {
    const locale: LocaleConfig = yml.safeLoad(
      fs.readFileSync(pJoin(dataDir, `config.${localeId}.yml`), 'utf8'))
    locales[locale.locale] = locale
  }

  return {
    global: global,
    locales: locales
  }
}
