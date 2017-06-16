import * as fs from 'fs'
import * as yml from 'js-yaml'
import { join as pJoin } from 'path'

export interface IGlobalConfig {
  defaultLocale: string
  locales: {
    [locale: string]: string
  }
  pages: string[]
  dataDir: string
  tempDir: string
  templatesDir: string
}

export interface IPluginsConfig {
  [plugin: string]: any
}

export interface ILocaleConfig {
  locale: string
  name: string
  blogTitle: string
  blogTagline: string
  dictionary: {
    [id: string]: string
  }
}

export interface IConfig {
  global: IGlobalConfig
  plugins: IPluginsConfig
  locales: { [locale: string]: ILocaleConfig }
}

export default function (dataDir: string) {

  const global: IGlobalConfig = yml.safeLoad(
    fs.readFileSync(pJoin(dataDir, 'config.yml'), 'utf8'))

  global.dataDir = dataDir

  const plugins: IPluginsConfig = yml.safeLoad(
    fs.readFileSync(pJoin(dataDir, 'plugins.yml'), 'utf8'))

  const locales: { [locale: string]: ILocaleConfig } = {}

  for (const localeId in global.locales) {
    const locale: ILocaleConfig = yml.safeLoad(
      fs.readFileSync(pJoin(dataDir, `config.${localeId}.yml`), 'utf8'))
    locales[locale.locale] = locale
  }

  return {
    global: global,
    plugins: plugins,
    locales: locales
  }
}
