var assert = require('assert');
var Pool = require('./');

var pg = Pool('heroku-postgresql', 'ci-herokuaddonpool', {
  'config': /(HEROKU_POSTGRESQL|DATABASE)\S*URL/g,
  'log': true
});

var tcona, tconb, tconc;
pg.setup().then((ans) => {
  var cona = 'consumer-a';
  var conb = 'consumer-b';
  var conc = 'consumer-c';
  var supplies = ans.size;
  pg.remove(cona).then((ans) => {
    tcona = Date.now();
    console.log(`${cona} has acquired ${ans.name}`);
    console.log(`-> connection string: ${ans.value}`);
    // consumer-a uses database for 20s
    setTimeout(() => {
      console.log(`${cona} is releasing ${ans.name}`);
      pg.add(cona);
    }, 20000);
  }).then(() => {
    return pg.remove(conb);
  }).then((ans) => {
    tconb = Date.now();
    console.log(`${conb} has acquired ${ans.name}`);
    console.log(`-> connection string: ${ans.value}`);
    // consumer-b uses database for 10s
    setTimeout(() => {
      console.log(`${conb} is releasing ${ans.name}`);
      pg.add(conb);
    }, 10000);
  }).then(() => {
    return pg.remove(conc);
  }).then((ans) => {
    // consumer-c waits for 10s until consumer-b releases
    tconc = Date.now();
    var tdiff = tconc - tconb;
    assert.ok(tdiff>=10000 && tdiff<=20000);
    console.log(`${conc} has acquired ${ans.name}`);
    console.log(`-> connection string: ${ans.value}`);
    // consumer-c uses database for 10s
    setTimeout(() => {
      console.log(`${conc} is releasing ${ans.name}`);
      pg.add(conc);
    }, 10000);
  });
});
