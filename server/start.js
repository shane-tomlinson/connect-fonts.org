const express         = require('express');
const cons            = require('consolidate');
const swig            = require('swig');
const url             = require('url');
const path            = require('path');
const fs              = require('fs');
const http            = require('http');
const spdy            = require('spdy');
const helmet          = require('helmet');
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
const HTTP_PORT       = process.env.HTTP_PORT || 3000;
const SSL_PORT        = process.env.SSL_PORT || 3433;

const TEMPLATE_PATH   = path.join(__dirname, 'views');
const STATIC_PATH     = path.join(__dirname, '..', 'client');

const SSL_CERT_PATH   = path.join(__dirname, '..', 'cert');

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

// Redirect all http traffic to https
app.use(function(req, res, next) {
 if(!req.secure) {
    var urlObj = url.parse(req.protocol + "://" + req.get('Host') + req.url);
    if (urlObj.host.indexOf(":" + HTTP_PORT) > -1) {
      urlObj.host = urlObj.host.replace(":" + HTTP_PORT, ":" + SSL_PORT);
    }
    urlObj.protocol = "https";

    var redirectTo = url.format(urlObj);
    res.redirect(redirectTo, 301);
  } else {
    next();
  }
});

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
helmet.defaults(app);

app.use(express.static(STATIC_PATH));

app.get('/', function (req, res) {
  res.render('index.html', {});
});

app.get('/families', function (req, res) {
  font_packs.getFamilies(function(err, families) {
    var cssNames = Object.keys(families).join(",");

    res.render('family-list.html', {
      cssNames: cssNames,
      fonts: families,
      sampletext: getSampleText(req)
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

var spdy_options = {
  key: fs.readFileSync(path.join(SSL_CERT_PATH, 'connect-fonts.org.key')),
  cert: fs.readFileSync(path.join(SSL_CERT_PATH, 'connect-fonts.org.crt')),
  ca: fs.readFileSync(path.join(SSL_CERT_PATH, 'connect-fonts.org.csr'))
};

console.log("HTTP Server listening on", IP_ADDRESS + ":" + HTTP_PORT);
var httpServer = http.createServer(app);
httpServer.listen(HTTP_PORT);

console.log("HTTPS Server listening on", IP_ADDRESS + ":" + SSL_PORT);
var spdyServer = spdy.createServer(spdy_options, app);
spdyServer.listen(SSL_PORT);

