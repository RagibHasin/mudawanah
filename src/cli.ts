import * as fs from 'fs'
import * as yargs from 'yargs'
import * as chalk from 'chalk'
import * as ask from 'inquirer'

const packageJson = JSON.parse(fs.readFileSync('../package.json', 'utf8'))

yargs
  .command('init [dir]', 'initialize a new Mudawanah', args => args, init)
  .command('generate [src] <out>', 'generate a static build', args => args, gen)

function init(args: { dir?: string }) {
  if (args.dir === undefined) {
    args.dir = '.'
  }

}

function gen(args: { src?: string, out: string }) {

}
