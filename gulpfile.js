const gulp = require('gulp')
const merge = require('merge-stream')
const ts = require('gulp-typescript')
const tsProj = ts.createProject('tsconfig.json')

const dest = './bin'

gulp.task('build', function (cb) {
  let tsc = tsProj()

  tsProj.src().pipe(tsc)

  return merge(
    tsc.js.pipe(gulp.dest(dest)),
    tsc.dts.pipe(gulp.dest(dest))
  )
})

gulp.task('default', ['build'])

gulp.task('watch', function () {
  gulp.watch('./src/**/*.ts', ['build'])
})
