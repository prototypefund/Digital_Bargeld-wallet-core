/*
 This file is part of TALER
 (C) 2015-2016 GNUnet e.V.

 TALER is free software; you can redistribute it and/or modify it under the
 terms of the GNU General Public License as published by the Free Software
 Foundation; either version 3, or (at your option) any later version.

 TALER is distributed in the hope that it will be useful, but WITHOUT ANY
 WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 A PARTICULAR PURPOSE.  See the GNU General Public License for more details.

 You should have received a copy of the GNU General Public License along with
 TALER; see the file COPYING.  If not, see <http://www.gnu.org/licenses/>
 */

"use strict";

/**
 * Run with
 * $ gulp <taskname>
 *
 * The important tasks are:
 * - tsconfig: generate tsconfig.json file for
 *   development
 * - package: create Chrome extension zip file in
 *   dist/.
 *
 * @author Florian Dold
 */

const gulp = require("gulp");
const map = require("map-stream");
const zip = require("gulp-zip");
const gzip = require("gulp-gzip");
const rename = require("gulp-rename");
const tar = require("gulp-tar");
const glob = require("glob");
const jsonTransform = require("gulp-json-transform");
const fs = require("fs");
const through = require("through2");
const File = require("vinyl");
const Stream = require("stream").Stream;
const vfs = require("vinyl-fs");
const webpack = require("webpack");
const po2json = require("po2json");
const path = require("path");

const paths = {
  ts: {
    src: [
      "src/**/*.{ts,tsx,js}",
      "!src/**/*-test*.ts",
    ],
    test: [
        "src/**/*-test*.ts",
    ],
  },
  // distributed in the chrome extension
  dist: [
    "dist/*-bundle.js",
    "dist/*-bundle.js.map",
    "img/icon.png",
    "img/logo.png",
    "src/webex/**/*.{js,css,html}",
  ],
  // for the source distribution
  extra: [
      "AUTHORS",
      "COPYING",
      "Makefile",
      "README",
      "configure",
      "gulpfile.js",
      "manifest.json",
      "package.json",
      "src/i18n/*.po",
      "src/i18n/*.pot",
      "src/i18n/poheader",
      "src/i18n/strings-prelude",
      "tooling/**",
      "tsconfig.json",
      "webpack.config.js",
  ],
};


const tsBaseArgs = {
  target: "es6",
  jsx: "react",
  reactNamespace: "React",
  experimentalDecorators: true,
  module: "commonjs",
  sourceMap: true,
  lib: ["es6", "dom"],
  noImplicitReturns: true,
  noFallthroughCasesInSwitch: true,
  strict: true,
  strictPropertyInitialization: false,
  outDir: "dist/node",
  noImplicitAny: true,
  allowJs: true,
  checkJs: true,
  incremental: true,
  esModuleInterop: true,
};


const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));


// Concatenate node streams,
// taken from dominictarr's event-stream module
function concatStreams (...streams) {
  var stream = new Stream();
  stream.setMaxListeners(0); // allow adding more than 11 streams
  var endCount = 0;
  stream.writable = stream.readable = true;

  streams.forEach(function (e) {
    e.pipe(stream, {end: false});
    var ended = false;
    e.on('end', function () {
      if (ended) return;
      ended = true;
      endCount++;
      if (endCount == streams.length)
        stream.emit('end');
    })
  });
  stream.write = function (data) {
    this.emit('data', data);
  };
  stream.destroy = function () {
    streams.forEach(function (e) {
      if (e.destroy) e.destroy();
    })
  };
  return stream;
}



function dist_prod() {
  return vfs.src(paths.dist, {base: ".", stripBOM: false})
            .pipe(gulp.dest("dist/ext/"));
}

function compile_prod(callback) {
  let config = require("./webpack.config.js")({ mode: "production" });
  webpack(config, function(err, stats) {
    if (err) {
      throw new gutil.PluginError("webpack", err);
    }
    if (stats.hasErrors() || stats.hasWarnins) {
      console.log("[webpack]", stats.toString({
        colors: true,
      }));
    }
    if (stats.hasErrors()) {
      callback(Error("webpack completed with errors"))
    } else {
      callback();
    }
  });
}


function manifest_stable() {
  return gulp.src("manifest.json")
             .pipe(jsonTransform((data) => {
               data.name = "GNU Taler Wallet";
               return data;
             }, 2))
             .pipe(gulp.dest("dist/ext/"));
}


function manifest_unstable() {
  return gulp.src("manifest.json")
             .pipe(jsonTransform((data) => {
               data.name = "GNU Taler Wallet (unstable)";
               return data;
             }, 2))
             .pipe(gulp.dest("dist/ext/"));
}


