const gulp = require('gulp')
const merge = require('merge-stream')
const ts = require('gulp-typescript')
const tslint = require('gulp-tslint')
const maps = require('gulp-sourcemaps')
const ugly = require('gulp-uglify')
const pump = require('pump')
const tsProj = ts.createProject('tsconfig.json')
const tsc = tsProj()

const dest = './bin'

gulp.task('build-helper', (cb) => {
  const tsProj = ts.createProject('tsconfig.json',
    { declaration: false, target: 'es5' })
  const tsc = tsProj()
  gulp.src('./src/client*.ts').pipe(tsc)
  pump(
    tsc.js,
    ugly(),
    gulp.dest(dest),
    cb)
})

gulp.task('build', ['build-helper'], () => {
  tsProj.src().pipe(maps.init()).pipe(tsc)

  return merge(
    tsc.js.pipe(maps.write()).pipe(gulp.dest(dest)),
    tsc.dts.pipe(gulp.dest(dest))
  )
})

gulp.task('default', ['build'])

gulp.task('watch', () => {
  gulp.watch('./src/**/*.ts', ['build', 'tslint'])
})

gulp.task('tslint', () => {
  return tsProj.src()
    .pipe(tslint({ formatter: 'prose' }))
    .pipe(tslint.report({ emitError: false }))
})
