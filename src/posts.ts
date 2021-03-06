import * as fs from 'fs'
import * as os from 'os'
import * as yml from 'js-yaml'
import * as hilight from 'highlight.js'
import * as markdownIt from 'markdown-it'
import * as removeMarkdown from 'remove-markdown'

import { join as pJoin } from 'path'

import Config, { IConfig } from './config'
import { RendererPlugin } from './pluginsHelper'

export interface IPost {
  title: string
  id: string
  locale: string
  date: Date
  url: string[]
  tags?: string[]
  view?: string
  md: string
  pluginsData?: { [plugin: string]: any }
}

export default class Posts {

  private readonly config: IConfig
  private renderer: markdownIt.MarkdownIt

  // url to qualified id
  private postsMap: { [url: string]: { [locale: string]: string } } = {}
  // qualified id to metaPosts
  private posts: { [fullId: string]: IPost } = {}
  // list of unqualified id by locale
  private postByLocale: { [locale: string]: string[] } = {}
  // list of locales of a post
  private localesOfPost: { [post: string]: { [locale: string]: string } } = {}

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

    const dataDir = this.config.global.dataDir

    if (!fs.existsSync(pJoin(config.global.tempDir, 'posts'))) {
      fs.mkdirSync(pJoin(config.global.tempDir, 'posts'))
    }

    const postFiles = fs.readdirSync(pJoin(dataDir, 'posts'))

    const tempPosts: IPost[] = []

    // load posts from files
    for (const post of postFiles) {

      const postData = fs.readFileSync(pJoin(dataDir, 'posts', post), 'utf8')
        .split(os.EOL + os.EOL + os.EOL + os.EOL, 2)
      const meta: IPost = yml.safeLoad(postData[0])

      meta.md = postData[1]
      meta.view = removeMarkdown(postData[1].split(os.EOL + os.EOL, 1)[0], { gfm: true })

      for (const url of meta.url) {
        if (this.postsMap[url] === undefined) {
          this.postsMap[url] = {}
        }
        this.postsMap[url][meta.locale] = meta.id
      }

      if (this.localesOfPost[meta.id] === undefined) {
        this.localesOfPost[meta.id] = {}
      }
      this.localesOfPost[meta.id][meta.locale] = meta.url[0]

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

    this.render([])
  }

  render(plugins: RendererPlugin<IPost>[]) {
    for (const post in this.posts) {
      // Prepare renderer
      let renderer = this.renderer
      for (const plugin of plugins) {
        renderer = plugin(this.posts[post], renderer)
      }

      fs.writeFileSync(pJoin(this.config.global.tempDir, 'posts',
        `${this.posts[post].id}.${this.posts[post].locale}.html`),
        renderer.render(this.posts[post].md), 'utf8')
    }
  }

  getPostsByLocale(locale: string) {
    const handles = this.postByLocale[locale]
    const ret: IPost[] = []

    for (const handle of handles) {
      ret.push(this.posts[handle + '.' + locale])
    }

    return ret
  }

  getPostFromUrl(url: string, locale: string) {
    if (this.postsMap[url] && this.postsMap[url][locale]) {
      return this.posts[this.postsMap[url][locale] + '.' + locale]
    }
  }

  getLocalesOfPost(id: string) {
    return this.localesOfPost[id]
  }

  getPost(id: string) {
    return this.posts[id]
  }

  getAllPosts() {
    const allPosts: IPost[] = []
    for (const id in this.posts) {
      allPosts.push(this.posts[id])
    }
    return allPosts
  }
}
