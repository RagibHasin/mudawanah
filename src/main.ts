import * as route from 'koa-router'
import * as mount from 'koa-mount'
import * as serve from 'koa-static'
import * as kCompose from 'koa-compose'
import * as view from 'koa-views'

import expand from 'expand-placeholder'

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

  private readonly assetsMount: route.IMiddleware
  private readonly blog: route

  /**
   * Construct a new Mudawanah.
   * @param {string} dataDir Data directory to use.
   * @param {string} mountPoint From where it is accessible.
   */
  constructor(dataDir: string, mountPoint?: string) {
    this.config = Config(dataDir)

    if (!fs.existsSync(this.config.global.tempDir)) {
      fs.mkdirSync(this.config.global.tempDir)
    }

    this.posts = new Posts(this.config)
    this.pages = new Pages(this.config)

    if (this.config.global.mountPoint === undefined) {
      this.config.global.mountPoint = mountPoint
    } else {
      this.mountPoint = this.config.global.mountPoint
    }

    if (mountPoint !== undefined) {
      this.mountPoint = mountPoint
      this.assetsMount = mount(mountPoint + '/assets', serve(this.config.global.assetsDir))
    } else {
      this.assetsMount = mount('/assets', serve(this.config.global.assetsDir))
    }

    this.blog = new route({ prefix: mountPoint })
    this.blog.use(view(this.config.global.templatesDir, { extension: 'pug' }))

    for (const plugin in this.config.plugins) {
      const plugMod: IPlugin = require('mudawanah-' + plugin)
      this.use(plugMod)
    }

    this.blog.get('/', async (ctx, next) => {
      await next()
      ctx.redirect((this.mountPoint === undefined ? '' : this.mountPoint)
        + '/' + this.config.global.defaultLocale)
    })

    this.blog.get('/:locale', async (ctx, next) => {
      await next()

      const locale = ctx.params.locale

      if (!this.config.global.locales.hasOwnProperty(locale)) {
        ctx.redirect((this.mountPoint === undefined ? '' : this.mountPoint)
          + '/' + this.config.global.defaultLocale)
        return
      }

      const tempPosts = this.posts.getPostsByLocale(locale)
      if (this.composedIndexMiddleware !== undefined) {
        await this.composedIndexMiddleware(tempPosts, this.config, async () => { })
      }

      let translations: any = {}
      for (const gLocale in this.config.global.locales) {
        translations[gLocale] = this._resolve(gLocale, '/')
      }
      delete translations[locale]
      if (Object.keys(translations).length === 0) {
        translations = undefined
      }

      await ctx.render('index', this._viewLocals(locale, {
        posts: tempPosts,
        translations: translations
      }))
    })

    this.blog.get('/:locale/post/:uri', async (ctx, next) => {
      await next()

      const post = this.posts.getPostFromUrl(ctx.params.uri, ctx.params.locale)

      if (post) {
        await this._renderPost(ctx, ctx.params.locale, post)
      } else {
        await this._render404(ctx, ctx.params.locale)
      }
    })

    this.blog.get('/:locale/:page', async (ctx, next) => {
      await next()

      if (ctx.params.page === 'post') {
        ctx.redirect(this.mountPoint)
      }

      if (ctx.params.page === 'assets') {
        await this._render404(ctx, ctx.params.locale)
      } else if (this.config.global.pages.includes(ctx.params.page)) {
        await this._renderPage(ctx, ctx.params.locale, this.pages.getPage(ctx.params.page + '.' + ctx.params.locale))
      } else {
        await this._render404(ctx, ctx.params.locale)
      }
    })
  }

  private _resolve(locale: string, path: string) {
    return (this.mountPoint === undefined ? '' : this.mountPoint) + '/' + locale + path
  }

  private _asset(item: string) {
    return (this.mountPoint === undefined ? '' : this.mountPoint) + '/assets/' + item
  }

  private _viewLocals(locale: string, additionals?: any) {
    const base = {
      global: this.config.global,
      usedPlugins: this.config.plugins,
      locale: this.config.locales[locale],
      dict: this.config.locales[locale].dictionary,
      resolve: this._resolve.bind(this, locale),
      asset: this._asset.bind(this)
    }
    if (additionals === undefined) {
      return base
    }
    return Object.assign(base, additionals)
  }

  private async _render404(ctx: route.IRouterContext, locale: string) {
    await this._renderPage(ctx, locale, this.pages.getPage('404.' + locale))
  }

  private async _renderPage(ctx: route.IRouterContext, locale: string, page: IPage) {

    let translations: any = {}
    for (const gLocale in this.config.global.locales) {
      translations[gLocale] = this._resolve(gLocale, '/' + page.id)
    }
    delete translations[locale]
    if (Object.keys(translations).length === 0) {
      translations = undefined
    }

    await ctx.render('page', this._viewLocals(locale, {
      page: page,
      translations: translations,
      text: fs.readFileSync(
        pJoin(this.config.global.tempDir, 'pages',
          `${page.id}.${page.locale}.html`), 'utf8')
    }))
  }

  private async _renderPost(ctx: route.IRouterContext, locale: string, post: IPost) {

    let translations: any = {}
    const dummyTranslate = this.posts.getLocalesOfPost(post.id)
    for (const gLocale in dummyTranslate) {
      if (gLocale !== locale) {
        translations[gLocale] = this._resolve(gLocale, '/post/' + dummyTranslate[gLocale])
      }
    }
    if (Object.keys(translations).length === 0) {
      translations = undefined
    }

    await ctx.render('post', this._viewLocals(locale, {
      post: post,
      translations: translations,
      text: fs.readFileSync(
        pJoin(this.config.global.tempDir, 'posts',
          `${post.id}.${post.locale}.html`), 'utf8')
    }))
  }

  /**
   * Get composed middleware for using with Koa.
   */
  middlewares() {
    return kCompose([this.assetsMount, this.blog.routes(), this.blog.allowedMethods()])
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
