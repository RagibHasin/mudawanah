import * as fs from 'fs'
import * as os from 'os'
import * as yml from 'js-yaml'
import * as hilight from 'highlight.js'
import * as markdownIt from 'markdown-it'

import { resolve as pJoin } from 'path'

import Config, { IConfig } from './config'

export interface IPage {
  title: string
  id: string
  locale: string
}

export default class Pages {

  private readonly config: IConfig

  // qualified id to metaPages
  private pages: { [fullId: string]: IPage } = {}

  constructor(config: IConfig) {
    this.config = config

    const dataDir = this.config.global.dataDir

    const md = markdownIt('commonmark', {
      highlight: (str, lang) => {
        if (lang && hilight.getLanguage(lang)) {
          try {
            return hilight.highlight(lang, str).value
          } catch (_) { }
        }
        return ''
      }
    })

    const pageFiles = fs.readdirSync(pJoin(dataDir, 'pages'))

    // load pages from files
    for (const page of pageFiles) {

      const pageData = fs.readFileSync(pJoin(dataDir, 'pages', page), 'utf8')
        .split(os.EOL + os.EOL + os.EOL, 2)
      const meta: IPage = yml.safeLoad(pageData[0])

      fs.writeFileSync(pJoin(config.global.tempDir, 'pages', `${meta.id}.${meta.locale}.html`),
        md.render(pageData[1]), 'utf8')

      this.pages[`${meta.id}.${meta.locale}`] = meta
    }
  }

  getPage(id: string) {
    return this.pages[id]
  }

  getAllPages() {
    const allPages: IPage[] = []
    for (const id in this.pages) {
      allPages.push(this.pages[id])
    }
    return allPages
  }
}
