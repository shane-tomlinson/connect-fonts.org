/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

exports.asyncForEach = function(array, cb, done) {
  next(null);

  var index = 0;
  function next(err) {
    if (err) return done && done(err);

    var item = array.shift();
    if (!item) return done && done(null);
    var idx = index;
    index++;
    cb(item, idx, next);
  }
};


