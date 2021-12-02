const ts = require("gulp-typescript");
const tsProject = ts.createProject("tsconfig.json");
const gulp = require("gulp");
const clean = require("gulp-clean"); //清理文件或文件夹
var merge = require("merge2");
gulp.task("clean", function () {
  return gulp.src("lib/*", { read: false }).pipe(clean());
});

gulp.task("tsc", function () {
  var tsResult = tsProject.src().pipe(tsProject());
  return merge([
    tsResult.dts.pipe(gulp.dest("lib")),
    tsResult.js.pipe(gulp.dest("lib")),
  ]);
});
gulp.task("copy_file", function () {
  return gulp
    .src(["./src/**/*.js", "./src/**/*.json"], { base: "./src" })
    .pipe(gulp.dest("lib"));
});

gulp.task("default", gulp.series("clean", "tsc", "copy_file"));
