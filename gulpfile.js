const gulp = require('gulp')
const merge = require('merge-stream')
const ts = require('gulp-typescript')
const maps = require('gulp-sourcemaps')
const tsProj = ts.createProject('tsconfig.json')
const tslint = require('gulp-tslint')
const tsc = tsProj()

const dest = './bin'

gulp.task('build', () => {
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
