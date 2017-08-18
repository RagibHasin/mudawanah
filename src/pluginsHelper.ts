import { IConfig, IMarkdownItPlugin } from './config'
import { MarkdownIt } from 'markdown-it'

export type Middleware<T> = (ctx: T, config: IConfig, next: () => Promise<void>) => Promise<void>

/**
 * Compose `middleware` returning a fully valid middleware comprised of
 * all those which are passed.
 *
 * @param {Array} middleware
 * @return {Function}
 * @api public
 */

export default function Compose<T>(middleware: Middleware<T>[]) {

  /**
   * @param {Object} context
   * @return {Promise}
   * @api public
   */
  return function (context: T, config: IConfig, next: () => Promise<void>) {
    // last called middleware #
    let index = -1
    return dispatch(0)
    function dispatch(i: number): Promise<void> {
      // tslint:disable-next-line:curly
      if (i <= index) {
        return Promise.reject(new Error('next() called multiple times'))
      }
      index = i
      let fn = middleware[i]
      if (i === middleware.length) {
        fn = next
      }
      if (!fn) {
        return Promise.resolve()
      }
      try {
        return Promise.resolve(fn(context, config, function next() {
          return dispatch(i + 1)
        }))
      } catch (err) {
        return Promise.reject(err)
      }
    }
  }
}

export type RendererPlugin<T> = (ctx: T, md: MarkdownIt) => MarkdownIt

export function MakeMarkdownItRenderer(md: MarkdownIt, plugins: IMarkdownItPlugin[]) {
  for (const plugin of plugins) {
    if (plugin.options && Array.isArray(plugin.options)) {
      md = md.use.apply(md, [plugin.fn].concat(plugin.options))
    } else if (plugin.options && typeof plugin.options === 'object') {
      md = md.use(plugin.fn, plugin.options)
    } else {
      md = md.use(plugin.fn)
    }
  }
  return md
}
