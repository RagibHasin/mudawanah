import * as fs from 'fs'
import * as os from 'os'
import * as yml from 'js-yaml'
import * as hilight from 'highlight.js'
import * as markdownIt from 'markdown-it'

import { join as pJoin } from 'path'

import Config, { IConfig } from './config'
import { RendererPlugin } from './pluginsHelper'

export interface IPage {
  title: string
  id: string
  locale: string
  md: string
  pluginsData?: { [plugin: string]: any }
}

export default class Pages {

  private readonly config: IConfig
  private renderer: markdownIt.MarkdownIt

  // qualified id to metaPages
  private pages: { [fullId: string]: IPage } = {}

  constructor(config: IConfig) {
    this.config = config

    this.renderer = markdownIt('commonmark', {
      highlight: (str, lang) => {
        if (lang && hilight.getLanguage(lang)) {
          try {
            return hilight.highlight(lang, str).value
          } catch (_) { }
        }
        return ''
      }
    })

    if (!fs.existsSync(pJoin(config.global.tempDir, 'pages'))) {
      fs.mkdirSync(pJoin(config.global.tempDir, 'pages'))
    }

    const dataDir = this.config.global.dataDir

    const pageFiles = fs.readdirSync(pJoin(dataDir, 'pages'))

    // load pages from files
    for (const page of pageFiles) {

      const pageData = fs.readFileSync(pJoin(dataDir, 'pages', page), 'utf8')
        .split(os.EOL + os.EOL + os.EOL + os.EOL, 2)
      const meta: IPage = yml.safeLoad(pageData[0])

      meta.md = pageData[1]

      this.pages[`${meta.id}.${meta.locale}`] = meta
    }

    this.render([])
  }

  render(plugins: RendererPlugin<IPage>[]) {
    for (const page in this.pages) {
      // Prepare renderer
      let renderer = this.renderer
      for (const plugin of plugins) {
        renderer = plugin(this.pages[page], renderer)
      }

      fs.writeFileSync(pJoin(this.config.global.tempDir, 'pages',
        `${this.pages[page].id}.${this.pages[page].locale}.html`),
        renderer.render(this.pages[page].md), 'utf8')
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
