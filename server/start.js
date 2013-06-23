const express         = require('express');
const cons            = require('consolidate');
const swig            = require('swig');
const path            = require('path');
const connect_fonts   = require('connect-fonts');
const fontpack_opensans
                      = require('connect-fonts-opensans');
const fontpack_roboto
                      = require('connect-fonts-roboto');
const fontpack_installer
                      = require('./lib/font-installer');
const util            = require('./lib/util');
const app             = express();

const IP_ADDRESS      = process.env.IP_ADDRESS || "127.0.0.1";
const PORT            = process.env.PORT || 3000;

const TEMPLATE_PATH   = path.join(__dirname, 'views');
const STATIC_PATH     = path.join(__dirname, '..', 'client');

const DEFAULT_SAMPLE_TEXT
                      = "Grumpy wizards make toxic brew for the evil Queen and Jack.";

app.engine('.html', cons.swig);
app.set('view engine', 'html');

swig.init({
  root: TEMPLATE_PATH,
  allowErrors: true,
  cache: false
});


app.set('views', TEMPLATE_PATH);

app.use(connect_fonts.setup({
  fonts: [ fontpack_opensans, fontpack_roboto ],
  allow_origin: "http://connect-fonts.org",
  maxage: 180 * 24 * 60 * 60 * 1000,   // 180 days
  compress: true,
  ua: 'all'
}));

// Force a refresh of the font list.
fontpack_installer.setup({
  fontMiddleware: connect_fonts,
  updateIntervalMins: 5
}, function(err) {
  if (err) return err;
});

app.use(express.cookieParser());
app.use(express.bodyParser());
app.use(express.static(STATIC_PATH));

app.get('/', function (req, res) {
  res.render('index.html', {});
});

/**
 * Get font configurations by family. Each family will contain an array of
 * fonts.
 */
var families;
function getFamilies(fontConfigs) {
  if (families) return families;

  // Sort fonts into families
  families = {};
  for (var fontName in fontConfigs) {
    var fontConfig = fontConfigs[fontName];
    fontConfig.name = fontName;

    var family = fontConfig.fontFamily;

    if (!families[family])
      families[family] = {};

    families[family][fontName] = fontConfig;
  }


  return families;
}

function getRegularFontsForFamilies(families) {
  // Find the "regular" font for each family
  var bestRegulars = {};
  for (var familyName in families) {
    var family = families[familyName];
    var bestRegularName = getRegularFontForFamily(family);
    var bestRegular = family[bestRegularName];

    bestRegular.cssname = bestRegularName;
    bestRegular.familyName = familyName;

    bestRegulars[bestRegularName] = bestRegular;
  }

  return bestRegulars;
}

function getRegularFontForFamily(family) {
  var fontNames = Object.keys(family);
  // try to find the best match.
  var bestRegular = fontNames.reduce(function(bestRegular, fontName) {
    var fontConfig = family[fontName];
    if (fontConfig === bestRegular) return fontName;

    if (fontConfig.fontWeight === 400 && fontConfig.fontStyle === "normal") {
      // If an exact match.
      return fontName;
    }
    else if (Math.abs(fontConfig.fontWeight - 400) < Math.abs(bestRegular.fontWeight - 400)) {
      // Otherwise, look for the closest font weight.
      return fontName;
    }

    return bestRegular;
  }, family[fontNames[0]]);

  return bestRegular;
}


app.get('/fonts', function (req, res) {
  var families = getFamilies(connect_fonts.fontConfigs);
  var familyExampleFonts = getRegularFontsForFamilies(families);
  var cssNames = Object.keys(familyExampleFonts).join(",");

  res.render('font-list.html', {
    cssNames: cssNames,
    families: familyExampleFonts
  });
});

app.get('/fonts/reload', function(req, res) {
  fontpack_installer.loadNew();
  families = null;
  res.redirect('/fonts');
});

// Set the users sample text.
app.post('/sampletext', function(req, res) {
  var sampleText = req.body.sampletext;
  if (sampleText) {
    res.cookie('sampletext', sampleText, {
      path: '/font',
      expires: new Date(Date.now() + 900000),
      httpOnly: true
    });
    res.redirect(303, req.headers.referer);
  }
});

app.post('/delete-sampletext', function(req, res) {
  res.clearCookie('sampletext', { path: '/font' });
  res.redirect(303, req.headers.referer);
});

app.get('/family/:name', function (req, res) {
  var familyName = req.params.name;
  var familyConfig = getFamilies(connect_fonts.fontConfigs)[familyName];

  if (familyConfig) {
    familyConfig = util.deepCopy(familyConfig);
    var fontNames = Object.keys(familyConfig).join(",");
    res.render('family-detail.html', {
      fontNames: fontNames,
      fonts: familyConfig
    });
  }
  else {
    res.send("Unknown font", 404);
  }
});

app.get('/font/:name', function (req, res) {
  var fontName = req.params.name;
  var fontConfig = connect_fonts.fontConfigs[fontName];
  if (fontConfig) {
    fontConfig = util.deepCopy(fontConfig);
    fontConfig.name = fontName;
    try {
      fontConfig.packConfig.author.urls = fontConfig.packConfig.author.urls.split(',');
    } catch(e) {}
    try {
      fontConfig.packConfig.author.emails = fontConfig.packConfig.author.emails.split(',');
    } catch(e) {}
    try {
      fontConfig.packConfig.author.githubs = fontConfig.packConfig.author.githubs.split(',');
    } catch(e) {}

    res.render('font-detail.html', {
      font: fontConfig,
      sampletext: getSampleText(req)
    });
  }
  else {
    res.send("Unknown font", 404);
  }
});

function getSampleText(req) {
  var sampleText = req.cookies && req.cookies.sampletext;
  if (!sampleText) sampleText = DEFAULT_SAMPLE_TEXT;
  return sampleText;
}

console.log("Listening on", IP_ADDRESS + ":" + PORT);
app.listen(PORT);//, IP_ADDRESS);

