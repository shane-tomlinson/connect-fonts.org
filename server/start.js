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

app.engine('.html', cons.swig);
app.set('view engine', 'html');

swig.init({
  root: TEMPLATE_PATH,
  allowErrors: true
});


app.set('views', TEMPLATE_PATH);

app.use(connect_fonts.setup({
  fonts: [ fontpack_opensans, fontpack_roboto ],
  allow_origin: "http://www.connect-fonts.org",
  maxage: 180 * 24 * 60 * 60 * 1000,   // 180 days
  compress: true,
  ua: 'all'
}));

// Force a refresh of the font list.
fontpack_installer.setup({
  fontMiddleware: connect_fonts
}, function(err) {
  if (err) return err;

  fontpack_installer.loadInstalled(function(err) {
    if (err) return err;

    fontpack_installer.loadNew(function(err) {
      if (err) return err;
    });
  });
});

app.use(express.static(STATIC_PATH));

app.get('/', function (req, res) {
  res.render('index.html', {});
});

app.get('/fonts', function (req, res) {
  var fontNames = Object.keys(connect_fonts.fontConfigs).join(",");
  res.render('font-list.html', {
    fontNames: fontNames,
    fonts: connect_fonts.fontConfigs
  });
});

app.get('/fonts/reload', function(req, res) {
  refreshFonts(function() {});
  res.redirect('/fonts');
});

app.get('/font/:name', function (req, res) {
  var fontName = req.params.name;
  var fontConfig = connect_fonts.fontConfigs[fontName];
  if (fontConfig) {
    fontConfig.name = fontName;

    res.render('font-detail.html', {
      font: fontConfig
    });
  }
  else {
    res.send("Unknown font", 404);
  }
});

console.log("Listening on", IP_ADDRESS + ":" + PORT);
app.listen(PORT);//, IP_ADDRESS);

