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

      const locale = this._getLocale(ctx)

      const tempPosts = this.posts.getPostsByLocale(locale)
      if (this.composedIndexMiddleware !== undefined) {
        await this.composedIndexMiddleware(tempPosts, this.config, async () => { })
      }

      let translations: any = {}
      for (const gLocale in this.config.global.locales) {
        translations[gLocale] = this._resolve('/')
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

    this.blog.get('/post/:uri', async (ctx, next) => {
      await next()

      const post = this.posts.getPostFromUrl(ctx.params.uri, this._getLocale(ctx))

      if (post) {
        await this._renderPost(ctx, post)
      } else {
        await this._render404(ctx)
      }
    })

    this.blog.get('/:page', async (ctx, next) => {
      await next()

      if (ctx.params.page === 'post') {
        ctx.redirect(this.mountPoint)
      }

      if (ctx.params.page === 'assets') {
        await this._render404(ctx)
      } else if (this.config.global.pages.includes(ctx.params.page)) {
        await this._renderPage(ctx, this.pages.getPage(ctx.params.page + '.' + this._getLocale(ctx)))
      } else {
        await this._render404(ctx)
      }
    })
  }

  private _resolve(path: string) {
    return this.mountPoint === undefined ? path : this.mountPoint + path
  }

  private _viewLocals(locale: string, additionals?: any) {
    const base = {
      global: this.config.global,
      usedPlugins: this.config.plugins,
      locale: this.config.locales[locale],
      dict: this.config.locales[locale].dictionary,
      resolve: this._resolve.bind(this),
      injectionScript: expand(fs.readFileSync(pJoin(__dirname, 'clientInjection.js'), 'utf8'),
        { uid: this.config.global.uid }, { opening: '#{', closing: '}' })
    }
    if (additionals === undefined) {
      return base
    }
    return Object.assign(base, additionals)
  }

  private _getLocale(ctx: route.IRouterContext) {
    let locale = ctx.cookies.get(`mudawanah.${this.config.global.uid}.locale`)
    if (locale === undefined) {
      locale = this.config.global.defaultLocale
      ctx.cookies.set(`mudawanah.${this.config.global.uid}.locale`, locale)
    }
    return locale
  }

  private async _render404(ctx: route.IRouterContext) {
    await this._renderPage(ctx, this.pages.getPage('404.' + this._getLocale(ctx)))
  }

  private async _renderPage(ctx: route.IRouterContext, page: IPage) {
    const locale = this._getLocale(ctx)
    if (this.composedPageMiddleware !== undefined) {
      await this.composedPageMiddleware(page, this.config, async () => { })
    }

    let translations: any = {}
    for (const gLocale in this.config.global.locales) {
      translations[gLocale] = this._resolve('/' + page.id)
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

  private async _renderPost(ctx: route.IRouterContext, post: IPost) {
    const locale = this._getLocale(ctx)
    if (this.composedPostMiddleware !== undefined) {
      await this.composedPostMiddleware(post, this.config, async () => { })
    }

    let translations: any = {}
    const dummyTranslate = this.posts.getLocalesOfPost(post.id)
    for (const gLocale in dummyTranslate) {
      if (gLocale !== locale) {
        translations[gLocale] = this._resolve('/post/' + dummyTranslate[gLocale])
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
