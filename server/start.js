const express         = require('express');
const swig            = require('swig');
const url             = require('url');
const path            = require('path');
const fs              = require('fs');
const http            = require('http');
const spdy            = require('spdy');
const helmet          = require('helmet');
const rum_diary_endpoint
                      = require('rum-diary-endpoint');
const connect_fonts   = require('connect-fonts');
const fontpack_quicksand
                      = require('connect-fonts-quicksand');
const fontpack_roboto
                      = require('connect-fonts-roboto');
const fontpack_installer
                      = require('./lib/font-installer');
const font_packs      = require('./lib/font-packs');

const app             = express();

const IP_ADDRESS      = process.env.IP_ADDRESS || "127.0.0.1";
const HTTP_PORT       = process.env.HTTP_PORT || 3000;
const SSL_PORT        = process.env.SSL_PORT || 3433;

const TEMPLATE_PATH   = path.join(__dirname, 'views');
const STATIC_PATH     = path.join(__dirname, '..', 'client');

const SSL_CERT_PATH   = path.join(__dirname, '..', 'cert');

const DEFAULT_SAMPLE_TEXT
                      = "Grumpy wizards make toxic brew for the evil Queen and Jack.";

app.engine('html', swig.renderFile);
app.set('view engine', 'html');
app.set('views', TEMPLATE_PATH);

// Swig will cache templates for you, but you can disable
// that and use Express's caching instead, if you like:
app.set('view cache', false);

swig.setDefaults({
  cache: false
});


app.set('views', TEMPLATE_PATH);
app.set('view cache', false);

// Redirect all http traffic to https
app.use(function(req, res, next) {
  console.log("received request: ", req.url);
  if (!req.secure) {
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

var fontMiddleware = connect_fonts.setup({
  fonts: [ fontpack_quicksand, fontpack_roboto ],
  allow_origin: "http://connect-fonts.org",
  maxage: 180 * 24 * 60 * 60 * 1000,   // 180 days
  compress: true,
  ua: 'all'
});

app.use(fontMiddleware);

font_packs.setup({
  fontConfigs: fontMiddleware.fontConfigs
});

// Force a refresh of the font list.
fontpack_installer.setup({
  fontMiddleware: fontMiddleware,
  updateIntervalMins: 10
}, function(err) {
  if (err) return err;

  font_packs.update(fontMiddleware.fontConfigs);
});

app.use(express.cookieParser());
app.use(express.bodyParser());
app.use(helmet());


const httpCollector = new rum_diary_endpoint.collectors.Http({
  collectorUrl: 'https://rum-diary.org/load',
  maxCacheSize: 1
});

const metricsMiddleware = rum_diary_endpoint.setup({
  endpoint: '/metrics',
  collectors: [ httpCollector ]
});

app.use(metricsMiddleware);

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