function package_stable () {
  let basename = String.prototype.concat("taler-wallet-stable-", manifest.version_name, "-", manifest.version);
  let zipname = basename + ".zip";
  let xpiname = basename + ".xpi";
  return gulp.src("dist/ext/**", {buffer: false, stripBOM: false})
             .pipe(zip(zipname))
             .pipe(gulp.dest("dist/"));
}

function package_unstable () {
  let basename = String.prototype.concat("taler-wallet-unstable-", manifest.version_name, "-",  manifest.version);
  let zipname = basename + ".zip";
  let xpiname = basename + ".xpi";
  return gulp.src("dist/ext/**", {buffer: false, stripBOM: false})
             .pipe(zip(zipname))
             .pipe(gulp.dest("dist/"));
}


/**
 * Create source distribution.
 */
function srcdist() {
  const name = String.prototype.concat("taler-wallet-webex-", manifest.version_name);
  const opts = {buffer: false, stripBOM: false, base: "."};
  // We can't just concat patterns due to exclude patterns
  const files = concatStreams(
      gulp.src(paths.ts.src, opts),
      gulp.src(paths.ts.test, opts),
      gulp.src(paths.dist, opts),
      gulp.src(paths.extra, opts));

  return files
      .pipe(rename(function (p) { p.dirname = name + "/" + p.dirname; }))
      .pipe(tar(name + "-src.tar"))
      .pipe(gzip())
      .pipe(gulp.dest("."));
}


/**
 * Extract .po files from source code
 */
gulp.task("pogen", function (cb) {
  throw Error("not yet implemented");
});


/**
 * Generate a tsconfig.json with the
 * given compiler options that compiles
 * all files piped into it.
 */
function genTSConfig(confBase) {
  let conf = {
    compileOnSave: true,
    compilerOptions: {},
    files: []
  };
  Object.assign(conf.compilerOptions, confBase);
  return through.obj(function (file, enc, cb) {
    conf.files.push(file.relative);
    cb();
  }, function (cb) {
    conf.files.sort();
    let x = JSON.stringify(conf, null, 2);
    let f = new File({
      path: "tsconfig.json",
      contents: Buffer.from(x),
    });
    this.push(f);
    cb();
  });
}


/**
 * Get the content of a Vinyl file object as a buffer.
 */
function readContentsBuffer(file, cb) {
  if (file.isBuffer()) {
    cb(file.contents);
    return;
  }
  if (!file.isStream()) {
    throw Error("file must be stream or buffer");
  }
  const chunks = [];
  file.contents.on("data", function (chunk) {
    if (!Buffer.isBuffer(chunk)) {
      throw Error("stream data must be a buffer");
    }
    chunks.push(chunk);
  });
  file.contents.on("end", function (chunk) {
    cb(Buffer.concat(chunks));
  });
  file.contents.on("error", function (err) {
    cb(undefined, err);
  });
}


/**
 * Combine multiple translations (*.po files) into
 * one JavaScript file.
 */
function pofilesToJs(targetPath) {
  const outStream = through();
  const f = new File({
    path: targetPath,
    contents: outStream,
  });
  const prelude = fs.readFileSync("./src/i18n/strings-prelude");
  outStream.write(prelude);
  return through.obj(function (file, enc, cb) {
    console.log("processing file", file);
    readContentsBuffer(file, function (buf, error) {
      console.log("got contents");
      if (error) {
        throw error;
      }
      const lang = path.basename(file.path, ".po");
      if (!lang) {
        throw Error();
      }
      console.log("lang", lang);
      const pojson = po2json.parse(buf, {format: "jed1.x", fuzzy: true});
      outStream.write("strings['" + lang + "'] = " + JSON.stringify(pojson, null, "  ") + ";\n");
      console.log("...done");
      cb();
    });
  }, function (cb) {
    console.log("processing done");
    outStream.end();
    this.push(f);
    cb();
  });
}


function tsconfig() {
  let opts = {base: "."};
  const files = concatStreams(
          vfs.src(paths.ts.src, opts),
          vfs.src(paths.ts.test, opts));
  return files.pipe(genTSConfig(tsBaseArgs))
              .pipe(gulp.dest("."));
}


function po2js() {
  return gulp.src("src/i18n/*.po", {base: "."})
             .pipe(pofilesToJs("src/i18n/strings.ts"))
             .pipe(gulp.dest("."));
}


exports.srcdist = srcdist
exports.tsconfig = tsconfig
exports.po2js = po2js
exports.stable = gulp.series(tsconfig, manifest_stable, compile_prod, dist_prod, package_stable)
exports.default = exports.stable
