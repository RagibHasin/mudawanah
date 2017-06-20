import * as route from 'koa-router'
import * as serve from 'koa-static'
import 'koa-pug'

import * as fs from 'fs'
import { join as pJoin } from 'path'

import Config, { IConfig } from './config'
import Posts, { IPost } from './posts'
import Pages, { IPage } from './pages'
import compose, { Middleware } from './compose'

export { IConfig, IGlobalConfig, ILocaleConfig, IPluginsConfig } from './config'
export { IPage } from './pages'
export { IPost } from './posts'

export interface IPlugin {
  index?: Middleware<IPost[]>
  post?: Middleware<IPost>
  page?: Middleware<IPage>
  static?: {
    index?: Middleware<IPost[]>
    post?: Middleware<IPost>
    page?: Middleware<IPage>
    initialize(initable: {
      routes: route,
      config: IConfig,
      posts: IPost[],
      pages: IPage[]
    }): Promise<void>
  }
  initialize(initable: {
    routes: route,
    config: IConfig,
    posts: IPost[],
    pages: IPage[]
  }): Promise<void>
}

export default class Mudawanah {

  readonly config: IConfig
  readonly posts: Posts
  readonly pages: Pages

  readonly mountPoint: string

  readonly pluginsData: { [plugin: string]: any }

  private readonly plugins: IPlugin[] = []
  private readonly indexMiddlewares: Middleware<IPost[]>[] = []
  private readonly postMiddlewares: Middleware<IPost>[] = []
  private readonly pageMiddlewares: Middleware<IPage>[] = []

  private composedIndexMiddleware: Middleware<IPost[]>
  private composedPostMiddleware: Middleware<IPost>
  private composedPageMiddleware: Middleware<IPage>

  private readonly blog: route

  /**
   * Construct a new Mudawanah.
   * @param {string} mountPoint From where it is accessible.
   * @param {string} dataDir Data directory to use.
   */
  constructor(mountPoint: string, dataDir: string)

  /**
   * Construct a new Mudawanah with mount pount defaults to '/'.
   * @param {string} dataDir Data directory to use.
   */
  constructor(dataDir: string)

  constructor(mountPoint: string, dataDir?: string) {

    if (dataDir === undefined) {
      dataDir = mountPoint
      mountPoint = '/'
    }

    this.config = Config(dataDir)
    this.posts = new Posts(this.config)
    this.pages = new Pages(this.config)

    if (this.config.global.mountPoint === undefined) {
      this.config.global.mountPoint = mountPoint
    } else {
      this.mountPoint = this.config.global.mountPoint
    }

    this.mountPoint = mountPoint

    this.blog = new route({ prefix: mountPoint })

    for (const plugin in this.config.plugins) {
      const plugMod: IPlugin = require('mudawanah-' + plugin)
      this.use(plugMod)
    }

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
        plugins: this.config.plugins,
        locale: this.config.locales[locale],
        dict: this.config.locales[locale].dictionary,
        posts: tempPosts
      })
    })

    this.blog.get('/post/:uri', async (ctx, next) => {
      await next()

      const post = this.posts.getPostFromUrl(ctx.params['uri'])

      if (post) {
        await this._renderPost(ctx, post)
      } else {
        await this._renderPage(ctx, this.pages.getPage('404'))
      }
    })

    this.blog.get('/:page', async (ctx, next) => {
      await next()

      let page: IPage

      if (ctx.params['page'] === 'post') {
        ctx.redirect(this.mountPoint)
      }

      if (this.config.global.pages.includes(ctx.params['page'])) {
        page = this.pages.getPage(ctx.params['uri'])
      } else {
        page = this.pages.getPage('404')
      }
      await this._renderPage(ctx, page)
    })

    this.blog.use('/assets', serve(this.config.global.assetsDir, { gzip: true }))
  }

  private _getLocale(ctx: route.IRouterContext) {
    let locale = ctx.cookies.get('mudawanah-locale')
    if (locale === undefined) {
      locale = this.config.global.defaultLocale
      ctx.cookies.set('mudawanah-locale', locale)
    }
    return locale
  }

  private async _renderPage(ctx: route.IRouterContext, page: IPage) {

    const locale = this._getLocale(ctx)
    await this.composedPageMiddleware(page, this.config, async () => { })
    ctx.render(
      pJoin(
        this.config.global.dataDir,
        this.config.global.templatesDir,
        'page'),
      {
        global: this.config.global,
        plugins: this.config.plugins,
        locale: this.config.locales[locale],
        dict: this.config.locales[locale].dictionary,
        page: page,
        text: fs.readFileSync(
          pJoin(this.config.global.tempDir, 'page',
            `${page.id}.${page.locale}.html`), 'utf8')
      })
  }

  private async _renderPost(ctx: route.IRouterContext, post: IPost) {
    const locale = this._getLocale(ctx)
    await this.composedPostMiddleware(post, this.config, async () => { })
    ctx.render(
      pJoin(
        this.config.global.dataDir,
        this.config.global.templatesDir,
        'post'),
      {
        global: this.config.global,
        plugins: this.config.plugins,
        locale: this.config.locales[locale],
        dict: this.config.locales[locale].dictionary,
        post: post,
        text: fs.readFileSync(
          pJoin(this.config.global.tempDir, 'post',
            `${post.id}.${post.locale}.html`), 'utf8')
      })
  }

  /**
   * Get route middlewares for using with Koa.
   */
  routes() {
    return this.blog.routes()
  }

  /**
   * Use a plugin.
   * @param plugin The plugin import to use.
   */
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
    plugin.initialize({
      config: this.config,
      routes: this.blog,
      posts: this.posts.getAllPosts(),
      pages: this.pages.getAllPages()
    }).catch()
  }
}
