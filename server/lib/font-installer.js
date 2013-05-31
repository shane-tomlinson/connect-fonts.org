/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const npm           = require("npm");
const path          = require("path");
const matchmodule   = require("matchmodule");
const util          = require("./util");
const timebot       = require("timebot");
const dependencies  = require(path.join(__dirname, "..", "..", "package.json")).dependencies;

const PACKAGE_QUERY = "connect-fonts-";

/**
 * A list of packages with the connect-fonts prefix that should
 * not be installed
 */
const PACKAGE_BLACKLIST = [
  "connect-fonts",
  "connect-fonts-tools",
  "connect-fonts-example"
];

var fontMiddleware;

function shouldInstallPackage(packageName) {
  return !(dependencies[packageName] || PACKAGE_BLACKLIST.indexOf(packageName) > -1);
}

function getUpdateMinutes(updateIntervalMins) {
  updateIntervalMins = updateIntervalMins || 10;
  var updateTimes = [];

  for (var i = 0; i < 60; ++i) {
    if ((i % updateIntervalMins) === 0) {
      updateTimes.push(i);
    }
  }

  return updateTimes.join(',');
}

exports.setup = function(options, done) {
  options = options || {};
  fontMiddleware = options.fontMiddleware;

  exports.loadInstalled(function(err) {
    if (err) return done(err);
    exports.loadNew(function(err) {
      if (err) return done(err);

      // Refresh the font list from npm every updateIntervalMins
      timebot.set({
        path: 'load new fonts',
        minute: getUpdateMinutes(options.updateIntervalMins)
      }, {
        cron: function() {
          console.log("refreshing font list");
          exports.loadNew();
        }
      });
    });
  });
};

function registerFontPack(packageName, done) {
  try {
    var fontPack = require(packageName);
    dependencies[packageName] = true;
    fontMiddleware.registerFontPack(fontPack, done);
  } catch(e) {
    done(e);
  }
}

/**
 * Load font packs already installed in the node_modules directory
 * @method loadInstalled
 * @param {function} done
 */
exports.loadInstalled = function(done) {
  console.log("searching for installed fonts");
  var packageNames = matchmodule.filter(PACKAGE_QUERY + '*');
  console.log(packageNames.length + " potential installed font packs found");

  util.asyncForEach(packageNames, function(packageName, index, next) {
    console.log(packageName);
    if ( ! shouldInstallPackage(packageName)) return next();

    registerFontPack(packageName, next);
  }, done);
};

/**
 * Load new fonts from the npmjs.org repository
 * @method loadNew
 * @param {function} done
 */
exports.loadNew = function(done) {
  console.log("searching for new fonts on npm");
  npm.load(function(err) {
    if (err) return done(err);

    npm.commands.search(PACKAGE_QUERY, true, function(err, packages) {
      if (err) return done(err);

      var packageNames = Object.keys(packages);

      console.log(packageNames.length + " potential npm font packs found");

      util.asyncForEach(packageNames, function(packageName, index, next) {
        console.log(packageName);
        if ( ! shouldInstallPackage(packageName)) return next();

        npm.commands.install([packageName], function(err) {
          if (err) return done(err);

          registerFontPack(packageName, next);
        });
      }, done);
    });
  });
};

