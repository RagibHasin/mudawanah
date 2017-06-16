import * as fs from 'fs'
import * as yml from 'js-yaml'
import * as hilight from 'highlight.js'
import * as markdownIt from 'markdown-it'
import * as removeMarkdown from 'remove-markdown'

import { join as pJoin } from 'path'

import Config, { IConfig } from './config'

export interface IPost {
  title: string
  id: string
  locale: string
  date: string
  url: string[]
  tags?: string[]
  view?: string
  pluginsData?: { [plugin: string]: any }
}

export default class Posts {

  private readonly config: IConfig

  // url to qualified id
  private postsMap: { [url: string]: string } = {}
  // qualified id to metaPpst
  private posts: { [fullId: string]: IPost } = {}
  // list of unqualified id by locale
  private postByLocale: { [locale: string]: string[] } = {}

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

    const postFiles = fs.readdirSync(pJoin(dataDir, 'posts'))

    const tempPosts: IPost[] = []

    // load posts from files
    for (const post of postFiles) {

      const postData = fs.readFileSync(pJoin(dataDir, 'posts', post), 'utf8').split('\n\n\n')
      const meta: IPost = yml.safeLoad(postData[0])

      fs.writeFileSync(pJoin(config.global.tempDir, 'posts', `${meta.id}.${meta.locale}.html`),
        md.render(postData[1]), 'utf8')

      meta.view = removeMarkdown(postData[1], { gfm: true })

      for (const url of meta.url) {
        this.postsMap[url] = `${meta.id}.${meta.locale}`
      }

      tempPosts.push(meta)
    }

    // newest first
    tempPosts.sort((a, b) => new Date(b.date).valueOf() - new Date(a.date).valueOf())

    for (const meta of tempPosts) {
      this.posts[`${meta.id}.${meta.locale}`] = meta

      if (this.postByLocale[meta.locale] === undefined) {
        this.postByLocale[meta.locale] = []
      }
      this.postByLocale[meta.locale].push(meta.id)
    }
  }
  getPostsByLocale(locale: string) {
    const handles = this.postByLocale[locale]
    const ret: IPost[] = []

    for (const handle of handles) {
      ret.push(this.posts[handle])
    }

    return ret
  }

  getPostFromUrl(url: string) {
    if (this.postsMap[url]) {
      return this.posts[this.postsMap[url]]
    }
  }

  getPost(id: string) {
    return this.posts[id]
  }
}
