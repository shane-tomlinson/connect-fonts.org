/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const util = require('./util');

/**
 * Font pack config access functions
 */

var fontConfigs;
var families;

exports.setup = function(config, done) {
  fontConfigs = config.fontConfigs;

  done && done(null);
};

exports.update = function(fontConfigs, done) {
  fontConfigs = fontConfigs;
  families = null;

  done(null);
};

/**
 * Get all font configurations for all families. Each family will contain an array of
 * fonts. Calls done with a copy of all font configs that is safe to modify.
 */
exports.getAllFontsByFamily = function(done) {
  if (families) return done(null, util.deepCopy(families));

  // Sort fonts into families
  families = {};
  for (var fontName in fontConfigs) {
    var fontConfig = util.deepCopy(fontConfigs[fontName]);
    fontConfig.name = fontName;

    var family = fontConfig.fontFamily;

    if (!families[family])
      families[family] = {};

    families[family][fontName] = cleanupFontConfig(fontConfig);
  }

  done(null, util.deepCopy(families));
};

/**
 * Get the configuration for a single family
 */
exports.getFamily = function(familyName, done) {
  exports.getAllFontsByFamily(function(err, families) {
    if (err) return done(err);
    var family = families[familyName];
    if (!family) return done(null, null);

    var sortedFonts = {};
    Object.keys(family).sort().forEach(function(fontName) {
      sortedFonts[fontName] = family[fontName];
    });

    var cssNames = Object.keys(family);
    var familyInfo = {
      fonts: sortedFonts,
      cssNames: cssNames,
      packConfig: family[cssNames[0]].packConfig
    };
    done(null, familyInfo);
  });
};

/**
 * Get a list of all installed font families.
 * Each family will contain a sample font, which is normally
 * the "regular" font.
 */
exports.getFamilies = function(done) {
  // Find the "regular" font for each family
  exports.getAllFontsByFamily(function(err, families) {
    if (err) return done(err);

    var bestRegulars = {};
    Object.keys(families).sort().forEach(function(familyName) {
      var family = families[familyName];
      var bestRegularName = getRegularFontForFamily(family);
      var bestRegular = family[bestRegularName];

      bestRegular.cssname = bestRegularName;
      bestRegular.familyName = familyName;
      bestRegular.count = Object.keys(family).length;

      bestRegulars[bestRegularName] = bestRegular;
    });

    done(null, bestRegulars);
  });
};

/**
 * Get the configuration for a single font
 */
exports.getFont = function(fontName, done) {
  var fontConfig = fontConfigs[fontName];
  if (!fontConfig) return done(null, null);

  fontConfig = cleanupFontConfig(util.deepCopy(fontConfig));
  fontConfig.packConfig.count = Object.keys(fontConfig.packConfig.fonts).length;
  fontConfig.name = fontName;
  done(null, fontConfig);
};


function cleanupFontConfig(fontConfig) {
  try {
    fontConfig.packConfig.author.urls = fontConfig.packConfig.author.urls.split(',');
  } catch(e) {}
  try {
    fontConfig.packConfig.author.emails = fontConfig.packConfig.author.emails.split(',');
  } catch(e) {}
  try {
    fontConfig.packConfig.author.githubs = fontConfig.packConfig.author.githubs.split(',');
  } catch(e) {}

  return fontConfig;
}

function getRegularFontForFamily(family) {
  var fontNames = Object.keys(family);
  // try to find the best match.
  var bestRegular = fontNames.reduce(function(bestRegular, fontName) {
    if (fontName === bestRegular) return bestRegular;

    var fontConfig = family[fontName];

    if (fontConfig.fontWeight === 400 && fontConfig.fontStyle === "normal") {
      // If an exact match.
      return fontName;
    }
    else if (Math.abs(fontConfig.fontWeight - 400) < Math.abs(bestRegular.fontWeight - 400)) {
      // Otherwise, look for the closest font weight.
      return fontName;
    }

    return bestRegular;
  }, fontNames[0]);

  return bestRegular;
}


