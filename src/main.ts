import * as koa from 'koa'
import * as route from 'koa-router'
import * as serve from 'koa-static'
import * as copmress from 'koa-compress'
import * as log from 'koa-logger'
import * as pug from 'koa-pug'

import { root } from './helpers'

import Config, { IConfig } from './config'
import Posts, { IPost } from './posts'
import Pages, { IPage } from './pages'

export { IConfig } from './config'

export interface IPlugin {
  initialize(blog: Mudawanah): void
  index(config: IConfig, next: Promise<void>): Promise<void>
  post(post: IPost, config: IConfig, next: Promise<void>): Promise<void>
  page(page: IPage, config: IConfig, next: Promise<void>): Promise<void>
}

export default class Mudawanah {

  readonly config: IConfig
  readonly posts: Posts

  readonly plugins: IPlugin[] = []
  readonly blog: route

  constructor(mountPoint: string, dataDir: string)
  constructor(dataDir: string)

  constructor(mountPoint: string, dataDir?: string) {

    if (dataDir === undefined) {
      dataDir = mountPoint
      mountPoint = '/'
    }

    this.config = Config(dataDir)
    this.posts = new Posts(this.config)

    this.blog = new route({ prefix: mountPoint })

    this.blog.get('/', async (ctx, next) => {
      await next()
      let locale = ctx.cookies.get('blog-locale')
      if (locale === undefined) {
        locale = this.config.global.defaultLocale
        ctx.cookies.set('blog-locale', locale)
      }

      ctx.render('index', {
        global: this.config.global,
        locale: this.config.locales[locale],
        posts: this.posts.getPostsByLocale(locale)
      })
    })
  }

  routes() {
    return this.blog.routes()
  }

  use(plugin: IPlugin) {
    this.plugins.push(plugin)
    plugin.initialize(this)
  }
}
