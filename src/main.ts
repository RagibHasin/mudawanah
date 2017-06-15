import * as route from 'koa-router'
import 'koa-pug'

import { join as pJoin } from 'path'

import Config, { IConfig } from './config'
import Posts, { IPost } from './posts'
import Pages, { IPage } from './pages'
import compose, { Middleware } from './compose'

export { IConfig } from './config'

export interface IPlugin {
  index?: Middleware<IPost[]>
  post?: Middleware<IPost>
  page?: Middleware<IPage>
  initialize(blog: Mudawanah): void
}

export default class Mudawanah {

  readonly config: IConfig
  readonly posts: Posts
  readonly pages: Pages

  readonly mountPoint: string

  private readonly plugins: IPlugin[] = []
  private readonly indexMiddlewares: Middleware<IPost[]>[] = []
  private readonly postMiddlewares: Middleware<IPost>[] = []
  private readonly pageMiddlewares: Middleware<IPage>[] = []

  private composedIndexMiddleware: Middleware<IPost[]>
  private composedPostMiddleware: Middleware<IPost>
  private composedPageMiddleware: Middleware<IPage>

  private readonly blog: route

  constructor(mountPoint: string, dataDir: string)
  constructor(dataDir: string)

  constructor(mountPoint: string, dataDir?: string) {

    if (dataDir === undefined) {
      dataDir = mountPoint
      mountPoint = '/'
    }

    this.config = Config(dataDir)
    this.posts = new Posts(this.config)
    this.pages = new Pages(this.config)

    this.mountPoint = mountPoint

    this.blog = new route({ prefix: mountPoint })

    this.blog.get('/', async (ctx, next) => {
      await next()

      let locale = ctx.cookies.get('mudawanah-locale')
      if (locale === undefined) {
        locale = this.config.global.defaultLocale
        ctx.cookies.set('mudawanah-locale', locale)
      }

      const tempPosts = this.posts.getPostsByLocale(locale)
      await this.composedIndexMiddleware(tempPosts, this.config, async () => { })

      ctx.render(pJoin(this.config.global.dataDir, this.config.global.templatesDir, 'index'), {
        global: this.config.global,
        locale: this.config.locales[locale],
        posts: tempPosts
      })
    })

    this.blog.get('/post/:uri', async (ctx, next) => {
      await next()

      let locale = ctx.cookies.get('mudawanah-locale')
      if (locale === undefined) {
        locale = this.config.global.defaultLocale
        ctx.cookies.set('mudawanah-locale', locale)
      }

      const post = this.posts.getPostFromUrl(ctx.params['uri'])

      if (post) {
        await this.composedPostMiddleware(post, this.config, async () => { })
        ctx.render(pJoin(this.config.global.dataDir, this.config.global.templatesDir, 'post'), {
          global: this.config.global,
          locale: this.config.locales[locale],
          post: post
        })
      } else {
        const page = this.pages.getPage('404')
        await this.composedPageMiddleware(page, this.config, async () => { })
        ctx.render(pJoin(this.config.global.dataDir, this.config.global.templatesDir, 'page'), {
          global: this.config.global,
          locale: this.config.locales[locale],
          page: page
        })
      }
    })

    this.blog.get('/:page', async (ctx, next) => {
      await next()

      let locale = ctx.cookies.get('mudawanah-locale')
      if (locale === undefined) {
        locale = this.config.global.defaultLocale
        ctx.cookies.set('mudawanah-locale', locale)
      }

      let page: IPage

      if (ctx.params['page'] === 'post') {
        ctx.redirect(this.mountPoint)
      }

      if (this.config.global.pages.includes(ctx.params['page'])) {
        page = this.pages.getPage(ctx.params['uri'])
      } else {
        page = this.pages.getPage('404')
      }
      await this.composedPageMiddleware(page, this.config, async () => { })
      ctx.render(pJoin(this.config.global.dataDir, this.config.global.templatesDir, 'page'), {
        global: this.config.global,
        locale: this.config.locales[locale],
        page: page
      })
    })
  }

  routes() {
    return this.blog.routes()
  }

  use(plugin: IPlugin) {
    this.plugins.push(plugin)
    if (plugin.index) {
      this.indexMiddlewares.push(plugin.index)
      this.composedIndexMiddleware = compose(this.indexMiddlewares)
    }
    if (plugin.post) {
      this.postMiddlewares.push(plugin.post)
      this.composedPostMiddleware = compose(this.postMiddlewares)
    }
    if (plugin.page) {
      this.pageMiddlewares.push(plugin.page)
      this.composedPageMiddleware = compose(this.pageMiddlewares)
    }
    plugin.initialize(this)
  }
}
