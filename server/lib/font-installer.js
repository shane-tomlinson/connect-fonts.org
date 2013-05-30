/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const npm           = require("npm");
const path          = require("path");
const util          = require("./util");
const dependencies  = require(path.join(__dirname, '..', '..', 'package.json')).dependencies;

/**
 * A list of packages with the connect-fonts prefix that should
 * not be installed
 */
const PACKAGE_BLACKLIST = [
  "connect-fonts",
  "connect-fonts-tools",
  "connect-fonts-example"
];

function shouldInstallPackage(packageName) {
  return !(dependencies[packageName] || PACKAGE_BLACKLIST.indexOf(packageName) > -1);
}

/**
 * Load new fonts from the npmjs.org repository
 * @method load
 * @param {function} done
 *     called with two parameters, err and a list of new font packages.
 */
exports.load = function(done) {
  console.log("searching for fonts");
  npm.load(function(err) {
    if (err) return done(err);

    var query = "connect-fonts-";
    npm.commands.search(query, true, function(err, packages) {
      if (err) return done(err);

      var packageNames = Object.keys(packages);
      var installedPackages = [];

      console.log(packageNames.length + " potential font packs found");

      util.asyncForEach(packageNames, function(packageName, index, next) {
        console.log(packageName);
        if ( ! shouldInstallPackage(packageName)) return next();

        dependencies[packageName] = true;

        npm.commands.install([packageName], function(err) {
          if (err) return done(err);

          // XXX once the font is installed, use an event emitter to signal to
          // some other unit that it can display the new font.
          installedPackages.push(packageName);
          next();
        });
      }, function(err) {
        done(err, !err && installedPackages);
      });
    });
  });
};