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
const font_packs      = require('./lib/font-packs');
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

font_packs.setup({
  fontConfigs: connect_fonts.fontConfigs
});

// Force a refresh of the font list.
fontpack_installer.setup({
  fontMiddleware: connect_fonts,
  updateIntervalMins: 10
}, function(err) {
  if (err) return err;

  font_packs.update(connect_fonts.fontConfigs);
});

app.use(express.cookieParser());
app.use(express.bodyParser());
app.use(express.static(STATIC_PATH));

app.get('/', function (req, res) {
  res.render('index.html', {});
});

app.get('/families', function (req, res) {
  font_packs.getFamilies(function(err, families) {
    var cssNames = Object.keys(families).join(",");

    res.render('family-list.html', {
      cssNames: cssNames,
      fonts: families
    });
  });
});

app.get('/family/:name', function (req, res) {
  var familyName = req.params.name;
  font_packs.getFamily(familyName, function(err, familyConfig) {
    if (err || !familyConfig) {
      return res.send("Unknown font", 404);
    }

    var cssNames = familyConfig.cssNames;
    if (cssNames.length === 1) {
      // if there is only one font in the family, redirect
      // straight to that font.
      res.redirect('/font/' + cssNames[0]);
    }
    else {
      util.print(Object.keys(familyConfig.packConfig.font_common));
      familyConfig.sampletext = getSampleText(req);
      res.render('family-detail.html', familyConfig);
    }
  });
});

app.get('/font/:name', function (req, res) {
  var fontName = req.params.name;
  font_packs.getFont(fontName, function(err, fontConfig) {
    if (err || !fontConfig) return res.send("unknown font", 404);

    res.render('font-detail.html', {
      font: fontConfig,
      sampletext: getSampleText(req)
    });
  });
});

app.get('/reload', function(req, res) {
  fontpack_installer.loadNew();
  res.redirect('/fonts');
});


// Set the users sample text.
app.post('/sampletext', function(req, res) {
  var sampleText = req.body.sampletext;
  if (sampleText) {
    res.cookie('sampletext', sampleText, {
      expires: new Date(Date.now() + 900000),
      httpOnly: true
    });
    res.redirect(303, req.headers.referer);
  }
});

app.post('/delete-sampletext', function(req, res) {
  res.clearCookie('sampletext', {});
  res.redirect(303, req.headers.referer);
});


function getSampleText(req) {
  var sampleText = req.cookies && req.cookies.sampletext;
  if (!sampleText) sampleText = DEFAULT_SAMPLE_TEXT;
  return sampleText;
}

console.log("Listening on", IP_ADDRESS + ":" + PORT);
app.listen(PORT);//, IP_ADDRESS);

