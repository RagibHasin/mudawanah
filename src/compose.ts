import { IConfig } from './config'

export type Middleware<T> = (ctx: T, config: IConfig, next: () => Promise<void>) => Promise<void>

/**
 * Compose `middleware` returning
 * a fully valid middleware comprised
 * of all those which are passed.
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
