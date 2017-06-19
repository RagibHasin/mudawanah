import * as fs from 'fs'
import * as yml from 'js-yaml'
import { join as pJoin } from 'path'

import stringify from './stringify'

export interface IGlobalConfig {
  defaultLocale: string
  locales: {
    [locale: string]: string
  }
  pages: string[]
  mountPoint?: string
  dataDir: string
  tempDir: string
  templatesDir: string
  assetsDir: string
}

export interface IPluginsConfig {
  [plugin: string]: any
}

export type TDictionaryFunction =
  ((...params: any[]) => string) |
  ((param: boolean) => string) |
  ((param: number) => string)

export interface IDictionary {
  [id: string]: string | string[] | IDictionary | TDictionaryFunction
}

export interface ILocaleConfig {
  locale: string
  name: string
  blogTitle: string
  blogTagline: string
  dictionary: IDictionary
}

export interface IConfig {
  global: IGlobalConfig
  plugins: IPluginsConfig
  locales: { [locale: string]: ILocaleConfig }
}

function fixDictionary(dict: IDictionary, locale: string) {
  for (const key in dict) {

    if (typeof dict[key] === 'object') {
      dict[key] = fixDictionary(dict[key] as IDictionary, locale)
    }

    if (Array.isArray(dict[key])) {
      const arr = dict[key] as string[]
      switch ((dict[key] as string[]).length) {
        case 1:
          dict[key] = (...params: any[]) =>
            stringify(locale)((dict[key] as string[])[0], params)
          break
        case 2:
          dict[key] = (param: boolean) =>
            (dict[key] as string[])[param ? 1 : 0]
          break
        case 3:
          dict[key] = (param: number) => {
            switch (param) {
              case 0:
              case 1:
                return (dict[key] as string[])[param]
              default:
                return stringify(locale)((dict[key] as string[])[2], param)
            }
          }
          break
        default:
          throw new TypeError('Malformed dictionary: ' + key)
      }
    }
  }
  return dict
}

export default function (dataDir: string) {

  const global: IGlobalConfig = yml.safeLoad(
    fs.readFileSync(pJoin(dataDir, 'config.yml'), 'utf8'))

  global.dataDir = dataDir

  if (global.tempDir === undefined) {
    global.tempDir = pJoin(dataDir, '_temp')
  }
  if (global.templatesDir === undefined) {
    global.templatesDir = pJoin(dataDir, 'templates')
  }
  if (global.assetsDir === undefined) {
    global.assetsDir = pJoin(dataDir, 'assets')
  }

  const plugins: IPluginsConfig = yml.safeLoad(
    fs.readFileSync(pJoin(dataDir, 'plugins.yml'), 'utf8'))

  const locales: { [locale: string]: ILocaleConfig } = {}

  for (const localeId in global.locales) {
    const locale: ILocaleConfig = yml.safeLoad(
      fs.readFileSync(pJoin(dataDir, `config.${localeId}.yml`), 'utf8'))

    if (locale.dictionary === undefined) {
      const dict: IDictionary = yml.safeLoad(
        fs.readFileSync(pJoin(dataDir, `dictionary.${localeId}.yml`), 'utf8'))
      locale.dictionary = dict
    }

    locale.dictionary = fixDictionary(locale.dictionary, localeId)
    locale.dictionary['fmtDate'] = (...dates: any[]) => stringify(localeId)('#d', dates)
    locale.dictionary['fmtNum'] = (...nums: any[]) => stringify(localeId)('#n', nums)

    locales[locale.locale] = locale
  }

  return {
    global: global,
    plugins: plugins,
    locales: locales
  }
}
