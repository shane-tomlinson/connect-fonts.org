const express         = require('express');
const cons            = require('consolidate');
const swig            = require('swig');
const path            = require('path');
const connect_fonts   = require('connect-fonts');
const fontpack_opensans
                      = require('connect-fonts-opensans');
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
  fonts: [ fontpack_opensans ],
  allow_origin: "*",
  maxage: 180 * 24 * 60 * 60 * 1000,   // 180 days
  ua: 'all'
}));

app.use(express.static(STATIC_PATH));

app.get('/', function (req, res) {
  res.render('index.html', { foo: 'bar' });
});

console.log("Listening on", IP_ADDRESS + ":" + PORT);
app.listen(PORT, IP_ADDRESS);

